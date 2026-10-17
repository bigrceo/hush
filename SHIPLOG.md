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

## 2026-10-18 · Agent Shop: holder overlap

**Shipped**
- New listing `holder-overlap` (0.001 SOL per call, paid privately from the pool). Input: two mints as `mint=A,B`.
- It compares the top 20 token accounts of each mint, excluding liquidity pools, pump.fun bonding curves and program-owned accounts, and returns the owners they share, ranked, with each one's % of circulating supply on both sides. It flags a likely cluster when 5 or more top holders overlap.
- Code: `src/lib/overlap.ts`. Test: `test/overlap.test.ts`.

**Verified on mainnet**
- Paid call comparing Fartcoin and GOAT: https://solscan.io/tx/5EVkaWo2Ur5WnbTLS1F2NJLFV88GZoVTQ9uiDsbiEhyRKU9SM4zPXbTGemzT9PSkSTUw9Tj7VXZA6HXk25NK1VUz
  - Signed only by pool address `2ciWp6…NXgS`.
  - Paid 0.001 SOL to one-time payee `3iRVnZ…bunj`.
- Result: 20 × 20 holders compared, 2 shared top holders (`u6PJ8D…q2w`, `5Q544f…e4j1`), holding 8.31% of Fartcoin and 8.04% of GOAT; no cluster flag. The two shared wallets are probably exchange hot wallets; the scan doesn't label them yet.

**Image:** `x-launch-pack/img/U-overlap.png`

**Tweet (≤270, lowercase):**
> new in the hush agent shop: holder overlap. give your agent two mints, it pays 0.001 sol privately and gets the top wallets they share, pools excluded. same cluster behind two coins? now you know before you ape

## 2026-10-17 · Self-serve sellers

**Shipped**
- `/sell`: connect a wallet, list any https GET endpoint with a price (0.001 to 0.1 SOL) and a description. It shows up in the Agent Shop as `s-<id>` right away.
- Paid calls are proxied to the seller's endpoint (10 s timeout, 256 KB cap, no redirects, private/loopback hosts refused). If the endpoint fails, the gate's escrow refunds the buyer.
- Earnings stay on the one-time payees until the seller clicks "Sweep": HUSH drains them to the seller's wallet, several per transaction. Pause / resume per listing, max 5 listings per wallet.
- API: `GET/POST /api/sellers`, `PATCH /api/sellers/:id`, `POST /api/sellers/:id/sweep`. Agent leash allowlists accept seller listings. Migration `0005_sellers.sql`. Tests: `test/sellers.test.ts`.

**Verified on mainnet**
- Listed `s-17cdc8bf13` (SOL/USD spot from a public price API, 0.001 SOL) from the demo owner wallet.
- Demo agent bought it: https://solscan.io/tx/4qT6ucCFzanFGsefrioHpNiN7jpiT9hX4yMFYgXyaScadygoVG63asr6XtDKbbb9Tjw71siGBCp14BpWU438KByi (pool address `EjXZ6h…uyR` → one-time payee), answer `{"amount":"103.895","base":"SOL","currency":"USD"}`.
- Sweep to the seller wallet: https://solscan.io/tx/5WqaSaV3PTBF24dfaQ25pG4U4kW58kWT2zcBdPfxCTNBg6XRdR8Q595F7E7ZFi5JE9Q18bSUKMsyxF99J67SNn6x (0.000995 SOL after fee).

**Image:** `x-launch-pack/updates/01-sellers.png`

## 2026-10-17 · Leash alerts

**Shipped**
- New "Leash alerts" card in `/app`: set a webhook (Discord, Slack or any https URL) and a budget threshold (default 80%).
- Alerts fire when an agent's spend crosses the threshold (once per day, on the crossing call), when the leash blocks a call (allowlist, per-call cap, daily budget, balance, frozen; same block at most once per 10 min), and when a per-agent or global kill switch flips.
- Every alert is also kept in the app (last 30). One JSON body works for Discord (`content`), Slack (`text`) and generic receivers (`hush` object).
- API: `GET/PUT /api/alerts`, `POST /api/alerts/test`. Migration `0006_alerts.sql`. Code: `src/lib/alerts.ts`, `src/lib/alertrules.ts`. Tests: `test/alerts.test.ts`.

