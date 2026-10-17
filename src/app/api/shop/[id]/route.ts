import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { scanToken } from "@/lib/tokenscan";
import { listing } from "@/lib/shop";
import { gateFor } from "@/lib/gate";
import { RPC_URL, CLUSTER } from "@/lib/config";

export const dynamic = "force-dynamic";

async function solPrice() {
  const [a, b] = await Promise.allSettled([
    fetch("https://api.coinbase.com/v2/prices/SOL-USD/spot").then((r) => r.json()).then((j) => +j.data.amount),
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT").then((r) => r.json()).then((j) => +j.price),
  ]);
  const v = [a, b].flatMap((x) => (x.status === "fulfilled" && x.value > 0 ? [x.value] : []));
  if (!v.length) throw new Error("no price source answered");
  return { usd: v.reduce((s, x) => s + x, 0) / v.length, sources: v.length };
}

async function pulse() {
  const c = new Connection(RPC_URL);
  const [perf, epoch] = await Promise.all([c.getRecentPerformanceSamples(4), c.getEpochInfo()]);
  const tps = perf.reduce((s, p) => s + p.numTransactions / p.samplePeriodSecs, 0) / Math.max(1, perf.length);
  return { cluster: CLUSTER, tps: Math.round(tps), slot: epoch.absoluteSlot, epoch: epoch.epoch, epochProgress: +(epoch.slotIndex / epoch.slotsInEpoch).toFixed(4) };
}

const handlers: Record<string, (u: URL) => Promise<unknown>> = {
  "sol-price": () => solPrice(),
  "network-pulse": () => pulse(),
  "wallet-scan": async (u) => {
    const pk = new PublicKey(u.searchParams.get("address") || "");
    const c = new Connection(RPC_URL);
    const [bal, sigs] = await Promise.all([c.getBalance(pk), c.getSignaturesForAddress(pk, { limit: 25 })]);
    return { address: pk.toBase58(), cluster: CLUSTER, sol: bal / 1e9, recentTxs: sigs.length, lastActive: sigs[0]?.blockTime ?? null };
  },
  "token-scan": async (u) => scanToken(new Connection(RPC_URL, "confirmed"), u.searchParams.get("mint") || ""),
  "token-check": async (u) => {
    const m = await getMint(new Connection(RPC_URL), new PublicKey(u.searchParams.get("mint") || ""));
    return { mint: m.address.toBase58(), supply: m.supply.toString(), decimals: m.decimals, mintAuthority: m.mintAuthority?.toBase58() ?? null, freezeAuthority: m.freezeAuthority?.toBase58() ?? null };
  },
  "market-brief": async () => {
    const [p, n] = await Promise.all([solPrice(), pulse()]);
    const brief = `SOL trades near $${p.usd.toFixed(2)} (${p.sources} sources). ${CLUSTER} is doing ~${n.tps} TPS, epoch ${n.epoch} is ${(n.epochProgress * 100).toFixed(0)}% done.`;
    return { price: p, pulse: n, brief };
  },
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const l = listing(id);
  if (!l) return Response.json({ error: "unknown listing" }, { status: 404 });
  const gated = gateFor(l, async (r) => {
    const data = await handlers[id](new URL(r.url));
    return Response.json({ listing: id, data });
  });
  return gated(req);
}
