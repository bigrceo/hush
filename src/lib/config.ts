// Runtime config. Everything defaults to devnet so the full payment loop works without real money.
export const CLUSTER = (process.env.HUSH_CLUSTER || process.env.NEXT_PUBLIC_CLUSTER || "devnet") as
  | "devnet"
  | "mainnet-beta";

export const RPC_URL =
  process.env.RPC_URL ||
  (CLUSTER === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");

// Root secret: derives every one-time stealth payee, every agent key and every session token.
// Set HUSH_SECRET in production (wrangler secret put HUSH_SECRET). The dev fallback is public on purpose.
export const HUSH_SECRET = process.env.HUSH_SECRET || "hush-dev-secret-do-not-use-in-production";

export const USDC_MINT =
  CLUSTER === "mainnet-beta"
    ? "EPjFWdd5AufqSSqeM2qZqWAquxHnWsZXsP6ehNkN5Mkj6"
    : "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; // Circle devnet USDC

export const HUSH_MINT = process.env.NEXT_PUBLIC_HUSH_MINT || ""; // CA: soon
export const NETWORK_ID = CLUSTER === "mainnet-beta" ? "solana" : "solana-devnet";
export const QUOTE_TTL_MS = 5 * 60_000;
export const FACILITATOR_FEE_BPS = 100; // 1%, cut by holder tier
