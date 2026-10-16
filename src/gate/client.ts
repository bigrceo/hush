/**
 * Hush client: pays a Hush Gate 402 from a Solana keypair (agent wallet) in one transaction.
 *   const res = await hushFetch(url, { keypair, rpcUrl, maxTotal: 0.01 });
 */
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { b64url } from "./crypto";

export interface Requirement {
  scheme: string;
  network: string;
  resource: string;
  asset: string;
  currency: "SOL" | "USDC";
  maxAmountRequired: string;
  payTo: string;
  extra: { quote: string; legs: { seller: string; amount: string; payTo: string }[] };
}

export function buildPaymentTx(payer: PublicKey, req: Requirement): Transaction {
  const tx = new Transaction();
  for (const leg of req.extra.legs) {
    const to = new PublicKey(leg.payTo);
    if (req.currency === "SOL") {
      tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: to, lamports: BigInt(leg.amount) }));
    } else {
      const mint = new PublicKey(req.asset);
      const fromAta = getAssociatedTokenAddressSync(mint, payer);
      const toAta = getAssociatedTokenAddressSync(mint, to, true);
      tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, toAta, to, mint));
      tx.add(createTransferCheckedInstruction(fromAta, mint, toAta, payer, BigInt(leg.amount), 6));
    }
  }
  return tx;
}

export const paymentHeader = (quote: string, signature: string) => b64url(JSON.stringify({ quote, signature }));

export async function payRequirement(conn: Connection, keypair: Keypair, req: Requirement) {
  const tx = buildPaymentTx(keypair.publicKey, req);
  return sendAndConfirmTransaction(conn, tx, [keypair], { commitment: "confirmed" });
}

export async function hushFetch(
  url: string,
  o: {
    /** The paying keypair, or a function picking it once the 402 terms are known (e.g. from a pool). */
    keypair: Keypair | ((r: Requirement) => Promise<Keypair> | Keypair);
    rpcUrl: string;
    init?: RequestInit;
    approve?: (r: Requirement) => boolean | Promise<boolean>;
  },
) {
  const first = await fetch(url, o.init);
  if (first.status !== 402) return { res: first, paid: null as null | { signature: string; requirement: Requirement } };
  const body = (await first.json()) as { accepts: Requirement[] };
  const req = body.accepts[0];
  if (o.approve && !(await o.approve(req))) throw new Error("payment not approved by policy");
  const conn = new Connection(o.rpcUrl, "confirmed");
  const kp = typeof o.keypair === "function" ? await o.keypair(req) : o.keypair;
  const signature = await payRequirement(conn, kp, req);
  const headers = new Headers(o.init?.headers);
  headers.set("x-payment", paymentHeader(req.extra.quote, signature));
  const res = await fetch(url, { ...o.init, headers });
  return { res, paid: { signature, requirement: req } };
}
