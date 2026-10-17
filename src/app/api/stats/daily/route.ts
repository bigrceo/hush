import { publicStats } from "@/lib/statsdaily";
export const revalidate = 60;
// Public: daily paid calls / refunds / SOL volume / active agents for the last 30 days, per-listing totals, anchors, buyback.
export async function GET() {
  return Response.json(await publicStats(), { headers: { "cache-control": "public, s-maxage=60" } });
}
