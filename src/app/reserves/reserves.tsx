"use client";
import { useEffect, useState } from "react";

type R = { at: string; heldSol: number; owedSol: number; fundedAgents: number; coverage: number | null; pool: { address: string; sol: number }[] };
const short = (s: string, n = 4) => `${s.slice(0, n)}…${s.slice(-n)}`;

export default function Reserves() {
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const load = () => fetch("/api/pool/reserves").then((x) => x.json()).then(setR).catch((e) => setErr(String(e)));
    load(); const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);
  const ok = r && (r.coverage == null || r.coverage >= 1);
  return (
    <main className="relative mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="relative">
        <p className="label"><span className="label-hush">Reserves</span> &nbsp;Solana mainnet · live, refreshes every 30s</p>
        <h1 className="title mt-4 text-5xl sm:text-7xl">Every lamport owed <span className="hush-text">is on-chain.</span></h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">The pool is what breaks the link between your agent and the seller. Here is what it holds, read live from mainnet, next to what HUSH owes every funded agent.</p>
        {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
        {r && (
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <section className="card no-lift p-6"><p className="label">Held by the pool</p><p className="title mt-2 text-4xl">{r.heldSol.toFixed(4)} SOL</p><p className="mt-1 text-sm text-muted">sum of the {r.pool.length} pool addresses</p></section>
            <section className="card no-lift p-6"><p className="label">Owed to agents</p><p className="title mt-2 text-4xl">{r.owedSol.toFixed(4)} SOL</p><p className="mt-1 text-sm text-muted">{r.fundedAgents} funded agents, ledger total</p></section>
            <section className="card no-lift p-6"><p className="label">Coverage</p><p className={`title mt-2 text-4xl ${ok ? "hush-text" : "text-red-300"}`}>{r.coverage == null ? "n/a" : `${(r.coverage * 100).toFixed(0)}%`}</p><p className="mt-1 text-sm text-muted">held ÷ owed, at {r.at.slice(11, 19)} UTC</p></section>
          </div>
        )}
        {r && (
          <section className="card no-lift mt-6 p-6">
            <p className="label">Pool addresses · check them yourself</p>
            {r.pool.map((p) => (
              <div key={p.address} className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2 text-sm">
                <a className="underline" target="_blank" rel="noreferrer" href={`https://solscan.io/account/${p.address}`}>{short(p.address, 6)}</a>
                <span className="hush-text">{p.sol.toFixed(4)} SOL</span>
              </div>
            ))}
          </section>
        )}
        <section className="card-raised mt-10 max-w-3xl p-6">
          <p className="title text-2xl">Custody, plainly</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li><b className="text-white">Today the pool is custodial.</b> Deposits sit in pool addresses whose keys HUSH&apos;s server holds. That&apos;s what lets one payment leave from a shared address instead of your wallet.</li>
            <li><b className="text-white">Withdrawals only go to you.</b> A withdrawal pays your whole balance to the wallet that owns the agent. There is no &quot;send elsewhere&quot; option to abuse.</li>
            <li><b className="text-white">Reserves are public.</b> This page reads every pool address from mainnet and compares it to the ledger. Anyone can audit it, any time.</li>
            <li><b className="text-white">Keep it small.</b> The pool is for agent spending money, not savings. Fund what your agent needs, withdraw the rest.</li>
            <li><b className="text-white">Code is public:</b> <a className="underline" href="https://github.com/bigrceo/hush" target="_blank" rel="noreferrer">github.com/bigrceo/hush</a> (pool logic in <code>src/lib/pool.ts</code>).</li>
          </ul>
        </section>
        <p className="mt-6 text-sm text-muted">API: <a className="underline" href="/api/pool/reserves">/api/pool/reserves</a></p>
      </div>
    </main>
  );
}
