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
