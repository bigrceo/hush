import { poolAddresses, poolBalances } from "@/lib/pool";
import { CLUSTER } from "@/lib/config";
export const dynamic = "force-dynamic";
// Public: the pool addresses every buy is paid from, and their balances. No per-agent data.
export async function GET() {
  const addrs = await poolAddresses();
  const bals = await poolBalances().catch(() => addrs.map(() => null));
  return Response.json({ cluster: CLUSTER, pool: addrs.map((a, i) => ({ address: a, sol: bals[i] == null ? null : (bals[i] as number) / 1e9 })) });
}
