// Wallet leak scan: what a stranger learns about any Solana wallet from its recent history alone.
// Reads the last N transactions from mainnet and builds the picture an observer would: who the wallet pays,
// who pays it, how often, how much, and at what hours. No HUSH account needed, nothing stored.
import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { RPC_URL } from "./config";

const SKIP = new Set(["11111111111111111111111111111111", "ComputeBudget111111111111111111111111111111"]);
const USDC = "EPjFWJd5AufqSSqeM2qJXSUmJMv2pqjHnSZWnXzrtkMR";

type Party = { address: string; out: number; in: number; solOut: number; solIn: number; usdcOut: number; usdcIn: number; first: number | null; last: number | null };

function deltas(t: ParsedTransactionWithMeta) {
  const keys = t.transaction.message.accountKeys;
  const sol = keys.map((k, i) => ({ address: k.pubkey.toBase58(), signer: k.signer, lamports: (t.meta?.postBalances[i] ?? 0) - (t.meta?.preBalances[i] ?? 0) }));
  const tok = new Map<string, { owner: string; mint: string; delta: number }>();
  for (const [arr, sign] of [[t.meta?.preTokenBalances ?? [], -1], [t.meta?.postTokenBalances ?? [], 1]] as const)
    for (const b of arr) {
      if (!b.owner) continue;
      const k = b.owner + b.mint;
      const cur = tok.get(k) ?? { owner: b.owner, mint: b.mint, delta: 0 };
      cur.delta += sign * Number(b.uiTokenAmount.uiAmountString ?? 0);
      tok.set(k, cur);
    }
  return { sol, tokens: [...tok.values()].filter((x) => Math.abs(x.delta) > 1e-9) };
}

export async function walletLeaks(address: string, limit = 40) {
  let pk: PublicKey;
  try { pk = new PublicKey(address); } catch { throw new Error("not a Solana address"); }
  const me = pk.toBase58();
  const c = new Connection(RPC_URL, "confirmed");
  const sigs = (await c.getSignaturesForAddress(pk, { limit })).filter((s) => !s.err);
  if (!sigs.length) throw new Error("no transactions found for this address");
  const txs: (ParsedTransactionWithMeta | null)[] = [];
  // One call per tx, 6 at a time: many RPC plans refuse batched getParsedTransactions.
  for (let i = 0; i < sigs.length; i += 6)
    txs.push(...(await Promise.all(sigs.slice(i, i + 6).map((s) => c.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null)))));

  const parties = new Map<string, Party>();
  const hours = Array(24).fill(0) as number[];
  let spentSol = 0, spentUsdc = 0;
  const touch = (a: string, at: number | null) => {
    const p = parties.get(a) ?? { address: a, out: 0, in: 0, solOut: 0, solIn: 0, usdcOut: 0, usdcIn: 0, first: null, last: null };
    if (at) { p.first = p.first == null ? at : Math.min(p.first, at); p.last = p.last == null ? at : Math.max(p.last, at); }
    parties.set(a, p); return p;
  };
  for (const t of txs) {
    if (!t?.meta) continue;
    const at = t.blockTime ?? null;
    if (at) hours[new Date(at * 1000).getUTCHours()]++;
    const { sol, tokens } = deltas(t);
    const mine = sol.find((s) => s.address === me);
    const meSigned = !!mine?.signer;
    // Outgoing: I signed and someone else gained.
    if (meSigned) {
      for (const s of sol) if (s.address !== me && !s.signer && s.lamports > 0 && !SKIP.has(s.address)) { const p = touch(s.address, at); p.out++; p.solOut += s.lamports / 1e9; spentSol += s.lamports / 1e9; }
      for (const tk of tokens) if (tk.owner !== me && tk.delta > 0) { const p = touch(tk.owner, at); if (!sol.some((s) => s.address === tk.owner && s.lamports > 0)) p.out++; if (tk.mint === USDC) { p.usdcOut += tk.delta; spentUsdc += tk.delta; } }
    } else {
      // Incoming: someone else signed and I gained.
      const gained = (mine?.lamports ?? 0) > 0 || tokens.some((tk) => tk.owner === me && tk.delta > 0);
      const payer = sol.find((s) => s.signer)?.address;
      if (gained && payer && payer !== me) {
        const p = touch(payer, at); p.in++;
        p.solIn += Math.max(0, mine?.lamports ?? 0) / 1e9;
        for (const tk of tokens) if (tk.owner === me && tk.delta > 0 && tk.mint === USDC) p.usdcIn += tk.delta;
      }
    }
  }
  const list = [...parties.values()].sort((a, b) => b.out + b.in - (a.out + a.in));
  const repeat = list.filter((p) => p.out >= 2);
  const balance = await c.getBalance(pk).catch(() => null);
  const busiest = hours.indexOf(Math.max(...hours));
  const leaks: string[] = [];
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  if (list.some((p) => p.out)) leaks.push(`${n(list.filter((p) => p.out).length, "address", "addresses")} this wallet paid, readable by anyone`);
  if (repeat.length) leaks.push(`${n(repeat.length, "repeat payee", "repeat payees")}: a supplier or customer list`);
  if (list.some((p) => p.in)) leaks.push(`${n(list.filter((p) => p.in).length, "address", "addresses")} that paid this wallet`);
  if (spentSol > 0 || spentUsdc > 0) leaks.push(`spend total: ${spentSol.toFixed(4)} SOL${spentUsdc ? ` + ${spentUsdc.toFixed(2)} USDC` : ""}`);
  if (balance != null) leaks.push(`live balance: ${(balance / 1e9).toFixed(4)} SOL`);
  leaks.push(`most active around ${String(busiest).padStart(2, "0")}:00 UTC`);
  return {
    address: me, scanned: txs.filter(Boolean).length, balanceLamports: balance, spentSol, spentUsdc, hours, busiestHourUtc: busiest,
    counterparties: list.length, repeatPayees: repeat.length, top: list.slice(0, 10), leaks,
    verdict: `${leaks.length} things a stranger learns from the last ${txs.filter(Boolean).length} transactions`,
  };
}
