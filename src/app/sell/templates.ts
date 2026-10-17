// Starter endpoints sellers can deploy in minutes, then list on /sell.
export interface Template { id: string; name: string; host: string; priceSol: string; description: string; input: string; sample: string; file: string; code: string }
export const TEMPLATES: Template[] = [
  {
    id: "worker-price", name: "Token price", host: "Cloudflare Worker", priceSol: "0.001", input: "mint", sample: "So11111111111111111111111111111111111111112",
    description: "USD price of any Solana mint from Jupiter, with a timestamp.", file: "worker.js",
    code: `export default {
  async fetch(req) {
    const mint = new URL(req.url).searchParams.get("mint");
    if (!mint) return Response.json({ error: "mint required" }, { status: 400 });
    const r = await fetch("https://lite-api.jup.ag/price/v3?ids=" + mint);
    const p = (await r.json())[mint];
    return Response.json({ mint, usd: p?.usdPrice ?? null, at: Date.now() });
  },
};`,
  },
  {
    id: "vercel-balance", name: "Wallet SOL balance", host: "Vercel function", priceSol: "0.001", input: "address", sample: "7aA3yg67uV8b4JBBaYimc8X4pBtrWMj2Mc8Ch9QVxXfy",
    description: "SOL balance of any wallet, straight from mainnet RPC.", file: "app/api/balance/route.ts",
    code: `export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address) return Response.json({ error: "address required" }, { status: 400 });
  const r = await fetch(process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
  });
  const { result } = await r.json();
  return Response.json({ address, sol: result.value / 1e9 });
}`,
  },
  {
    id: "py-signal", name: "Your own signal", host: "Python (FastAPI)", priceSol: "0.002", input: "mint", sample: "",
    description: "Whatever your script knows about a mint: score, notes, alerts.", file: "main.py",
    code: `from fastapi import FastAPI

app = FastAPI()

@app.get("/signal")
def signal(mint: str):
    # plug in your own model, DB or scraper here
    score = my_score(mint)
    return {"mint": mint, "score": score}`,
  },
];
