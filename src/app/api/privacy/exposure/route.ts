import { exposure } from "@/lib/exposure";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
// Public: GET /api/privacy/exposure?tx=<signature> — what this payment reveals to anyone reading the chain.
export async function GET(req: Request) {
  try {
    return Response.json(await exposure(new URL(req.url).searchParams.get("tx")?.trim() || ""), { headers: { "cache-control": "public, s-maxage=60" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
