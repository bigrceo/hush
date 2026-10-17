// Holder tiers: read the agent owner's $HUSH balance on-chain (cached briefly) and map it to a fee tier.
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "./config";
import { TOKEN } from "./token";
import { tierFor, type Tier } from "./feemath";

const g = globalThis as unknown as { __hushTier?: Map<string, { at: number; balance: number }> };
const cache = (g.__hushTier ??= new Map());
const TTL = 60_000;

export async function hushBalance(owner: string): Promise<number> {
  if (!TOKEN.mint) return 0;
  const hit = cache.get(owner);
  if (hit && Date.now() - hit.at < TTL) return hit.balance;
  const conn = new Connection(RPC_URL, "confirmed");
  const r = await conn.getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(TOKEN.mint) });
  const balance = r.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
  cache.set(owner, { at: Date.now(), balance });
  return balance;
}

export async function ownerTier(owner: string): Promise<{ balance: number; tier: Tier | null }> {
  const balance = await hushBalance(owner).catch(() => 0); // RPC trouble never blocks a buy; it just means no discount
  return { balance, tier: tierFor(balance, TOKEN.tiers) };
}
