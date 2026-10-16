// End-to-end check on devnet: owner signs in, creates an agent, funds it, tests the leash, buys privately.
// usage: node scripts/e2e.mjs [base] [funder-keypair.json]   (without a funder, uses the devnet faucet)
import fs from "node:fs";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const BASE = process.argv[2] || "http://localhost:4048";
const rpc = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com", "confirmed");
const owner = Keypair.generate();
const j = async (p, init = {}, tok) => {
  const r = await fetch(BASE + p, { ...init, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}), ...(init.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const ts = Date.now();
const msg = `Sign in to HUSH\nwallet: ${owner.publicKey.toBase58()}\nts: ${ts}`;
const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), owner.secretKey));
const { body: { token } } = await j("/api/auth", { method: "POST", body: JSON.stringify({ pubkey: owner.publicKey.toBase58(), ts, signature: sig }) });
console.log("session", !!token);
const { body: created } = await j("/api/agents", { method: "POST", body: JSON.stringify({ name: "e2e-agent" }) }, token);
const agent = created.agent, key = created.apiKey;
console.log("agent", agent.name, agent.pubkey);

const funderPath = process.argv[3];
if (funderPath) {
  const f = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(funderPath, "utf8"))));
  await sendAndConfirmTransaction(rpc, new Transaction().add(SystemProgram.transfer({ fromPubkey: f.publicKey, toPubkey: new PublicKey(agent.pubkey), lamports: 20_000_000 })), [f]);
} else {
  const s = await rpc.requestAirdrop(new PublicKey(agent.pubkey), 0.1e9);
  await rpc.confirmTransaction(s, "confirmed");
}
console.log("funded", (await rpc.getBalance(new PublicKey(agent.pubkey))) / 1e9, "SOL");

const buy = (listing, input) => j("/api/agent/buy", { method: "POST", headers: { "x-agent-key": key }, body: JSON.stringify({ listing, input }) });
console.log("not allowlisted ->", (await buy("wallet-scan", agent.pubkey)).body.error);
let r = await buy("sol-price"); console.log("sol-price", r.status, r.body.error, r.body.paid?.signature?.slice(0, 12), JSON.stringify(r.body.result));
r = await buy("market-brief"); console.log("market-brief", r.status, r.body.error, "legs", r.body.paid?.legs, r.body.result?.data?.brief);
await j(`/api/agents/${agent.id}`, { method: "PATCH", body: JSON.stringify({ allowlist: ["sol-price", "market-brief", "wallet-scan"] }) }, token);
r = await buy("wallet-scan", "not-an-address"); console.log("seller fails ->", r.status, r.body.result?.error, "refund", r.body.result?.refundSignature?.slice(0, 12));
await j(`/api/agents/${agent.id}`, { method: "PATCH", body: JSON.stringify({ perCallCap: 0.0005 }) }, token);
console.log("over cap ->", (await buy("sol-price")).body.error);
await j(`/api/agents/${agent.id}`, { method: "PATCH", body: JSON.stringify({ perCallCap: 0.005, frozen: true }) }, token);
console.log("frozen ->", (await buy("sol-price")).body.error);
const replay = await fetch(BASE + "/api/shop/sol-price", { headers: { "x-payment": "e30" } });
console.log("bad payment header ->", replay.status);
console.log("stats", JSON.stringify((await j("/api/stats")).body.gdp));
console.log("owner receipts", (await j("/api/receipts", {}, token)).body.receipts.length);
