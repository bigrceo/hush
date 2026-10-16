// End-to-end for verifiable receipts against a local validator + test DB:
// buys -> seal epoch -> anchor pending (unfunded publisher) -> fund -> anchor -> owner proof -> /verify in a browser.
// usage: RPC_URL=http://127.0.0.1:8999 CRON_SECRET=... node scripts/verify-e2e.mjs http://localhost:4049 <chromiumPath>
import fs from "node:fs";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { chromium } from "playwright-core";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const [BASE = "http://localhost:4049", exe] = process.argv.slice(2);
const rpc = new Connection(process.env.RPC_URL || "http://127.0.0.1:8999", "confirmed");
const CRON = process.env.CRON_SECRET;
const out = new URL("../screenshots/", import.meta.url).pathname;
const j = async (p, init = {}, tok) => { const r = await fetch(BASE + p, { ...init, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}), ...(init.headers || {}) } }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const air = async (pk, sol) => { const s = await rpc.requestAirdrop(new PublicKey(pk), sol * LAMPORTS_PER_SOL); await rpc.confirmTransaction(s, "confirmed"); };

const owner = Keypair.generate(), ts = Date.now();
const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(`Sign in to HUSH\nwallet: ${owner.publicKey.toBase58()}\nts: ${ts}`), owner.secretKey));
const { body: { token } } = await j("/api/auth", { method: "POST", body: JSON.stringify({ pubkey: owner.publicKey.toBase58(), ts, signature: sig }) });
const { body: c } = await j("/api/agents", { method: "POST", body: JSON.stringify({ name: "verify-e2e" }) }, token);
await air(c.agent.pubkey, 1);
for (const l of ["sol-price", "market-brief", "network-pulse"]) {
  const r = await j("/api/agent/buy", { method: "POST", headers: { "x-agent-key": c.apiKey }, body: JSON.stringify({ listing: l }) });
  console.log("buy", l, r.status, r.body.ok);
}
const cron = () => j("/api/cron/epoch", { method: "POST", headers: { authorization: "Bearer " + CRON } });
console.log("cron without secret ->", (await j("/api/cron/epoch", { method: "POST" })).status);
const pub = (await j("/api/publisher")).body.publisher;
const c1 = await cron();
console.log("seal+anchor (publisher unfunded):", JSON.stringify(c1.body).slice(0, 300));
const { body: rec } = await j("/api/receipts", {}, token);
const mine = rec.receipts[0];
const pending = await fetch(`${BASE}/api/receipts/${mine.nonce}/proof`, { headers: { authorization: "Bearer " + token } });
console.log("proof status while pending anchor:", pending.status);
await air(pub, 0.05);
const c2 = await cron();
console.log("anchor after funding:", JSON.stringify(c2.body.anchored));
const proof = await (await fetch(`${BASE}/api/receipts/${mine.nonce}/proof`, { headers: { authorization: "Bearer " + token } })).json();
console.log("proof epoch", proof.epoch, "leaves", proof.leafCount, "path", proof.path.length, "anchor", proof.anchor.signature?.slice(0, 12));
console.log("foreign owner proof ->", (await fetch(`${BASE}/api/receipts/${mine.nonce}/proof`, { headers: { authorization: "Bearer x.y" } })).status);
fs.writeFileSync(out + "proof-sample.json", JSON.stringify(proof, null, 2));
const epochs = (await j("/api/epochs")).body.epochs;
console.log("public epochs:", epochs.map((e) => `${e.id}:${e.anchorStatus}`).join(" "));
const stats = (await j("/api/stats")).body;
console.log("score epochs:", stats.scores.map((s) => `${s.seller}=${s.epochs.length}`).join(" "));

const b = await chromium.launch({ executablePath: exe });
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
await p.goto(BASE + "/verify", { waitUntil: "networkidle" });
await p.locator("textarea").fill(JSON.stringify(proof, null, 2));
await p.getByRole("button", { name: "Verify" }).click();
await p.getByText("✓ Included").waitFor({ timeout: 30000 });
await p.waitForTimeout(800);
await p.screenshot({ path: out + "verify-ok.png", fullPage: true });
console.log("browser: verified ✓");
const bad = { ...proof, path: proof.path.map((s, i) => (i === 0 ? { ...s, side: s.side === "L" ? "R" : "L" } : s)) };
await p.locator("textarea").fill(JSON.stringify(bad));
await p.getByRole("button", { name: "Verify" }).click();
await p.getByText("✗ Not verified").waitFor({ timeout: 30000 });
await p.screenshot({ path: out + "verify-tampered.png", fullPage: true });
console.log("browser: tampered proof rejected ✗");
await b.close();
