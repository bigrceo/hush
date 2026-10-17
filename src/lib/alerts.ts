// Leash alerts: budget threshold, blocked calls, kill switch. Stored per owner and pushed to an optional webhook.
import { d1 } from "./store";
import { webhookBody } from "./alertrules";
import { checkHttpsUrl } from "./sellerrules";

export type AlertSettings = { webhook: string | null; pct: number };
export type AlertRow = { id: number; agentId: string | null; kind: string; message: string; delivered: boolean; at: number };

export async function getAlertSettings(owner: string): Promise<AlertSettings> {
  const r = await (await d1()).prepare("SELECT alert_webhook, alert_pct FROM owners WHERE owner = ?").bind(owner).first<{ alert_webhook: string | null; alert_pct: number }>();
  return { webhook: r?.alert_webhook ?? null, pct: r?.alert_pct ?? 80 };
}

export async function setAlertSettings(owner: string, s: { webhook?: string | null; pct?: number }) {
  if (s.webhook) { const bad = checkHttpsUrl(s.webhook, ["hushagents.com", "vercel.app"]); if (bad) throw new Error("webhook " + bad); }
  if (s.pct !== undefined && !(Number.isInteger(s.pct) && s.pct >= 10 && s.pct <= 100)) throw new Error("threshold must be 10-100 %");
  const cur = await getAlertSettings(owner);
  const next = { webhook: s.webhook === undefined ? cur.webhook : s.webhook || null, pct: s.pct ?? cur.pct };
  await (await d1()).prepare("INSERT INTO owners (owner, frozen_all, alert_webhook, alert_pct) VALUES (?, 0, ?, ?) ON CONFLICT(owner) DO UPDATE SET alert_webhook = excluded.alert_webhook, alert_pct = excluded.alert_pct").bind(owner, next.webhook, next.pct).run();
  return next;
}

export async function listAlerts(owner: string, limit = 30): Promise<AlertRow[]> {
  const { results } = await (await d1()).prepare("SELECT id, agent_id, kind, message, delivered, at FROM alerts WHERE owner = ? ORDER BY at DESC LIMIT ?").bind(owner, limit).all<{ id: string; agent_id: string | null; kind: string; message: string; delivered: number; at: string }>();
  return results.map((r) => ({ id: Number(r.id), agentId: r.agent_id, kind: r.kind, message: r.message, delivered: !!r.delivered, at: Number(r.at) }));
}

/** Records an alert and posts it to the owner's webhook (4 s timeout). Never throws. dedupeMs skips repeats of the same kind+agent. */
export async function raiseAlert(owner: string, e: { kind: string; agentId?: string | null; agentName?: string | null; message: string }, dedupeMs = 0) {
  try {
    const db = await d1();
    const at = Date.now();
    if (dedupeMs > 0) {
      const dup = await db.prepare("SELECT 1 AS x FROM alerts WHERE owner = ? AND kind = ? AND agent_id IS NOT DISTINCT FROM ? AND message = ? AND at > ? LIMIT 1").bind(owner, e.kind, e.agentId ?? null, e.message, at - dedupeMs).first();
      if (dup) return { skipped: true };
    }
    const { webhook } = await getAlertSettings(owner);
    let delivered = false;
    if (webhook) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      try {
        const r = await fetch(webhook, { method: "POST", redirect: "error", signal: ctrl.signal, headers: { "content-type": "application/json", "user-agent": "HUSH-alerts/1 (+https://hushagents.com)" }, body: JSON.stringify(webhookBody({ kind: e.kind, agent: e.agentName, message: e.message, at })) });
        delivered = r.ok;
      } catch { /* delivery failure is recorded below */ } finally { clearTimeout(t); }
    }
    await db.prepare("INSERT INTO alerts (owner, agent_id, kind, message, delivered, at) VALUES (?, ?, ?, ?, ?, ?)").bind(owner, e.agentId ?? null, e.kind, e.message, delivered ? 1 : 0, at).run();
    return { delivered, webhook: !!webhook };
  } catch (err) {
    console.error("alert failed", err);
    return { delivered: false, error: true };
  }
}
