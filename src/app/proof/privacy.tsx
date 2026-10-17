"use client";
import { useState } from "react";

type Check = { signature: string; at: string | null; signers: { address: string; hushPool: boolean }[]; receivers: { address: string; lamports: number; before: number | null; total: number }[]; hushReceipt: { commitment: string; epoch: number | null } | null; verdict: string };
const short = (s: string, n = 6) => `${s.slice(0, n)}…${s.slice(-n)}`;

/** Unlinkability check: paste any payout tx and see who signed it and whether the receiver was fresh. */
export function PrivacyChecker({ cluster, example }: { cluster: string; example?: string }) {
  const [tx, setTx] = useState("");
  const [res, setRes] = useState<Check | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const q = cluster === "mainnet-beta" ? "" : "?cluster=devnet";
  const run = async (sig: string) => {
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/privacy/check?tx=" + encodeURIComponent(sig.trim()));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRes(j);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="card-raised mt-6 p-5">
      <p className="label">Unlinkability check · run it on any payout</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="paste a payout transaction signature" className="min-w-0 flex-1" />
        <button disabled={busy || !tx.trim()} onClick={() => run(tx)} className="btn btn-hush">{busy ? "Checking…" : "Check"}</button>
        {example && <button disabled={busy} onClick={() => { setTx(example); run(example); }} className="btn btn-ghost">Try a demo payout</button>}
      </div>
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      {res && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="title text-xl hush-text">{res.verdict}</p>
          {res.signers.map((s) => <p key={s.address}>Signed by <a className="underline" target="_blank" rel="noreferrer" href={`https://solscan.io/account/${s.address}${q}`}>{short(s.address)}</a> · {s.hushPool ? "a shared HUSH pool address" : "NOT a HUSH pool address"}</p>)}
          {res.receivers.map((r) => <p key={r.address}>Paid {(r.lamports / 1e9).toFixed(6)} SOL to <a className="underline" target="_blank" rel="noreferrer" href={`https://solscan.io/account/${r.address}${q}`}>{short(r.address)}</a> · {r.before === 0 ? "no history before this payment" : r.before == null ? "history not readable" : `${r.before} earlier transaction(s)`}</p>)}
          <p className="text-muted">{res.hushReceipt ? `HUSH receipt commitment ${short(res.hushReceipt.commitment, 8)}${res.hushReceipt.epoch != null ? `, sealed in epoch #${res.hushReceipt.epoch}` : ", joins the next epoch"}` : "No HUSH receipt for this transaction."}</p>
          <a className="text-xs underline" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${res.signature}${q}`}>Open on Solscan ↗</a>
        </div>
      )}
    </div>
  );
}
