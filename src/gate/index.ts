/**
 * Hush Gate — private x402 middleware for Solana.
 *
 *   export const GET = hushGate({ price: "0.001", currency: "SOL", resource: "/forecast" }, handler);
 *
 * 1. A call without X-PAYMENT gets HTTP 402 + payment requirements. Every leg pays a ONE-TIME stealth
 *    address derived from (HUSH_SECRET, nonce, leg). Nobody watching the chain can link two calls to the
 *    same seller, or a buyer to what it bought.
 * 2. The client pays (SOL or USDC, one transaction, all legs) and retries with X-PAYMENT = base64url JSON
 *    { quote, signature }.
 * 3. The gate re-derives the stealth addresses, reads the transaction over RPC, checks amounts, asset,
 *    expiry and replay, then runs the handler.
 * 4. Per-call escrow: the money sits on the stealth address until the handler returns a valid answer.
 *    If the handler fails, the gate refunds the payer from the stealth key and answers 502.
 *
 * Works with anything that speaks Web Request/Response: Next.js route handlers, Hono, Workers, Bun.
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { b64url, deriveKeypair, fromB64url, hmac, randomId, timingSafeEqual } from "./crypto";

export type Currency = "SOL" | "USDC";

export interface Leg {
  /** Seller label (shown in receipts). */
  seller: string;
  /** Human amount, e.g. "0.001". */
  amount: string;
}

export interface GateOptions {
  resource: string;
  description?: string;
  currency?: Currency;
  /** Single-seller price. Ignored when `legs` is set. */
  price?: string;
  seller?: string;
  /** Composite call: one request pays several upstream sellers in the same transaction. */
  legs?: Leg[];
  secret: string;
  rpcUrl: string;
  network: string;
  usdcMint: string;
  ttlMs?: number;
  /** Called after verify; return false to reject (replay store). Default: in-memory set. */
  claimSignature?: (sig: string) => Promise<boolean> | boolean;
  /** Settlement hook: fired on every verified call (success or refund). */
  onReceipt?: (r: GateReceipt) => void | Promise<void>;
}

export interface GateReceipt {
  nonce: string;
  resource: string;
  currency: Currency;
  legs: { seller: string; amount: string; payTo: string }[];
  total: string;
  payer: string;
  signature: string;
  ok: boolean;
  refundSignature?: string;
  latencyMs: number;
  at: number;
}

export interface Quote {
  v: 1;
  r: string; // resource
  c: Currency;
  l: { s: string; a: string }[]; // legs
  n: string; // nonce
  e: number; // expiry ms
}

export const MIN_SOL_LEG = 890_880n;
const DECIMALS: Record<Currency, number> = { SOL: 9, USDC: 6 };

export function toBase(amount: string, cur: Currency): bigint {
  const [i, f = ""] = amount.split(".");
  const d = DECIMALS[cur];
  return BigInt(i || "0") * 10n ** BigInt(d) + BigInt((f + "0".repeat(d)).slice(0, d) || "0");
}
export function fromBase(v: bigint, cur: Currency): string {
  const d = DECIMALS[cur];
  const s = v.toString().padStart(d + 1, "0");
  return (s.slice(0, -d) + "." + s.slice(-d)).replace(/\.?0+$/, "");
}

export async function stealthKeypair(secret: string, nonce: string, leg: number) {
  return deriveKeypair(secret, `stealth/${nonce}/${leg}`);
}

async function signQuote(secret: string, q: Quote): Promise<string> {
  const body = b64url(JSON.stringify(q));
  const sig = b64url(await hmac(secret, "quote/" + body));
  return body + "." + sig;
}

async function openQuote(secret: string, token: string): Promise<Quote | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = b64url(await hmac(secret, "quote/" + body));
  if (!timingSafeEqual(sig, expect)) return null;
  try {
    return JSON.parse(fromB64url(body)) as Quote;
  } catch {
    return null;
  }
}

const g = globalThis as unknown as { __hushSeen?: Set<string> };
const seen = (g.__hushSeen ??= new Set<string>());

