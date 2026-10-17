import { test } from "node:test";
import assert from "node:assert/strict";
import { crossesBudget, blockReason, webhookBody } from "../src/lib/alertrules.ts";

test("budget alert fires once, on the crossing spend", () => {
  assert.equal(crossesBudget(0.007, 0.008, 0.01, 80), true);
  assert.equal(crossesBudget(0.008, 0.009, 0.01, 80), false);
  assert.equal(crossesBudget(0.001, 0.002, 0.01, 80), false);
  assert.equal(crossesBudget(0, 0.002, 0, 80), false);
});
test("block reasons", () => {
  assert.equal(blockReason("kill switch is on: agent is frozen"), "frozen");
  assert.equal(blockReason("seller not on allowlist: x"), "allowlist");
  assert.equal(blockReason("over per-call cap (1 > 0.5 SOL)"), "per-call cap");
  assert.equal(blockReason("over daily budget (0.02 > 0.01 SOL)"), "daily budget");
  assert.equal(blockReason("insufficient HUSH balance"), "balance");
});
test("webhook body works for discord and slack", () => {
  const b = webhookBody({ kind: "budget", agent: "bot", message: "80% of budget", at: 0 });
  assert.equal(b.content, b.text);
  assert.match(b.content, /bot/);
});
