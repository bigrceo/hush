// Pure buyback allocation math (unit-tested).
export const WSOL = "So11111111111111111111111111111111111111112";

/** Split the unallocated fee balance: `share` to buyback & burn, the rest to the ops account. */
export function splitFees(feeBalance: number, share: number): { buyback: number; ops: number } {
  if (feeBalance <= 0) return { buyback: 0, ops: 0 };
  const buyback = Math.floor(feeBalance * share);
  return { buyback, ops: feeBalance - buyback };
}

/** Temporary SOL the buyback wallet needs on top of the swap input: wSOL + token-account rent (Token-2022
 *  accounts carry extensions), the DEX's own per-user accounts, and fees. Unused float is returned. */
export function floatNeeded(ataRent: number): number {
  return Math.max(8_000_000, 3 * ataRent + 1_500_000);
}
