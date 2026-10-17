import { listingTotal } from "@/lib/shop";
import { allListings } from "@/lib/sellers";
import { hushScores } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  const scores = await hushScores();
  return Response.json({
    listings: (await allListings()).map((l) => ({ ...l, total: listingTotal(l), endpoint: `/api/shop/${l.id}`, score: scores.find((s) => s.seller === l.seller)?.score ?? null })),
  });
}
