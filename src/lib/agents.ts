import { Connection, Keypair } from "@solana/web3.js";
import { b64url, hmac, randomId, seal, sha256Hex, unseal } from "@/gate/crypto";
import { hushFetch, type Requirement } from "@/gate/client";
import { fromBase } from "@/gate";
import { HUSH_SECRET, RPC_URL } from "./config";
import { addSpend, getAgent, getAgentSecrets, insertAgent, isFrozenAll, tagReceiptAgent, today, type Agent } from "./store";
import { listingTotal } from "./shop";
import { findListing } from "./sellers";
import { credit, debit, ledgerBalance, poolPayer, sweepDeposit } from "./pool";
import { FEE } from "./poolmath";
import { ownerTier } from "./tiers";
import { facilitatorFee } from "./feemath";
import { TOKEN } from "./token";
import { accrueFee } from "./pool";

/** Agent wallets are random keypairs; the secret key is stored AES-GCM-sealed in D1. */
export async function agentKeypair(id: string): Promise<Keypair> {
  const s = await getAgentSecrets(id);
  if (!s) throw new Error("unknown agent");
  return Keypair.fromSecretKey(await unseal(HUSH_SECRET, s.secret_enc));
}
const newApiKey = async (id: string) => `hush_${id}_${b64url(await hmac(HUSH_SECRET, "agentkey/" + id + "/" + randomId(8)))}`;

export async function createAgent(owner: string, name: string) {
  const id = randomId(6);
  const kp = Keypair.generate();
  const apiKey = await newApiKey(id);
  const a: Agent = {
    id,
    name: name.slice(0, 32) || "agent-" + id.slice(0, 2),
    owner,
    pubkey: kp.publicKey.toBase58(),
    dailyBudget: 0.05,
    perCallCap: 0.005,
    allowlist: ["sol-price", "network-pulse", "market-brief"],
    frozen: false,
    spent: { day: today(), sol: 0 },
    createdAt: Date.now(),
  };
  await insertAgent(a, await seal(HUSH_SECRET, kp.secretKey), await sha256Hex(apiKey));
  return { agent: a, apiKey };
}

export async function agentFromKey(key: string | null) {
  if (!key) return null;
  const m = /^hush_([0-9a-f]+)_/.exec(key);
  if (!m) return null;
  const s = await getAgentSecrets(m[1]);
  if (!s || s.key_hash !== (await sha256Hex(key))) return null;
  return getAgent(m[1]);
}

export class LeashError extends Error {
  constructor(msg: string, public status = 403) {
    super(msg);
  }
}

/** Leash: every check runs on the server, before any money moves. */
export async function checkLeash(a: Agent, listingId: string, amountSol: number) {
  if (a.frozen || (await isFrozenAll(a.owner))) throw new LeashError("kill switch is on: agent is frozen");
  if (!a.allowlist.includes(listingId)) throw new LeashError(`seller not on allowlist: ${listingId}`);
  if (amountSol > a.perCallCap) throw new LeashError(`over per-call cap (${amountSol} > ${a.perCallCap} SOL)`);
  if (a.spent.sol + amountSol > a.dailyBudget)
    throw new LeashError(`over daily budget (${(a.spent.sol + amountSol).toFixed(6)} > ${a.dailyBudget} SOL)`);
}

export async function agentBuy(a: Agent, listingId: string, input: string | undefined, origin: string) {
  const l = await findListing(listingId);
  if (!l) throw new LeashError("unknown listing", 404);
  await checkLeash(a, l.id, listingTotal(l)); // pre-check with list price
  const url = new URL(`/api/shop/${l.id}`, origin);
  if (l.input && input) url.searchParams.set(l.input, input);

  // Fold any fresh deposit into the pool before spending (only if the ledger can't already cover it,
  // so deposits and buys are not back-to-back on-chain more than necessary).
  const listLamports = Math.round(listingTotal(l) * 1e9);
  if ((await ledgerBalance(a.id)) < listLamports + FEE) await sweepDeposit(a.id, await agentKeypair(a.id));

  const t0 = Date.now();
  const { tier, balance: hushHeld } = await ownerTier(a.owner);
  let fee = 0;
  let held = 0;
  let payer = null as Awaited<ReturnType<typeof poolPayer>>;
  const { res, paid } = await hushFetch(url.toString(), {
    rpcUrl: RPC_URL,
    // The payment is signed by a HUSH pool address, never by the agent's own deposit address.
    keypair: async (r: Requirement) => {
      const sol = r.currency === "SOL" ? +fromBase(BigInt(r.maxAmountRequired), "SOL") : 0;
      await checkLeash(a, l.id, sol); // re-check against what the seller actually asks
      if (r.currency !== "SOL") throw new LeashError("pool payments support SOL only for now", 400);
      // Facilitator fee (1% before tier discount) stays in the pool, booked to the fee account.
      fee = facilitatorFee(Number(r.maxAmountRequired), TOKEN.feeBps, tier);
      const lamports = Number(r.maxAmountRequired) + FEE + fee;
      if (!(await debit(a.id, lamports, "buy", null))) throw new LeashError(`insufficient HUSH balance (need ${(lamports / 1e9).toFixed(6)} SOL incl. fees)`, 402);
      held = lamports;
      payer = await poolPayer(Number(r.maxAmountRequired));
      if (!payer) {
        await credit(a.id, lamports, "release", null);
        held = 0;
        throw new LeashError("pool liquidity is rebalancing, try again shortly", 503);
      }
      return payer;
    },
  }).catch(async (e) => {
    if (held) await credit(a.id, held, "release", null); // payment never left the pool
    throw e;
  });
  const body = await res.json().catch(() => ({}));
  if (paid) {
    const sol = paid.requirement.currency === "SOL" ? +fromBase(BigInt(paid.requirement.maxAmountRequired), "SOL") : 0;
    if (res.ok) {
      await addSpend(a.id, sol);
      if (fee > 0) await accrueFee(fee, paid.signature);
    }
    // Escrow refund goes back to the pool address that paid; credit the agent's ledger for it (fee included).
    else if (body?.refundSignature) await credit(a.id, Number(paid.requirement.maxAmountRequired) - FEE + fee, "refund", body.refundSignature);
    else if (fee > 0) await credit(a.id, fee, "release", null); // seller failed without refund: never keep the fee
    await tagReceiptAgent(paid.signature, a.id);
  }
  return { status: res.status, ok: res.ok, listing: l.id, paid: paid ? { signature: paid.signature, from: (payer as unknown as { publicKey?: { toBase58(): string } })?.publicKey?.toBase58() ?? null, amount: paid.requirement.maxAmountRequired, currency: paid.requirement.currency, legs: paid.requirement.extra.legs.length, facilitatorFee: fee, tier: tier?.name ?? null, hushHeld } : null, ms: Date.now() - t0, result: body };
}

/** Spendable balance (ledger) plus anything still waiting on the deposit address. */
export async function agentBalance(a: Agent) {
  return (await ledgerBalance(a.id)) / 1e9;
}
export async function agentPendingDeposit(a: Agent) {
  return (await new Connection(RPC_URL, "confirmed").getBalance(new (await import("@solana/web3.js")).PublicKey(a.pubkey))) / 1e9;
}
