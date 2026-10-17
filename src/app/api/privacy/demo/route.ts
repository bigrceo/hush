import { demoChains } from "@/lib/privacyproof";
export const revalidate = 60;
// Public: the HUSH demo agent's latest payments traced end to end (disclosed on purpose; real users are never traced).
export async function GET() {
  return Response.json(await demoChains(3));
}
