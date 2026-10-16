import { readSession } from "@/lib/auth";
import { agentBuy, agentFromKey, LeashError } from "@/lib/agents";
import { getAgent } from "@/lib/store";
export const dynamic = "force-dynamic";
// Auth: `x-agent-key: hush_...` (agents, MCP) or an owner session + agentId (dApp).
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  let a = await agentFromKey(req.headers.get("x-agent-key"));
  if (!a) {
    const owner = await readSession(req);
    const cand = b.agentId ? await getAgent(String(b.agentId)) : null;
    if (owner && cand?.owner === owner) a = cand;
  }
  if (!a) return Response.json({ error: "unknown agent" }, { status: 401 });
  try {
    return Response.json(await agentBuy(a, String(b.listing), b.input, new URL(req.url).origin));
  } catch (e) {
    const status = e instanceof LeashError ? e.status : 500;
    return Response.json({ error: e instanceof Error ? e.message : String(e), blockedBy: e instanceof LeashError ? "leash" : undefined }, { status });
  }
}
