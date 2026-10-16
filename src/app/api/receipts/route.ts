import { readSession } from "@/lib/auth";
import { ownerReceipts, publicReceipts } from "@/lib/store";
export const dynamic = "force-dynamic";
// Public: commitments only. Owner session: full receipts of your own agents.
export async function GET(req: Request) {
  const owner = await readSession(req);
  if (owner) return Response.json({ receipts: await ownerReceipts(owner) });
  return Response.json({ receipts: await publicReceipts() });
}
