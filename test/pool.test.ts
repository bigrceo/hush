import { test } from "node:test";
import assert from "node:assert/strict";
import { canPay, canReceive, FEE, pickPayer, pickReceiver, planWithdraw, RENT_MIN } from "../src/lib/poolmath.ts";

test("pool address stays empty or rent-exempt", () => {
  assert.equal(canPay(10_000_000, 1_000_000), true);
  assert.equal(canPay(1_000_000 + FEE, 1_000_000), true); // drains to exactly 0
  assert.equal(canPay(1_500_000, 1_000_000), false); // would leave 495k < rent
  assert.equal(canPay(500_000, 1_000_000), false);
});

test("deposits into an empty address must reach rent-exempt", () => {
  assert.equal(canReceive(0, RENT_MIN - 1), false);
  assert.equal(canReceive(0, RENT_MIN), true);
  assert.equal(canReceive(1, 10), true);
});

test("payer is picked only among eligible pool addresses", () => {
  const bals = [0, 50_000_000, 1_200_000, 20_000_000];
  for (const r of [0, 0.3, 0.6, 0.99]) assert.ok([1, 3].includes(pickPayer(bals, 1_000_000, r)));
  assert.equal(pickPayer([0, 0], 1_000_000, 0.5), -1);
  assert.equal(pickReceiver([0, 0], 100_000, 0.5), -1);
  assert.equal(pickReceiver([0, 5_000_000], 100_000, 0.1), 1);
});

test("withdraw plan never leaves an address below rent and covers what it can", () => {
  const bals = [30_000_000, 12_000_000, 0];
  const { legs, uncovered } = planWithdraw(bals, 35_000_000);
  assert.equal(uncovered, 0);
  assert.equal(legs.reduce((s, [, x]) => s + x + FEE, 0), 35_000_000); // sent + fees == ledger balance
  for (const [i, x] of legs) { const left = bals[i] - x - FEE; assert.ok(left === 0 || left >= RENT_MIN); }
  assert.ok(planWithdraw([1_000_000], 50_000_000).uncovered > 0);
});
