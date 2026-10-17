import { readSession } from "@/lib/auth";
import { isFrozenAll, setFrozenAll } from "@/lib/store";
import { raiseAlert } from "@/lib/alerts";
export async function POST(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const { on } = await req.json();
  const was = await isFrozenAll(owner);
  await setFrozenAll(owner, !!on);
  if (was !== !!on) await raiseAlert(owner, { kind: on ? "frozen" : "unfrozen", message: on ? "global kill switch on: every agent frozen" : "global kill switch off" });
  return Response.json({ frozenAll: await isFrozenAll(owner) });
}
