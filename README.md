# HUSH

**Agents pay agents. Nobody sees who.**

HUSH is a private x402 payment layer for AI agents on Solana. An agent calls a paid endpoint, gets an HTTP 402 with payment requirements, pays in SOL (or USDC) to a one-time address, and gets the answer. Every call pays a different address, so nobody watching the chain can link an agent's purchases to a seller or to each other. Receipts stay private, but every receipt is rolled into a Merkle root anchored on Solana, so any receipt can be proven.

Live: https://hushagents.com · Verify a receipt: https://hushagents.com/verify · Proof page: https://hushagents.com/proof

## Architecture

| Piece | Where | What it does |
|---|---|---|
| **Hush Gate** | `src/gate/index.ts` | x402 middleware for any `Request -> Response` handler (Next.js, Hono, Workers). Answers 402 with `accepts[]`, then verifies the payment tx over RPC (amount, asset, expiry, replay) before serving. |
| **Stealth payees** | `src/gate/index.ts` | Each quote has a fresh nonce; each seller leg pays `ed25519(HMAC(HUSH_SECRET, "stealth/<nonce>/<leg>"))`. Addresses never repeat. The gate can sign for them, which gives per-call escrow: a failed call is refunded from the same address. |
| **Client** | `src/gate/client.ts` | Pays a 402 from a keypair in one transaction (all legs), retries with `X-PAYMENT`. |
| **Composite calls** | `src/lib/shop.ts` | One request, several sellers, one transaction. |
| **Sealed receipts** | `src/lib/store.ts` | Every verified call stores a receipt. Publicly only `commitment = sha256(nonce|signature|payer)` is exposed. Owners see their own agents' receipts. |
| **Merkle epochs** | `src/lib/merkle.ts`, `src/lib/epochs.ts` | Hourly (Vercel Cron) the new commitments become leaves (`sha256("hush-leaf-v1:" + commitment)`), the root is stored and anchored on Solana with an SPL Memo `HUSH receipts root v1 <epoch> <root> <count>`, signed by a publisher key derived from `HUSH_SECRET`. |
| **Proofs + /verify** | `src/app/api/receipts/[nonce]/proof`, `src/app/verify` | Owners download a proof per receipt (leaf, path, epoch, root, anchor tx). `/verify` recomputes the root in the browser, reads the memo from Solana and checks the signer. No other receipt is revealed. |
| **Hush Score** | `src/lib/store.ts`, `/api/stats` | Per-seller score from paid receipts (success, latency, refunds), published with the epoch roots it was computed from. |
| **Pool (payer privacy)** | `src/lib/pool.ts`, `src/lib/poolmath.ts` | Deposits are swept into rotating pool addresses and credited to an internal ledger; buys, refunds and withdrawals run from the pool, so the agent's own address never pays a seller. `/api/pool` lists the pool addresses. |
| **Leash** | `src/lib/agents.ts` | Agent wallets (random keys, AES-GCM sealed in Postgres) with daily budget, per-call cap, allowlist and kill switch, all enforced server-side before money moves. |
| **MCP server** | `mcp/server.mjs` | stdio MCP server so Claude, Cursor or any MCP client can browse the shop and buy with a leashed agent key. |

Stack: Next.js 16, Postgres (Neon), `@solana/web3.js`, deployed on Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL (any Postgres) and HUSH_SECRET
npm run db:migrate              # applies migrations/pg/*.sql
npm run dev                     # http://localhost:4048
npm test                        # Merkle + proof unit tests
```

Production runs on Solana mainnet (hushagents.com). Local dev defaults to devnet. For a fully local loop run `solana-test-validator` and set `RPC_URL`/`NEXT_PUBLIC_RPC_URL` to it; `scripts/e2e.mjs` and `scripts/verify-e2e.mjs` drive buys, leash checks, epoch sealing, anchoring and browser verification end to end.

MCP: create an agent in the app, copy its key, then

```json
{ "mcpServers": { "hush": { "command": "node", "args": ["/path/to/hush/mcp/server.mjs"], "env": { "HUSH_URL": "http://localhost:4048", "HUSH_AGENT_KEY": "hush_..." } } } }
```

## Verify a receipt

1. In the app, open your receipts and click **proof** on a sealed receipt. You get a JSON file.
2. Open https://hushagents.com/verify, paste or drop the file, press **Verify**.
3. Your browser recomputes `leaf -> root` from the Merkle path, fetches the anchor transaction from Solana, checks the memo carries the same epoch, root and count, and that it was signed by the publisher (`/api/publisher`).

Epoch roots and anchor transactions are public at `/api/epochs`.

## Honest limits

- **Who pays whom is hidden, deposits are not.** Agents fund a per-agent deposit address that the server sweeps into a shared pool (`src/lib/pool.ts`, rotating `pool/v1/0..3` addresses, ledger in Postgres). Every buy is signed by a pool address and pays a one-time payee, so on-chain there is no agent → seller link. Still visible: that a deposit into HUSH happened, amounts and timing. With few users the pool offers weak cover.
- **Custodial.** The operator holds the pool keys and the ledger. Withdrawals pay out from the pool to the owner.
- **Not zero-knowledge.** Privacy comes from one-time addresses; verifiability comes from SHA-256 Merkle trees anchored with a memo. There are no ZK proofs here.
- **Operator trust.** The HUSH operator holds `HUSH_SECRET`, which derives payee keys, agent key encryption and the publisher key.
- **USDC path untested.** USDC payment verification is implemented but not tested end to end; USDC refunds are not implemented.
- Anchoring needs the publisher key to hold a little SOL; until then epochs stay "pending anchor".

## License

MIT
