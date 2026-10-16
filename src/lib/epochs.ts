// Receipt epochs: unsealed receipts are rolled into a Merkle tree, the root is stored and anchored on Solana
// with an SPL Memo signed by the publisher key (derived from HUSH_SECRET).
import { Connection, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { deriveKeypair } from "@/gate/crypto";
import { buildLevels, leafOf, memoFor, pathFrom, type ReceiptProof } from "./merkle";
import { d1 } from "./store";
import { CLUSTER, HUSH_SECRET, RPC_URL } from "./config";

export const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const MAX_LEAVES = 4096;
export const MIN_ANCHOR_LAMPORTS = 10_000;

export const publisherKeypair = () => deriveKeypair(HUSH_SECRET, "publisher/v1");
export const publisherAddress = async () => (await publisherKeypair()).publicKey.toBase58();

export interface Epoch { id: number; root: string; leafCount: number; firstAt: number; lastAt: number; createdAt: number; anchorStatus: "pending" | "anchored"; anchorSig: string | null; anchorError: string | null; anchoredAt: number | null }
type EpochRow = { id: number; root: string; leaf_count: number; first_at: string; last_at: string; created_at: string; anchor_status: "pending" | "anchored"; anchor_sig: string | null; anchor_error: string | null; anchored_at: string | null };
const toEpoch = (r: EpochRow): Epoch => ({ id: Number(r.id), root: r.root, leafCount: Number(r.leaf_count), firstAt: Number(r.first_at), lastAt: Number(r.last_at), createdAt: Number(r.created_at), anchorStatus: r.anchor_status, anchorSig: r.anchor_sig, anchorError: r.anchor_error, anchoredAt: r.anchored_at ? Number(r.anchored_at) : null });

/** Seals every unsealed receipt (oldest first, up to MAX_LEAVES per epoch). Returns the new epochs. */
export async function sealEpochs(): Promise<Epoch[]> {
  const db = await d1();
  const out: Epoch[] = [];
  for (;;) {
    const { results } = await db.prepare("SELECT nonce, commitment, at FROM receipts WHERE epoch_id IS NULL ORDER BY at ASC, nonce ASC LIMIT ?").bind(MAX_LEAVES).all<{ nonce: string; commitment: string; at: string }>();
    if (!results.length) break;
    const leaves = await Promise.all(results.map((r) => leafOf(r.commitment)));
    const levels = await buildLevels(leaves);
    const root = levels[levels.length - 1][0];
    const e = await db.prepare(
      "INSERT INTO epochs (root, leaf_count, first_at, last_at, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *",
    ).bind(root, leaves.length, Number(results[0].at), Number(results[results.length - 1].at), Date.now()).first<EpochRow>();
    if (!e) throw new Error("epoch insert failed");
    // Only claim rows that are still unsealed, so two concurrent sealers cannot double-assign.
    const r = await db.prepare(
      `UPDATE receipts AS r SET epoch_id = ?, leaf_index = u.idx, leaf = u.leaf
       FROM (SELECT unnest(?::text[]) AS nonce, unnest(?::int[]) AS idx, unnest(?::text[]) AS leaf) AS u
       WHERE r.nonce = u.nonce AND r.epoch_id IS NULL`,
    ).bind(e.id, results.map((x) => x.nonce), results.map((_, i) => i), leaves).run();
    if (r.meta.changes !== results.length) {
      await db.prepare("UPDATE receipts SET epoch_id = NULL, leaf_index = NULL, leaf = NULL WHERE epoch_id = ?").bind(e.id).run();
      await db.prepare("DELETE FROM epochs WHERE id = ?").bind(e.id).run();
      break; // someone else sealed concurrently; try again next run
    }
    out.push(toEpoch(e));
    if (results.length < MAX_LEAVES) break;
  }
  return out;
}

/** Anchors pending epochs with an SPL Memo. Leaves them pending (with the reason) if the publisher can't pay. */
export async function anchorPending(limit = 5) {
  const db = await d1();
  const { results } = await db.prepare("SELECT * FROM epochs WHERE anchor_status = 'pending' ORDER BY id ASC LIMIT ?").bind(limit).all<EpochRow>();
  const kp = await publisherKeypair();
  const conn = new Connection(RPC_URL, "confirmed");
  const report: { epoch: number; status: string; signature?: string; error?: string }[] = [];
  for (const row of results) {
    const e = toEpoch(row);
    try {
      const bal = await conn.getBalance(kp.publicKey);
      if (bal < MIN_ANCHOR_LAMPORTS) throw new Error(`publisher ${kp.publicKey.toBase58()} needs SOL (balance ${bal} lamports)`);
      const ix = new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [{ pubkey: kp.publicKey, isSigner: true, isWritable: false }], data: Buffer.from(memoFor(e.id, e.root, e.leafCount), "utf8") });
      const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [kp], { commitment: "confirmed" });
      await db.prepare("UPDATE epochs SET anchor_status = 'anchored', anchor_sig = ?, anchor_error = NULL, anchored_at = ? WHERE id = ?").bind(sig, Date.now(), e.id).run();
      report.push({ epoch: e.id, status: "anchored", signature: sig });
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      await db.prepare("UPDATE epochs SET anchor_error = ? WHERE id = ?").bind(msg, e.id).run();
      report.push({ epoch: e.id, status: "pending", error: msg });
      if (/needs SOL/.test(msg)) break;
    }
  }
  return report;
}

