// Privacy proof: (1) end-to-end chains for HUSH's own demo agent, disclosed on purpose, and (2) an unlinkability
// check anyone can run on any payout transaction. Real users' chains are never shown: that link is what HUSH hides.
import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { RPC_URL } from "./config";
import { d1 } from "./store";
import { poolAddresses } from "./pool";
import { proofFor } from "./epochs";
import { leafOf, rootFromPath } from "./merkle";

export const DEMO_AGENT_ID = process.env.DEMO_AGENT_ID || "aeb46c0a5eeb"; // "claude-demo", owned by the HUSH team
const conn = () => new Connection(RPC_URL, "confirmed");

const keysOf = (t: ParsedTransactionWithMeta) => t.transaction.message.accountKeys.map((k) => ({ pubkey: k.pubkey.toBase58(), signer: k.signer, writable: k.writable }));

/** SOL movements of a parsed tx: per account, post - pre lamports. */
function deltas(t: ParsedTransactionWithMeta) {
  const k = keysOf(t);
  return k.map((x, i) => ({ ...x, lamports: (t.meta?.postBalances[i] ?? 0) - (t.meta?.preBalances[i] ?? 0) }));
}

/** How many transactions an address had before `sig` (0 = brand new at that payment). Looks back up to 1000. */
async function priorHistory(c: Connection, addr: string, sig: string) {
  const sigs = await c.getSignaturesForAddress(new PublicKey(addr), { limit: 1000 });
  const i = sigs.findIndex((s) => s.signature === sig);
  return { before: i < 0 ? null : sigs.length - 1 - i, total: sigs.length, firstSeen: sigs.at(-1)?.signature ?? null };
}

/** Public: analyse any payout tx. Says who signed / paid, whether that is a HUSH pool address, and whether the receivers were fresh. */
export async function unlinkabilityCheck(sig: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) throw new Error("not a transaction signature");
  const c = conn();
  const t = await c.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  if (!t || !t.meta) throw new Error("transaction not found");
  const pool = new Set(await poolAddresses());
  const d = deltas(t);
  const signers = d.filter((x) => x.signer).map((x) => ({ address: x.pubkey, hushPool: pool.has(x.pubkey) }));
  const receivers = d.filter((x) => x.lamports > 0 && !x.signer);
  const recv = await Promise.all(receivers.map(async (r) => ({ address: r.pubkey, lamports: r.lamports, ...(await priorHistory(c, r.pubkey, sig)) })));
  const receipt = await (await d1()).prepare("SELECT commitment, epoch_id FROM receipts WHERE signature = ?").bind(sig).first<{ commitment: string; epoch_id: number | null }>();
  const allPool = signers.length > 0 && signers.every((s) => s.hushPool);
  return {
    signature: sig,
    at: t.blockTime ? new Date(t.blockTime * 1000).toISOString() : null,
    signers,
    receivers: recv,
    hushReceipt: receipt ? { commitment: receipt.commitment, epoch: receipt.epoch_id } : null,
    verdict: !receipt
      ? "not a HUSH payment"
      : allPool && recv.every((r) => r.before === 0)
        ? "unlinkable: signed only by the shared HUSH pool, paid to address(es) with no history before this payment"
        : allPool ? "signed only by the shared HUSH pool" : "signed by a non-pool wallet",
    poolAddresses: [...pool],
  };
}

/** The demo agent's latest paid calls, each traced end to end. */
export async function demoChains(n = 3) {
  const db = await d1();
  const agent = await db.prepare("SELECT pubkey, owner, name FROM agents WHERE id = ?").bind(DEMO_AGENT_ID).first<{ pubkey: string; owner: string; name: string }>();
  if (!agent) return { agent: null, chains: [] };
  type R = { nonce: string; signature: string; listing: string; total: string; at: string };
  // Latest payments, plus the latest one already sealed into an anchored epoch (fresh ones wait for the hourly seal).
  const latest = (await db.prepare("SELECT nonce, signature, listing, total, at FROM receipts WHERE agent_id = ? AND ok = 1 ORDER BY at DESC LIMIT ?").bind(DEMO_AGENT_ID, n).all<R>()).results;
  const sealed = await db.prepare("SELECT r.nonce, r.signature, r.listing, r.total, r.at FROM receipts r JOIN epochs e ON e.id = r.epoch_id WHERE r.agent_id = ? AND r.ok = 1 AND e.anchor_sig IS NOT NULL ORDER BY r.at DESC LIMIT 1").bind(DEMO_AGENT_ID).first<R>();
  const results = sealed && !latest.some((x) => x.nonce === sealed.nonce) ? [...latest.slice(0, n - 1), sealed] : latest;
  const c = conn();
  const chains = await Promise.all(results.map(async (r) => {
    const dep = await db.prepare("SELECT ref, lamports, at FROM ledger WHERE agent_id = ? AND kind = 'deposit' AND at <= ? AND ref IS NOT NULL ORDER BY at DESC LIMIT 1").bind(DEMO_AGENT_ID, Number(r.at)).first<{ ref: string; lamports: string; at: string }>();
    const check = await unlinkabilityCheck(r.signature).catch((e) => ({ error: String(e) }));
    const t = await c.getParsedTransaction(r.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }).catch(() => null);
    const keys = t ? keysOf(t).map((k) => k.pubkey) : [];
    const p = await proofFor(r.nonce).catch(() => null);
    let merkle: unknown = { pending: true, note: "joins the next hourly epoch" };
    if (p && !("pending" in p)) merkle = { epoch: p.epoch, root: p.root, leafIndex: p.leafIndex, leafCount: p.leafCount, verified: (await rootFromPath(await leafOf(p.commitment), p.path)) === p.root, anchorTx: p.anchor.signature, memo: p.anchor.memo };
    return {
      listing: r.listing, amount: r.total, at: Number(r.at),
      deposit: dep ? { tx: dep.ref, lamports: Number(dep.lamports), from: agent.pubkey } : null,
      payout: { tx: r.signature, check },
      payerNotInPayout: !keys.includes(agent.pubkey) && !keys.includes(agent.owner),
      merkle,
    };
  }));
  return { agent: { name: agent.name, depositAddress: agent.pubkey, owner: agent.owner }, chains };
}
