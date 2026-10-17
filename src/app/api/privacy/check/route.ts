import { unlinkabilityCheck } from "@/lib/privacyproof";
export const dynamic = "force-dynamic";
// Public: GET /api/privacy/check?tx=<signature>
export async function GET(req: Request) {
  try {
    return Response.json(await unlinkabilityCheck(new URL(req.url).searchParams.get("tx")?.trim() || ""));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