export async function buildRequirements(o: GateOptions) {
  const cur = o.currency ?? "SOL";
  const legs: Leg[] = o.legs ?? [{ seller: o.seller ?? "seller", amount: o.price ?? "0" }];
  // A fresh Solana account must be rent-exempt, so a SOL leg to a one-time payee can't be dust.
  if (cur === "SOL") for (const x of legs) if (toBase(x.amount, cur) < MIN_SOL_LEG) throw new Error(`SOL leg below ${MIN_SOL_LEG} lamports (rent-exempt minimum)`);
  const q: Quote = {
    v: 1,
    r: o.resource,
    c: cur,
    l: legs.map((x) => ({ s: x.seller, a: x.amount })),
    n: randomId(12),
    e: Date.now() + (o.ttlMs ?? 300_000),
  };
  const token = await signQuote(o.secret, q);
  const payTo = await Promise.all(
    legs.map(async (_, i) => (await stealthKeypair(o.secret, q.n, i)).publicKey.toBase58()),
  );
  const total = legs.reduce((s, x) => s + toBase(x.amount, cur), 0n);
  return {
    x402Version: 1,
    error: "payment required",
    accepts: [
      {
        scheme: "exact",
        network: o.network,
        resource: o.resource,
        description: o.description ?? "",
        asset: cur === "SOL" ? "native" : o.usdcMint,
        currency: cur,
        maxAmountRequired: total.toString(),
        maxTimeoutSeconds: Math.floor((q.e - Date.now()) / 1000),
        // Private x402 extension: every leg is a one-time stealth payee.
        extra: {
          privacy: "stealth-one-time-payee",
          quote: token,
          legs: legs.map((x, i) => ({
            seller: x.seller,
            amount: toBase(x.amount, cur).toString(),
            payTo: payTo[i],
          })),
        },
        payTo: payTo[0],
      },
    ],
  };
}

type RpcTx = {
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: { owner?: string; mint: string; uiTokenAmount: { amount: string } }[];
    postTokenBalances?: { owner?: string; mint: string; uiTokenAmount: { amount: string } }[];
  } | null;
  transaction: { message: { accountKeys: ({ pubkey: string } | string)[] } };
  blockTime: number | null;
};

async function getTx(rpcUrl: string, sig: string): Promise<RpcTx | null> {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [sig, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
      }),
    });
    const j = (await r.json()) as { result: RpcTx | null };
    if (j.result) return j.result;
    await new Promise((res) => setTimeout(res, 750));
  }
  return null;
}

function received(tx: RpcTx, cur: Currency, owner: string, mint: string): bigint {
  const keys = tx.transaction.message.accountKeys.map((k) => (typeof k === "string" ? k : k.pubkey));
  if (!tx.meta) return 0n;
  if (cur === "SOL") {
    const i = keys.indexOf(owner);
    if (i < 0) return 0n;
    return BigInt(tx.meta.postBalances[i]) - BigInt(tx.meta.preBalances[i]);
  }
  const sum = (arr?: RpcTx["meta"] extends infer M ? (M extends { postTokenBalances?: infer T } ? T : never) : never) =>
    (arr ?? [])
      .filter((b) => b.owner === owner && b.mint === mint)
      .reduce((s, b) => s + BigInt(b.uiTokenAmount.amount), 0n);
  return sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances);
}

export type VerifyResult =
  | { ok: true; quote: Quote; payer: string; signature: string; payTo: string[] }
  | { ok: false; status: number; error: string };

