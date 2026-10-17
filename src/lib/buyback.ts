// Buyback & burn: 50% of accrued facilitator fees buys $HUSH via Jupiter and the tokens are burned (SPL burn).
// The other 50% moves to the ops account, which pays the network fees and the temporary token-account rent.
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createBurnCheckedInstruction, createCloseAccountInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { deriveKeypair } from "@/gate/crypto";
import { HUSH_SECRET, RPC_URL } from "./config";
import { TOKEN } from "./token";
import { d1 } from "./store";
import { credit, debit, ledger, poolKeypairs, poolBalances } from "./pool";
import { FEE, pickPayer, pickReceiver } from "./poolmath";
import { WSOL, floatNeeded, splitFees } from "./buybackmath";

export const FEE_ACCOUNT = "__fees__";
export const OPS_ACCOUNT = "__ops__";
export const BUYBACK_THRESHOLD = Number(process.env.BUYBACK_MIN_LAMPORTS || 2_000_000); // 0.002 SOL
const JUP = process.env.JUPITER_API || "https://lite-api.jup.ag/swap/v1";

export const buybackKeypair = () => deriveKeypair(HUSH_SECRET, "buyback/v1");

async function sumLedger(id: string) {
  const r = await (await d1()).prepare("SELECT COALESCE(SUM(lamports),0) AS s FROM ledger WHERE agent_id = ?").bind(id).first<{ s: string }>();
  return Number(r?.s ?? 0);
}

