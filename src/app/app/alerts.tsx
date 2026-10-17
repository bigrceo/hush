"use client";
import { useCallback, useEffect, useState } from "react";

type Alert = { id: number; agentId: string | null; kind: string; message: string; delivered: boolean; at: number };

/** Leash alerts: webhook (Discord, Slack or any https URL), budget threshold, recent alerts. */
export default function AlertsCard({ token }: { token: string }) {
  const [webhook, setWebhook] = useState("");
  const [pct, setPct] = useState(80);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const call = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(path, { ...init, headers: { "content-type": "application/json", authorization: "Bearer " + token } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }, [token]);
  const load = useCallback(async () => {
    const j = await call("/api/alerts");
    setAlerts(j.alerts);
    return j;
  }, [call]);
  useEffect(() => {
    load().then((j) => { setWebhook(j.settings.webhook ?? ""); setPct(j.settings.pct); }).catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(t);
  }, [load]);
  const save = async () => { setMsg(null); try { await call("/api/alerts", { method: "PUT", body: JSON.stringify({ webhook: webhook.trim() || null, pct }) }); setMsg("saved"); } catch (e) { setMsg((e as Error).message); } };
  const test = async () => { setMsg(null); try { const j = await call("/api/alerts/test", { method: "POST" }); setMsg(j.webhook ? (j.delivered ? "test delivered" : "webhook did not answer 2xx") : "no webhook set: alert kept here only"); await load(); } catch (e) { setMsg((e as Error).message); } };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between"><p className="label">Leash alerts</p><p className="label">budget · blocks · kill switch</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
        <label className="flex flex-col gap-1"><span className="label">Webhook (Discord, Slack or any https URL)</span><input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/…" /></label>
        <label className="flex flex-col gap-1"><span className="label">Budget alert at %</span><input type="number" min={10} max={100} step={5} value={pct} onChange={(e) => setPct(+e.target.value)} /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={save} className="btn btn-hush h-9">Save</button>
        <button onClick={test} className="btn btn-ghost h-9">Send test</button>
        {msg && <span className="text-xs hush-text">{msg}</span>}
      </div>
      <div className="mt-5 max-h-56 space-y-2 overflow-auto text-xs">
        {alerts.length === 0 && <p className="text-subtle">No alerts yet. You get one when an agent hits {pct}% of its daily budget, when a call is blocked by the leash, and when a kill switch flips.</p>}
        {alerts.map((a) => (
          <div key={a.id} className="flex justify-between gap-4 border-b border-line/60 pb-2">
            <span><span className="hush-text uppercase tracking-wider">{a.kind}</span> &nbsp;{a.message}</span>
            <span className="shrink-0 text-subtle">{new Date(a.at).toLocaleTimeString()}{a.delivered ? " · sent" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
