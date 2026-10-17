import { test } from "node:test";
import assert from "node:assert/strict";
import { facilitatorFee, tierFor } from "../src/lib/feemath.ts";

const tiers = [
  { name: "Tier 1", min: 100_000, perk: "", discount: 0.1 },
  { name: "Tier 2", min: 1_000_000, perk: "", discount: 0.25 },
  { name: "Tier 3", min: 5_000_000, perk: "", discount: 0.5 },
  { name: "Tier 4", min: 10_000_000, perk: "", discount: 1 },
];

test("tier thresholds", () => {
  assert.equal(tierFor(0, tiers), null);
  assert.equal(tierFor(99_999, tiers), null);
  assert.equal(tierFor(100_000, tiers)?.name, "Tier 1");
  assert.equal(tierFor(1_500_000, tiers)?.name, "Tier 2");
  assert.equal(tierFor(5_000_000, tiers)?.name, "Tier 3");
  assert.equal(tierFor(42_000_000, tiers)?.name, "Tier 4");
});

test("fee: 1% base, discounted by tier", () => {
  assert.equal(facilitatorFee(1_000_000, 100, null), 10_000);
  assert.equal(facilitatorFee(1_000_000, 100, tiers[0]), 9_000);
  assert.equal(facilitatorFee(1_000_000, 100, tiers[1]), 7_500);
  assert.equal(facilitatorFee(1_000_000, 100, tiers[2]), 5_000);
  assert.equal(facilitatorFee(1_000_000, 100, tiers[3]), 0);
  assert.equal(facilitatorFee(3_000_000, 100, null), 30_000);
});
