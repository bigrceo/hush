import { LISTINGS, listingTotal } from "@/lib/shop";
import { hushScores } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  const scores = await hushScores();
  return Response.json({
    listings: LISTINGS.map((l) => ({ ...l, total: listingTotal(l), endpoint: `/api/shop/${l.id}`, score: scores.find((s) => s.seller === l.seller)?.score ?? null })),
  });
}
