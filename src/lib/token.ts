// $HUSH token economics and links — edit here, the site reads everything from this file.
export const TOKEN = {
  symbol: "$HUSH",
  mint: process.env.NEXT_PUBLIC_HUSH_MINT || "",
  feeBps: 100, // facilitator fee on every buy, in basis points of the price (1%), before tier discount
  buybackShare: 0.5, // share of facilitator fees that buys and burns $HUSH
  tiers: [
    { name: "Tier 1", min: 100_000, perk: "−10% fees", discount: 0.1 },
    { name: "Tier 2", min: 1_000_000, perk: "−25% fees", discount: 0.25 },
    { name: "Tier 3", min: 5_000_000, perk: "−50% fees", discount: 0.5 },
    { name: "Tier 4", min: 10_000_000, perk: "zero fees", discount: 1 },
  ],
};

export const LINKS = {
  buy: process.env.NEXT_PUBLIC_BUY_URL || "https://pump.fun",
  x: process.env.NEXT_PUBLIC_X_URL || "",
  telegram: process.env.NEXT_PUBLIC_TG_URL || "",
  dexscreener: TOKEN.mint ? `https://dexscreener.com/solana/${TOKEN.mint}` : "",
  pump: TOKEN.mint ? `https://pump.fun/coin/${TOKEN.mint}` : "",
  holders: TOKEN.mint ? `https://solscan.io/token/${TOKEN.mint}#holders` : "",
  github: process.env.NEXT_PUBLIC_GITHUB_URL || "", // set once the public repo is live; hidden until then
};

/** Public source repo used by /proof (owner/name on GitHub). */
export const REPO = { owner: "bigrceo", name: "hush", branch: "main" };

/** Team wallets shown on /proof. Add entries as { address, label, lockUrl? }. */
export const TEAM_WALLETS: { address: string; label: string; lockUrl?: string }[] = [];

export const fmtAmount = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1_000}k`);
