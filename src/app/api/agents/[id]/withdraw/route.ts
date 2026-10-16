import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { readSession } from "@/lib/auth";
import { getAgent } from "@/lib/store";
import { agentKeypair } from "@/lib/agents";
import { RPC_URL } from "@/lib/config";
// Sends the agent wallet's whole SOL balance back to its owner. Owner only.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await readSession(req);
  const a = await getAgent((await ctx.params).id);
  if (!owner || !a || a.owner !== owner) return Response.json({ error: "not your agent" }, { status: 403 });
  const kp = await agentKeypair(a.id);
  const conn = new Connection(RPC_URL, "confirmed");
  const bal = await conn.getBalance(kp.publicKey);
  if (bal <= 5000) return Response.json({ error: "empty" }, { status: 400 });
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(owner), lamports: bal - 5000 }));
  return Response.json({ signature: await sendAndConfirmTransaction(conn, tx, [kp]) });
}
