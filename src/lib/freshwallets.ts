// Fresh-wallet ratio: how many of a token's top holders are brand-new or near-empty-history wallets.
import { Connection, PublicKey } from "@solana/web3.js";
import { topHolders } from "./overlap";
import { walletAge, freshFlags } from "./freshrules";

export async function freshWallets(conn: Connection, mintStr: string, cap = 100) {
  const holders = await topHolders(conn, mintStr);
  const now = Math.floor(Date.now() / 1000);
  const rows = [];
  for (let i = 0; i < holders.length; i += 5) {
    const batch = holders.slice(i, i + 5);
    rows.push(...(await Promise.all(batch.map(async (h) => {
      const sigs = await conn.getSignaturesForAddress(new PublicKey(h.owner), { limit: cap }).catch(() => []);
      return { owner: h.owner, pct: h.pct, ...walletAge(sigs.map((s) => s.blockTime ?? now), cap, now) };
    }))));
  }
  const fresh = rows.filter((r) => r.fresh);
  const freshPct = Math.round(fresh.reduce((s, r) => s + r.pct, 0) * 100) / 100;
  return {
    mint: mintStr,
    holdersChecked: rows.length,
    freshCount: fresh.length,
    freshRatio: rows.length ? Math.round((fresh.length / rows.length) * 100) / 100 : 0,
    freshPctOfSupply: freshPct,
    holders: rows.sort((a, b) => b.pct - a.pct),
    flags: freshFlags({ fresh: fresh.length, total: rows.length, freshPct }),
    note: `Top 20 token accounts, pools and bonding curves excluded. Fresh = 5 or fewer transactions, or first activity under 7 days ago (last ${cap} transactions read per wallet).`,
  };
}
