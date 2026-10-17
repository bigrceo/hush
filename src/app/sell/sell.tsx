"use client";
import { useCallback, useEffect, useState } from "react";
import bs58 from "bs58";
import { detectWallets, INSTALL, type HushWallet } from "@/lib/wallets";

type S = { id: string; name: string; url: string; priceSol: number; description: string; input: string | null; active: boolean; listingId: string; label: string; endpoint: string; earnings: { calls: number; earnedSol: number; unsweptSol: number; unswept: number; sweeps: string[] } };
const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER || "devnet";
const tx = (s: string) => `https://solscan.io/tx/${s}${CLUSTER === "mainnet-beta" ? "" : "?cluster=devnet"}`;

export default function Sell() {
  const [token, setToken] = useState<string | null>(null);
  const [pk, setPk] = useState<string | null>(null);
  const [wallets, setWallets] = useState<HushWallet[]>([]);
  const [picker, setPicker] = useState(false);
  const [sellers, setSellers] = useState<S[]>([]);
  const [form, setForm] = useState({ name: "", url: "", priceSol: "0.002", description: "", input: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { try { const t = sessionStorage.getItem("hush.token"), p = sessionStorage.getItem("hush.pk"); if (t && p) { setToken(t); setPk(p); } } catch {} setWallets(detectWallets()); }, []);
  const api = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }, [token]);
  const refresh = useCallback(async () => { if (token) setSellers((await api("/api/sellers")).sellers); }, [api, token]);
  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  async function connect(w: HushWallet) {
    setPicker(false);
    try {
      const pub = await w.connect(), ts = Date.now();
      const sig = await w.signMessage(new TextEncoder().encode(`Sign in to HUSH\nwallet: ${pub}\nts: ${ts}`));
      const { token } = await (await fetch("/api/auth", { method: "POST", body: JSON.stringify({ pubkey: pub, ts, signature: bs58.encode(sig) }) })).json();
      setToken(token); setPk(pub);
      try { sessionStorage.setItem("hush.token", token); sessionStorage.setItem("hush.pk", pub); sessionStorage.setItem("hush.wallet", w.name); } catch {}
    } catch (e) { setMsg((e as Error).message); }
  }
  const act = async (f: () => Promise<string | void>) => { setBusy(true); setMsg(null); try { const m = await f(); if (m) setMsg(m); await refresh(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } };

  return (
    <main className="relative mx-auto max-w-[1000px] px-4 py-16 sm:px-6">
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="relative">
        <p className="label"><span className="label-hush">Sell</span> &nbsp;Self-serve sellers</p>
        <h1 className="title mt-4 text-5xl sm:text-7xl">Sell to agents, <span className="hush-text">per call.</span></h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">List any https endpoint and a price in SOL. Agents pay over private x402, HUSH calls your endpoint and returns the answer. Every payment lands on a fresh one-time address; sweep your earnings to your wallet whenever you want.</p>

        {!token ? (
          <div className="card no-lift mt-10 p-8 text-center">
            <p className="title text-2xl">Connect the wallet that <span className="hush-text">gets paid.</span></p>
            <button onClick={() => { setWallets(detectWallets()); setPicker(true); }} className="btn btn-hush mt-6">Connect wallet</button>
          </div>
        ) : (
          <>
            <div className="card no-lift mt-10 p-6 sm:p-8">
              <p className="label">New listing · paid to {pk?.slice(0, 4)}…{pk?.slice(-4)}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1"><span className="label">Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Weather oracle" /></label>
                <label className="flex flex-col gap-1"><span className="label">Price per call (SOL)</span><input type="number" step="0.001" min="0.001" value={form.priceSol} onChange={(e) => setForm({ ...form, priceSol: e.target.value })} /></label>
                <label className="flex flex-col gap-1 sm:col-span-2"><span className="label">Endpoint (https, GET, JSON)</span><input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://api.example.com/forecast" /></label>
                <label className="flex flex-col gap-1 sm:col-span-2"><span className="label">Description</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What the agent gets back" /></label>
                <label className="flex flex-col gap-1"><span className="label">Optional input parameter</span><input value={form.input} onChange={(e) => setForm({ ...form, input: e.target.value })} placeholder="city" /></label>
              </div>
              <button disabled={busy} onClick={() => act(async () => { const j = await api("/api/sellers", { method: "POST", body: JSON.stringify({ ...form, priceSol: Number(form.priceSol), input: form.input || undefined }) }); setForm({ name: "", url: "", priceSol: "0.002", description: "", input: "" }); return `Listed as ${j.listingId}. Agents can buy it now.`; })} className="btn btn-hush mt-6">List endpoint</button>
              <p className="mt-3 text-xs text-muted">Price 0.001 to 0.1 SOL. HUSH adds a 1% facilitator fee on the buyer&apos;s side. Your endpoint must answer within 10 s with under 256 KB; if it fails, the buyer is refunded automatically. Max 5 listings per wallet.</p>
            </div>

            {msg && <p className="mt-4 text-sm hush-text">{msg}</p>}

            <div className="mt-6 space-y-4">
              {sellers.length === 0 && <p className="text-muted">No listings yet.</p>}
              {sellers.map((s) => (
                <div key={s.id} className="card no-lift p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="label">{s.active ? "Live" : "Paused"} · {s.listingId}</p>
                      <p className="title mt-2 text-2xl">{s.name}</p>
                      <p className="mt-1 text-sm text-muted">{s.description}</p>
                      <p className="mt-1 break-all text-xs text-subtle">{s.url}</p>
                    </div>
                    <p className="title text-2xl">{s.priceSol} <span className="hush-text">SOL</span></p>
                  </div>
                  <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
                    <div><p className="label">Paid calls</p><p className="title mt-1 text-2xl">{s.earnings.calls}</p></div>
                    <div><p className="label">Earned</p><p className="title mt-1 text-2xl">{s.earnings.earnedSol.toFixed(4)} SOL</p></div>
                    <div><p className="label">Ready to sweep</p><p className="title mt-1 text-2xl hush-text">{s.earnings.unsweptSol.toFixed(4)} SOL</p></div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button disabled={busy || s.earnings.unswept === 0} onClick={() => act(async () => { const j = await api(`/api/sellers/${s.id}/sweep`, { method: "POST" }); return `Swept ${j.sol.toFixed(6)} SOL in ${j.signatures.length} tx`; })} className="btn btn-hush">Sweep to my wallet</button>
                    <button disabled={busy} onClick={() => act(async () => { await api(`/api/sellers/${s.id}`, { method: "PATCH", body: JSON.stringify({ active: !s.active }) }); })} className="btn btn-ghost">{s.active ? "Pause" : "Resume"}</button>
                  </div>
                  {s.earnings.sweeps.length > 0 && <p className="mt-4 text-xs text-muted">Sweeps: {s.earnings.sweeps.map((x) => <a key={x} href={tx(x)} target="_blank" rel="noreferrer" className="mr-3 underline">{x.slice(0, 8)}… ↗</a>)}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {picker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPicker(false)}>
          <div className="card no-lift w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connect a wallet">
            <p className="label">Connect a wallet</p>
            <div className="mt-4 space-y-2">
              {wallets.map((w) => (
                <button key={w.name} onClick={() => connect(w)} className="card-raised flex w-full items-center gap-3 px-4 py-3 text-left hover:border-hush">
                  {w.icon ? <img src={w.icon} alt="" className="h-7 w-7 rounded-lg" /> : <span className="h-7 w-7 rounded-lg bg-line" />}<span className="font-medium">{w.name}</span>
                </button>
              ))}
              {wallets.length === 0 && <p className="text-sm text-muted">No Solana wallet found. {INSTALL.map((i) => <a key={i.name} href={i.url} target="_blank" rel="noreferrer" className="mr-3 underline">{i.name}</a>)}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