export async function verifyPayment(o: GateOptions, header: string): Promise<VerifyResult> {
  let p: { quote: string; signature: string };
  try {
    p = JSON.parse(fromB64url(header));
  } catch {
    return { ok: false, status: 400, error: "bad X-PAYMENT header" };
  }
  if (typeof p?.quote !== "string" || typeof p?.signature !== "string")
    return { ok: false, status: 400, error: "X-PAYMENT needs { quote, signature }" };
  const q = await openQuote(o.secret, p.quote);
  if (!q) return { ok: false, status: 402, error: "quote not signed by this gate" };
  if (q.r !== o.resource) return { ok: false, status: 402, error: "quote is for another resource" };
  if (Date.now() > q.e) return { ok: false, status: 402, error: "quote expired" };
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(p.signature)) return { ok: false, status: 400, error: "bad signature" };

  const tx = await getTx(o.rpcUrl, p.signature);
  if (!tx || !tx.meta) return { ok: false, status: 402, error: "transaction not found (yet)" };
  if (tx.meta.err) return { ok: false, status: 402, error: "transaction failed on-chain" };
  if (tx.blockTime && tx.blockTime * 1000 < q.e - (o.ttlMs ?? 300_000) - 60_000)
    return { ok: false, status: 402, error: "transaction older than quote" };

  const payTo: string[] = [];
  for (let i = 0; i < q.l.length; i++) {
    const pk = (await stealthKeypair(o.secret, q.n, i)).publicKey.toBase58();
    payTo.push(pk);
    const got = received(tx, q.c, pk, o.usdcMint);
    if (got < toBase(q.l[i].a, q.c)) return { ok: false, status: 402, error: `leg ${i} underpaid` };
  }
  const claim = o.claimSignature ?? ((s: string) => (seen.has(s) ? false : (seen.add(s), true)));
  if (!(await claim(p.signature))) return { ok: false, status: 409, error: "payment already used" };

  const k0 = tx.transaction.message.accountKeys[0];
  const payer = typeof k0 === "string" ? k0 : k0.pubkey;
  return { ok: true, quote: q, payer, signature: p.signature, payTo };
}

/** Escrow refund: the gate holds every stealth key, so it can send a failed call's money back. */
export async function refund(o: GateOptions, q: Quote, payer: string): Promise<string | undefined> {
  if (q.c !== "SOL") return undefined; // USDC refunds need a fee payer; settled by the facilitator sweep.
  const conn = new Connection(o.rpcUrl, "confirmed");
  let last: string | undefined;
  for (let i = 0; i < q.l.length; i++) {
    const kp = await stealthKeypair(o.secret, q.n, i);
    const bal = await conn.getBalance(kp.publicKey);
    const send = bal - 5000;
    if (send <= 0) continue;
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(payer), lamports: send }),
    );
    last = await sendAndConfirmTransaction(conn, tx, [kp]);
  }
  return last;
}

export function hushGate(o: GateOptions, handler: (req: Request, ctx: { payer: string; nonce: string }) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const header = req.headers.get("x-payment");
    if (!header) {
      return Response.json(await buildRequirements(o), { status: 402 });
    }
    const t0 = Date.now();
    const v = await verifyPayment(o, header);
    if (!v.ok) return Response.json({ error: v.error, ...(v.status === 402 ? await buildRequirements(o) : {}) }, { status: v.status });

    const legs = v.quote.l.map((x, i) => ({ seller: x.s, amount: x.a, payTo: v.payTo[i] }));
    const total = fromBase(
      v.quote.l.reduce((s, x) => s + toBase(x.a, v.quote.c), 0n),
      v.quote.c,
    );
    const base = { nonce: v.quote.n, resource: o.resource, currency: v.quote.c, legs, total, payer: v.payer, signature: v.signature };

    let res: Response | null = null;
    try {
      res = await handler(req, { payer: v.payer, nonce: v.quote.n });
      if (!res.ok) throw new Error("handler returned " + res.status);
    } catch (e) {
      let refundSignature: string | undefined;
      try {
        refundSignature = await refund(o, v.quote, v.payer);
      } catch {}
      await o.onReceipt?.({ ...base, ok: false, refundSignature, latencyMs: Date.now() - t0, at: Date.now() });
      return Response.json({ error: "seller failed, refunded", detail: String(e), refundSignature }, { status: 502 });
    }
    await o.onReceipt?.({ ...base, ok: true, latencyMs: Date.now() - t0, at: Date.now() });
    const out = new Response(res.body, res);
    out.headers.set("x-payment-response", b64url(JSON.stringify({ success: true, nonce: v.quote.n, signature: v.signature })));
    return out;
  };
}
