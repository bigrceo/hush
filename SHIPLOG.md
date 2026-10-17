# HUSH ship log

Each entry: what shipped, how it was verified, and a one-line announcement idea.

## 2026-10-17 · Holder tiers live + facilitator fee

**Shipped**
- A 1% facilitator fee is now charged on every buy (it was configured but never charged before). It stays in the HUSH pool and is booked to a protocol fee account in the ledger (`__fees__`).
- Holder tiers are live: each buy reads the agent owner's $HUSH balance on-chain (mint `FcQNnWnjJuyfm4P5wHjG5bCtPQ3tDVS2F9jzYxahpump`, cached 60 s) and discounts the fee (−10% / −25% / −50% / zero at 100k / 1M / 5M / 10M). Tiers and the fee rate live in `src/lib/token.ts`.
- Refunded or failed calls return the fee. The buy response carries `facilitatorFee`, `tier` and `hushHeld`; the app shows your tier, effective fee and the gap to the next tier.
- Fixed: pool withdrawals now count the network fee per leg against the balance (a full-balance withdrawal used to be refused).

**Verified**
- Unit tests: tier thresholds and fee math (`test/fees.test.ts`), withdraw planning (`test/pool.test.ts`).
- Local validator with a stand-in $HUSH mint (`scripts/tier-e2e.mjs`): owners holding 0 / 150k / 1.5M / 12M tokens were charged 10,000 / 9,000 / 7,500 / 0 lamports on a 0.001 SOL buy; each ledger debit equalled price + network fee + facilitator fee; the fee account accrued exactly the sum. `scripts/pool-e2e.mjs` still passes (refund returns the fee, withdraw works).
- Mainnet: see the claude-demo buy below.

**Announce:** "Holding $HUSH now cuts your agent's fees on every call. 10M+ holders pay zero."
- Mainnet buy with claude-demo after deploy: https://solscan.io/tx/2ZNjyHU5x4fMk3yo3bNSAbwK5xqGfvM1Rbssf6yCv6LCXh4avJTTC69onzLwe4dmfQDFbsiMjikA1aFHvHhPSGcu (sent from pool address `2mJik4…H6k7`). The owner wallet `7aA3…xXfy` holds 0 $HUSH on-chain (checked via `getParsedTokenAccountsByOwner`), and the buy returned `tier: null`, `facilitatorFee: 10000` lamports (1% of 0.001 SOL). The discounted tiers were verified on the local validator only, since no test wallet holds real $HUSH.

## 2026-10-17 · Solflare, Backpack and any Wallet Standard wallet

**Shipped**
- The app now connects any Wallet Standard Solana wallet (Phantom, Solflare, Backpack, ...) through `@wallet-standard/app`, with legacy injected providers (`window.phantom.solana`, `window.solflare`, `window.backpack`) as a fallback. Sign-in, funding the agent deposit address and withdraw all work through the chosen wallet (`src/lib/wallets.ts`).
- New wallet picker in the site style: detected wallets with their icons, plus install links for the ones that are missing. The wallet is re-attached by name after a page reload.

**Verified**
- `scripts/wallet-e2e.mjs` on a local validator drives the real app in Chromium twice:
  - with an injected Wallet Standard wallet registered the way Backpack and Solflare do it (`standard:connect`, `solana:signMessage`, `solana:signAndSendTransaction`);
  - with a legacy `window.solflare` provider that only has `signTransaction`.
- Both ran connect → sign-in → create agent → fund 0.05 SOL → private buy → withdraw from the pool back to the owner.
- Screenshot: `screenshots/wallet-picker.png`.

**Announce:** "HUSH now works with Solflare, Backpack and every Wallet Standard wallet, not just Phantom."

## 2026-10-17 · Buyback & burn live

**Shipped**
- An hourly job (`/api/cron/buyback`, Vercel Cron at :30) splits accrued facilitator fees 50/50.
  - Half buys $HUSH on Jupiter (SOL → $HUSH) and the tokens are burned with an SPL `burnChecked` (Token-2022, since $HUSH is a Token-2022 mint). The emptied token account is closed so its rent comes back.
  - The other half goes to an ops account that pays network fees and the temporary token-account rent.
- The job runs from a dedicated buyback wallet `3BZzbcZHeeVUawT3SGRoq3DyUd7mrpA7cvcuUBr11F84`, funded from the pool for each run. Leftovers go back to the pool.
- Every run (SOL in, tokens burned, swap tx, burn tx) is stored in Postgres and is public at `/api/buyback`. /proof has a new "Buyback & burn" block with Solscan links.
- Manual trigger: POST `/api/cron/buyback` with an admin token. Supports `dryRun` (quote only), a `threshold` override, and a float source. The default threshold is 0.002 SOL of buyback share.
- If a swap doesn't land, its input goes back to the fee account. The swap is re-broadcast until it confirms or its blockhash expires.

**Verified on mainnet** (first run, threshold lowered so the tiny fee balance could go through)
- Swap: https://solscan.io/tx/5SmWWKiixrSk9a1TpzVWn5r7TcHwh88aQNnWhVdfFEBoTTHK7d9JiGbEEg9gBuQFRfHZVkVd65kxnuer3fBSEPt5. 0.00000125 SOL of fees → 5.076307 $HUSH via Pump.fun (Jupiter route), signed by the buyback wallet.
- Burn: https://solscan.io/tx/sRK2DKvzfJxMdY8yBYTVc4QdDNx7L14pG1M6zGEroMYUiyrSz2Y4ra28p1tkrbrszXivi7qHiRMAa1fQfbB4xut. `burnChecked` 5.076307 $HUSH, then `closeAccount`.
- $HUSH total supply dropped from 999,683,059.139141 to 999,683,054.062834, exactly 5.076307. The buyback wallet ends at 0 SOL.
- The first two attempts failed safely (failed runs are listed in the API):
  - Attempt 1: the float was too small for Pump.fun's accounts.
  - Attempt 2: the swap expired before landing.
  - Their SOL went back to the pool. One 2,500-lamport ledger mis-credit from attempt 2 was corrected by an `adjust` entry.
- The temporary float came from the claude-demo agent. Its net cost over the three attempts was about 0.00137 SOL (network and priority fees, plus rent the DEX keeps for a per-user account).
- Unit tests: fee split and float sizing (`test/buyback.test.ts`).

**Announce:** "First $HUSH buyback & burn executed on-chain: fees in, $HUSH bought on Jupiter, burned. Every run is public at hushagents.com/proof."
