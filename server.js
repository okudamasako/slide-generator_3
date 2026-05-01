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
  MODEL: "claude-3-5-sonnet-20241022",
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

  // ---- Claude API呼び出し（タイムアウト付き） ----
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const response = await anthropic.messages.create(
      {
        model: CONFIG.MODEL,
        max_tokens: CONFIG.MAX_TOKENS,
        system: CONFIG.SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: CONFIG.USER_PROMPT_TEMPLATE({ theme, target, goal, notes, slideCount }),
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timer);

    const markdown = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    res.json({ markdown });
  } catch (err) {
    clearTimeout(timer);
    console.error("Claude API Error:", err);

    if (err.name === "AbortError") {
      return res.status(504).json({ error: "生成がタイムアウトしました（30秒）。もう一度お試しください。" });
    }
    if (err.status === 401) {
      return res.status(500).json({ error: "APIキーが無効です。管理者に連絡してください。" });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: "APIの利用上限に達しました。しばらく待ってから再試行してください。" });
    }
    if (err.status === 529) {
      return res.status(503).json({ error: "Claude APIが混雑しています。しばらく待ってから再試行してください。" });
    }
    res.status(500).json({ error: "生成中にエラーが発生しました。時間をおいて再試行してください。" });
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
