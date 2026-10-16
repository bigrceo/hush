# hush-x402

Private x402 middleware for Solana. Sell any HTTP endpoint per call in SOL or USDC. Every call pays a **fresh one-time stealth address** derived from your secret, so nobody watching the chain can link your buyers' calls together or count your customers.

Works anywhere with Web `Request`/`Response`: Next.js route handlers, Hono, Cloudflare Workers, Bun, Deno.

```bash
npm i hush-x402
```

## Sell an endpoint for SOL (10 lines)

```ts
// app/api/forecast/route.ts (Next.js)
import { sell } from "hush-x402";

export const GET = sell(
  { secret: process.env.HUSH_SECRET!, rpcUrl: process.env.RPC_URL, price: "0.001", resource: "/api/forecast", seller: "forecast-lab" },
  async () => Response.json({ tomorrow: "sunny", confidence: 0.82 }),
);
```

Hono / Workers: `app.get("/api/forecast", (c) => handler(c.req.raw))` where `handler` is the value returned by `sell(...)`.

## What happens on a call

1. No `X-PAYMENT` header → **HTTP 402** with x402 `accepts[]`. `payTo` (and `extra.legs[].payTo`) is a one-time address derived from `HMAC(secret, nonce, leg)`; `extra.quote` is an HMAC-signed quote (resource, amount, expiry).
2. The buyer pays in one transaction and retries with `X-PAYMENT: base64url({ quote, signature })`.
3. The gate re-derives the address, reads the tx over RPC, checks amount, asset, expiry and replay, then runs your handler.
4. **Per-call escrow:** if your handler throws or returns non-2xx, the gate refunds the payer (SOL) from the one-time address and answers 502.

Funds stay on the one-time addresses until you sweep them: `stealthKeypair(secret, nonce, leg)` gives you each key (keep nonces from `onReceipt`).

## Paying as an agent

```ts
import { hushFetch } from "hush-x402/client";
const { res } = await hushFetch("https://seller.example/api/forecast", { keypair, rpcUrl });
```

## Options

`sell({ secret, price, resource, rpcUrl?, cluster?, currency?, seller?, onReceipt?, claimSignature? }, handler)`. For composite calls paying several sellers in one transaction, use the lower-level `hushGate({ ..., legs: [{ seller, amount }] }, handler)`.

- `secret`: at least 32 chars of randomness. It controls every payee key. Never share it.
- `claimSignature`: replay guard. The default is in-memory (one process); in production store used signatures in your DB.
- SOL legs must be ≥ 0.00089088 SOL (a fresh Solana account must be rent-exempt).

## Limits

On its own, hush-x402 hides the payee, not the buyer's wallet (on hushagents.com buyers pay from a shared pool, which hides that too). Not zero-knowledge. USDC verification is implemented but less tested than SOL; USDC refunds are not automatic.

Part of [HUSH](https://hushagents.com) · [source](https://github.com/bigrceo/hush) · MIT
