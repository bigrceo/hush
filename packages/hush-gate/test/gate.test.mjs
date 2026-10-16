import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequirements, fromBase, hushGate, sell, toBase, verifyPayment, stealthKeypair } from "../dist/mod.js";
import { buildPaymentTx, paymentHeader } from "../dist/client.js";
import { Keypair } from "@solana/web3.js";

const opts = { resource: "/forecast", price: "0.001", currency: "SOL", seller: "me", secret: "x".repeat(40), rpcUrl: "http://127.0.0.1:1", network: "solana-devnet", usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" };

test("amount conversions", () => {
  assert.equal(toBase("0.001", "SOL"), 1_000_000n);
  assert.equal(toBase("1.5", "USDC"), 1_500_000n);
  assert.equal(fromBase(1_234_000n, "SOL"), "0.001234");
});

test("402 carries a one-time stealth payee per call", async () => {
  const a = (await buildRequirements(opts)).accepts[0];
  const b = (await buildRequirements(opts)).accepts[0];
  assert.equal(a.maxAmountRequired, "1000000");
  assert.equal(a.extra.privacy, "stealth-one-time-payee");
  assert.notEqual(a.payTo, b.payTo);
  const nonce = JSON.parse(Buffer.from(a.extra.quote.split(".")[0], "base64url").toString()).n;
  assert.equal((await stealthKeypair(opts.secret, nonce, 0)).publicKey.toBase58(), a.payTo);
});

test("rejects dust SOL legs (rent-exempt minimum)", async () => {
  await assert.rejects(buildRequirements({ ...opts, price: "0.0001" }));
});

test("middleware answers 402 without payment", async () => {
  const h = hushGate(opts, async () => new Response("secret"));
  const r = await h(new Request("http://x/forecast"));
  assert.equal(r.status, 402);
  assert.equal((await r.json()).x402Version, 1);
});

test("bad or forged payment headers are refused before any RPC call", async () => {
  assert.equal((await verifyPayment(opts, "not-json")).status, 400);
  const req = (await buildRequirements(opts)).accepts[0];
  const forged = req.extra.quote.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  assert.equal((await verifyPayment(opts, paymentHeader(forged, "1".repeat(88)))).status, 402);
  const other = (await buildRequirements({ ...opts, resource: "/other" })).accepts[0];
  const v = await verifyPayment(opts, paymentHeader(other.extra.quote, "1".repeat(88)));
  assert.equal(v.ok, false);
});

test("client builds one transfer per leg", async () => {
  const req = (await buildRequirements({ ...opts, legs: [{ seller: "a", amount: "0.001" }, { seller: "b", amount: "0.002" }] })).accepts[0];
  const tx = buildPaymentTx(Keypair.generate().publicKey, req);
  assert.equal(tx.instructions.length, 2);
});

test("sell() helper validates the secret", () => {
  assert.throws(() => sell({ secret: "short", price: "0.001", resource: "/x" }, async () => new Response()));
  assert.equal(typeof sell({ secret: "y".repeat(40), price: "0.001", resource: "/x" }, async () => new Response()), "function");
});
