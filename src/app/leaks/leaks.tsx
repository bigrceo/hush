"use client";
import { useEffect, useState } from "react";

type Party = { address: string; out: number; in: number; solOut: number; solIn: number; usdcOut: number; usdcIn: number; first: number | null; last: number | null };
type Res = { address: string; scanned: number; balanceLamports: number | null; spentSol: number; spentUsdc: number; hours: number[]; busiestHourUtc: number; counterparties: number; repeatPayees: number; top: Party[]; leaks: string[]; verdict: string };
const short = (s: string, n = 4) => `${s.slice(0, n)}…${s.slice(-n)}`;
const acct = (a: string) => `https://solscan.io/account/${a}`;
const day = (t: number | null) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "");

export default function Leaks({ initial = "" }: { initial?: string }) {
  const [addr, setAddr] = useState(initial);
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (a = addr) => {
    if (!a.trim()) return;
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/privacy/wallet?address=" + encodeURIComponent(a.trim()));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRes(j);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => { if (initial) run(initial); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const share = res ? `https://x.com/intent/post?text=${encodeURIComponent(`my wallet is an open diary: ${res.leaks.length} things a stranger reads from my last ${res.scanned} transactions.\nscan yours:`)}&url=${encodeURIComponent(`https://hushagents.com/leaks/${res.address}`)}` : "";
  const max = res ? Math.max(1, ...res.hours) : 1;
  return (
    <main className="relative mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="relative">
        <p className="label"><span className="label-hush">Leak scan</span> &nbsp;Solana mainnet · live</p>
        <h1 className="title mt-4 text-5xl sm:text-7xl">Your wallet is <span className="hush-text">an open diary.</span></h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">Paste any Solana wallet. We read its recent history from mainnet the way a stranger would: who it pays, who pays it, how much, and when it&apos;s awake. Nothing is stored.</p>
        <div className="mt-8 flex max-w-2xl gap-2">
          <input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="paste a wallet address" className="min-w-0 flex-1" />
          <button disabled={busy || !addr.trim()} onClick={() => run()} className="btn btn-hush">{busy ? "Reading…" : "Scan"}</button>
        </div>
        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        {busy && <p className="mt-4 text-sm text-muted">Reading the last 40 transactions from mainnet…</p>}
        {res && (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <section className="card no-lift p-6">
              <p className="label">What anyone can read</p>
              <p className="title mt-2 text-2xl text-red-300">{res.verdict}</p>
              <a href={share} target="_blank" rel="noreferrer" className="btn btn-hush mt-4 inline-flex h-10 px-4">Share my diary on X</a>
              <ul className="mt-4 space-y-2 text-sm">{res.leaks.map((l) => <li key={l} className="border-b border-white/5 pb-2">{l}</li>)}</ul>
              <p className="label mt-6">Active hours (UTC)</p>
              <div className="mt-3 flex h-24 items-end gap-[3px]">{res.hours.map((h, i) => <div key={i} title={`${i}:00 · ${h} tx`} className="flex-1 rounded-sm bg-[#9b7bff]" style={{ height: `${(h / max) * 100}%`, opacity: h ? 1 : 0.15 }} />)}</div>
              <div className="mt-1 flex justify-between text-xs text-subtle"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
            </section>
            <section className="card no-lift p-6">
              <p className="label">Who it deals with · {res.counterparties} addresses</p>
              <div className="mt-3">
                {res.top.map((p) => (
                  <div key={p.address} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-2 text-sm">
                    <a className="underline" target="_blank" rel="noreferrer" href={acct(p.address)}>{short(p.address)}</a>
                    <span className="text-muted">{p.out ? `paid ${p.out}×` : ""}{p.out && p.in ? " · " : ""}{p.in ? `received ${p.in}×` : ""}</span>
                    <span className="text-red-300">{p.solOut ? `${p.solOut.toFixed(4)} SOL` : p.usdcOut ? `${p.usdcOut.toFixed(2)} USDC` : p.solIn ? `+${p.solIn.toFixed(4)} SOL` : ""}</span>
                    <span className="hidden text-xs text-subtle sm:inline">{day(p.last)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
        <div className="card-raised mt-10 max-w-3xl p-6">
          <p className="title text-2xl">Through HUSH, none of this lines up.</p>
          <p className="mt-2 text-muted">Your agent pays from a shared pool, each seller gets a one-time address, and the receipt is still provable. Scan a HUSH payout address and you find one transaction, ever. See it side by side on <a className="underline" href="/compare">/compare</a>.</p>
        </div>
        <p className="mt-6 text-sm text-muted">API: <a className="underline" href="/api/privacy/wallet">/api/privacy/wallet?address=</a></p>
      </div>
    </main>
  );
}
