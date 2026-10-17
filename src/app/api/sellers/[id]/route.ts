import { readSession } from "@/lib/auth";
import { getSeller, setSellerActive } from "@/lib/sellers";
// Pause or resume a listing (owner only): { active: boolean }
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await readSession(req);
  const s = await getSeller((await ctx.params).id);
  if (!owner || !s || s.owner !== owner) return Response.json({ error: "not your listing" }, { status: 403 });
  const { active } = await req.json().catch(() => ({}));
  await setSellerActive(owner, s.id, !!active);
  return Response.json({ seller: await getSeller(s.id) });
}
