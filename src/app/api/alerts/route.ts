import { readSession } from "@/lib/auth";
import { getAlertSettings, listAlerts, setAlertSettings } from "@/lib/alerts";
export const dynamic = "force-dynamic";
// Leash alerts for the signed-in owner: settings + recent alerts.
export async function GET(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  return Response.json({ settings: await getAlertSettings(owner), alerts: await listAlerts(owner) });
}
// { webhook?: string | null, pct?: number }
export async function PUT(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    return Response.json({ settings: await setAlertSettings(owner, { webhook: b.webhook === undefined ? undefined : b.webhook ? String(b.webhook) : null, pct: b.pct === undefined ? undefined : Number(b.pct) }) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
