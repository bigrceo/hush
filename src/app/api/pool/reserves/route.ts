import { poolAddresses, poolBalances } from "@/lib/pool";
import { d1 } from "@/lib/store";
export const dynamic = "force-dynamic";
// Public proof of reserves: SOL the pool holds on-chain vs. SOL owed to agents in the ledger. No per-agent data.
export async function GET() {
  const addrs = await poolAddresses();
  const bals = await poolBalances();
  const r = await (await d1()).prepare("SELECT COALESCE(SUM(CAST(balance_lamports AS INTEGER)), 0) AS owed, COUNT(*) AS n FROM agents WHERE CAST(balance_lamports AS INTEGER) > 0").first<{ owed: number; n: number }>();
  const held = bals.reduce((a, b) => a + b, 0);
  const owed = Number(r?.owed ?? 0);
  return Response.json({
    at: new Date().toISOString(), heldSol: held / 1e9, owedSol: owed / 1e9, fundedAgents: Number(r?.n ?? 0),
    coverage: owed ? held / owed : null, pool: addrs.map((a, i) => ({ address: a, sol: bals[i] / 1e9 })),
  }, { headers: { "cache-control": "public, s-maxage=30" } });
}
