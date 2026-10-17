// Bundle check: link a token's top holders by who funded them and the slot they first appeared in.
import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { topHolders } from "./overlap";
import { bundleClusters, bundleFlags, type FundedHolder } from "./bundlerules";

/** First SOL sender into `owner` in a parsed tx (system transfer), else the fee payer if it is not the owner. */
function funderOf(tx: ParsedTransactionWithMeta | null, owner: string): string | null {
  if (!tx) return null;
  const ixs = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions)];
  for (const ix of ixs) {
    const p = (ix as { parsed?: { type?: string; info?: { source?: string; destination?: string; newAccount?: string } } }).parsed;
    if (p?.info && (p.type === "transfer" || p.type === "createAccount" || p.type === "transferWithSeed")) {
      const dest = p.info.destination ?? p.info.newAccount;
      if (dest === owner && p.info.source && p.info.source !== owner) return p.info.source;
    }
  }
  const payer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58();
  return payer && payer !== owner ? payer : null;
}

export async function bundleCheck(conn: Connection, mintStr: string, cap = 100) {
  const holders = await topHolders(conn, mintStr);
  const rows: FundedHolder[] = [];
  for (let i = 0; i < holders.length; i += 5) {
    rows.push(...(await Promise.all(holders.slice(i, i + 5).map(async (h) => {
      const sigs = await conn.getSignaturesForAddress(new PublicKey(h.owner), { limit: cap }).catch(() => []);
      if (!sigs.length || sigs.length >= cap) return { owner: h.owner, pct: h.pct, funder: null, firstSlot: null };
      const first = sigs[sigs.length - 1];
      const tx = await conn.getParsedTransaction(first.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null);
      return { owner: h.owner, pct: h.pct, funder: funderOf(tx, h.owner), firstSlot: first.slot };
    }))));
  }
  const { clusters, bundledWallets, bundledPct } = bundleClusters(rows);
  return {
    mint: mintStr,
    holdersChecked: rows.length,
    traced: rows.filter((r) => r.funder || r.firstSlot != null).length,
    bundledWallets,
    bundledPct,
    clusters: clusters.slice(0, 8),
    holders: rows.sort((a, b) => b.pct - a.pct),
    flags: bundleFlags({ bundledWallets, bundledPct, biggest: Math.max(0, ...clusters.map((c) => c.wallets.length)) }),
    note: `Top 20 token accounts, pools and bonding curves excluded. Each wallet's first transaction (within its last ${cap}) gives its funder and birth slot; wallets sharing either are linked. Wallets with ${cap}+ transactions are not traced.`,
  };
}
