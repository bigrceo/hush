// Local-validator helper: creates a stand-in $HUSH mint (6 decimals) and mints to a wallet.
// usage: node scripts/test-mint.mjs create <authorityKeyfile>   -> prints mint address
//        node scripts/test-mint.mjs mint <authorityKeyfile> <mint> <owner> <uiAmount>
import fs from "node:fs";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
const rpc = new Connection(process.env.RPC_URL || "http://127.0.0.1:8999", "confirmed");
const [cmd, keyfile, mint, owner, amount] = process.argv.slice(2);
let auth;
if (fs.existsSync(keyfile)) auth = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keyfile, "utf8"))));
else { auth = Keypair.generate(); fs.writeFileSync(keyfile, JSON.stringify([...auth.secretKey])); }
if ((await rpc.getBalance(auth.publicKey)) < LAMPORTS_PER_SOL) await rpc.confirmTransaction(await rpc.requestAirdrop(auth.publicKey, 2 * LAMPORTS_PER_SOL), "confirmed");
if (cmd === "create") console.log((await createMint(rpc, auth, auth.publicKey, null, 6)).toBase58());
else {
  const ata = await getOrCreateAssociatedTokenAccount(rpc, auth, new PublicKey(mint), new PublicKey(owner));
  await mintTo(rpc, auth, new PublicKey(mint), ata.address, auth, BigInt(Math.round(Number(amount) * 1e6)));
  console.log("minted", amount, "to", owner.slice(0, 6));
}
