import { readSession } from "@/lib/auth";
import { getAgent, updateLeash } from "@/lib/store";
import { allListings } from "@/lib/sellers";
import { raiseAlert } from "@/lib/alerts";
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await readSession(req);
  const id = (await ctx.params).id;
  const a = await getAgent(id);
  if (!owner || !a || a.owner !== owner) return Response.json({ error: "not your agent" }, { status: 403 });
  const b = await req.json();
  const known = new Set((await allListings()).map((l) => l.id));
  await updateLeash(id, {
    dailyBudget: typeof b.dailyBudget === "number" && b.dailyBudget >= 0 ? b.dailyBudget : undefined,
    perCallCap: typeof b.perCallCap === "number" && b.perCallCap >= 0 ? b.perCallCap : undefined,
    allowlist: Array.isArray(b.allowlist) ? b.allowlist.filter((x: string) => known.has(x)) : undefined,
    frozen: typeof b.frozen === "boolean" ? b.frozen : undefined,
  });
  if (typeof b.frozen === "boolean" && b.frozen !== a.frozen)
    await raiseAlert(owner, { kind: b.frozen ? "frozen" : "unfrozen", agentId: id, agentName: a.name, message: b.frozen ? "kill switch on: agent frozen, every call is refused" : "agent unfrozen" });
  return Response.json({ agent: await getAgent(id) });
}
