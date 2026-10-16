// Standalone x402 buyer: hits a Hush-Gated endpoint, pays the 402 from a local keypair, prints the answer.
// usage: node examples/agent-buy.mjs <url> <path-to-keypair.json>   (devnet)
import fs from "node:fs";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const [url = "http://localhost:4048/api/shop/sol-price", kpPath] = process.argv.slice(2);
const rpc = process.env.RPC_URL || "https://api.devnet.solana.com";
const kp = kpPath ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, "utf8")))) : Keypair.generate();

const first = await fetch(url);
console.log("status", first.status);
if (first.status !== 402) process.exit(console.log(await first.text()));
const req = (await first.json()).accepts[0];
console.log("pay", req.maxAmountRequired, req.currency, "to", req.extra.legs.length, "one-time payee(s)");
if (req.currency !== "SOL") throw new Error("this example pays SOL only");
const tx = new Transaction();
for (const l of req.extra.legs) tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(l.payTo), lamports: BigInt(l.amount) }));
const signature = await sendAndConfirmTransaction(new Connection(rpc, "confirmed"), tx, [kp]);
const header = Buffer.from(JSON.stringify({ quote: req.extra.quote, signature })).toString("base64url");
const res = await fetch(url, { headers: { "x-payment": header } });
console.log(res.status, await res.text());
