// Pure fee/tier math (unit-tested in test/fees.test.ts).
export type Tier = { name: string; min: number; perk: string; discount: number };

/** Highest tier whose threshold the balance reaches, or null. */
export function tierFor(balance: number, tiers: Tier[]): Tier | null {
  let best: Tier | null = null;
  for (const t of tiers) if (balance >= t.min && (!best || t.min > best.min)) best = t;
  return best;
}

/** Facilitator fee in lamports for a price, after the tier discount. Rounded down, never negative. */
export function facilitatorFee(priceLamports: number, feeBps: number, tier: Tier | null): number {
  const base = (priceLamports * feeBps) / 10_000;
  return Math.max(0, Math.floor(base * (1 - (tier?.discount ?? 0))));
}
