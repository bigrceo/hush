// HUSH pool: payer-side privacy. Agents deposit into their own address; the server sweeps deposits into a set
// of rotating pool addresses and credits an internal ledger. Every buy is paid FROM a pool address TO the
// seller's one-time stealth payee, so on-chain there is no direct agent -> seller link.
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { deriveKeypair } from "@/gate/crypto";
import { HUSH_SECRET, RPC_URL } from "./config";
import { d1 } from "./store";
import { FEE, pickPayer, pickReceiver, planWithdraw } from "./poolmath";

export const POOL_SIZE = 4;
const conn = () => new Connection(RPC_URL, "confirmed");

export async function poolKeypairs(): Promise<Keypair[]> {
  return Promise.all(Array.from({ length: POOL_SIZE }, (_, i) => deriveKeypair(HUSH_SECRET, `pool/v1/${i}`)));
}
export async function poolAddresses() {
  return (await poolKeypairs()).map((k) => k.publicKey.toBase58());
}
export async function poolBalances(kps?: Keypair[]) {
  const ks = kps ?? (await poolKeypairs());
  const infos = await conn().getMultipleAccountsInfo(ks.map((k) => k.publicKey));
  return infos.map((i) => i?.lamports ?? 0);
}

async function ledger(agentId: string, kind: string, lamports: number, ref: string | null) {
  await (await d1()).prepare("INSERT INTO ledger (agent_id, kind, lamports, ref, at) VALUES (?, ?, ?, ?, ?)").bind(agentId, kind, lamports, ref, Date.now()).run();
}

export async function ledgerBalance(agentId: string): Promise<number> {
  const r = await (await d1()).prepare("SELECT balance_lamports FROM agents WHERE id = ?").bind(agentId).first<{ balance_lamports: string }>();
  return Number(r?.balance_lamports ?? 0);
}

export async function credit(agentId: string, lamports: number, kind: string, ref: string | null) {
  await (await d1()).prepare("UPDATE agents SET balance_lamports = balance_lamports + ? WHERE id = ?").bind(lamports, agentId).run();
  await ledger(agentId, kind, lamports, ref);
}

/** Atomic debit; false if the agent can't cover it. */
export async function debit(agentId: string, lamports: number, kind: string, ref: string | null) {
  const r = await (await d1()).prepare("UPDATE agents SET balance_lamports = balance_lamports - ? WHERE id = ? AND balance_lamports >= ?").bind(lamports, agentId, lamports).run();
  if (r.meta.changes !== 1) return false;
  await ledger(agentId, kind, -lamports, ref);
  return true;
}

/**
 * Sweeps whatever sits on the agent's deposit address into a random pool address and credits the ledger
 * (minus the network fee). Safe to call often; does nothing when the deposit address is empty.
 */
export async function sweepDeposit(agentId: string, depositKp: Keypair): Promise<{ swept: number; signature?: string }> {
  const c = conn();
  const bal = await c.getBalance(depositKp.publicKey);
  const amount = bal - FEE;
  if (amount <= 0) return { swept: 0 };
  const kps = await poolKeypairs();
  const to = pickReceiver(await poolBalances(kps), amount, Math.random());
  if (to < 0) return { swept: 0 };
  const sig = await sendAndConfirmTransaction(c, new Transaction().add(SystemProgram.transfer({ fromPubkey: depositKp.publicKey, toPubkey: kps[to].publicKey, lamports: amount })), [depositKp], { commitment: "confirmed" });
  await credit(agentId, amount, "deposit", sig);
  return { swept: amount, signature: sig };
}

/** A pool keypair that can pay `lamports` now (random among eligible), or null. */
export async function poolPayer(lamports: number): Promise<Keypair | null> {
  const kps = await poolKeypairs();
  const i = pickPayer(await poolBalances(kps), lamports, Math.random());
  return i < 0 ? null : kps[i];
}

/** Pays the agent's ledger balance out of the pool to `to` (the owner). */
export async function withdrawFromPool(agentId: string, to: string) {
  const want = await ledgerBalance(agentId);
  if (want <= 0) return { sent: 0, signatures: [] as string[] };
  const kps = await poolKeypairs();
  const { legs } = planWithdraw(await poolBalances(kps), want);
  const c = conn();
  const signatures: string[] = [];
  let sent = 0;
  for (const [i, lamports] of legs) {
    if (!(await debit(agentId, lamports + FEE, "withdraw", null))) break;
    try {
      const sig = await sendAndConfirmTransaction(c, new Transaction().add(SystemProgram.transfer({ fromPubkey: kps[i].publicKey, toPubkey: new PublicKey(to), lamports })), [kps[i]], { commitment: "confirmed" });
      signatures.push(sig);
      sent += lamports;
    } catch (e) {
      await credit(agentId, lamports + FEE, "release", null);
      throw e;
    }
  }
  return { sent, signatures };
}

/** Cron / migration: sweep every agent deposit address that holds SOL into the pool. */
export async function sweepAllDeposits() {
  const { results } = await (await d1()).prepare("SELECT id, secret_enc FROM agents").all<{ id: string; secret_enc: string }>();
  const { unseal } = await import("@/gate/crypto");
  let n = 0, lamports = 0;
  for (const r of results) {
    try {
      const kp = Keypair.fromSecretKey(await unseal(HUSH_SECRET, r.secret_enc));
      const s = await sweepDeposit(r.id, kp);
      if (s.swept) { n++; lamports += s.swept; }
    } catch {}
  }
  return { agents: n, sol: lamports / 1e9 };
}