**Verified live**
- Test alert, a blocked call (`wallet-scan` not on the allowlist), a budget crossing (demo agent at 0.006 / 0.006 SOL with a 90% threshold, paid call https://solscan.io/tx/3g3kWhYo3NmL7s6FeXufGU3Zt3DBbKYmaKKNpnduHLFEAGm54U411oSTGtMbS6krmAJsNuBbNtyvdrtUHDLbHCTS) and freeze/unfreeze all reached a test webhook with HTTP 2xx. Demo settings restored after the test.

**Image:** `x-launch-pack/updates/02-leash-alerts.png`

## 2026-10-17 · Receipts CSV export

**Shipped**
- "Export CSV" on the receipts card in `/app` and "Export sales CSV" on `/sell`.
- `GET /api/receipts/export` (owner session): `role=buyer` (default, every receipt of your agents, with agent name) or `role=seller` (every paid call to your self-serve listings, with the sweep tx). Filters `from` / `to` (UTC days), `format=csv|json`.
- Columns: time, agent / listing name, listing, paid or refunded, amount, currency, payment tx, refund tx, (sweep tx), latency, epoch, commitment, receipt id. Formula-looking cells are neutralised for spreadsheets. Code: `src/lib/csv.ts`, test `test/csv.test.ts`.

**Verified live**
- Buyer export for the demo owner: 10 receipts, `content-type: text/csv`, attachment filename; date filter on 2026-10-17 returns 7 rows; seller export lists the `s-17cdc8bf13` sale with its sweep tx; anonymous request → 401.

**Image:** `x-launch-pack/updates/03-csv-export.png`

## 2026-10-17 · Public stats page

**Shipped**
- `/stats` (in the header and footer): paid agent calls, SOL paid to sellers, refunds, median latency, agents created and active in 7 days, shop listings (incl. self-serve), anchored receipt epochs, $HUSH burned; daily paid-calls chart since the first receipt (hover for paid / refunded / SOL); per-listing totals; latest anchor memo tx.
- `GET /api/stats/daily`: same data as JSON, cached 60 s. Counts and volumes only, no payer / payee / signature. Code: `src/lib/statsdaily.ts`.

**Verified live** (17 Oct, 15:1x): 109 paid calls, 1 refund, 0.147 SOL, median 82 ms, 8 anchored epochs, 5.08 $HUSH burned, 9 listings (1 self-serve).

**Image:** `x-launch-pack/updates/04-stats.png`

## 2026-10-17 · Privacy proof, end to end

**Why:** a payout on its own looks like a plain 0.001 SOL transfer, so the pool + one-time address privacy wasn't visible.

**Shipped**
- `/proof` section [00] "Privacy, end to end": the HUSH demo agent's latest paid calls (plus its latest call already sealed in an anchored root), each traced on purpose:
  1. the agent's deposit tx into the shared pool,
  2. the pool → one-time address payout tx (signer checked against the pool addresses),
  3. the payout address had no history before the payment, and neither the agent's deposit address nor its owner wallet appears in the payout tx,
  4. the receipt's Merkle path recomputed against the epoch root, with the SPL Memo anchor tx.
  Only HUSH's own demo agent is traced; real users never are.
- Unlinkability check anyone can run (form on `/proof`, `GET /api/privacy/check?tx=`): signers and whether each is a HUSH pool address, receivers and their prior history, HUSH receipt commitment / epoch, verdict. `GET /api/privacy/demo` returns the traced chains. Code: `src/lib/privacyproof.ts`.

**Verified on mainnet**
- Fresh top-up of the demo agent from its owner: https://solscan.io/tx/3agVr5q5a2AV5S5h3YR4iVMJYXPCoCBCxx33KwnSbwC7L2D7s9HihyguUjr9wdhaNQtwzkhg3zLGPJGcaDdXtbQk, swept into the pool (deposit tx `5DxDCwK8aj…`).
- Three fresh paid calls from the pool: https://solscan.io/tx/3GNmUVtq8ra55vqwTpu5Jg2JiA7Aq5RDuivf4W8QfVPFdMTdD9YPFYSX2ysuXySuRc3KUn7chAaBdk6u9pUjWRDh , https://solscan.io/tx/4TjoHoyG2j2mKdWLy6wP5bLb48c9WKeQz6zkNSGK5EMd3uk4hepPy2ue9z1KZsrPJvUtTSf4ZvJRoWQ6ysJYuFXS , https://solscan.io/tx/2oBfARSbm1znVr1W7p5RBkrMuwegNxCsXN5atXJwiqMs9dvc82NFs6MEKQ1sXezpZe9ebSEQKYkMe3yZ4BKs3Hw
- Live verdict on each: "unlinkable: signed only by the shared HUSH pool, paid to address(es) with no history before this payment"; payer absent from payout tx. Anchored example: holder-overlap receipt, leaf 2 of 3 in epoch #8, path verified, memo tx `5fHubvQz…d5yg`. Fresh receipts join the next hourly epoch.

**Image:** `x-launch-pack/updates/05-privacy-proof.png`

## 2026-10-17 · Agent Shop: liquidity check

**Shipped**
- New listing `liquidity-check` (0.001 SOL per call, paid privately from the pool). Input: `mint`.
- Decodes the pump.fun bonding curve (graduated or not, progress %, real SOL). For graduated or any SPL token, lists every DEX pool (DEX Screener public API, pump.fun curve excluded) with liquidity, 24h volume and creation date; total liquidity, market cap, market cap ÷ liquidity. Flags: no pool, liquidity under $10k, market cap over 50x liquidity.
- Code: `src/lib/liquidity.ts`. Test: `test/liquidity.test.ts`.

**Verified on mainnet**
- Paid call on Fartcoin: https://solscan.io/tx/67jCqVAXt5bQXWiqZGceXeUswVLY1wxhxse6e26qGvBcXkUDH3U9dgvQwcDT59beKmdonwPbJg9ZPNKn3wFqxxic (signed by pool address `55m4NU…4ghg`).
- Result: curve graduated, 30 pools, $9.16M liquidity, market cap 16.3x liquidity, no flags.

**Image:** `x-launch-pack/updates/06-liquidity-check.png`

## 2026-10-17 · Agent Shop: fresh-wallet ratio

**Shipped**
- New listing `fresh-wallets` (0.001 SOL per call, paid privately from the pool). Input: `mint`.
- Takes the top 20 holders (pools, bonding curves and program accounts excluded), reads each owner's last 100 transactions and marks it fresh when it has 5 or fewer transactions or its first activity is under 7 days old. Returns per-holder tx count / age / % of circulating supply, fresh count and ratio, supply held by fresh wallets. Flags: 40%+ of top holders fresh, or fresh wallets holding 15%+.
- Code: `src/lib/freshwallets.ts`, `src/lib/freshrules.ts`. Test: `test/fresh.test.ts`. Shop route `maxDuration` 60 s.

**Verified on mainnet**
- Paid call on GOAT: https://solscan.io/tx/339DnkmuBb9DwtSCy4SGa8mVrpP8qPo3E3ya7usy9sErYscRbQ2cc67yKEWFWhUd9LuAPTF4BZ5e4TLvJ9rnnCx7 (signed by pool address `2ciWp6…NXgS`), 14.3 s.
- Result: 20 holders checked, 1 fresh / near-empty (0.98% of supply), no flags.

**Image:** `x-launch-pack/updates/07-fresh-wallets.png`

## 2026-10-17 · Python client

**Shipped**
- `packages/hush-py` (`hush-agents`, standard library only, Python 3.8+): `HushClient.listings()`, `.buy(listing, input)`, `.stats()`, `.privacy_check(tx)`; `HushError` with `status` and `blocked_by="leash"`; CLI `hush listings | buy | stats | check`. Install: `pip install "git+https://github.com/bigrceo/hush.git#subdirectory=packages/hush-py"`. Offline tests in `packages/hush-py/tests`. Python snippet in `/docs` Developers.

**Verified on mainnet**
- `python -m hush_agents buy sol-price` with the demo agent key: https://solscan.io/tx/3eFpZXcT5EMToLy8ncvuVe5Q23pKhzXFm1th7FFNmFaoQvPbt7CeEkWnpUN71D1nKgeLH9UBSmVV6aDAFtDyx8S7 (pool address `2mJik4…H6k7`), answer 104.035 USD.

**Image:** `x-launch-pack/updates/08-python.png`

## 2026-10-17 · Agent Shop: bundle check

**Shipped**
- New listing `bundle-check` (0.001 SOL per call, paid privately from the pool). Input: `mint`.
- Takes the top 20 holders (pools, bonding curves and program accounts excluded), finds each wallet's first transaction (within its last 100) to get who funded it and the slot it was born in. Links holders that share a funder, share a birth slot, or were funded by another top holder. Returns clusters with their wallets and % of circulating supply, linked wallet count and supply. Flags: 3+ top holders in one cluster, or linked wallets holding 10%+.
- Code: `src/lib/bundle.ts`, `src/lib/bundlerules.ts`. Test: `test/bundle.test.ts`.

**Verified on mainnet**
- Paid call on GOAT: https://solscan.io/tx/3dYawb2j29mc7H9D47SpcqaMgox5CqNcfiRqvfpPsXCYuhWwKABdgxdvpYLK2hU5JE39B6PxtDMzRWnyKx3EpPpa (signed by pool address `2mJik4…H6k7`), 3.6 s.
- Result: 1 cluster, top holder `EZ41…xjsJ` funded top holder `AMMg…P4kX`, together 12.97% of circulating supply, flagged.

**Image:** `x-launch-pack/updates/09-bundle-check.png`

## 2026-10-17 · Seller templates + endpoint test

**Shipped**
- `/sell` now opens with three starter endpoints to deploy and list: Token price (Cloudflare Worker, Jupiter price, `?mint=`), Wallet SOL balance (Vercel function, mainnet RPC, `?address=`), Your own signal (Python FastAPI, `?mint=`). Copy code, or "Use this template" to prefill name, price, description and input.
- "Test endpoint" before listing: `POST /api/sellers/test {url, input?, value?}` (signed in) calls the endpoint exactly like the paid proxy (https only, private hosts and HUSH hosts refused, no redirects, 10 s timeout, 256 KB cap) and returns status, latency, size, JSON or not, a preview and the problems that would refund buyers.
- Code: `src/app/sell/templates.ts`, `src/app/sell/sell.tsx`, `src/app/api/sellers/test/route.ts`.

**Verified live**
- `/sell` serves the template block. Test endpoint: Jupiter price URL → ok, HTTP 200, 46 ms, 218 bytes, JSON; an HTTP 500 URL → not ready, "answered HTTP 500: buyers would be refunded"; `hushagents.com` URL → refused (400). Unsigned call → 401.

**Image:** `x-launch-pack/updates/10-seller-templates.png`
