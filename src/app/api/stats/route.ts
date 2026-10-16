import { agentGdp, countAgents, hushScores } from "@/lib/store";
import { sellerEpochs } from "@/lib/epochs";
import { CLUSTER } from "@/lib/config";
export const dynamic = "force-dynamic";
export async function GET() {
  const [scores, roots] = await Promise.all([hushScores(), sellerEpochs()]);
  return Response.json({
    cluster: CLUSTER,
    gdp: await agentGdp(),
    scores: scores.map((s) => ({ ...s, epochs: roots.get(s.seller) ?? [] })),
    scoreNote: "Each score is computed from paid receipts whose commitments are leaves of the listed epoch roots, anchored on Solana. Anyone holding those receipts can recompute it and prove inclusion.",
    agents: await countAgents(),
  });
}
