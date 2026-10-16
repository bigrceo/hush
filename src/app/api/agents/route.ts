import { readSession } from "@/lib/auth";
import { createAgent, agentBalance } from "@/lib/agents";
import { isFrozenAll, listAgents } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const list = await listAgents(owner);
  const agents = await Promise.all(list.map(async (a) => ({ ...a, balance: await agentBalance(a).catch(() => null) })));
  return Response.json({ agents, frozenAll: await isFrozenAll(owner) });
}
export async function POST(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const { name } = await req.json().catch(() => ({}));
  const { agent, apiKey } = await createAgent(owner, String(name ?? ""));
  return Response.json({ agent, apiKey });
}