export async function listEpochs(limit = 20): Promise<Epoch[]> {
  const { results } = await (await d1()).prepare("SELECT * FROM epochs ORDER BY id DESC LIMIT ?").bind(limit).all<EpochRow>();
  return results.map(toEpoch);
}

/** Proof for one receipt. Caller must have checked ownership. */
export async function proofFor(nonce: string): Promise<ReceiptProof | { pending: true }> {
  const db = await d1();
  const r = await db.prepare("SELECT commitment, epoch_id, leaf_index FROM receipts WHERE nonce = ?").bind(nonce).first<{ commitment: string; epoch_id: number | null; leaf_index: number | null }>();
  if (!r) throw new Error("unknown receipt");
  if (r.epoch_id == null || r.leaf_index == null) return { pending: true };
  const e = toEpoch((await db.prepare("SELECT * FROM epochs WHERE id = ?").bind(r.epoch_id).first<EpochRow>())!);
  const { results } = await db.prepare("SELECT leaf FROM receipts WHERE epoch_id = ? ORDER BY leaf_index ASC").bind(e.id).all<{ leaf: string }>();
  const levels = await buildLevels(results.map((x) => x.leaf));
  const idx = Number(r.leaf_index);
  return {
    v: 1,
    kind: "hush-receipt-proof",
    commitment: r.commitment,
    leaf: results[idx].leaf,
    leafIndex: idx,
    path: pathFrom(levels, idx),
    epoch: e.id,
    root: e.root,
    leafCount: e.leafCount,
    anchor: { cluster: CLUSTER, publisher: await publisherAddress(), signature: e.anchorSig, memo: memoFor(e.id, e.root, e.leafCount) },
  };
}

/** Anchored epoch roots each seller's receipts live in (for Hush Score). */
export async function sellerEpochs(): Promise<Map<string, { epoch: number; root: string; signature: string | null }[]>> {
  const { results } = await (await d1()).prepare(
    "SELECT DISTINCT r.legs, e.id, e.root, e.anchor_sig FROM receipts r JOIN epochs e ON e.id = r.epoch_id ORDER BY e.id ASC",
  ).all<{ legs: string; id: number; root: string; anchor_sig: string | null }>();
  const m = new Map<string, { epoch: number; root: string; signature: string | null }[]>();
  for (const r of results)
    for (const l of JSON.parse(r.legs) as { seller: string }[]) {
      const arr = m.get(l.seller) ?? [];
      if (!arr.some((x) => x.epoch === Number(r.id))) arr.push({ epoch: Number(r.id), root: r.root, signature: r.anchor_sig });
      m.set(l.seller, arr);
    }
  return m;
}
