import { publisherAddress } from "@/lib/epochs";
import { CLUSTER } from "@/lib/config";
export async function GET() {
  return Response.json({ cluster: CLUSTER, publisher: await publisherAddress() });
}
