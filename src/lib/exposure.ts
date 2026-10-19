// Exposure report: what any Solana payment tells a stranger. Works on any tx (a plain wallet / x402 transfer or a
// HUSH payout): who paid, who got paid, how much history each side has, and how many earlier transactions they share.
import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { RPC_URL } from "./config";
import { poolAddresses } from "./pool";
import { d1 } from "./store";

const conn = () => new Connection(RPC_URL, "confirmed");
const SYSTEM = new Set(["11111111111111111111111111111111", "ComputeBudget111111111111111111111111111111"]);

type Hist = { before: number | null; capped: boolean; firstSeen: number | null; sigs: Set<string> };

async function history(c: Connection, addr: string, sig: string): Promise<Hist> {
  const sigs = await c.getSignaturesForAddress(new PublicKey(addr), { limit: 1000 });
  const i = sigs.findIndex((s) => s.signature === sig);
  const earlier = i < 0 ? [] : sigs.slice(i + 1);
  return { before: i < 0 ? null : earlier.length, capped: sigs.length === 1000, firstSeen: sigs.at(-1)?.blockTime ?? null, sigs: new Set(earlier.map((s) => s.signature)) };
}

/** Amount moved per owner: SOL lamport deltas plus SPL token deltas (owner-level, e.g. USDC for x402). */
function flows(t: ParsedTransactionWithMeta) {
  const keys = t.transaction.message.accountKeys;
  const sol = keys.map((k, i) => ({ address: k.pubkey.toBase58(), signer: k.signer, lamports: (t.meta?.postBalances[i] ?? 0) - (t.meta?.preBalances[i] ?? 0) }));
  const tok = new Map<string, { owner: string; mint: string; delta: number }>();
  for (const [arr, sign] of [[t.meta?.preTokenBalances ?? [], -1], [t.meta?.postTokenBalances ?? [], 1]] as const) {
    for (const b of arr) {
      if (!b.owner) continue;
      const k = b.owner + b.mint;
      const cur = tok.get(k) ?? { owner: b.owner, mint: b.mint, delta: 0 };
      cur.delta += sign * Number(b.uiTokenAmount.uiAmountString ?? 0);
      tok.set(k, cur);
    }
  }
  return { sol, tokens: [...tok.values()].filter((x) => Math.abs(x.delta) > 1e-12) };
}

export async function exposure(sig: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) throw new Error("not a transaction signature");
  const c = conn();
  const t = await c.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  if (!t || !t.meta) throw new Error("transaction not found");
  const pool = new Set(await poolAddresses());
  const { sol, tokens } = flows(t);
  const payer = sol[0].address; // fee payer = first signer
  const signers = sol.filter((x) => x.signer).map((x) => x.address);
  // Receivers: owners that gained SOL (non-signer, not a program) or gained tokens.
  const recv = new Map<string, { address: string; lamports: number; tokens: { mint: string; amount: number }[] }>();
  for (const s of sol) if (!s.signer && s.lamports > 0 && !SYSTEM.has(s.address)) recv.set(s.address, { address: s.address, lamports: s.lamports, tokens: [] });
  for (const tk of tokens) if (tk.delta > 0 && !signers.includes(tk.owner)) {
    const r = recv.get(tk.owner) ?? { address: tk.owner, lamports: 0, tokens: [] };
    r.tokens.push({ mint: tk.mint, amount: tk.delta }); recv.set(tk.owner, r);
  }
  const receivers = [...recv.values()].slice(0, 4);
  const ph = await history(c, payer, sig);
  const rs = await Promise.all(receivers.map(async (r) => {
    const h = await history(c, r.address, sig);
    let shared = 0; for (const s of h.sigs) if (ph.sigs.has(s)) shared++;
    return { ...r, before: h.before, capped: h.capped, firstSeen: h.firstSeen, sharedWithPayer: shared };
  }));
  const balance = await c.getBalance(new PublicKey(payer)).catch(() => null);
  const receipt = await (await d1()).prepare("SELECT epoch_id FROM receipts WHERE signature = ?").bind(sig).first<{ epoch_id: number | null }>().catch(() => null);
  const payerIsPool = pool.has(payer);
  const leaks: string[] = [];
  if (!payerIsPool) {
    leaks.push("the payer's own wallet signed and paid");
    if ((ph.before ?? 0) > 0) leaks.push(`the payer's full history is one click away (${ph.before}${ph.capped ? "+" : ""} earlier transactions)`);
    if (balance != null) leaks.push(`the payer's balance is public (${(balance / 1e9).toFixed(4)} SOL right now)`);
  }
  for (const r of rs) {
    if (!payerIsPool) leaks.push(`payer → ${r.address.slice(0, 4)}…${r.address.slice(-4)} is a direct, permanent on-chain link`);
    if (r.sharedWithPayer > 0) leaks.push(`payer and ${r.address.slice(0, 4)}…${r.address.slice(-4)} already shared ${r.sharedWithPayer} earlier transaction(s)`);
    if ((r.before ?? 0) > 0) leaks.push(`the receiver ${r.address.slice(0, 4)}…${r.address.slice(-4)} is a reused address (${r.before}${r.capped ? "+" : ""} earlier transactions)`);
  }
  return {
    signature: sig,
    at: t.blockTime ? new Date(t.blockTime * 1000).toISOString() : null,
    hush: !!receipt,
    payer: { address: payer, hushPool: payerIsPool, before: ph.before, capped: ph.capped, firstSeen: ph.firstSeen, balanceLamports: balance },
    receivers: rs,
    leaks,
    verdict: leaks.length === 0 ? "nothing links a payer to this payment" : `${leaks.length} thing(s) a stranger learns from this payment`,
  };
}
