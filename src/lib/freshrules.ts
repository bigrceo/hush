// Pure helpers for the fresh-wallet listing (unit-tested in test/fresh.test.ts).
/** Pure: classify a wallet from its (capped) recent history. */
export function walletAge(sigTimes: number[], cap: number, nowSec: number) {
  const n = sigTimes.length;
  const oldest = n ? Math.min(...sigTimes) : null;
  const ageDays = n < cap && oldest ? Math.floor((nowSec - oldest) / 86400) : null; // null = older than we looked
  const fresh = n <= 5 || (ageDays != null && ageDays < 7);
  return { txs: n, capped: n >= cap, ageDays, fresh };
}

/** Pure flag logic (unit-tested). */
export function freshFlags(x: { fresh: number; total: number; freshPct: number }) {
  const f: string[] = [];
  if (x.total && x.fresh / x.total >= 0.4) f.push(`${x.fresh} of the top ${x.total} holders are fresh wallets`);
  if (x.freshPct >= 15) f.push(`fresh wallets hold ${x.freshPct}% of circulating supply`);
  return f;
}

