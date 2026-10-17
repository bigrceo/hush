// Dev check: who created a pump.fun / Solana token, what they still hold, and how often they launch.
import { Connection, PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";
const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");


/** Creator pubkey stored in a pump.fun bonding-curve account (bytes 49..81), or null. */
export function creatorFromCurve(data: Uint8Array): string | null {
  if (data.length < 81) return null;
  const k = data.slice(49, 81);
  if (k.every((b) => b === 0)) return null;
  return new PublicKey(k).toBase58();
}

/** Pure flag logic (unit-tested). */
export function devFlags(x: { initialPct: number | null; holdingPct: number; launches: number; windowTxs: number }) {
  const f: string[] = [];
  if (x.initialPct != null && x.initialPct > 0 && x.holdingPct < x.initialPct * 0.5) f.push(`dev sold more than half of its initial ${x.initialPct}%`);
  if (x.initialPct == null && x.holdingPct === 0) f.push("dev holds none of the supply now");
  if (x.launches >= 3) f.push(`serial launcher: ${x.launches} pump.fun creates in its last ${x.windowTxs} transactions`);
  if (x.holdingPct >= 10) f.push(`dev still holds ${x.holdingPct}% of supply`);
  return f;
}

const isPumpCreate = (t: ParsedTransactionWithMeta | null) =>
  !!t?.meta?.logMessages?.some((l) => /Instruction: Create(V2)?$/.test(l)) && t.transaction.message.accountKeys.some((k) => k.pubkey.equals(PUMP_PROGRAM));

export async function devCheck(conn: Connection, mintStr: string, window = 60) {
  const mint = new PublicKey(mintStr);
  const info = await conn.getAccountInfo(mint);
  if (!info) throw new Error("mint not found");
  const program = info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const m = await getMint(conn, mint, "confirmed", program);
  const [curve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM);
  const curveInfo = await conn.getAccountInfo(curve);
  let creator = curveInfo ? creatorFromCurve(curveInfo.data) : null;
  // Older curves don't store the creator: the metadata account is touched by very few transactions, and its
  // oldest one is the token's create transaction, whose fee payer is the creator.
  const META = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const [metaPda] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), META.toBuffer(), mint.toBuffer()], META);
  const metaSigs = await conn.getSignaturesForAddress(metaPda, { limit: 1000 }).catch(() => []);
  const createSig = metaSigs.length ? metaSigs[metaSigs.length - 1].signature : null;
  const createTx = createSig ? await conn.getParsedTransaction(createSig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }).catch(() => null) : null;
  const createdOnPump = !!createTx?.transaction.message.accountKeys.some((k) => k.pubkey.equals(PUMP_PROGRAM));
  if (!creator && createTx && createdOnPump) creator = createTx.transaction.message.accountKeys[0].pubkey.toBase58();
  if (!creator) return { mint: mint.toBase58(), pumpFun: false, creator: null, note: "not a pump.fun token (no bonding curve with a creator); dev check covers pump.fun launches", flags: [] as string[] };

  const supply = Number(m.supply);
  const pct = (raw: number) => Math.round((raw / supply) * 1e6) / 1e4;
  const held = await conn.getParsedTokenAccountsByOwner(new PublicKey(creator), { mint });
  const holdingRaw = held.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.amount), 0);

  // Recent history of the creator: count pump.fun creates, and find this token's create tx if it is in the window.
  const sigs = await conn.getSignaturesForAddress(new PublicKey(creator), { limit: window });
  const txs: (ParsedTransactionWithMeta | null)[] = [];
  // Some recent transactions use a newer transaction version the client can't parse; skip those individually.
  for (let i = 0; i < sigs.length; i += 20) {
    const batch = sigs.slice(i, i + 20).map((s) => s.signature);
    try {
      txs.push(...(await conn.getParsedTransactions(batch, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })));
    } catch {
      for (const sg of batch) txs.push(await conn.getParsedTransaction(sg, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }).catch(() => null));
    }
  }
  const creates = txs.filter(isPumpCreate);
  const own = (createdOnPump && createTx ? createTx : null) ?? creates.find((t) => (t!.meta?.postTokenBalances ?? []).some((b) => b.mint === mint.toBase58()));
  const initialRaw = own ? (own.meta?.postTokenBalances ?? []).filter((b) => b.mint === mint.toBase58() && b.owner === creator).reduce((s, b) => s + Number(b.uiTokenAmount.amount), 0) : null;
  const createdMints = [...new Set(creates.flatMap((t) => (t!.meta?.postTokenBalances ?? []).map((b) => b.mint)))].filter((x) => x !== "So11111111111111111111111111111111111111112");

  const out = {
    mint: mint.toBase58(),
    pumpFun: true,
    graduated: curveInfo ? curveInfo.data[48] === 1 : null,
    creator,
    devHoldingPct: pct(holdingRaw),
    devInitialBuyPct: initialRaw == null ? null : pct(initialRaw),
    createTx: own ? own.transaction.signatures[0] : null,
    createdAt: own?.blockTime ? new Date(own.blockTime * 1000).toISOString() : null,
    recentLaunches: { count: creates.length, inLastTxs: sigs.length, readable: txs.filter(Boolean).length, mints: createdMints.slice(0, 10) },
    note: initialRaw == null ? "Creation transaction not found; initial buy not measured." : "Initial buy measured from the creation transaction.",
  };
  return { ...out, flags: devFlags({ initialPct: out.devInitialBuyPct, holdingPct: out.devHoldingPct, launches: creates.length, windowTxs: sigs.length }) };
}
