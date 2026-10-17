import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeCurve, liquidityFlags } from "../src/lib/liquidity.ts";

test("decodes a pump.fun curve and its progress", () => {
  const b = new Uint8Array(81); const v = new DataView(b.buffer);
  v.setBigUint64(24, 396_550_000_000_000n, true); v.setBigUint64(32, 40_000_000_000n, true); b[48] = 0;
  const c = decodeCurve(b)!;
  assert.equal(c.progressPct, 50); assert.equal(c.complete, false); assert.equal(c.realSolReserves, 40_000_000_000n);
});
test("liquidity flags", () => {
  assert.deepEqual(liquidityFlags({ onCurve: true, liquidityUsd: 0, mcapUsd: null, pools: 0 }), []);
  assert.equal(liquidityFlags({ onCurve: false, liquidityUsd: 5000, mcapUsd: 1_000_000, pools: 1 }).length, 2);
  assert.match(liquidityFlags({ onCurve: false, liquidityUsd: 0, mcapUsd: null, pools: 0 })[0], /no DEX pool/);
});
