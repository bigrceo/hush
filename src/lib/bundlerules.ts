// Pure helpers for the bundle-check listing (unit-tested in test/bundle.test.ts).
export interface FundedHolder { owner: string; pct: number; funder: string | null; firstSlot: number | null }

/** Pure: group holders that share a funding wallet or were born in the same slot. */
export function bundleClusters(rows: FundedHolder[]) {
  const groups = new Map<string, FundedHolder[]>();
  const add = (k: string, r: FundedHolder) => { const g = groups.get(k) ?? []; if (!g.includes(r)) g.push(r); groups.set(k, g); };
  const funders = new Set(rows.map((r) => r.funder));
  for (const r of rows) {
    if (funders.has(r.owner)) add("funder:" + r.owner, r); // a top holder that funded other top holders
    if (r.funder && r.funder !== r.owner) add("funder:" + r.funder, r);
    if (r.firstSlot != null) add("slot:" + r.firstSlot, r);
  }
  const clusters = [...groups].filter(([, g]) => g.length >= 2).map(([k, g]) => ({
    by: k.startsWith("funder:") ? "same funder" : "same first slot",
    key: k.split(":")[1],
    wallets: g.map((x) => x.owner),
    pct: Math.round(g.reduce((s, x) => s + x.pct, 0) * 100) / 100,
  }));
  clusters.sort((a, b) => b.pct - a.pct);
  const inBundle = new Set(clusters.flatMap((c) => c.wallets));
  const bundledPct = Math.round(rows.filter((r) => inBundle.has(r.owner)).reduce((s, r) => s + r.pct, 0) * 100) / 100;
  return { clusters, bundledWallets: inBundle.size, bundledPct };
}

export function bundleFlags(x: { bundledWallets: number; bundledPct: number; biggest: number }) {
  const f: string[] = [];
  if (x.biggest >= 3) f.push(`${x.biggest} top holders share one funder or launch slot`);
  if (x.bundledPct >= 10) f.push(`linked wallets hold ${x.bundledPct}% of circulating supply`);
  return f;
}
