// Pure helpers for the HUSH pool (no I/O), unit-tested in test/pool.test.ts.
export const FEE = 5000;            // lamports per signature
export const RENT_MIN = 890_880;    // rent-exempt minimum for a 0-data system account

/** Can a pool address with `bal` pay `amount` (+fee) and stay valid (empty, or still rent-exempt)? */
export function canPay(bal: number, amount: number): boolean {
  const left = bal - amount - FEE;
  return left === 0 || left >= RENT_MIN;
}

/** Can `amount` be deposited into an address that holds `bal`? (a new account must reach rent-exempt) */
export function canReceive(bal: number, amount: number): boolean {
  return bal > 0 ? true : amount >= RENT_MIN;
}

/** Pick a pool index able to pay `amount`, at random among eligible ones (rand in [0,1)). */
export function pickPayer(balances: number[], amount: number, rand: number): number {
  const ok = balances.map((b, i) => (canPay(b, amount) ? i : -1)).filter((i) => i >= 0);
  if (!ok.length) return -1;
  return ok[Math.floor(rand * ok.length) % ok.length];
}

/** Pick a pool index to receive a deposit sweep of `amount`, random among valid targets. */
export function pickReceiver(balances: number[], amount: number, rand: number): number {
  const ok = balances.map((b, i) => (canReceive(b, amount) ? i : -1)).filter((i) => i >= 0);
  if (!ok.length) return -1;
  return ok[Math.floor(rand * ok.length) % ok.length];
}

/** Split a withdrawal across pool addresses. Returns [index, lamports to send] legs and what is left uncovered. */
export function planWithdraw(balances: number[], amount: number): { legs: [number, number][]; uncovered: number } {
  const legs: [number, number][] = [];
  let rest = amount;
  const order = balances.map((b, i) => [i, b] as const).sort((a, b) => b[1] - a[1]);
  for (const [i, b] of order) {
    if (rest <= 0) break;
    if (b <= FEE) continue;
    let take = Math.min(rest, b - FEE);
    const left = b - take - FEE;
    if (left > 0 && left < RENT_MIN) take = b - FEE - RENT_MIN;
    if (take <= 0) continue;
    legs.push([i, take]);
    rest -= take;
  }
  return { legs, uncovered: Math.max(0, rest) };
}
