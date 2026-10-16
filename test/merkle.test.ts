import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLevels, checkProof, leafOf, memoFor, nodeOf, pathFrom, rootFromPath, rootOf, type ReceiptProof } from "../src/lib/merkle.ts";

const commit = (i: number) => (i.toString(16).padStart(2, "0")).repeat(32);

test("single leaf root is the leaf", async () => {
  const l = await leafOf(commit(1));
  assert.equal(await rootOf([l]), l);
  assert.deepEqual(pathFrom(await buildLevels([l]), 0), []);
});

test("two leaves", async () => {
  const a = await leafOf(commit(1)), b = await leafOf(commit(2));
  assert.equal(await rootOf([a, b]), await nodeOf(a, b));
});

for (const n of [1, 2, 3, 5, 7, 8, 13, 64, 100]) {
  test(`every leaf proves into the root (n=${n})`, async () => {
    const leaves = await Promise.all(Array.from({ length: n }, (_, i) => leafOf(commit(i))));
    const levels = await buildLevels(leaves);
    const root = levels[levels.length - 1][0];
    for (let i = 0; i < n; i++) assert.equal(await rootFromPath(leaves[i], pathFrom(levels, i)), root);
  });
}

test("tampering is caught", async () => {
  const commits = Array.from({ length: 9 }, (_, i) => commit(i));
  const leaves = await Promise.all(commits.map(leafOf));
  const levels = await buildLevels(leaves);
  const root = levels[levels.length - 1][0];
  const base: ReceiptProof = { v: 1, kind: "hush-receipt-proof", commitment: commits[4], leaf: leaves[4], leafIndex: 4, path: pathFrom(levels, 4), epoch: 3, root, leafCount: 9, anchor: { cluster: "test", publisher: "x", signature: "s", memo: memoFor(3, root, 9) } };
  assert.equal((await checkProof(base)).ok, true);
  assert.equal((await checkProof({ ...base, commitment: commits[5] })).ok, false);
  const badPath = base.path.map((s, i) => (i === 1 ? { ...s, side: (s.side === "L" ? "R" : "L") as "L" | "R" } : s));
  assert.equal((await checkProof({ ...base, path: badPath })).ok, false);
  assert.equal((await checkProof({ ...base, anchor: { ...base.anchor, memo: memoFor(4, root, 9) } })).ok, false);
  assert.equal((await checkProof({ ...base, root: leaves[0] })).ok, false);
});
