"use client";
import { useEffect, useState } from "react";
import { Counter } from "./motion";

type Stats = { cluster: string; gdp: { sol: number; usdc: number; calls: number; refunds: number }; scores: { seller: string; calls: number; success: number; refundRate: number; latencyMs: number; score: number; receiptsRoot: string }[]; agents: number };
type PubReceipt = { commitment: string; listing: string; currency: string; ok: boolean; at: number; legs: number };

export function useStats(ms = 5000) {
  const [s, set] = useState<Stats | null>(null);
  useEffect(() => {
    let on = true;
    const tick = () => fetch("/api/stats").then((r) => r.json()).then((j) => on && set(j)).catch(() => {});
    tick();
    const t = setInterval(tick, ms);
    return () => { on = false; clearInterval(t); };
  }, [ms]);
  return s;
}

export function GdpCounter({ big = false }: { big?: boolean }) {
  const s = useStats();
  const calls = s?.gdp.calls ?? 0;
  if (!s || calls === 0)
    return (
      <div>
        <div className={`title ${big ? "text-[44px] sm:text-[68px]" : "text-2xl"}`}>
          First receipts <span className="hush-text">land at launch.</span>
        </div>
        <p className="label mt-3">{s ? "Agent GDP goes live with the first paid call" : "reading receipts…"}</p>
      </div>
    );
  return (
    <div>
      <div className={`title tabular-nums ${big ? "text-[56px] sm:text-[88px]" : "text-4xl"}`}>
        <Counter value={s.gdp.sol} decimals={s.gdp.sol < 1 ? 4 : 2} /> <span className="hush-text">SOL</span>
      </div>
      <p className="label mt-3">
        <Counter value={calls} /> paid calls{s.gdp.refunds > 0 ? ` · ${s.gdp.refunds} refunded` : ""}{s.gdp.usdc > 0 ? ` · ${s.gdp.usdc.toFixed(2)} USDC` : ""}
      </p>
    </div>
  );
}

export function ReceiptFeed() {
  const [rs, set] = useState<PubReceipt[]>([]);
  useEffect(() => {
    const tick = () => fetch("/api/receipts").then((r) => r.json()).then((j) => set(j.receipts ?? [])).catch(() => {});
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);
  if (!rs.length)
    return <p className="font-mono text-xs text-subtle">First receipts land at launch. Each one shows up here as a sealed commitment, never as an address.</p>;
  return (
    <ul className="space-y-2 font-mono text-xs">
      {rs.slice(0, 6).map((r) => (
        <li key={r.commitment} className="flex items-center justify-between gap-4 border-b border-line/60 pb-2">
          <span className={r.ok ? "hush-text" : "text-subtle"}>{r.ok ? "PAID" : "REFUNDED"}</span>
          <span className="truncate text-muted">{r.listing}</span>
          <span className="text-subtle">{r.commitment.slice(0, 10)}…</span>
        </li>
      ))}
    </ul>
  );
}

export function ScoreTable() {
  const s = useStats(8000);
  const rows = s?.scores ?? [];
  if (!rows.length) return <p className="font-mono text-xs text-subtle">Scores go live with the first paid receipts.</p>;
  return (
    <div className="space-y-3">
      {rows.slice(0, 4).map((r) => (
        <div key={r.seller} className="card-raised flex items-center justify-between p-4">
          <div>
            <p className="font-mono text-sm">{r.seller}</p>
            <p className="label mt-1">{(r.success * 100).toFixed(0)}% ok · {r.latencyMs}ms · root {r.receiptsRoot.slice(0, 8)}</p>
          </div>
          <span className="title text-2xl hush-text tabular-nums"><Counter value={r.score} /></span>
        </div>
      ))}
    </div>
  );
}

type L = { id: string; name: string; seller: string; blurb: string; currency: string; total: number; kind: string; score: number | null; legs?: unknown[] };
export function ShopGrid({ limit = 6 }: { limit?: number }) {
  const [ls, set] = useState<L[]>([]);
  useEffect(() => { fetch("/api/shop").then((r) => r.json()).then((j) => set(j.listings)).catch(() => {}); }, []);
  return (
    <div className="rg grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ls.slice(0, limit).map((l) => (
        <div key={l.id} className="card-raised flex flex-col p-5">
          <div className="flex items-center justify-between">
            <span className="label">{l.kind}{l.legs ? ` · ${l.legs.length} sellers` : ""}</span>
            <span className="label label-hush">score {l.score ?? "new"}</span>
          </div>
          <p className="title mt-4 text-xl">{l.name}</p>
          <p className="mt-2 flex-1 text-sm text-muted">{l.blurb}</p>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4 font-mono text-xs">
            <span className="text-muted">{l.seller}</span>
            <span>{l.total} {l.currency}<span className="text-subtle"> / call</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}
