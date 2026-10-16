import { readSession } from "@/lib/auth";
import { proofFor } from "@/lib/epochs";
import { d1 } from "@/lib/store";
export const dynamic = "force-dynamic";
// Owner only: the inclusion proof for one of your agents' receipts.
export async function GET(req: Request, ctx: { params: Promise<{ nonce: string }> }) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const { nonce } = await ctx.params;
  const own = await (await d1()).prepare("SELECT 1 AS ok FROM receipts r JOIN agents a ON a.id = r.agent_id WHERE r.nonce = ? AND a.owner = ?").bind(nonce, owner).first();
  if (!own) return Response.json({ error: "not your receipt" }, { status: 403 });
  const p = await proofFor(nonce);
  if ("pending" in p) return Response.json({ pending: true, message: "This receipt joins the next epoch. Proofs appear once it is sealed." }, { status: 202 });
  return new Response(JSON.stringify(p, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="hush-proof-${nonce.slice(0, 10)}.json"` } });
}
