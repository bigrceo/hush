import { test } from "node:test";
import assert from "node:assert/strict";
import { concentration, riskFlags } from "../src/lib/tokenscan.ts";

test("concentration of circulating supply", () => {
  const c = concentration([500n, 100n, 100n, 50n, ...Array(10).fill(10n)], 1000n);
  assert.equal(c.top1Pct, 50);
  assert.equal(c.top10Pct, 50 + 10 + 10 + 5 + 6 * 1);
  assert.deepEqual(concentration([], 0n), { top1Pct: 0, top10Pct: 0 });
});

test("flags", () => {
  assert.deepEqual(riskFlags({ mintAuthority: null, freezeAuthority: null, top1Pct: 3, top10Pct: 20 }), []);
  assert.equal(riskFlags({ mintAuthority: "x", freezeAuthority: "y", top1Pct: 12, top10Pct: 45 }).length, 4);
});
