// Public usage stats from receipts (no payer, no payee, no signature).
import { d1, agentGdp, countAgents } from "./store";
import { listEpochs } from "./epochs";
import { buybackState } from "./buyback";
import { allListings } from "./sellers";

export async function publicStats(days = 30) {
  const db = await d1();
  const since = Date.now() - days * 86_400_000;
  const [daily, perListing, lat, agents7, sellers] = await Promise.all([
    db.prepare(`SELECT to_char(to_timestamp(at/1000) AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,
        SUM(CASE WHEN ok=1 THEN 1 ELSE 0 END) AS paid, SUM(CASE WHEN ok=0 THEN 1 ELSE 0 END) AS refunded,
        COALESCE(SUM(CASE WHEN ok=1 AND currency='SOL' THEN CAST(total AS DOUBLE PRECISION) END),0) AS sol,
        COUNT(DISTINCT agent_id) AS agents
      FROM receipts WHERE at >= ? GROUP BY 1 ORDER BY 1`).bind(since).all<{ day: string; paid: string; refunded: string; sol: string; agents: string }>(),
    db.prepare(`SELECT listing, SUM(CASE WHEN ok=1 THEN 1 ELSE 0 END) AS paid, COALESCE(SUM(CASE WHEN ok=1 AND currency='SOL' THEN CAST(total AS DOUBLE PRECISION) END),0) AS sol
      FROM receipts GROUP BY listing ORDER BY 2 DESC`).all<{ listing: string; paid: string; sol: string }>(),
    db.prepare(`SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50 FROM receipts WHERE ok=1`).first<{ p50: number | null }>(),
    db.prepare(`SELECT COUNT(DISTINCT agent_id) AS n FROM receipts WHERE at >= ? AND agent_id IS NOT NULL`).bind(Date.now() - 7 * 86_400_000).first<{ n: string }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM sellers WHERE active = 1`).first<{ n: string }>().catch(() => ({ n: "0" })),
  ]);
  const byDay = new Map(daily.results.map((r) => [r.day, r]));
  // Start at the first day with receipts (at least 7 days shown), so launch week isn't drowned in empty days.
  const first = daily.results[0]?.day;
  const span = first ? Math.min(days, Math.max(7, Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(first)) / 86_400_000) + 1)) : 7;
  days = span;
  const series = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(day);
    return { day, paid: Number(r?.paid ?? 0), refunded: Number(r?.refunded ?? 0), sol: Number(r?.sol ?? 0), agents: Number(r?.agents ?? 0) };
  });
  const [gdp, agentsTotal, epochs, buyback, listings] = await Promise.all([agentGdp(), countAgents(), listEpochs(200), buybackState(), allListings()]);
  return {
    generatedAt: Date.now(),
    totals: { paidCalls: gdp.calls, refunds: gdp.refunds, sol: gdp.sol, agents: agentsTotal, activeAgents7d: Number(agents7?.n ?? 0), listings: listings.length, sellerListings: Number(sellers?.n ?? 0), medianLatencyMs: lat?.p50 == null ? null : Math.round(Number(lat.p50)) },
    anchors: { epochs: epochs.length, anchored: epochs.filter((e) => e.anchorStatus === "anchored").length, latest: epochs.find((e) => e.anchorSig) ?? null },
    buyback: buyback.totals,
    daily: series,
    perListing: perListing.results.map((r) => ({ listing: r.listing, paid: Number(r.paid), sol: Number(r.sol) })),
  };
}
