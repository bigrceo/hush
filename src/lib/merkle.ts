// HUSH receipt Merkle tree. Shared by the server (epochs, proofs) and the browser (/verify).
// No dependencies: WebCrypto SHA-256 only.
//
//   leaf  = sha256("hush-leaf-v1:" || commitment)        commitment = sha256(nonce|signature|payer), hex
//   node  = sha256(0x01 || left || right)                 raw 32-byte digests
//   odd   = a level with an odd count carries its last node up unchanged
//
// A proof is the leaf plus the sibling at every level ("L" = sibling on the left).

export type Side = "L" | "R";
export interface PathStep { sibling: string; side: Side }

const enc = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => {
  if (!/^[0-9a-f]{64}$/.test(h)) throw new Error("expected a 32-byte hex digest");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const sha = async (b: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", b as Uint8Array<ArrayBuffer>));

export async function leafOf(commitment: string): Promise<string> {
  return hex(await sha(enc.encode("hush-leaf-v1:" + commitment)));
}

export async function nodeOf(left: string, right: string): Promise<string> {
  const b = new Uint8Array(65);
  b[0] = 1;
  b.set(unhex(left), 1);
  b.set(unhex(right), 33);
  return hex(await sha(b));
}

/** All levels, bottom (leaves) first. */
export async function buildLevels(leaves: string[]): Promise<string[][]> {
  if (!leaves.length) throw new Error("empty tree");
  const levels = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const cur = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? await nodeOf(cur[i], cur[i + 1]) : cur[i]);
    levels.push(next);
  }
  return levels;
}

export async function rootOf(leaves: string[]) {
  const l = await buildLevels(leaves);
  return l[l.length - 1][0];
}

export function pathFrom(levels: string[][], index: number): PathStep[] {
  const path: PathStep[] = [];
  let i = index;
  for (let d = 0; d < levels.length - 1; d++) {
    const lvl = levels[d];
    const sib = i % 2 === 0 ? i + 1 : i - 1;
    if (sib < lvl.length) path.push({ sibling: lvl[sib], side: i % 2 === 0 ? "R" : "L" });
    i = Math.floor(i / 2);
  }
  return path;
}

export async function rootFromPath(leaf: string, path: PathStep[]): Promise<string> {
  let h = leaf;
  for (const s of path) h = s.side === "L" ? await nodeOf(s.sibling, h) : await nodeOf(h, s.sibling);
  return h;
}

export const memoFor = (epoch: number, root: string, count: number) => `HUSH receipts root v1 ${epoch} ${root} ${count}`;
export const MEMO_RE = /^HUSH receipts root v1 (\d+) ([0-9a-f]{64}) (\d+)$/;

export interface ReceiptProof {
  v: 1;
  kind: "hush-receipt-proof";
  commitment: string;
  leaf: string;
  leafIndex: number;
  path: PathStep[];
  epoch: number;
  root: string;
  leafCount: number;
  anchor: { cluster: string; publisher: string; signature: string | null; memo: string };
}

/** Recomputes leaf and root from the proof. Does not touch the network. */
export async function checkProof(p: ReceiptProof): Promise<{ ok: boolean; reason?: string; root?: string }> {
  if (p?.kind !== "hush-receipt-proof" || p.v !== 1) return { ok: false, reason: "not a HUSH receipt proof (v1)" };
  if ((await leafOf(p.commitment)) !== p.leaf) return { ok: false, reason: "leaf does not match the commitment" };
  const root = await rootFromPath(p.leaf, p.path);
  if (root !== p.root) return { ok: false, reason: "path does not lead to the stated root", root };
  if (p.anchor.memo !== memoFor(p.epoch, p.root, p.leafCount)) return { ok: false, reason: "memo text does not match epoch/root/count", root };
  return { ok: true, root };
}
