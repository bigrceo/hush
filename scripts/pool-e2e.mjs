// Payer-privacy e2e on a local validator: deposit -> sweep into pool -> buys paid from pool -> refund -> withdraw.
// usage: RPC_URL=http://127.0.0.1:8999 node scripts/pool-e2e.mjs http://localhost:4052
import nacl from "tweetnacl";
import bs58 from "bs58";
import assert from "node:assert/strict";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const BASE = process.argv[2] || "http://localhost:4052";
const rpc = new Connection(process.env.RPC_URL || "http://127.0.0.1:8999", "confirmed");
const j = async (p, init = {}, tok) => { const r = await fetch(BASE + p, { ...init, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}), ...(init.headers || {}) } }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const owner = Keypair.generate(), ts = Date.now();
const air = async (pk, sol) => { const s = await rpc.requestAirdrop(new PublicKey(pk), sol * LAMPORTS_PER_SOL); await rpc.confirmTransaction(s, "confirmed"); };
await air(owner.publicKey, 0.01); // so the owner account exists for withdraw
const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(`Sign in to HUSH\nwallet: ${owner.publicKey.toBase58()}\nts: ${ts}`), owner.secretKey));
const { body: { token } } = await j("/api/auth", { method: "POST", body: JSON.stringify({ pubkey: owner.publicKey.toBase58(), ts, signature: sig }) });
const { body: c } = await j("/api/agents", { method: "POST", body: JSON.stringify({ name: "pool-e2e" }) }, token);
const agentAddr = c.agent.pubkey;
const pool = (await j("/api/pool")).body.pool.map((p) => p.address);
console.log("pool addresses:", pool.length);

await air(agentAddr, 0.2);
const list = (await j("/api/agents", {}, token)).body.agents.find((a) => a.id === c.agent.id);
console.log("after sweep: ledger", list.balance, "SOL, deposit address left", list.pendingDeposit);
assert.ok(list.balance > 0.199 && list.pendingDeposit === 0);

const buy = (listing, input) => j("/api/agent/buy", { method: "POST", headers: { "x-agent-key": c.apiKey }, body: JSON.stringify({ listing, input }) });
const r1 = await buy("sol-price");
assert.equal(r1.status, 200); assert.equal(r1.body.ok, true);
const tx = await rpc.getParsedTransaction(r1.body.paid.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
const signers = tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey.toBase58());
const transfers = tx.transaction.message.instructions.filter((i) => i.parsed?.type === "transfer").map((i) => i.parsed.info);
console.log("payment signer:", signers, "| transfers:", transfers.map((t) => `${t.source.slice(0, 4)}→${t.destination.slice(0, 4)} ${t.lamports}`));
assert.ok(signers.every((s) => pool.includes(s)), "signer must be a pool address");
assert.ok(!signers.includes(agentAddr) && transfers.every((t) => t.source !== agentAddr), "agent address must not appear as sender");
assert.ok(transfers.every((t) => !pool.includes(t.destination) && t.destination !== agentAddr), "payee is a one-time address");
const pre = (await rpc.getSignaturesForAddress(new PublicKey(transfers[0].destination))).length;
console.log("one-time payee history:", pre, "tx(s)");

const r2 = await buy("market-brief");
assert.equal(r2.body.ok, true);
console.log("composite paid from:", r2.body.paid.from?.slice(0, 6), "legs", r2.body.paid.legs);

// agent deposit address never talks to a seller: its only outgoing tx is the sweep into the pool
const hist = await rpc.getSignaturesForAddress(new PublicKey(agentAddr));
for (const h of hist) {
  const t = await rpc.getParsedTransaction(h.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  for (const i of t.transaction.message.instructions) if (i.parsed?.type === "transfer" && i.parsed.info.source === agentAddr) assert.ok(pool.includes(i.parsed.info.destination), "deposit only ever goes to the pool");
}
console.log("deposit address history:", hist.length, "tx(s), outgoing only to pool ✓");

await j(`/api/agents/${c.agent.id}`, { method: "PATCH", body: JSON.stringify({ allowlist: ["sol-price", "market-brief", "wallet-scan"] }) }, token);
const before = (await j("/api/agents", {}, token)).body.agents.find((a) => a.id === c.agent.id).balance;
const r3 = await buy("wallet-scan", "not-an-address");
const after = (await j("/api/agents", {}, token)).body.agents.find((a) => a.id === c.agent.id).balance;
console.log("failed seller ->", r3.body.status, "refunded to ledger:", (after - before + 0.002 + 0.000005).toFixed(6), "(net cost", (before - after).toFixed(6), "SOL = fees)");
assert.equal(r3.body.status, 502); assert.ok(before - after < 0.0001);

await j(`/api/agents/${c.agent.id}`, { method: "PATCH", body: JSON.stringify({ frozen: true }) }, token);
assert.equal((await buy("sol-price")).status, 403);
await j(`/api/agents/${c.agent.id}`, { method: "PATCH", body: JSON.stringify({ frozen: false, dailyBudget: 1, perCallCap: 1 }) }, token);

const ob = await rpc.getBalance(owner.publicKey);
const w = await j(`/api/agents/${c.agent.id}/withdraw`, { method: "POST" }, token);
const oa = await rpc.getBalance(owner.publicKey);
console.log("withdraw:", w.status, w.body.sol, "SOL from pool in", w.body.signatures?.length, "tx; owner +", ((oa - ob) / 1e9).toFixed(6));
assert.equal(w.status, 200);
const wt = await rpc.getParsedTransaction(w.body.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
assert.ok(wt.transaction.message.accountKeys.filter((k) => k.signer).every((k) => pool.includes(k.pubkey.toBase58())));
const empty = await buy("sol-price");
console.log("buy with empty balance ->", empty.status, empty.body.error);
assert.equal(empty.status, 402);
console.log("ALL OK");
