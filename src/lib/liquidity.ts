// Liquidity check: pump.fun bonding-curve state, or (after graduation / for any SPL token) every DEX pool with
// its liquidity, from the DEX Screener public API.
import { Connection, PublicKey } from "@solana/web3.js";

const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const INITIAL_REAL_TOKENS = 793_100_000_000_000n; // pump.fun curve starting real token reserves (6 decimals)

/** Pure: decode a pump.fun bonding curve account. */
export function decodeCurve(data: Uint8Array) {
  if (data.length < 49) return null;
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u = (o: number) => v.getBigUint64(o, true);
  const realTokens = u(24);
  return {
    virtualTokenReserves: u(8), virtualSolReserves: u(16), realTokenReserves: realTokens, realSolReserves: u(32), tokenTotalSupply: u(40),
    complete: data[48] === 1,
    progressPct: Math.max(0, Math.min(100, Math.round((1 - Number(realTokens) / Number(INITIAL_REAL_TOKENS)) * 10000) / 100)),
  };
}

/** Pure flag logic (unit-tested). */
export function liquidityFlags(x: { onCurve: boolean; liquidityUsd: number; mcapUsd: number | null; pools: number }) {
  const f: string[] = [];
  if (!x.onCurve && x.pools === 0) f.push("no DEX pool found");
  if (!x.onCurve && x.pools > 0 && x.liquidityUsd < 10_000) f.push(`thin liquidity: $${Math.round(x.liquidityUsd).toLocaleString("en-US")}`);
  if (!x.onCurve && x.mcapUsd && x.liquidityUsd > 0 && x.mcapUsd / x.liquidityUsd > 50) f.push(`market cap is ${Math.round(x.mcapUsd / x.liquidityUsd)}x liquidity: exits will slip hard`);
  return f;
}

type Pair = { dexId: string; pairAddress: string; quoteToken?: { symbol: string }; liquidity?: { usd?: number }; marketCap?: number; fdv?: number; pairCreatedAt?: number; volume?: { h24?: number }; priceUsd?: string };

export async function liquidityCheck(conn: Connection, mintStr: string) {
  const mint = new PublicKey(mintStr);
  const [curvePda] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM);
  const [mintInfo, curveInfo] = await conn.getMultipleAccountsInfo([mint, curvePda]);
  if (!mintInfo) throw new Error("mint not found");
  const curve = curveInfo ? decodeCurve(curveInfo.data) : null;
  const r = await fetch(`https://api.dexscreener.com/token-pairs/v1/solana/${mint.toBase58()}`, { headers: { accept: "application/json" } });
  const pairs: Pair[] = r.ok ? await r.json() : [];
  const pools = (Array.isArray(pairs) ? pairs : []).filter((p) => p.dexId !== "pumpfun").sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const liquidityUsd = Math.round(pools.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0));
  const mcapUsd = pools[0]?.marketCap ?? pools[0]?.fdv ?? null;
  const onCurve = !!curve && !curve.complete;
  return {
    mint: mint.toBase58(),
    pumpFun: !!curve,
    bondingCurve: curve ? { address: curvePda.toBase58(), graduated: curve.complete, progressPct: curve.complete ? 100 : curve.progressPct, realSol: Number(curve.realSolReserves) / 1e9 } : null,
    pools: pools.slice(0, 8).map((p) => ({ dex: p.dexId, address: p.pairAddress, quote: p.quoteToken?.symbol ?? null, liquidityUsd: Math.round(p.liquidity?.usd ?? 0), volume24hUsd: Math.round(p.volume?.h24 ?? 0), createdAt: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null })),
    poolCount: pools.length,
    liquidityUsd,
    marketCapUsd: mcapUsd ? Math.round(mcapUsd) : null,
    mcapToLiquidity: mcapUsd && liquidityUsd ? Math.round((mcapUsd / liquidityUsd) * 10) / 10 : null,
    flags: liquidityFlags({ onCurve, liquidityUsd, mcapUsd, pools: pools.length }),
    note: onCurve ? "Still on the pump.fun bonding curve: liquidity is the curve itself (real SOL shown)." : "Pool liquidity from the DEX Screener public API, pump.fun curve excluded.",
  };
}
