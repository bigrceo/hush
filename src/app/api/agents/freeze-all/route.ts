import { readSession } from "@/lib/auth";
import { isFrozenAll, setFrozenAll } from "@/lib/store";
export async function POST(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const { on } = await req.json();
  await setFrozenAll(owner, !!on);
  return Response.json({ frozenAll: await isFrozenAll(owner) });
}
