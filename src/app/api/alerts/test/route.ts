import { readSession } from "@/lib/auth";
import { raiseAlert } from "@/lib/alerts";
// Sends a test alert to the owner's webhook.
export async function POST(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  return Response.json(await raiseAlert(owner, { kind: "test", message: "test alert: your leash alerts reach this channel" }));
}
