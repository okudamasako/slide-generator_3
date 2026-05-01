// ============================================================
// server.js — AIスライド構成案ジェネレーター バックエンド
// ============================================================
// 【遠隔修正ガイド】
//   プロンプトを変更したい場合 → CONFIG.SYSTEM_PROMPT を編集
//   モデルを変更したい場合   → CONFIG.MODEL を編集
//   トークン数を変更したい場合 → CONFIG.MAX_TOKENS を編集
//   ポートを変更したい場合   → .env の PORT を変更
// ============================================================

require("dotenv").config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// ★ 設定まとめ（ここを変更するだけで動作が変わります）
// ============================================================
const CONFIG = {
  // 変更前: "claude-sonnet-4-5" は存在しないためエラーになります
  // 変更後: 最新のClaude 3.5 Sonnetの正式なモデル名に変更します
  MODEL: "claude-3-haiku-20240307",
  // 変更前: 300 (検証用。わざと短くして10秒以内に生成を終わらせます)
  // 変更後: 2000 (元の十分な長さに戻します)
  MAX_TOKENS: 2000,
  TIMEOUT_MS: 30000,

  // スライド枚数の選択肢（フロントと合わせる）
  SLIDE_COUNT_OPTIONS: ["5〜8枚", "10〜12枚", "15〜20枚"],

  // ---- システムプロンプト（AIへの役割・出力ルール定義） ----
  SYSTEM_PROMPT: `あなたはプレゼン資料構成の専門家です。
ユーザーの入力をもとに、最適なスライド構成案をMarkdown形式で生成してください。

【出力ルール】
- Markdownのみを出力する。前置き・説明文・コメントは一切不要
- 各スライドは「---」で区切る
- 最初のスライドは「# タイトル」形式
- 各スライドの見出しは「## 見出し」形式
- 箇条書きは「- 」を使用
- 図解が効果的な箇所には「> 💡 [図解提案: ○○の図]」を挿入
- 指定された枚数目安に必ず従う
- タイトルスライド・まとめスライドも枚数に含める`,

  // ---- ユーザープロンプトのテンプレート ----
  USER_PROMPT_TEMPLATE: (data) => `以下の情報をもとに、スライド構成案を生成してください。

【テーマ】${data.theme}
【ターゲット】${data.target}
【目的・ゴール】${data.goal}
【伝えたい要点・メモ】
${data.notes}
【スライド枚数の目安】${data.slideCount}`,
};
// ============================================================

// ------------------------------------------------------------
// APIクライアント初期化（起動時にキーを確認）
// ------------------------------------------------------------
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ERROR: ANTHROPIC_API_KEY が .env に設定されていません");
  process.exit(1);
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ------------------------------------------------------------
// POST /api/generate — スライド構成案の生成
// ------------------------------------------------------------
app.post("/api/generate", async (req, res) => {
  const { theme, target, goal, notes, slideCount } = req.body;

  // ---- バリデーション ----
  const missing = [];
  if (!theme?.trim()) missing.push("テーマ");
  if (!target?.trim()) missing.push("ターゲット");
  if (!goal?.trim()) missing.push("目的・ゴール");
  if (!notes?.trim()) missing.push("伝えたい要点・メモ");
  if (!slideCount?.trim()) missing.push("スライド枚数");

  if (missing.length > 0) {
    return res.status(400).json({
      error: `入力が不足しています：${missing.join("、")}`,
    });
  }

  if (!CONFIG.SLIDE_COUNT_OPTIONS.includes(slideCount)) {
    return res.status(400).json({ error: "スライド枚数の値が不正です" });
  }

  // ---- ストリーミング通信 (SSE) の設定 ----
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Vercelなどでのバッファリングを無効化

  try {
    const stream = await anthropic.messages.stream({
      model: CONFIG.MODEL,
      max_tokens: CONFIG.MAX_TOKENS,
      system: CONFIG.SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: CONFIG.USER_PROMPT_TEMPLATE({ theme, target, goal, notes, slideCount }),
        },
      ],
    });

    // 1文字（数文字）生成されるたびにフロント画面へ送信
    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    // 生成が完了したときの合図を送信
    stream.on('end', () => {
      res.write(`data: [DONE]\n\n`);
      res.end();
    });

    // ストリーミング途中のエラー
    stream.on('error', (err) => {
      console.error("Stream error:", err);
      res.write(`data: ${JSON.stringify({ error: `ストリーミングが途絶えました: ${err.message}` })}\n\n`);
      res.end();
    });

  } catch (err) {
    console.error("Claude API Error:", err);
    let errMsg = `生成中にエラーが発生しました。(詳細: ${err.message})`;
    if (err.status === 401) errMsg = "APIキーが無効です。管理者に連絡してください。";
    if (err.status === 429) errMsg = "APIの利用上限に達しました。しばらく待ってから再試行してください。";
    if (err.status === 529) errMsg = "Claude APIが混雑しています。しばらく待ってから再試行してください。";
    
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// ------------------------------------------------------------
// GET /api/health — 死活確認（遠隔デバッグ用）
// ------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    model: CONFIG.MODEL,
    maxTokens: CONFIG.MAX_TOKENS,
    apiKeySet: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------------------------
// SPA フォールバック
// ------------------------------------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ------------------------------------------------------------
// サーバー起動 (ローカル用とVercel用で処理を分岐)
// ------------------------------------------------------------
// ローカル環境（Vercel以外）でのみポートを開いて待機します
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ サーバー起動: http://localhost:${PORT}`);
    console.log(`   モデル: ${CONFIG.MODEL}`);
    console.log(`   最大トークン: ${CONFIG.MAX_TOKENS}`);
  });
}

// Vercel のようなサーバーレス環境で Express アプリを動かすための設定
// これがないと Vercel 上でコネクションエラーが発生しやすくなります
module.exports = app;
