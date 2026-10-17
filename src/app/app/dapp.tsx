"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { GdpCounter, ScoreTable } from "@/components/live";
import AlertsCard from "./alerts";
import { detectWallets, INSTALL, onWalletsChange, type HushWallet } from "@/lib/wallets";

const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER || "devnet";
const RPC = process.env.NEXT_PUBLIC_RPC_URL || (CLUSTER === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}${CLUSTER === "devnet" ? "?cluster=devnet" : ""}`;

type Agent = { id: string; name: string; pubkey: string; dailyBudget: number; perCallCap: number; allowlist: string[]; frozen: boolean; spent: { day: string; sol: number }; balance: number | null; pendingDeposit?: number | null };
type Listing = { id: string; name: string; seller: string; total: number; currency: string; input?: string; blurb: string };
type Receipt = { nonce: string; listing: string; total: string; currency: string; ok: boolean; signature: string; refundSignature?: string; legs: { seller: string; payTo: string }[]; latencyMs: number; at: number; commitment: string; epochId?: number | null };

export default function Dapp() {
  const [pk, setPk] = useState<string | null>(null);
  const [wallets, setWallets] = useState<HushWallet[]>([]);
  const [picker, setPicker] = useState(false);
  const walletRef = useRef<HushWallet | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [frozenAll, setFrozenAll] = useState(false);
  const [holder, setHolder] = useState<{ hush: number; tier: string | null; perk: string | null; feePct: number; next: { name: string; min: number } | null } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const say = (s: string) => setLog((l) => [new Date().toLocaleTimeString() + "  " + s, ...l].slice(0, 30));

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}), ...init?.headers } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const j = await api("/api/agents");
    setAgents(j.agents);
    setFrozenAll(j.frozenAll);
    setHolder(j.holder ?? null);
    setSel((s) => s ?? j.agents[0]?.id ?? null);
    setReceipts((await api("/api/receipts")).receipts);
  }, [api, token]);

  useEffect(() => { fetch("/api/shop").then((r) => r.json()).then((j) => setListings(j.listings)); }, []);
  useEffect(() => { refresh().catch(() => {}); const t = setInterval(() => refresh().catch(() => {}), 10000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { try { const t = sessionStorage.getItem("hush.token"), p = sessionStorage.getItem("hush.pk"), w = sessionStorage.getItem("hush.wallet"); if (t && p) { setToken(t); setPk(p); setWalletName(w); } } catch {} }, []);
  useEffect(() => { const up = () => setWallets(detectWallets()); up(); const t = setTimeout(up, 600); const off = onWalletsChange(up); return () => { clearTimeout(t); off(); }; }, []);

  /** The connected wallet; after a reload it is re-attached by name on first use. */
  async function activeWallet(): Promise<HushWallet> {
    if (walletRef.current) return walletRef.current;
    const w = detectWallets().find((x) => x.name === walletName);
    if (!w) throw new Error("reconnect your wallet");
    const addr = await w.connect();
    if (addr !== pk) throw new Error(`${w.name} is on another account; reconnect`);
    walletRef.current = w;
    return w;
  }

  async function connect(w: HushWallet) {
    setPicker(false);
    try {
      const pub = await w.connect();
      const ts = Date.now();
      const msg = `Sign in to HUSH\nwallet: ${pub}\nts: ${ts}`;
      const signature = await w.signMessage(new TextEncoder().encode(msg));
      const { token } = await (await fetch("/api/auth", { method: "POST", body: JSON.stringify({ pubkey: pub, ts, signature: bs58.encode(signature) }) })).json();
      walletRef.current = w;
      setPk(pub); setToken(token); setWalletName(w.name);
      try { sessionStorage.setItem("hush.token", token); sessionStorage.setItem("hush.pk", pub); sessionStorage.setItem("hush.wallet", w.name); } catch {}
      say(`signed in with ${w.name} as ${pub.slice(0, 4)}…${pub.slice(-4)}`);
    } catch (e) { say("connect failed: " + (e as Error).message); }
  }
  const openPicker = () => { setWallets(detectWallets()); setPicker(true); };

  const agent = agents.find((a) => a.id === sel);

  async function run(label: string, f: () => Promise<void>) {
    setBusy(true);
    try { await f(); } catch (e) { say(label + " failed: " + (e as Error).message); } finally { setBusy(false); refresh().catch(() => {}); }
  }

  const createAgent = () => run("create", async () => {
    const name = agentName.trim() || "agent-" + (agents.length + 1).toString().padStart(2, "0");
    setAgentName("");
    const j = await api("/api/agents", { method: "POST", body: JSON.stringify({ name }) });
    setNewKey(j.apiKey); setSel(j.agent.id); say("agent created: " + j.agent.name);
  });

  const fund = (sol: number) => run("fund", async () => {
    if (!agent || !pk) return;
    const w = await activeWallet();
    const conn = new Connection(RPC, "confirmed");
    const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: new PublicKey(pk), toPubkey: new PublicKey(agent.pubkey), lamports: Math.round(sol * 1e9) }));
    tx.feePayer = new PublicKey(pk);
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    const signature = await w.signAndSend(tx, conn);
    await conn.confirmTransaction(signature, "confirmed");
    say(`funded ${sol} SOL → ${agent.name} (${signature.slice(0, 8)}…)`);
  });

  const airdrop = () => run("airdrop", async () => {
    if (!agent) return;
    const conn = new Connection(RPC, "confirmed");
    const sig = await conn.requestAirdrop(new PublicKey(agent.pubkey), 0.5e9);
    await conn.confirmTransaction(sig, "confirmed");
    say("devnet airdrop 0.5 SOL → " + agent.name);
  });

  const patch = (b: Partial<Agent>) => run("leash", async () => {
    if (!agent) return;
    await api(`/api/agents/${agent.id}`, { method: "PATCH", body: JSON.stringify(b) });
    say("leash updated: " + Object.keys(b).join(", "));
  });

  const killAll = () => run("kill switch", async () => {
    const j = await api("/api/agents/freeze-all", { method: "POST", body: JSON.stringify({ on: !frozenAll }) });
    say(j.frozenAll ? "KILL SWITCH ON: every agent frozen" : "kill switch off");
  });

  const withdraw = () => run("withdraw", async () => {
    if (!agent) return;
    const j = await api(`/api/agents/${agent.id}/withdraw`, { method: "POST" });
    say("withdrawn to owner: " + j.signature.slice(0, 8) + "…");
  });

  const downloadProof = (r: Receipt) => run("proof", async () => {
    const res = await fetch(`/api/receipts/${r.nonce}/proof`, { headers: { authorization: "Bearer " + token } });
    if (res.status === 202) { say("proof pending: this receipt joins the next epoch"); return; }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = `hush-proof-${r.nonce.slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    say(`proof downloaded for ${r.listing} (epoch ${r.epochId})`);
  });

  const buy = (l: Listing) => run("buy", async () => {
    if (!agent) return;
    const input = l.input ? (inputs[l.id]?.trim() || (l.input === "address" ? agent.pubkey : "So11111111111111111111111111111111111111112")) : undefined;
    say(`${agent.name} → 402 → paying ${l.total} ${l.currency} privately for ${l.id}…`);
    const j = await api("/api/agent/buy", { method: "POST", body: JSON.stringify({ agentId: agent.id, listing: l.id, input }) });
    say(`${j.ok ? "PAID" : "REFUNDED"} ${l.id} in ${j.ms}ms · fee ${((j.paid?.facilitatorFee ?? 0) / 1e9).toFixed(6)} SOL${j.paid?.tier ? ` (${j.paid.tier})` : ""} · ${j.paid?.legs ?? 0} one-time payee(s) · ${JSON.stringify(j.result.data ?? j.result).slice(0, 140)}`);
  });

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label"><span className="label-hush">App</span> &nbsp;{CLUSTER}</p>
          <h1 className="title mt-3 text-5xl">Your agents, <span className="hush-text">in private.</span></h1>
        </div>
        {pk ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{walletName ? walletName + " · " : ""}{pk.slice(0, 4)}…{pk.slice(-4)}</span>
            <button onClick={killAll} disabled={busy} className={`btn ${frozenAll ? "btn-hush" : "btn-ghost"}`}>{frozenAll ? "Unfreeze all" : "Freeze all agents"}</button>
          </div>
        ) : (
          <button onClick={openPicker} className="btn btn-hush">Connect wallet</button>
        )}
      </div>

      {!pk && (
        <div className="card mt-10 p-10 text-center">
          <p className="title text-3xl">Connect a wallet to <span className="hush-text">hold the leash.</span></p>
          <p className="mx-auto mt-3 max-w-md text-muted">Sign once (no transaction), create an agent wallet, fund it, set its limits, let it shop. Running on {CLUSTER}: switch your wallet to the same network. Phantom, Solflare, Backpack and any Wallet Standard wallet work.</p>
        </div>
      )}

      {newKey && (
        <div className="card mt-6 border-hush p-5">
          <p className="label label-hush">Agent API key · shown once</p>
          <p className="mt-2 break-all font-mono text-sm">{newKey}</p>
          <p className="mt-2 text-xs text-muted">Give it to the MCP server (HUSH_AGENT_KEY) or send it as x-agent-key. <button className="hush-text" onClick={() => setNewKey(null)}>Done</button></p>
        </div>
      )}

      {pk && (
        <div className="mt-10 grid gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-3">
            <p className="label">Agents</p>
            <div className="flex gap-2"><input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="agent name" className="min-w-0 flex-1" /><button onClick={createAgent} disabled={busy} className="btn btn-ghost h-[42px] px-4">+ New</button></div>
            {agents.length === 0 && <p className="text-sm text-muted">No agent yet.</p>}
            {agents.map((a) => (
              <button key={a.id} onClick={() => setSel(a.id)} className={`card-raised block w-full p-4 text-left ${sel === a.id ? "border-hush" : ""}`}>
                <div className="flex items-center justify-between"><span className="font-mono text-sm">{a.name}</span><span className={`label ${a.frozen || frozenAll ? "" : "label-hush"}`}>{a.frozen || frozenAll ? "frozen" : "active"}</span></div>
                <p className="label mt-2">{a.balance?.toFixed(4) ?? "…"} SOL · spent {a.spent.sol.toFixed(4)}</p>
              </button>
            ))}
            {holder && (
              <div className="card p-5">
                <p className="label">Holder tier</p>
                <p className="title mt-2 text-2xl">{holder.tier ?? "No tier"} <span className="hush-text">{holder.feePct.toFixed(2)}% fee</span></p>
                <p className="mt-2 text-xs text-muted">{holder.hush.toLocaleString()} $HUSH in your wallet{holder.perk ? ` · ${holder.perk}` : ""}</p>
                {holder.next && <p className="mt-1 text-xs text-subtle">{(holder.next.min - holder.hush).toLocaleString()} more for {holder.next.name}</p>}
              </div>
            )}
            <div className="card p-5"><p className="label mb-3">Agent GDP</p><GdpCounter /></div>
          </aside>

          <section className="space-y-4">
            {agent ? (
              <>
                <div className="card grid gap-6 p-6 md:grid-cols-2">
                  <div>
                    <p className="label">HUSH balance · paid from the shared pool</p>
                    <p className="title mt-2 text-3xl">{agent.balance?.toFixed(4) ?? "…"} <span className="hush-text">SOL</span></p>
                    <p className="mt-2 text-xs text-muted">Deposit address (funds are swept into the HUSH pool; buys never come from here)</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted">{agent.pubkey}</p>
                    {!!agent.pendingDeposit && agent.pendingDeposit > 0 && <p className="mt-1 text-xs hush-text">{agent.pendingDeposit.toFixed(4)} SOL arriving, joins the pool on next refresh</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button disabled={busy} onClick={() => fund(0.05)} className="btn btn-hush h-9">Fund 0.05 SOL</button>
                      {CLUSTER === "devnet" && <button disabled={busy} onClick={airdrop} className="btn btn-ghost h-9">Devnet airdrop</button>}
                      <button disabled={busy} onClick={withdraw} className="btn btn-ghost h-9">Withdraw</button>
                    </div>
                  </div>
                  <div>
                    <p className="label">Leash · enforced server-side</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <label className="flex flex-col gap-1"><span className="label">Daily budget (SOL)</span><input type="number" step="0.001" defaultValue={agent.dailyBudget} key={"d" + agent.id} onBlur={(e) => patch({ dailyBudget: +e.target.value })} /></label>
                      <label className="flex flex-col gap-1"><span className="label">Per-call cap (SOL)</span><input type="number" step="0.0001" defaultValue={agent.perCallCap} key={"c" + agent.id} onBlur={(e) => patch({ perCallCap: +e.target.value })} /></label>
                    </div>
                    <p className="label mt-4">Spent today {agent.spent.sol.toFixed(6)} / {agent.dailyBudget} SOL</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-line"><div className="h-full bg-hush" style={{ width: `${Math.min(100, (agent.spent.sol / Math.max(agent.dailyBudget, 1e-9)) * 100)}%` }} /></div>
                    <button disabled={busy} onClick={() => patch({ frozen: !agent.frozen })} className="btn btn-ghost mt-4 h-9">{agent.frozen ? "Unfreeze agent" : "Kill switch: freeze agent"}</button>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center justify-between"><p className="label">Agent Shop · allowlist</p><p className="label">x402 · one-time payees</p></div>
                  <div className="mt-4 divide-y divide-line">
                    {listings.map((l) => {
                      const allowed = agent.allowlist.includes(l.id);
                      return (
                        <div key={l.id} className="flex flex-wrap items-center gap-4 py-3">
                          <input type="checkbox" checked={allowed} onChange={() => patch({ allowlist: allowed ? agent.allowlist.filter((x) => x !== l.id) : [...agent.allowlist, l.id] })} className="h-4 w-4 accent-[#9b7bff]" />
                          <div className="min-w-0 flex-1"><p className="text-sm">{l.name}</p><p className="font-mono text-xs text-subtle">{l.seller} · {l.total} {l.currency}</p></div>
                          {l.input && <input value={inputs[l.id] ?? ""} onChange={(e) => setInputs((m) => ({ ...m, [l.id]: e.target.value }))} placeholder={l.input + " (default: " + (l.input === "address" ? "agent" : "wSOL") + ")"} className="w-full font-mono text-xs sm:w-56" />}
                          <button disabled={busy} onClick={() => buy(l)} className="btn btn-ghost h-9">Buy</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : pk && <div className="card p-10 text-center"><button onClick={createAgent} className="btn btn-hush">Create your first agent</button></div>}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-6">
                <p className="label">Your private receipts</p>
                <div className="mt-4 space-y-2 font-mono text-xs">
                  {receipts.length === 0 && <p className="text-subtle">None yet. Only you can see these.</p>}
                  {receipts.slice(0, 10).map((r) => (
                    <div key={r.nonce} className="border-b border-line/60 pb-2">
                      <div className="flex justify-between"><span className={r.ok ? "hush-text" : "text-subtle"}>{r.ok ? "PAID" : "REFUNDED"} {r.listing}</span><span>{r.total} {r.currency}</span></div>
                      <div className="mt-1 flex justify-between text-subtle"><span>{r.legs.length} payee(s) · {r.latencyMs}ms</span><span className="flex gap-3">{r.epochId != null ? <button onClick={() => downloadProof(r)} className="hush-text underline">proof ↓</button> : <span title="Sealed into the next epoch">proof soon</span>}<a className="underline" href={explorer(r.refundSignature ?? r.signature)} target="_blank">tx ↗</a></span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-6"><p className="label mb-4">Hush Score</p><ScoreTable /></div>
            </div>

            {token && <AlertsCard token={token} />}

            <div className="card p-6">
              <p className="label">Activity</p>
              <div className="mt-3 max-h-60 space-y-1 overflow-auto font-mono text-xs text-muted">{log.length ? log.map((l, i) => <p key={i}>{l}</p>) : <p className="text-subtle">Nothing yet.</p>}</div>
            </div>
          </section>
        </div>
      )}
      {picker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPicker(false)}>
          <div className="card no-lift w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connect a wallet">
            <div className="flex items-center justify-between"><p className="label">Connect a wallet</p><button onClick={() => setPicker(false)} className="text-muted hover:text-fg" aria-label="Close">✕</button></div>
            <div className="mt-4 space-y-2">
              {wallets.map((w) => (
                <button key={w.name} onClick={() => connect(w)} className="card-raised flex w-full items-center gap-3 px-4 py-3 text-left hover:border-hush">
                  {w.icon ? <img src={w.icon} alt="" className="h-7 w-7 rounded-lg" /> : <span className="h-7 w-7 rounded-lg bg-line" />}
                  <span className="font-medium">{w.name}</span>
                  <span className="label ml-auto">Detected</span>
                </button>
              ))}
              {wallets.length === 0 && <p className="text-sm text-muted">No Solana wallet found in this browser.</p>}
            </div>
            {INSTALL.some((i) => !wallets.some((w) => w.name.toLowerCase().startsWith(i.name.toLowerCase()))) && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="label">Get a wallet</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {INSTALL.filter((i) => !wallets.some((w) => w.name.toLowerCase().startsWith(i.name.toLowerCase()))).map((i) => (
                    <a key={i.name} href={i.url} target="_blank" rel="noreferrer" className="text-muted underline hover:text-fg">{i.name} ↗</a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
