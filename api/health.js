export const config = { runtime: 'edge' };

export default async function handler(req) {
  return new Response(JSON.stringify({
    status: "ok",
    runtime: "edge",
    apiKeySet: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
