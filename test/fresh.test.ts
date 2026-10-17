import { test } from "node:test";
import assert from "node:assert/strict";
import { walletAge, freshFlags } from "../src/lib/freshrules.ts";
const now = 1_800_000_000;
test("wallet age", () => {
  assert.equal(walletAge([now - 100, now - 200], 100, now).fresh, true); // 2 txs
  assert.equal(walletAge(Array.from({ length: 20 }, (_, i) => now - i * 3600), 100, now).fresh, true); // < 1 day old
  assert.equal(walletAge(Array.from({ length: 20 }, (_, i) => now - i * 86400 * 2), 100, now).fresh, false); // 38 days
  const c = walletAge(Array.from({ length: 100 }, () => now), 100, now);
  assert.equal(c.capped, true); assert.equal(c.ageDays, null); assert.equal(c.fresh, false);
});
test("fresh flags", () => {
  assert.equal(freshFlags({ fresh: 10, total: 20, freshPct: 20 }).length, 2);
  assert.equal(freshFlags({ fresh: 1, total: 20, freshPct: 1 }).length, 0);
});
