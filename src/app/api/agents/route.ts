import { readSession } from "@/lib/auth";
import { createAgent, agentBalance, agentKeypair, agentPendingDeposit } from "@/lib/agents";
import { sweepDeposit } from "@/lib/pool";
import { ownerTier } from "@/lib/tiers";
import { TOKEN } from "@/lib/token";
import { isFrozenAll, listAgents } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const list = await listAgents(owner);
  // Fold fresh deposits into the pool, then report the spendable (ledger) balance.
  await Promise.all(list.map(async (a) => sweepDeposit(a.id, await agentKeypair(a.id)).catch(() => null)));
  const agents = await Promise.all(list.map(async (a) => ({ ...a, balance: await agentBalance(a).catch(() => null), pendingDeposit: await agentPendingDeposit(a).catch(() => null) })));
  const { balance, tier } = await ownerTier(owner);
  return Response.json({ agents, frozenAll: await isFrozenAll(owner), holder: { hush: balance, tier: tier?.name ?? null, perk: tier?.perk ?? null, feePct: (TOKEN.feeBps / 100) * (1 - (tier?.discount ?? 0)), next: TOKEN.tiers.find((t) => t.min > balance) ?? null } });
}
export async function POST(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const { name } = await req.json().catch(() => ({}));
  const { agent, apiKey } = await createAgent(owner, String(name ?? ""));
  return Response.json({ agent, apiKey });
}
