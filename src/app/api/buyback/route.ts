import { buybackState } from "@/lib/buyback";
export const dynamic = "force-dynamic";
// Public: every buyback & burn run with its swap and burn transactions.
export async function GET() {
  return Response.json(await buybackState());
}
