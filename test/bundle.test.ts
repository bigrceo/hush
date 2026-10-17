import { test } from "node:test";
import assert from "node:assert/strict";
import { bundleClusters, bundleFlags } from "../src/lib/bundlerules.ts";
test("bundle clusters", () => {
  const r = bundleClusters([
    { owner: "a", pct: 5, funder: "F", firstSlot: 1 },
    { owner: "b", pct: 4, funder: "F", firstSlot: 2 },
    { owner: "c", pct: 3, funder: "G", firstSlot: 2 },
    { owner: "d", pct: 2, funder: null, firstSlot: null },
  ]);
  assert.equal(r.bundledWallets, 3); assert.equal(r.bundledPct, 12); assert.equal(r.clusters[0].by, "same funder");
  assert.deepEqual(bundleFlags({ bundledWallets: 3, bundledPct: 12, biggest: 2 }).length, 1);
  assert.equal(bundleClusters([{ owner: "a", pct: 1, funder: "a", firstSlot: null }]).clusters.length, 0);
  const h = bundleClusters([{ owner: "x", pct: 6, funder: null, firstSlot: null }, { owner: "y", pct: 6, funder: "x", firstSlot: 9 }]);
  assert.equal(h.bundledWallets, 2); assert.equal(h.bundledPct, 12);
});
