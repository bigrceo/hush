import { runBuyback } from "@/lib/buyback";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Hourly via Vercel Cron (Bearer CRON_SECRET). Manual runs: POST with Bearer ADMIN_TOKEN and
// { dryRun?, threshold?, floatAgentId? }.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await runBuyback());
}
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_TOKEN].some((s) => s && auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  return Response.json(await runBuyback({ dryRun: !!b.dryRun, threshold: typeof b.threshold === "number" ? b.threshold : undefined, floatAgentId: typeof b.floatAgentId === "string" ? b.floatAgentId : undefined }));
}
