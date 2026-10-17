import { test } from "node:test";
import assert from "node:assert/strict";
import { floatNeeded, splitFees } from "../src/lib/buybackmath.ts";

test("50/50 split of accrued fees, nothing lost to rounding", () => {
  assert.deepEqual(splitFees(10_000, 0.5), { buyback: 5_000, ops: 5_000 });
  assert.deepEqual(splitFees(10_001, 0.5), { buyback: 5_000, ops: 5_001 });
  assert.deepEqual(splitFees(0, 0.5), { buyback: 0, ops: 0 });
  assert.deepEqual(splitFees(-5, 0.5), { buyback: 0, ops: 0 });
});

test("float covers two token accounts and fees", () => {
  assert.equal(floatNeeded(2_039_280), 8_000_000);
  assert.ok(floatNeeded(3_000_000) >= 3 * 3_000_000);
});
