"use client";
import { useEffect, useState } from "react";

type Exposure = {
  signature: string; at: string | null; hush: boolean; verdict: string; leaks: string[];
  payer: { address: string; hushPool: boolean; before: number | null; capped: boolean; firstSeen: number | null; balanceLamports: number | null };
  receivers: { address: string; lamports: number; tokens: { mint: string; amount: number }[]; before: number | null; capped: boolean; sharedWithPayer: number }[];
};
const short = (s: string, n = 4) => `${s.slice(0, n)}…${s.slice(-n)}`;
const acct = (a: string) => `https://solscan.io/account/${a}`;
const since = (t: number | null) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "unknown");
const count = (n: number | null, capped: boolean) => (n == null ? "unreadable" : `${n}${capped ? "+" : ""}`);

function Row({ k, v, bad }: { k: string; v: React.ReactNode; bad?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2 text-sm">
      <span className="text-muted">{k}</span><span className={bad ? "text-red-300" : "hush-text"}>{v}</span>
    </div>
  );
}

function Panel({ title, sub, example, placeholder }: { title: string; sub: string; example: string; placeholder: string }) {
  const [tx, setTx] = useState(example);
  const [res, setRes] = useState<Exposure | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (sig: string) => {
    if (!sig.trim()) return;
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/privacy/exposure?tx=" + encodeURIComponent(sig.trim()));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRes(j);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => { if (example) run(example); }, [example]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = res?.payer;
  return (
    <section className="card no-lift flex flex-col p-6">
      <p className="label">{sub}</p>
      <h2 className="title mt-2 text-3xl">{title}</h2>
      <div className="mt-4 flex gap-2">
        <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1" />
        <button disabled={busy || !tx.trim()} onClick={() => run(tx)} className="btn btn-hush">{busy ? "Reading…" : "Read"}</button>
      </div>
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      {busy && <p className="mt-4 text-sm text-muted">Reading mainnet…</p>}
      {res && p && (
        <div className="mt-5">
          <p className="label">Who paid</p>
          <Row k="Signer" v={<a className="underline" target="_blank" rel="noreferrer" href={acct(p.address)}>{short(p.address)}</a>} bad={!p.hushPool} />
          <Row k="Is it the payer's own wallet?" v={p.hushPool ? "No, a shared HUSH pool address" : "Yes"} bad={!p.hushPool} />
          {!p.hushPool && <Row k="Payer's earlier transactions" v={count(p.before, p.capped)} bad />}
          {!p.hushPool && <Row k="Payer's balance, right now" v={p.balanceLamports == null ? "unknown" : `${(p.balanceLamports / 1e9).toFixed(4)} SOL`} bad />}
          {!p.hushPool && <Row k="Payer active since" v={p.capped ? "1000+ txs ago" : since(p.firstSeen)} bad />}
          {res.receivers.map((r) => (
            <div key={r.address} className="mt-4">
              <p className="label">Who got paid · <a className="underline" target="_blank" rel="noreferrer" href={acct(r.address)}>{short(r.address)}</a></p>
              <Row k="Earlier transactions" v={count(r.before, r.capped)} bad={(r.before ?? 0) > 0} />
              <Row k="Shared history with the signer" v={`${r.sharedWithPayer} tx`} bad={r.sharedWithPayer > 0} />
            </div>
          ))}
          <div className="card-raised mt-5 p-4">
            <p className={`title text-xl ${res.leaks.length ? "text-red-300" : "hush-text"}`}>{res.verdict}</p>
            {res.leaks.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{res.leaks.map((l) => <li key={l}>{l}</li>)}</ul>}
            {res.hush && <p className="mt-2 text-sm text-muted">HUSH receipt on file: provable in <a className="underline" href="/verify">/verify</a> without naming the payer.</p>}
          </div>
          <a className="mt-3 inline-block text-xs underline" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${res.signature}`}>Open on Solscan ↗</a>
        </div>
      )}
    </section>
  );
}

export default function Compare({ walletExample, hushExample }: { walletExample: string; hushExample: string }) {
  return (
    <main className="relative mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="relative">
        <p className="label"><span className="label-hush">Compare</span> &nbsp;Solana mainnet · live</p>
        <h1 className="title mt-4 text-5xl sm:text-7xl">What your payment <span className="hush-text">tells everyone.</span></h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">Paste any Solana transaction: a wallet transfer, an x402 USDC payment, anything. We read it from mainnet the way a stranger would and list what it gives away. Next to it, a HUSH payout read the same way.</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Panel sub="Any payment" title="A normal wallet payment" example={walletExample} placeholder="paste any transaction signature" />
          <Panel sub="HUSH payout" title="Paid through the pool" example={hushExample} placeholder="paste a HUSH payout signature" />
        </div>
        <p className="mt-6 text-sm text-muted">Defaults are HUSH&apos;s own demo agent, disclosed on purpose: its deposit (a plain wallet transfer) and its latest paid call. API: <a className="underline" href="/api/privacy/exposure">/api/privacy/exposure?tx=</a></p>
      </div>
    </main>
  );
}
