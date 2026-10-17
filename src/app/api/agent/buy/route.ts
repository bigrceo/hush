import { readSession } from "@/lib/auth";
import { agentBuy, agentFromKey, LeashError } from "@/lib/agents";
import { getAgent } from "@/lib/store";
import { raiseAlert } from "@/lib/alerts";
import { blockReason } from "@/lib/alertrules";
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
    // Leash blocks (not pool hiccups) notify the owner; the same block is reported at most once per 10 min.
    if (e instanceof LeashError && status !== 503 && status !== 404)
      await raiseAlert(a.owner, { kind: "blocked", agentId: a.id, agentName: a.name, message: `call to ${String(b.listing)} blocked (${blockReason(e.message)}): ${e.message}` }, 600_000);
    return Response.json({ error: e instanceof Error ? e.message : String(e), blockedBy: e instanceof LeashError ? "leash" : undefined }, { status });
  }
}
