import { listEpochs, publisherAddress } from "@/lib/epochs";
import { CLUSTER } from "@/lib/config";
export const dynamic = "force-dynamic";
// Public: roots only. No receipts, no leaves.
export async function GET() {
  return Response.json({ cluster: CLUSTER, publisher: await publisherAddress(), epochs: await listEpochs(50) });
}
