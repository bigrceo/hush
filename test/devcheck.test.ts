import { test } from "node:test";
import assert from "node:assert/strict";
import { creatorFromCurve, devFlags } from "../src/lib/devcheck.ts";

test("reads the creator from a bonding-curve account", () => {
  const d = new Uint8Array(150);
  assert.equal(creatorFromCurve(d), null);
  d.set(new Uint8Array(32).fill(7), 49);
  assert.equal(typeof creatorFromCurve(d), "string");
  assert.equal(creatorFromCurve(new Uint8Array(60)), null);
});

test("dev flags", () => {
  assert.deepEqual(devFlags({ initialPct: 4, holdingPct: 3, launches: 1, windowTxs: 60 }), []);
  assert.match(devFlags({ initialPct: 4, holdingPct: 1, launches: 1, windowTxs: 60 })[0], /sold more than half/);
  assert.match(devFlags({ initialPct: null, holdingPct: 0, launches: 0, windowTxs: 60 })[0], /holds none/);
  assert.match(devFlags({ initialPct: null, holdingPct: 1, launches: 5, windowTxs: 60 })[0], /serial launcher/);
});
