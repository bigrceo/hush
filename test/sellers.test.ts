import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSeller } from "../src/lib/sellerrules.ts";

const ok = { name: "Weather oracle", url: "https://api.example.com/weather", priceSol: 0.002, description: "Tomorrow's forecast for any city." };

test("accepts a normal https listing", () => assert.equal(validateSeller(ok), null));
test("rejects non-https, private hosts, credentials, odd ports", () => {
  for (const url of ["http://api.example.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://192.168.1.2/x", "https://169.254.169.254/latest", "https://[::1]/x", "https://u:p@api.example.com/x", "https://api.example.com:8443/x", "https://intranet/x", "ftp://x.com"])
    assert.notEqual(validateSeller({ ...ok, url }), null, url);
});
test("blocks configured hosts (no self-proxying)", () => {
  assert.notEqual(validateSeller({ ...ok, url: "https://hushagents.com/api/shop/sol-price" }, ["hushagents.com"]), null);
  assert.notEqual(validateSeller({ ...ok, url: "https://www.hushagents.com/x" }, ["hushagents.com"]), null);
});
test("price bounds (rent-exempt minimum) and text lengths", () => {
  assert.notEqual(validateSeller({ ...ok, priceSol: 0.0005 }), null);
  assert.notEqual(validateSeller({ ...ok, priceSol: 1 }), null);
  assert.notEqual(validateSeller({ ...ok, name: "x" }), null);
  assert.notEqual(validateSeller({ ...ok, description: "short" }), null);
  assert.notEqual(validateSeller({ ...ok, input: "bad name!" }), null);
  assert.equal(validateSeller({ ...ok, input: "city" }), null);
});