async function record(run: { status: string; solIn?: number; tokens?: string; decimals?: number; swapSig?: string; burnSig?: string; note?: string }) {
  await (await d1()).prepare("INSERT INTO buybacks (at, status, sol_in, tokens_burned, decimals, swap_sig, burn_sig, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(Date.now(), run.status, run.solIn ?? 0, run.tokens ?? null, run.decimals ?? null, run.swapSig ?? null, run.burnSig ?? null, run.note ?? null).run();
  return run;
}

export async function buybackState() {
  const db = await d1();
  const { results } = await db.prepare("SELECT * FROM buybacks ORDER BY at DESC LIMIT 50").all<Record<string, string | number | null>>();
  const tot = await db.prepare("SELECT COALESCE(SUM(sol_in),0) AS sol, COALESCE(SUM(CAST(tokens_burned AS NUMERIC)),0) AS tok, COUNT(*) AS n FROM buybacks WHERE status = 'done'").first<{ sol: string; tok: string; n: string }>();
  return {
    mint: TOKEN.mint,
    wallet: (await buybackKeypair()).publicKey.toBase58(),
    share: TOKEN.buybackShare,
    thresholdLamports: BUYBACK_THRESHOLD,
    pending: { fees: await sumLedger(FEE_ACCOUNT), ops: await sumLedger(OPS_ACCOUNT) },
    totals: { solIn: Number(tot?.sol ?? 0) / 1e9, tokensBurned: Number(tot?.tok ?? 0) / 1e6, runs: Number(tot?.n ?? 0) },
    runs: results.map((r) => ({ id: r.id, at: Number(r.at), status: r.status, solIn: Number(r.sol_in) / 1e9, tokensBurned: r.tokens_burned == null ? null : Number(r.tokens_burned) / 10 ** Number(r.decimals ?? 6), swapSig: r.swap_sig, burnSig: r.burn_sig, note: r.note })),
  };
}

export interface BuybackOpts { dryRun?: boolean; threshold?: number; floatAgentId?: string }

export async function runBuyback(o: BuybackOpts = {}) {
  if (!TOKEN.mint) return record({ status: "skipped", note: "no $HUSH mint configured" });
  const conn = new Connection(RPC_URL, "confirmed");
  const mint = new PublicKey(TOKEN.mint);

  // 1. Allocate newly accrued fees: share to buyback, rest to ops.
  const feeBal = await sumLedger(FEE_ACCOUNT);
  const { buyback, ops } = splitFees(feeBal, TOKEN.buybackShare);
  const threshold = o.threshold ?? BUYBACK_THRESHOLD;
  const quoteUrl = (amt: number) => `${JUP}/quote?inputMint=${WSOL}&outputMint=${mint.toBase58()}&amount=${amt}&slippageBps=500`;
  if (o.dryRun) {
    const q = buyback > 0 ? await (await fetch(quoteUrl(buyback))).json() : null;
    return { status: "dry-run", fees: feeBal, buyback, ops, threshold, wouldReceive: q?.outAmount ?? null, route: q?.routePlan?.map((r: { swapInfo: { label: string } }) => r.swapInfo.label) ?? [] };
  }
  if (buyback < threshold) return record({ status: "skipped", solIn: 0, note: `buyback share ${buyback} lamports below threshold ${threshold}` });

  // 2. Fund the buyback wallet from the pool: swap input + a temporary float for token-account rent and fees.
  const mintInfo = await conn.getAccountInfo(mint);
  const tokenProgram = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const float = floatNeeded(await conn.getMinimumBalanceForRentExemption(170));
  const floatFrom = o.floatAgentId ?? OPS_ACCOUNT;
  await ledger(FEE_ACCOUNT, "buyback", -buyback, null);
  await ledger(FEE_ACCOUNT, "to-ops", -ops, null);
  await ledger(OPS_ACCOUNT, "from-fees", ops, null);
  const floatOk = floatFrom === OPS_ACCOUNT ? (await sumLedger(OPS_ACCOUNT)) >= float && (await ledger(OPS_ACCOUNT, "buyback-float", -float, null), true) : await debit(floatFrom, float, "buyback-float", null);
  if (!floatOk) {
    await ledger(FEE_ACCOUNT, "buyback", buyback, "undo: no float");
    return record({ status: "skipped", note: `float of ${float} lamports not available from ${floatFrom === OPS_ACCOUNT ? "ops" : "float agent"}` });
  }
  const bk = await buybackKeypair();
  const kps = await poolKeypairs();
  const i = pickPayer(await poolBalances(kps), buyback + float, Math.random());
  const undoFloat = async () => (floatFrom === OPS_ACCOUNT ? ledger(OPS_ACCOUNT, "buyback-float", float, "undo") : credit(floatFrom, float, "release", null));
  if (i < 0) {
    await ledger(FEE_ACCOUNT, "buyback", buyback, "undo: pool");
    await undoFloat();
    return record({ status: "skipped", note: "pool liquidity unavailable" });
  }
  let swapSig: string | undefined, burnSig: string | undefined, tokens = 0n;
  let swapLanded = false;
  let returnFees = 0; // lamports of the returned balance that belong to the fee account (failed swap)
  try {
    await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: kps[i].publicKey, toPubkey: bk.publicKey, lamports: buyback + float })), [kps[i]], { commitment: "confirmed" });

    // 3. Swap SOL -> $HUSH via Jupiter.
    const quote = await (await fetch(quoteUrl(buyback))).json();
    if (!quote?.outAmount) throw new Error("no Jupiter route: " + JSON.stringify(quote).slice(0, 200));
    const sw = await (await fetch(`${JUP}/swap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteResponse: quote, userPublicKey: bk.publicKey.toBase58(), wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 20_000, priorityLevel: "high" } } }) })).json();
    if (!sw?.swapTransaction) throw new Error("Jupiter swap build failed: " + JSON.stringify(sw).slice(0, 200));
    const vtx = VersionedTransaction.deserialize(Buffer.from(sw.swapTransaction, "base64"));
    vtx.sign([bk]);
    const raw = vtx.serialize();
    swapSig = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 0 });
    // Re-broadcast until confirmed or the transaction's own blockhash expires.
    const lastValid = Number(sw.lastValidBlockHeight ?? 0);
    for (;;) {
      const st = (await conn.getSignatureStatus(swapSig)).value;
      if (st?.err) throw new Error("swap failed on-chain");
      if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) { swapLanded = true; break; }
      if (lastValid && (await conn.getBlockHeight("confirmed")) > lastValid) throw new Error("swap expired before landing");
      await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }

    // 4. Burn everything received and close the token account (rent comes back to the buyback wallet).
    const ata = getAssociatedTokenAddressSync(mint, bk.publicKey, false, tokenProgram);
    const bal = await conn.getTokenAccountBalance(ata);
    tokens = BigInt(bal.value.amount);
    const decimals = bal.value.decimals;
    burnSig = await sendAndConfirmTransaction(conn, new Transaction()
      .add(createBurnCheckedInstruction(ata, mint, bk.publicKey, tokens, decimals, [], tokenProgram))
      .add(createCloseAccountInstruction(ata, bk.publicKey, bk.publicKey, [], tokenProgram)), [bk], { commitment: "confirmed" });

    await record({ status: "done", solIn: buyback, tokens: tokens.toString(), decimals, swapSig, burnSig });
  } catch (e) {
    await record({ status: "failed", solIn: 0, swapSig, burnSig, note: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
    if (!swapLanded) {
      // Nothing was swapped: the swap input comes back to the fee account, not to the float source.
      const st = swapSig ? (await conn.getSignatureStatus(swapSig, { searchTransactionHistory: true })).value : null;
      if (!st || st.err) { await ledger(FEE_ACCOUNT, "buyback", buyback, "undo: swap did not land"); returnFees = buyback; }
    }
  }

  // 5. Return whatever is left in the buyback wallet to the pool and credit the float source.
  const left = (await conn.getBalance(bk.publicKey)) - FEE;
  if (left > 0) {
    const j = pickReceiver(await poolBalances(kps), left, Math.random());
    if (j >= 0) {
      await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: bk.publicKey, toPubkey: kps[j].publicKey, lamports: left })), [bk], { commitment: "confirmed" });
      const toFloat = Math.max(0, left - returnFees);
      if (floatFrom === OPS_ACCOUNT) await ledger(OPS_ACCOUNT, "float-return", toFloat, null);
      else await credit(floatFrom, toFloat, "release", null);
    }
  }
  return (await buybackState()).runs[0];
}
