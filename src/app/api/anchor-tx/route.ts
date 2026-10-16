import { RPC_URL } from "@/lib/config";
export const dynamic = "force-dynamic";
// Fallback for /verify when the browser can't reach a public RPC: returns the raw getTransaction result
// for a signature, untouched. The page still checks the memo and signer itself.
export async function GET(req: Request) {
  const sig = new URL(req.url).searchParams.get("sig") || "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) return Response.json({ error: "bad signature" }, { status: 400 });
  const r = await fetch(RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [sig, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }] }) });
  return Response.json(await r.json(), { headers: { "cache-control": "public, max-age=300" } });
}
