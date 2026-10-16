import { issueSession, loginMessage, verifyWalletSig } from "@/lib/auth";
export async function POST(req: Request) {
  const { pubkey, ts, signature } = await req.json();
  if (Math.abs(Date.now() - ts) > 5 * 60_000) return Response.json({ error: "stale" }, { status: 400 });
  if (!verifyWalletSig(pubkey, loginMessage(pubkey, ts), signature)) return Response.json({ error: "bad signature" }, { status: 401 });
  return Response.json({ token: await issueSession(pubkey) });
}
