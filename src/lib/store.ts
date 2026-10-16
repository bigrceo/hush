// Persistent state on Postgres (Neon via DATABASE_URL). One adapter: prepare(sql with ?).bind(...).first/all/run.
// Schema: migrations/pg/0001_init.sql (apply with `npm run db:migrate`).
import { neon } from "@neondatabase/serverless";
import type { GateReceipt } from "@/gate";
import { sha256Hex } from "@/gate/crypto";

interface Result<T> { results: T[]; meta: { changes: number } }
interface Stmt { bind(...v: unknown[]): Stmt; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<Result<T>>; run(): Promise<Result<unknown>> }
interface DB { prepare(q: string): Stmt }

let client: ReturnType<typeof neon<false, true>> | null = null;
function pg() {
  if (!client) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url, { fullResults: true });
  }
  return client;
}
const toPg = (q: string) => { let i = 0; return q.replace(/\?/g, () => "$" + ++i); };

export async function d1(): Promise<DB> {
  const make = (q: string, vals: unknown[] = []): Stmt => ({
    bind: (...v) => make(q, v),
    first: async <T,>() => ((await pg().query(toPg(q), vals)).rows[0] as T) ?? null,
    all: async <T,>() => { const r = await pg().query(toPg(q), vals); return { results: r.rows as T[], meta: { changes: r.rowCount ?? 0 } }; },
    run: async () => { const r = await pg().query(toPg(q), vals); return { results: [], meta: { changes: r.rowCount ?? 0 } }; },
  });
  return { prepare: (q) => make(q) };
}

export interface Agent {
  id: string;
  name: string;
  owner: string;
  pubkey: string;
  dailyBudget: number;
  perCallCap: number;
  allowlist: string[];
  frozen: boolean;
  spent: { day: string; sol: number };
  createdAt: number;
}

export interface Receipt extends GateReceipt {
  listing: string;
  commitment: string; // sha256(nonce|signature|payer) — the only thing made public
  agentId?: string;
  epochId?: number | null;
}

export const today = () => new Date().toISOString().slice(0, 10);

type AgentRow = { id: string; name: string; owner: string; pubkey: string; secret_enc: string; key_hash: string; daily_budget: number; per_call_cap: number; allowlist: string; frozen: number; spent_day: string; spent_sol: number; created_at: number };
const toAgent = (r: AgentRow): Agent => ({
  id: r.id, name: r.name, owner: r.owner, pubkey: r.pubkey, dailyBudget: r.daily_budget, perCallCap: r.per_call_cap,
  allowlist: JSON.parse(r.allowlist), frozen: !!r.frozen,
  spent: r.spent_day === today() ? { day: r.spent_day, sol: Number(r.spent_sol) } : { day: today(), sol: 0 }, createdAt: Number(r.created_at),
});

