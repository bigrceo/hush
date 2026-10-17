// Holder overlap: which top holders two tokens share (pools and bonding curves excluded).
import { Connection, PublicKey } from "@solana/web3.js";

const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_AMM = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");

/** Pure: shared owners between two holder lists, with each side's share. */
export function sharedHolders(a: { owner: string; pct: number }[], b: { owner: string; pct: number }[]) {
  const mb = new Map(b.map((x) => [x.owner, x.pct]));
  const shared = a.filter((x) => mb.has(x.owner)).map((x) => ({ owner: x.owner, pctA: x.pct, pctB: mb.get(x.owner)! }));
  return shared.sort((x, y) => y.pctA + y.pctB - (x.pctA + x.pctB));
}

async function topHolders(conn: Connection, mintStr: string) {
  const mint = new PublicKey(mintStr);
  const supplyInfo = await conn.getTokenSupply(mint);
  const supply = Number(supplyInfo.value.amount);
  const largest = (await conn.getTokenLargestAccounts(mint, "confirmed")).value;
  const parsed = await conn.getMultipleParsedAccounts(largest.map((a) => a.address));
  const owners = largest.map((_, i) => (parsed.value[i]?.data as { parsed?: { info?: { owner?: string } } })?.parsed?.info?.owner ?? null);
  const [curve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM);
  const ownerInfos = await conn.getMultipleAccountsInfo(owners.map((o) => (o ? new PublicKey(o) : PublicKey.default)));
  const isPool = (o: string | null, i: number) => !o || o === curve.toBase58() || !!ownerInfos[i]?.owner.equals(PUMP_AMM) || !!ownerInfos[i]?.executable;
  const pooled = largest.reduce((s, a, i) => (isPool(owners[i], i) ? s + Number(a.amount) : s), 0);
  const circ = Math.max(1, supply - pooled);
  const byOwner = new Map<string, number>();
  largest.forEach((a, i) => { if (!isPool(owners[i], i)) byOwner.set(owners[i]!, (byOwner.get(owners[i]!) ?? 0) + Number(a.amount)); });
  return [...byOwner].map(([owner, amt]) => ({ owner, pct: Math.round((amt / circ) * 1e6) / 1e4 }));
}

export async function holderOverlap(conn: Connection, mintA: string, mintB: string) {
  if (!mintA || !mintB || mintA === mintB) throw new Error("give two different mints: ?mint=A,B");
  const [a, b] = await Promise.all([topHolders(conn, mintA), topHolders(conn, mintB)]);
  const shared = sharedHolders(a, b);
  return {
    mintA, mintB,
    holdersCompared: { a: a.length, b: b.length },
    sharedCount: shared.length,
    shared: shared.slice(0, 10),
    sharedPctOfA: Math.round(shared.reduce((s, x) => s + x.pctA, 0) * 100) / 100,
    sharedPctOfB: Math.round(shared.reduce((s, x) => s + x.pctB, 0) * 100) / 100,
    flags: shared.length >= 5 ? [`${shared.length} of the top holders hold both: likely the same cluster`] : [],
    note: "Top 20 token accounts of each mint, liquidity pools and bonding curves excluded; % of circulating supply.",
  };
}
