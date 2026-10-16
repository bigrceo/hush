// Drives the dApp's real Phantom flow in Chromium with an injected test wallet (Phantom provider API backed
// by a local keypair in Node): connect -> sign-in message -> create agent -> fund (signAndSendTransaction)
// -> leash -> private buy -> withdraw. Needs a funded-by-airdrop RPC (local validator) and the dev server.
// usage: RPC_URL=http://127.0.0.1:8899 node scripts/phantom-e2e.mjs [base] [chromiumPath]
import fs from "node:fs";
import nacl from "tweetnacl";
import { chromium } from "playwright-core";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const BASE = process.argv[2] || "http://localhost:4048";
const exe = process.argv[3] || process.env.CHROMIUM_PATH;
const rpc = new Connection(process.env.RPC_URL || "http://127.0.0.1:8899", "confirmed");
const owner = Keypair.generate();
const shots = new URL("../screenshots/", import.meta.url).pathname;
fs.mkdirSync(shots, { recursive: true });

const sig0 = await rpc.requestAirdrop(owner.publicKey, 2 * LAMPORTS_PER_SOL);
await rpc.confirmTransaction(sig0, "confirmed");
const bal = async () => (await rpc.getBalance(owner.publicKey)) / LAMPORTS_PER_SOL;
console.log("owner", owner.publicKey.toBase58(), (await bal()), "SOL");

const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.on("console", (m) => m.type() === "error" && console.log("  [console]", m.text().slice(0, 200)));
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

await page.exposeFunction("__hushSign", (b64) => Buffer.from(nacl.sign.detached(Buffer.from(b64, "base64"), owner.secretKey)).toString("base64"));
await page.exposeFunction("__hushSend", async (b64) => {
  const s = await rpc.sendRawTransaction(Buffer.from(b64, "base64"));
  return s;
});
await page.addInitScript((pk) => {
  const b64 = (u8) => btoa(String.fromCharCode(...u8));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const publicKey = { toBase58: () => pk, toString: () => pk };
  const provider = {
    isPhantom: true,
    publicKey: null,
    isConnected: false,
    async connect() { this.publicKey = publicKey; this.isConnected = true; window.__hushLog = [...(window.__hushLog || []), "connect"]; return { publicKey }; },
    async disconnect() { this.publicKey = null; this.isConnected = false; },
    async signMessage(msg) { window.__hushLog.push("signMessage:" + new TextDecoder().decode(msg).split("\n")[0]); return { signature: unb64(await window.__hushSign(b64(msg))), publicKey }; },
    async signAndSendTransaction(tx) {
      const sig = unb64(await window.__hushSign(b64(tx.serializeMessage())));
      tx.addSignature(tx.feePayer, sig);
      window.__hushLog.push("signAndSendTransaction");
      return { signature: await window.__hushSend(b64(tx.serialize())), publicKey };
    },
  };
  window.phantom = { solana: provider };
  window.solana = provider;
}, owner.publicKey.toBase58());

const step = async (name, f) => { const t = Date.now(); await f(); console.log("ok ", name, `${Date.now() - t}ms`); };

await page.goto(BASE + "/app");
await step("connect + sign-in", async () => {
  await page.getByRole("button", { name: "Connect Phantom" }).first().click();
  await page.getByPlaceholder("agent name").waitFor({ timeout: 30000 });
});
await step("create agent", async () => {
  await page.getByPlaceholder("agent name").fill("agent-07");
  await page.getByRole("button", { name: "+ New" }).click();
  await page.getByText("Agent API key · shown once").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Done" }).click();
});
const before = await bal();
await step("fund 0.05 SOL via signAndSendTransaction", async () => {
  await page.getByRole("button", { name: "Fund 0.05 SOL" }).click();
  await page.getByText(/funded 0\.05 SOL/).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => /0\.05\d* SOL/.test(document.body.innerText), null, { timeout: 30000 });
});
console.log("   owner balance", before, "->", await bal());
await step("private buy: market brief (3 sellers)", async () => {
  const row = page.locator("div.flex.flex-wrap.items-center", { hasText: "Market brief (composite)" });
  await row.getByRole("button", { name: "Buy" }).click();
  await page.getByText(/PAID market-brief/).first().waitFor({ timeout: 90000 });
});
await step("private buy: sol price", async () => {
  const row = page.locator("div.flex.flex-wrap.items-center", { hasText: "SOL spot price" });
  await row.getByRole("button", { name: "Buy" }).click();
  await page.getByText(/PAID sol-price/).first().waitFor({ timeout: 90000 });
});
await page.waitForTimeout(11000); // one refresh cycle so receipts + balances show
await page.screenshot({ path: shots + "app-funded.png", fullPage: true });
await step("kill switch blocks buys", async () => {
  await page.getByRole("button", { name: "Kill switch: freeze agent" }).click();
  await page.getByText("leash updated: frozen").waitFor();
  const row = page.locator("div.flex.flex-wrap.items-center", { hasText: "SOL spot price" });
  await row.getByRole("button", { name: "Buy" }).click();
  await page.getByText(/buy failed: kill switch is on/).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Unfreeze agent" }).click();
});
const preW = await bal();
await step("withdraw to owner", async () => {
  await page.getByRole("button", { name: "Withdraw" }).click();
  await page.getByText(/withdrawn to owner/).waitFor({ timeout: 60000 });
});
console.log("   owner balance", preW, "->", await bal());
console.log("wallet calls:", await page.evaluate(() => window.__hushLog));
await browser.close();