export async function insertAgent(a: Agent, secretEnc: string, keyHash: string) {
  await (await d1()).prepare(
    "INSERT INTO agents (id,name,owner,pubkey,secret_enc,key_hash,daily_budget,per_call_cap,allowlist,frozen,spent_day,spent_sol,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).bind(a.id, a.name, a.owner, a.pubkey, secretEnc, keyHash, a.dailyBudget, a.perCallCap, JSON.stringify(a.allowlist), a.frozen ? 1 : 0, a.spent.day, a.spent.sol, a.createdAt).run();
}

export async function getAgent(id: string): Promise<Agent | null> {
  const r = await (await d1()).prepare("SELECT * FROM agents WHERE id = ?").bind(id).first<AgentRow>();
  return r ? toAgent(r) : null;
}
export async function getAgentSecrets(id: string) {
  return (await d1()).prepare("SELECT secret_enc, key_hash FROM agents WHERE id = ?").bind(id).first<{ secret_enc: string; key_hash: string }>();
}
export async function listAgents(owner: string): Promise<Agent[]> {
  const { results } = await (await d1()).prepare("SELECT * FROM agents WHERE owner = ? ORDER BY created_at").bind(owner).all<AgentRow>();
  return results.map(toAgent);
}
export async function countAgents() {
  return Number((await (await d1()).prepare("SELECT COUNT(*) AS n FROM agents").first<{ n: number }>())?.n ?? 0);
}
export async function updateLeash(id: string, p: Partial<Pick<Agent, "dailyBudget" | "perCallCap" | "allowlist" | "frozen">>) {
  const sets: string[] = [], vals: unknown[] = [];
  if (p.dailyBudget !== undefined) { sets.push("daily_budget = ?"); vals.push(p.dailyBudget); }
  if (p.perCallCap !== undefined) { sets.push("per_call_cap = ?"); vals.push(p.perCallCap); }
  if (p.allowlist !== undefined) { sets.push("allowlist = ?"); vals.push(JSON.stringify(p.allowlist)); }
  if (p.frozen !== undefined) { sets.push("frozen = ?"); vals.push(p.frozen ? 1 : 0); }
  if (sets.length) await (await d1()).prepare(`UPDATE agents SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id).run();
}
/** Atomic spend: resets on a new day, then adds. */
export async function addSpend(id: string, sol: number) {
  const d = today();
  await (await d1()).prepare(
    "UPDATE agents SET spent_sol = CASE WHEN spent_day = ? THEN spent_sol + ? ELSE ? END, spent_day = ? WHERE id = ?",
  ).bind(d, sol, sol, d, id).run();
}

export async function isFrozenAll(owner: string) {
  return !!(await (await d1()).prepare("SELECT frozen_all FROM owners WHERE owner = ?").bind(owner).first<{ frozen_all: number }>())?.frozen_all;
}
export async function setFrozenAll(owner: string, on: boolean) {
  await (await d1()).prepare("INSERT INTO owners (owner, frozen_all) VALUES (?, ?) ON CONFLICT(owner) DO UPDATE SET frozen_all = excluded.frozen_all").bind(owner, on ? 1 : 0).run();
}

/** x402 replay guard. true = first use. */
export async function claimSignature(sig: string) {
  const r = await (await d1()).prepare("INSERT INTO used_signatures (signature, at) VALUES (?, ?) ON CONFLICT (signature) DO NOTHING").bind(sig, Date.now()).run();
  return r.meta.changes === 1;
}

type ReceiptRow = { nonce: string; signature: string; listing: string; resource: string; currency: "SOL" | "USDC"; total: string; legs: string; payer: string; ok: number; refund_signature: string | null; latency_ms: number; at: number; commitment: string; agent_id: string | null; epoch_id?: number | null };
const toReceipt = (r: ReceiptRow): Receipt => ({
  nonce: r.nonce, signature: r.signature, listing: r.listing, resource: r.resource, currency: r.currency, total: r.total,
  legs: JSON.parse(r.legs), payer: r.payer, ok: !!r.ok, refundSignature: r.refund_signature ?? undefined, latencyMs: Number(r.latency_ms),
  at: Number(r.at), commitment: r.commitment, agentId: r.agent_id ?? undefined, epochId: r.epoch_id ?? null,
});

export async function addReceipt(r: GateReceipt, listing: string, agentId?: string) {
  const commitment = await sha256Hex(`${r.nonce}|${r.signature}|${r.payer}`);
  await (await d1()).prepare(
    "INSERT INTO receipts (nonce,signature,listing,resource,currency,total,legs,payer,ok,refund_signature,latency_ms,at,commitment,agent_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (nonce) DO UPDATE SET ok = EXCLUDED.ok, refund_signature = EXCLUDED.refund_signature, latency_ms = EXCLUDED.latency_ms",
  ).bind(r.nonce, r.signature, listing, r.resource, r.currency, r.total, JSON.stringify(r.legs), r.payer, r.ok ? 1 : 0, r.refundSignature ?? null, r.latencyMs, r.at, commitment, agentId ?? null).run();
  return commitment;
}
export async function tagReceiptAgent(signature: string, agentId: string) {
  await (await d1()).prepare("UPDATE receipts SET agent_id = ? WHERE signature = ?").bind(agentId, signature).run();
}
export async function ownerReceipts(owner: string, limit = 100) {
  const { results } = await (await d1()).prepare(
    "SELECT r.* FROM receipts r JOIN agents a ON a.id = r.agent_id WHERE a.owner = ? ORDER BY r.at DESC LIMIT ?",
  ).bind(owner, limit).all<ReceiptRow>();
  return results.map(toReceipt);
}
/** Public, private-by-default view: no payer, no payee, no signature. */
export async function publicReceipts(limit = 50) {
  const { results } = await (await d1()).prepare("SELECT commitment, listing, currency, ok, at, legs FROM receipts ORDER BY at DESC LIMIT ?").bind(limit).all<Pick<ReceiptRow, "commitment" | "listing" | "currency" | "ok" | "at" | "legs">>();
  return results.map((r) => ({ commitment: r.commitment, listing: r.listing, currency: r.currency, ok: !!r.ok, at: Number(r.at), legs: JSON.parse(r.legs).length }));
}

/** Hush Score per seller from receipts; published with a hash-chain root over the commitments, never the receipts. */
export async function hushScores() {
  const { results } = await (await d1()).prepare("SELECT legs, ok, latency_ms, commitment FROM receipts ORDER BY at ASC LIMIT 20000").all<Pick<ReceiptRow, "legs" | "ok" | "latency_ms" | "commitment">>();
  const by = new Map<string, Pick<ReceiptRow, "ok" | "latency_ms" | "commitment">[]>();
  for (const r of results) for (const l of JSON.parse(r.legs) as { seller: string }[]) by.set(l.seller, [...(by.get(l.seller) ?? []), r]);
  const out: { seller: string; calls: number; success: number; refundRate: number; latencyMs: number; score: number; receiptsRoot: string }[] = [];
  for (const [seller, rs] of by) {
    const ok = rs.filter((r) => r.ok).length, refunds = rs.length - ok;
    const lat = rs.reduce((s, r) => s + Number(r.latency_ms), 0) / rs.length;
    let root = "0";
    for (const r of rs) root = await sha256Hex(root + r.commitment);
    const success = ok / rs.length;
    const score = Math.round(1000 * (0.6 * success + 0.25 * Math.max(0, 1 - lat / 5000) + 0.15 * (1 - refunds / rs.length)));
    out.push({ seller, calls: rs.length, success, refundRate: refunds / rs.length, latencyMs: Math.round(lat), score, receiptsRoot: root });
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function agentGdp() {
  const r = await (await d1()).prepare(
    `SELECT COALESCE(SUM(CASE WHEN ok=1 AND currency='SOL' THEN CAST(total AS DOUBLE PRECISION) END),0) AS sol,
            COALESCE(SUM(CASE WHEN ok=1 AND currency='USDC' THEN CAST(total AS DOUBLE PRECISION) END),0) AS usdc,
            SUM(CASE WHEN ok=1 THEN 1 ELSE 0 END) AS calls, SUM(CASE WHEN ok=0 THEN 1 ELSE 0 END) AS refunds FROM receipts`,
  ).first<{ sol: number; usdc: number; calls: number | null; refunds: number | null }>();
  return { sol: Number(r?.sol ?? 0), usdc: Number(r?.usdc ?? 0), calls: Number(r?.calls ?? 0), refunds: Number(r?.refunds ?? 0) };
}
