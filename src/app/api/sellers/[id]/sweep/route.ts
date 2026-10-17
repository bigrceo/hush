import { readSession } from "@/lib/auth";
import { getSeller, sweepSeller } from "@/lib/sellers";
export const maxDuration = 60;
// Sweeps the listing's one-time payees to the seller's wallet (owner only).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await readSession(req);
  const s = await getSeller((await ctx.params).id);
  if (!owner || !s || s.owner !== owner) return Response.json({ error: "not your listing" }, { status: 403 });
  return Response.json(await sweepSeller(s));
}
