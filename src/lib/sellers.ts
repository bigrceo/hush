// Self-serve sellers: anyone registers an https endpoint + price; HUSH sells it through the gate and proxies
// paid calls to it. Earnings sit on the one-time stealth payees until the seller sweeps them.
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { randomId } from "@/gate/crypto";
import { stealthKeypair } from "@/gate";
import { HUSH_SECRET, RPC_URL } from "./config";
import { d1 } from "./store";
import { LISTINGS, type Listing } from "./shop";
import { SELLER_LIMITS, validateSeller, type SellerInput } from "./sellerrules";
import { FEE } from "./poolmath";

export interface Seller { id: string; owner: string; name: string; url: string; priceLamports: number; description: string; input: string | null; active: boolean; createdAt: number }
type Row = { id: string; owner: string; name: string; url: string; price_lamports: string; description: string; input: string | null; active: number; created_at: string };
const toSeller = (r: Row): Seller => ({ id: r.id, owner: r.owner, name: r.name, url: r.url, priceLamports: Number(r.price_lamports), description: r.description, input: r.input, active: !!r.active, createdAt: Number(r.created_at) });
const BLOCKED = ["hushagents.com", "vercel.app", "hush-ashen.vercel.app"];

export const sellerListingId = (id: string) => `s-${id}`;
export const sellerLabel = (s: Seller) => `${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24)}.seller`;

export function asListing(s: Seller): Listing {
  return { id: sellerListingId(s.id), name: s.name, seller: sellerLabel(s), blurb: s.description, currency: "SOL", price: (s.priceLamports / 1e9).toString(), input: s.input ?? undefined, kind: "data" };
}

export async function createSeller(owner: string, x: SellerInput) {
  const err = validateSeller(x, BLOCKED);
  if (err) throw new Error(err);
  const db = await d1();
  const n = await db.prepare("SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE created_at > ?) AS recent FROM sellers WHERE owner = ? AND active = 1").bind(Date.now() - 3600_000, owner).first<{ n: string; recent: string }>();
  if (Number(n?.n ?? 0) >= SELLER_LIMITS.maxPerOwner) throw new Error(`at most ${SELLER_LIMITS.maxPerOwner} active listings per wallet`);
  if (Number(n?.recent ?? 0) >= 3) throw new Error("too many new listings this hour, try later");
  const id = randomId(5);
  await db.prepare("INSERT INTO sellers (id, owner, name, url, price_lamports, description, input, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)")
    .bind(id, owner, x.name.trim(), x.url, Math.round(x.priceSol * 1e9), x.description.trim(), x.input || null, Date.now()).run();
  return (await getSeller(id))!;
}

export async function getSeller(id: string) {
  const r = await (await d1()).prepare("SELECT * FROM sellers WHERE id = ?").bind(id).first<Row>();
  return r ? toSeller(r) : null;
}
export async function listSellers(owner?: string) {
  const db = await d1();
  const { results } = owner
    ? await db.prepare("SELECT * FROM sellers WHERE owner = ? ORDER BY created_at DESC").bind(owner).all<Row>()
    : await db.prepare("SELECT * FROM sellers WHERE active = 1 ORDER BY created_at DESC LIMIT 200").all<Row>();
  return results.map(toSeller);
}
export async function setSellerActive(owner: string, id: string, active: boolean) {
  await (await d1()).prepare("UPDATE sellers SET active = ? WHERE id = ? AND owner = ?").bind(active ? 1 : 0, id, owner).run();
}

/** Built-in listings plus every active seller listing. */
export async function allListings(): Promise<Listing[]> {
  return [...LISTINGS, ...(await listSellers().catch(() => [])).map(asListing)];
}
export async function findListing(id: string): Promise<Listing | undefined> {
  const b = LISTINGS.find((l) => l.id === id);
  if (b) return b;
  if (!id.startsWith("s-")) return undefined;
  const s = await getSeller(id.slice(2));
  return s?.active ? asListing(s) : undefined;
}

/** Calls the seller's upstream with a timeout and a size cap. Throws on any failure (the gate then refunds). */
export async function callUpstream(s: Seller, buyerUrl: URL) {
  const u = new URL(s.url);
  if (s.input) { const v = buyerUrl.searchParams.get(s.input); if (v) u.searchParams.set(s.input, v.slice(0, 200)); }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), SELLER_LIMITS.timeoutMs);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: "error", headers: { "user-agent": "HUSH-proxy/1 (+https://hushagents.com)", accept: "application/json, text/plain" } });
    if (!r.ok) throw new Error(`seller answered ${r.status}`);
    const buf = await r.arrayBuffer();
    if (buf.byteLength > SELLER_LIMITS.maxBytes) throw new Error("seller response too large");
    const text = new TextDecoder().decode(buf);
    try { return JSON.parse(text); } catch { return { text }; }
  } finally { clearTimeout(t); }
}

/** Unswept earnings of a seller: successful receipts whose one-time payees still hold the payment. */
export async function sellerEarnings(s: Seller) {
  const { results } = await (await d1()).prepare("SELECT nonce, total, swept_sig, at FROM receipts WHERE listing = ? AND ok = 1 ORDER BY at DESC").bind(sellerListingId(s.id)).all<{ nonce: string; total: string; swept_sig: string | null; at: string }>();
  const unswept = results.filter((r) => !r.swept_sig);
  return {
    calls: results.length,
    earnedSol: results.reduce((a, r) => a + Number(r.total), 0),
    unsweptSol: unswept.reduce((a, r) => a + Number(r.total), 0),
    unswept: unswept.length,
    sweeps: [...new Set(results.filter((r) => r.swept_sig).map((r) => r.swept_sig!))].slice(0, 20),
  };
}

/** Sweeps every unswept one-time payee of this seller to the seller's wallet, several per transaction. */
export async function sweepSeller(s: Seller, maxPayees = 40) {
  const db = await d1();
  const { results } = await db.prepare("SELECT nonce FROM receipts WHERE listing = ? AND ok = 1 AND swept_sig IS NULL ORDER BY at ASC LIMIT ?").bind(sellerListingId(s.id), maxPayees).all<{ nonce: string }>();
  const conn = new Connection(RPC_URL, "confirmed");
  const to = new PublicKey(s.owner);
  const sigs: string[] = [];
  let lamports = 0;
  for (let i = 0; i < results.length; i += 6) {
    const batch = results.slice(i, i + 6);
    const kps = await Promise.all(batch.map((r) => stealthKeypair(HUSH_SECRET, r.nonce, 0)));
    const bals = await Promise.all(kps.map((k) => conn.getBalance(k.publicKey)));
    const live = kps.map((k, j) => ({ k, bal: bals[j], nonce: batch[j].nonce })).filter((x) => x.bal > 0);
    if (!live.length) continue;
    // First payee pays the fee for the whole batch; every payee is drained to exactly 0.
    const tx = new Transaction();
    live.forEach((x, j) => tx.add(SystemProgram.transfer({ fromPubkey: x.k.publicKey, toPubkey: to, lamports: j === 0 ? x.bal - FEE * live.length : x.bal })));
    tx.feePayer = live[0].k.publicKey;
    const sig = await sendAndConfirmTransaction(conn, tx, live.map((x) => x.k), { commitment: "confirmed" });
    sigs.push(sig);
    lamports += live.reduce((a, x) => a + x.bal, 0) - FEE * live.length;
    await db.prepare("UPDATE receipts SET swept_sig = ? WHERE nonce = ANY(?::text[])").bind(sig, live.map((x) => x.nonce)).run();
  }
  return { signatures: sigs, sol: lamports / 1e9 };
}
