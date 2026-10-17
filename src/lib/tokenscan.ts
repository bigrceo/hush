// Token risk scan for any Solana mint (SPL or Token-2022), pump.fun aware.
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";

export const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const PUMP_AMM = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");

/** Pure scoring helper (unit-tested): concentration figures from raw holder amounts. */
export function concentration(amounts: bigint[], supply: bigint) {
  if (supply <= 0n) return { top1Pct: 0, top10Pct: 0 };
  const sorted = [...amounts].sort((a, b) => (b > a ? 1 : b < a ? -1 : 0));
  const pct = (x: bigint) => Number((x * 1_000_000n) / supply) / 10_000;
  return { top1Pct: pct(sorted[0] ?? 0n), top10Pct: pct(sorted.slice(0, 10).reduce((s, x) => s + x, 0n)) };
}

export function riskFlags(x: { mintAuthority: string | null; freezeAuthority: string | null; top1Pct: number; top10Pct: number }) {
  const f: string[] = [];
  if (x.mintAuthority) f.push("mint authority active: supply can grow");
  if (x.freezeAuthority) f.push("freeze authority active: holders can be frozen");
  if (x.top1Pct >= 10) f.push(`largest holder owns ${x.top1Pct}%`);
  if (x.top10Pct >= 40) f.push(`top 10 holders own ${x.top10Pct}%`);
  return f;
}

export async function scanToken(conn: Connection, mintStr: string) {
  const mint = new PublicKey(mintStr);
  const info = await conn.getAccountInfo(mint);
  if (!info) throw new Error("mint not found");
  const program = info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const m = await getMint(conn, mint, "confirmed", program);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM);

  const largest = (await conn.getTokenLargestAccounts(mint, "confirmed")).value;
  const parsed = await conn.getMultipleParsedAccounts(largest.map((a) => a.address), { commitment: "confirmed" });
  const holders = largest.map((a, i) => {
    const d = parsed.value[i]?.data as { parsed?: { info?: { owner?: string } } } | undefined;
    return { tokenAccount: a.address.toBase58(), owner: d?.parsed?.info?.owner ?? null, amount: BigInt(a.amount), uiAmount: a.uiAmount ?? 0 };
  });
  // Liquidity, not a holder: the pump.fun bonding curve (and pump AMM pool authorities) are excluded.
  const ownerInfos = await conn.getMultipleAccountsInfo(holders.map((h) => (h.owner ? new PublicKey(h.owner) : PublicKey.default)));
  const isPool = (h: (typeof holders)[number], i: number) => h.owner === bondingCurve.toBase58() || !!ownerInfos[i]?.owner.equals(PUMP_AMM);
  const pools = holders.filter(isPool);
  const real = holders.filter((h, i) => !isPool(h, i));
  const circulating = m.supply - pools.reduce((s, h) => s + h.amount, 0n);
  const c = concentration(real.map((h) => h.amount), circulating > 0n ? circulating : m.supply);
  const out = {
    mint: mint.toBase58(),
    program: program.equals(TOKEN_2022_PROGRAM_ID) ? "token-2022" : "spl-token",
    decimals: m.decimals,
    supply: (Number(m.supply) / 10 ** m.decimals).toString(),
    mintAuthority: m.mintAuthority?.toBase58() ?? null,
    freezeAuthority: m.freezeAuthority?.toBase58() ?? null,
    pumpFun: { bondingCurve: bondingCurve.toBase58(), onCurve: pools.some((h) => h.owner === bondingCurve.toBase58()), excludedPct: Number(((m.supply - circulating) * 1_000_000n) / (m.supply || 1n)) / 10_000 },
    largestHolderPct: c.top1Pct,
    top10HoldersPct: c.top10Pct,
    top10: real.slice(0, 10).map((h) => ({ owner: h.owner, pct: Number((h.amount * 1_000_000n) / (circulating || 1n)) / 10_000 })),
    note: "Percentages are of circulating supply (liquidity pools excluded). Based on the 20 largest token accounts.",
  };
  return { ...out, flags: riskFlags({ mintAuthority: out.mintAuthority, freezeAuthority: out.freezeAuthority, top1Pct: c.top1Pct, top10Pct: c.top10Pct }) };
}
