import Anthropic from "@anthropic-ai/sdk";

// Vercel Edge Runtime を使用することで、無料枠でもタイムアウトを回避しやすくします
export const config = {
  runtime: 'edge',
};

const CONFIG = {
  MODEL: "claude-3-5-sonnet-20241022",
  MAX_TOKENS: 2000,
  SLIDE_COUNT_OPTIONS: ["5〜8枚", "10〜12枚", "15〜20枚"],
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
  USER_PROMPT_TEMPLATE: (data) => `以下の情報をもとに、スライド構成案を生成してください。

【テーマ】${data.theme}
【ターゲット】${data.target}
【目的・ゴール】${data.goal}
【伝えたい要点・メモ】
${data.notes}
【スライド枚数の目安】${data.slideCount}`,
};

export default async function handler(req) {
  // POST以外のメソッドは拒否
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const data = await req.json();
    const { theme, target, goal, notes, slideCount } = data;

    // 簡単な入力チェック
    if (!theme || !target || !goal || !notes || !slideCount) {
      return new Response(JSON.stringify({ error: "入力が不足しています。" }), { status: 400 });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });

    const encoder = new TextEncoder();
    
    // ストリーミングレスポンスの生成
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await anthropic.messages.create({
            model: CONFIG.MODEL,
            max_tokens: CONFIG.MAX_TOKENS,
            system: CONFIG.SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: CONFIG.USER_PROMPT_TEMPLATE({ theme, target, goal, notes, slideCount }),
              },
            ],
            stream: true,
          });

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text') {
              const text = event.delta.text;
              // SSE(Server-Sent Events)形式でデータをエンキュー
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err) {
          console.error("Anthropic Error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `AI通信エラー: ${err.message}` })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `サーバーエラー: ${err.message}` }), { status: 500 });
  }
}
