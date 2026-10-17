import { test } from "node:test";
import assert from "node:assert/strict";
import { sharedHolders } from "../src/lib/overlap.ts";

test("shared holders, ranked by combined share", () => {
  const r = sharedHolders([{ owner: "x", pct: 5 }, { owner: "y", pct: 1 }, { owner: "z", pct: 9 }], [{ owner: "y", pct: 8 }, { owner: "x", pct: 2 }, { owner: "q", pct: 3 }]);
  assert.deepEqual(r.map((s) => s.owner), ["y", "x"]);
  assert.equal(r[0].pctB, 8);
  assert.deepEqual(sharedHolders([], [{ owner: "a", pct: 1 }]), []);
});
