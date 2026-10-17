// Pure helpers for leash alerts (unit-tested in test/alerts.test.ts).

/** True when this spend moves the day's total across pct% of the daily budget. */
export function crossesBudget(before: number, after: number, budget: number, pct: number) {
  if (!(budget > 0) || !(pct > 0)) return false;
  const line = (budget * pct) / 100;
  return before < line && after >= line;
}

/** Maps a leash error message to a short alert reason. */
export function blockReason(msg: string): string {
  if (/kill switch|frozen/i.test(msg)) return "frozen";
  if (/allowlist/i.test(msg)) return "allowlist";
  if (/per-call cap/i.test(msg)) return "per-call cap";
  if (/daily budget/i.test(msg)) return "daily budget";
  if (/insufficient/i.test(msg)) return "balance";
  return "other";
}

/** One payload that Discord (content), Slack (text) and generic webhooks all accept. */
export function webhookBody(e: { kind: string; agent?: string | null; message: string; at: number }) {
  const line = `HUSH · ${e.agent ? e.agent + " · " : ""}${e.message}`;
  return { content: line, text: line, hush: { kind: e.kind, agent: e.agent ?? null, message: e.message, at: new Date(e.at).toISOString() } };
}
