// Holder tiers + facilitator fee on a local validator with a stand-in $HUSH mint.
// usage: RPC_URL=... MINT=<mint> MINT_AUTH=<keyfile> DATABASE_URL=<test db> node scripts/tier-e2e.mjs http://localhost:4052
import nacl from "tweetnacl";
import bs58 from "bs58";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const BASE = process.argv[2] || "http://localhost:4052";
const rpc = new Connection(process.env.RPC_URL || "http://127.0.0.1:8999", "confirmed");
const sql = neon(process.env.DATABASE_URL);
const j = async (p, init = {}, tok) => { const r = await fetch(BASE + p, { ...init, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}), ...(init.headers || {}) } }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const air = async (pk, sol) => rpc.confirmTransaction(await rpc.requestAirdrop(new PublicKey(pk), sol * LAMPORTS_PER_SOL), "confirmed");

async function ownerWithAgent(hush) {
  const owner = Keypair.generate(), ts = Date.now(), pk = owner.publicKey.toBase58();
  await air(pk, 0.01);
  if (hush) execFileSync("node", ["scripts/test-mint.mjs", "mint", process.env.MINT_AUTH, process.env.MINT, pk, String(hush)], { stdio: "ignore" });
  const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(`Sign in to HUSH\nwallet: ${pk}\nts: ${ts}`), owner.secretKey));
  const { body: { token } } = await j("/api/auth", { method: "POST", body: JSON.stringify({ pubkey: pk, ts, signature: sig }) });
  const { body: c } = await j("/api/agents", { method: "POST", body: JSON.stringify({ name: "tier-" + hush }) }, token);
  await air(c.agent.pubkey, 0.1);
  const l = await j("/api/agents", {}, token);
  return { token, c, holder: l.body.holder, bal: l.body.agents[0].balance };
}

const feesBefore = Number((await sql`SELECT COALESCE(SUM(lamports),0) AS s FROM ledger WHERE agent_id='__fees__'`)[0].s);
for (const [hush, tierName, fee] of [[0, null, 10_000], [150_000, "Tier 1", 9_000], [1_500_000, "Tier 2", 7_500], [12_000_000, "Tier 4", 0]]) {
  const o = await ownerWithAgent(hush);
  assert.equal(o.holder.tier, tierName);
  const r = await j("/api/agent/buy", { method: "POST", headers: { "x-agent-key": o.c.apiKey }, body: JSON.stringify({ listing: "sol-price" }) });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.paid.facilitatorFee, fee);
  const after = (await j("/api/agents", {}, o.token)).body.agents[0].balance;
  const spent = Math.round((o.bal - after) * 1e9);
  assert.equal(spent, 1_000_000 + 5000 + fee);
  console.log(`${String(hush).padStart(10)} $HUSH -> ${tierName ?? "no tier"}, fee ${fee} lamports (${o.holder.feePct}%), ledger debit ${spent} ✓`);
}
const feesAfter = Number((await sql`SELECT COALESCE(SUM(lamports),0) AS s FROM ledger WHERE agent_id='__fees__'`)[0].s);
assert.equal(feesAfter - feesBefore, 10_000 + 9_000 + 7_500);
console.log("fee account accrued", feesAfter - feesBefore, "lamports ✓  ALL OK");
