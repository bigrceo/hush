// Drives the app with an injected Wallet Standard wallet (registered like Solflare/Backpack do), plus a
// legacy-provider wallet, through connect -> sign-in -> create agent -> fund -> buy -> withdraw.
// usage: RPC_URL=http://127.0.0.1:8999 node scripts/wallet-e2e.mjs http://localhost:4052 <chromiumPath>
import fs from "node:fs";
import nacl from "tweetnacl";
import { chromium } from "playwright-core";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const [BASE = "http://localhost:4052", exe] = process.argv.slice(2);
const rpc = new Connection(process.env.RPC_URL || "http://127.0.0.1:8999", "confirmed");
const shots = new URL("../screenshots/", import.meta.url).pathname;
fs.mkdirSync(shots, { recursive: true });

async function run(kind) {
  const owner = Keypair.generate();
  await rpc.confirmTransaction(await rpc.requestAirdrop(owner.publicKey, 2 * LAMPORTS_PER_SOL), "confirmed");
  const bal = async () => (await rpc.getBalance(owner.publicKey)) / LAMPORTS_PER_SOL;
  const b = await chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  p.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  await p.exposeFunction("__sign", (b64) => Buffer.from(nacl.sign.detached(Buffer.from(b64, "base64"), owner.secretKey)).toString("base64"));
  await p.exposeFunction("__send", async (b64) => rpc.sendRawTransaction(Buffer.from(b64, "base64")));
  await p.exposeFunction("__signTxBytes", async (b64) => {
    // Sign a serialized legacy transaction: message starts after the signature section (1 sig).
    const raw = Buffer.from(b64, "base64");
    const n = raw[0];
    const msg = raw.subarray(1 + 64 * n);
    const sig = nacl.sign.detached(msg, owner.secretKey);
    sig.forEach((x, i) => (raw[1 + i] = x));
    return raw.toString("base64");
  });
  await p.addInitScript(({ pk, kind }) => {
    const b64 = (u8) => btoa(String.fromCharCode(...u8));
    const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const fromB58 = (s) => { let n = 0n; for (const c of s) n = n * 58n + BigInt(A.indexOf(c)); const out = []; while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; } for (const c of s) { if (c === "1") out.unshift(0); else break; } return Uint8Array.from(out); };
    window.__log = [];
    if (kind === "standard") {
      const account = { address: pk, publicKey: fromB58(pk), chains: ["solana:devnet", "solana:mainnet"], features: ["solana:signMessage", "solana:signAndSendTransaction"] };
      const wallet = {
        version: "1.0.0", name: "Backpack", icon: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#e33e3f"/></svg>'),
        chains: ["solana:devnet", "solana:mainnet"], accounts: [account],
        features: {
          "standard:connect": { version: "1.0.0", connect: async () => { window.__log.push("connect"); return { accounts: [account] }; } },
          "standard:events": { version: "1.0.0", on: () => () => {} },
          "solana:signMessage": { version: "1.0.0", signMessage: async ({ message }) => { window.__log.push("signMessage"); return [{ signedMessage: message, signature: unb64(await window.__sign(b64(message))) }]; } },
          "solana:signAndSendTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy", 0], signAndSendTransaction: async ({ transaction, chain }) => {
            window.__log.push("signAndSendTransaction:" + chain);
            const signed = unb64(await window.__signTxBytes(b64(transaction)));
            const sig58 = await window.__send(b64(signed));
            return [{ signature: fromB58(sig58) }];
          } },
        },
      };
      const register = ({ register }) => register(wallet);
      window.addEventListener("wallet-standard:app-ready", (e) => register(e.detail));
      window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
    } else {
      const publicKey = { toBase58: () => pk };
      window.solflare = {
        isSolflare: true, publicKey: null,
        async connect() { this.publicKey = publicKey; window.__log.push("connect"); },
        async signMessage(m) { window.__log.push("signMessage"); return { signature: unb64(await window.__sign(b64(m))) }; },
        async signTransaction(tx) { window.__log.push("signTransaction"); tx.addSignature(tx.feePayer, unb64(await window.__sign(b64(tx.serializeMessage())))); return tx; },
      };
    }
  }, { pk: owner.publicKey.toBase58(), kind });

  const walletName = kind === "standard" ? "Backpack" : "Solflare";
  await p.goto(BASE + "/app");
  await p.getByRole("button", { name: "Connect wallet" }).first().click();
  await p.getByRole("dialog").getByRole("button", { name: new RegExp(walletName) }).waitFor({ timeout: 15000 });
  if (kind === "standard") await p.screenshot({ path: shots + "wallet-picker.png" });
  await p.getByRole("dialog").getByRole("button", { name: new RegExp(walletName) }).click();
  await p.getByPlaceholder("agent name").waitFor({ timeout: 30000 });
  await p.getByPlaceholder("agent name").fill(kind + "-agent");
  await p.getByRole("button", { name: "+ New" }).click();
  await p.getByText("Agent API key · shown once").waitFor({ timeout: 30000 });
  await p.getByRole("button", { name: "Done" }).click();
  const b0 = await bal();
  await p.getByRole("button", { name: "Fund 0.05 SOL" }).click();
  await p.getByText(/funded 0\.05 SOL/).waitFor({ timeout: 60000 });
  await p.waitForFunction(() => /0\.04\d+ SOL|0\.05\d* SOL/.test(document.body.innerText), null, { timeout: 30000 });
  const row = p.locator("div.flex.flex-wrap.items-center", { hasText: "SOL spot price" });
  await row.getByRole("button", { name: "Buy" }).click();
  await p.getByText(/PAID sol-price/).first().waitFor({ timeout: 90000 });
  const b1 = await bal();
  await p.getByRole("button", { name: "Withdraw" }).click();
  await p.getByText(/withdrawn to owner/).waitFor({ timeout: 60000 });
  const b2 = await bal();
  console.log(`${walletName} (${kind}): funded ${(b0 - b1).toFixed(6)} SOL out, withdrew +${(b2 - b1).toFixed(6)} SOL; wallet calls:`, (await p.evaluate(() => window.__log)).join(", "));
  await b.close();
}
await run("standard");
await run("legacy");
console.log("ALL OK");
