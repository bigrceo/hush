import { walletLeaks } from "@/lib/walletleak";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
// Public: GET /api/privacy/wallet?address=<pubkey> — what a wallet's recent history tells a stranger.
export async function GET(req: Request) {
  try {
    return Response.json(await walletLeaks(new URL(req.url).searchParams.get("address")?.trim() || ""), { headers: { "cache-control": "public, s-maxage=120" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
