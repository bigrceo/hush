import { anchorPending, sealEpochs } from "@/lib/epochs";
import { sweepAllDeposits } from "@/lib/pool";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Seals unsealed receipts into a new epoch and anchors pending roots. Vercel Cron calls it with
// `Authorization: Bearer $CRON_SECRET`; run it by hand the same way.
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const swept = await sweepAllDeposits().catch((e) => ({ error: String(e) }));
  const sealed = await sealEpochs();
  const anchored = await anchorPending();
  return Response.json({ swept, sealed: sealed.map((e) => ({ epoch: e.id, root: e.root, leaves: e.leafCount })), anchored });
}
export const GET = handle;
export const POST = handle;
