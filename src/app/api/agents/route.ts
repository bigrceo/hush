import { readSession } from "@/lib/auth";
import { createAgent, agentBalance, agentKeypair, agentPendingDeposit } from "@/lib/agents";
import { sweepDeposit } from "@/lib/pool";
import { isFrozenAll, listAgents } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const list = await listAgents(owner);
  // Fold fresh deposits into the pool, then report the spendable (ledger) balance.
  await Promise.all(list.map(async (a) => sweepDeposit(a.id, await agentKeypair(a.id)).catch(() => null)));
  const agents = await Promise.all(list.map(async (a) => ({ ...a, balance: await agentBalance(a).catch(() => null), pendingDeposit: await agentPendingDeposit(a).catch(() => null) })));
  return Response.json({ agents, frozenAll: await isFrozenAll(owner) });
}
export async function POST(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const { name } = await req.json().catch(() => ({}));
  const { agent, apiKey } = await createAgent(owner, String(name ?? ""));
  return Response.json({ agent, apiKey });
}
