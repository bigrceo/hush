import { readSession } from "@/lib/auth";
import { getAgent } from "@/lib/store";
import { agentKeypair } from "@/lib/agents";
import { sweepDeposit, withdrawFromPool } from "@/lib/pool";
// Pays the agent's whole HUSH balance out of the pool to its owner. Owner only.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await readSession(req);
  const a = await getAgent((await ctx.params).id);
  if (!owner || !a || a.owner !== owner) return Response.json({ error: "not your agent" }, { status: 403 });
  await sweepDeposit(a.id, await agentKeypair(a.id)).catch(() => null);
  const r = await withdrawFromPool(a.id, owner);
  if (!r.sent) return Response.json({ error: "empty" }, { status: 400 });
  return Response.json({ signature: r.signatures[0], signatures: r.signatures, sol: r.sent / 1e9 });
}
