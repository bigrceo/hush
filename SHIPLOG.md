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

## 2026-10-17 · Agent Shop: token risk scan

**Shipped**
- New listing `token-scan` (0.001 SOL per call, scan.hush), paid privately like every HUSH call. Give it any Solana or pump.fun mint and it returns:
  - SPL or Token-2022, supply and decimals;
  - mint and freeze authority status;
  - largest-holder % and top-10 %, computed on circulating supply with the pump.fun bonding curve and pump AMM pool excluded;
  - the top 10 owners and plain-language red flags.
- It appears in `/api/shop`, so hush-mcp's `hush_shop` / `hush_buy` pick it up with no change.
- Code: `src/lib/tokenscan.ts`. Unit tests: `test/tokenscan.test.ts`.

**Verified on mainnet**
- Paid call by claude-demo: https://solscan.io/tx/27XmZvcjTCZpprfXNwsXpkSrNp9QpEokSf1BYLrAnkPFXbyvMF6ZmATB7Smhn9yLgEMNkg1KsDbVceYqfwwernVd
  - Signed by pool address `EjXZ6h…BuyR`.
  - Paid 0.001 SOL to a fresh one-time payee `C37Uya…cHPY` (one transaction in its history).
- Result for $HUSH: token-2022; mint and freeze authority revoked; bonding curve `EEdSBm…cV82` detected and excluded (29.77% of supply); largest holder 5.42%; top 10 38.19%; no flags.

**Image:** `x-launch-pack/img/U-tokenscan.png`

**Tweet (≤270, lowercase):**
> new in the hush agent shop: token risk scan. your agent pays 0.001 sol, privately, and gets top-10 holders, biggest wallet, mint/freeze authority and red flags for any pump.fun mint. bonding curve excluded. works from claude via npx hush-mcp

## 2026-10-18 · Agent Shop: dev check

**Shipped**
- New listing `dev-check` (0.001 SOL per call, paid privately from the pool). Give it any pump.fun mint and it returns:
  - the creator wallet (read from the bonding curve; for older curves that don't store it, from the fee payer of the token's create transaction, found through the metadata account);
  - the dev's initial buy % (from the create tx) and current holding %;
  - graduated or still on the curve;
  - how many pump.fun coins the dev created in its last 60 transactions;
  - flags: dev sold more than half, serial launcher, dev holds 10%+.
- Code: `src/lib/devcheck.ts`. Tests: `test/devcheck.test.ts`.

**Verified on mainnet**
- First attempt: the dev's history contained a transaction format the client can't parse. The call failed and HUSH's escrow refunded it automatically (refund tx `sFMVi23V…miJS`). I fixed it to skip unreadable transactions.
- Paid call on Fartcoin (`9BB6NF…gpump`): https://solscan.io/tx/4Fm8VkaEz8yexnko8ZtYfsUEykwT3LTPpFoKxsLe89LQGKx666cAk1TFEtYUqkJpaPnx6KwQY5mgWNaSCkWHRNm3
  - Signed only by pool address `2mJik4…H6k7`.
  - Paid 0.001 SOL to a one-time payee `6mE774…Hcsh`.
- Result: creator `HyYNVY…nMFF`, created 2024-10-18 (create tx `4x9KdE…z9S`), initial buy 6.71%, holding now 0%, 0 launches in its last 60 transactions, graduated; flag "dev sold more than half".

**Image:** `x-launch-pack/img/U-devcheck.png`

**Tweet (≤270, lowercase):**
> new in the hush agent shop: dev check. paste any pump.fun mint, your agent pays 0.001 sol privately and gets the creator wallet, its initial buy vs what it holds now, how many coins it launched lately, and a flag if it dumped. try it on your bags
