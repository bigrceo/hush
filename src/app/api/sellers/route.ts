import { readSession } from "@/lib/auth";
import { createSeller, listSellers, sellerEarnings, sellerListingId, sellerLabel } from "@/lib/sellers";
export const dynamic = "force-dynamic";
// Seller dashboard data (owner session): your listings with earnings.
export async function GET(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const sellers = await listSellers(owner);
  return Response.json({
    sellers: await Promise.all(sellers.map(async (s) => ({ ...s, listingId: sellerListingId(s.id), label: sellerLabel(s), priceSol: s.priceLamports / 1e9, endpoint: `/api/shop/${sellerListingId(s.id)}`, earnings: await sellerEarnings(s) }))),
  });
}
// Register an endpoint: { name, url, priceSol, description, input? }
export async function POST(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    const s = await createSeller(owner, { name: String(b.name ?? ""), url: String(b.url ?? ""), priceSol: Number(b.priceSol), description: String(b.description ?? ""), input: b.input ? String(b.input) : undefined });
    return Response.json({ seller: s, listingId: sellerListingId(s.id) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
