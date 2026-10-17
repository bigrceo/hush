import { readSession } from "@/lib/auth";
import { BLOCKED } from "@/lib/sellers";
import { SELLER_LIMITS, checkHttpsUrl } from "@/lib/sellerrules";
export const dynamic = "force-dynamic";
// Dry run of a seller endpoint exactly as the paid proxy would call it: { url, input?, value? }.
export async function POST(req: Request) {
  if (!(await readSession(req))) return Response.json({ error: "sign in" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const bad = checkHttpsUrl(String(b.url ?? ""), BLOCKED);
  if (bad) return Response.json({ ok: false, error: bad }, { status: 400 });
  const u = new URL(String(b.url));
  if (b.input && b.value) u.searchParams.set(String(b.input).slice(0, 24), String(b.value).slice(0, 200));
  const ctrl = new AbortController(), t0 = Date.now();
  const timer = setTimeout(() => ctrl.abort(), SELLER_LIMITS.timeoutMs);
  try {
    const r = await fetch(u, { signal: ctrl.signal, redirect: "error", headers: { "user-agent": "HUSH-proxy/1 (+https://hushagents.com)", accept: "application/json, text/plain" } });
    const buf = await r.arrayBuffer(), ms = Date.now() - t0, text = new TextDecoder().decode(buf.slice(0, 2000));
    let json = true; try { JSON.parse(new TextDecoder().decode(buf)); } catch { json = false; }
    const problems = [!r.ok && `answered HTTP ${r.status}: buyers would be refunded`, buf.byteLength > SELLER_LIMITS.maxBytes && "response over 256 KB: buyers would be refunded", !json && "response is not JSON: it will be wrapped as { text }", ms > 5000 && "slow: over 5 s"].filter(Boolean);
    return Response.json({ ok: r.ok && buf.byteLength <= SELLER_LIMITS.maxBytes, status: r.status, ms, bytes: buf.byteLength, json, preview: text.slice(0, 600), problems, calledUrl: u.toString() });
  } catch (e) {
    const msg = (e as Error).name === "AbortError" ? "no answer within 10 s: buyers would be refunded" : (e as Error).message.includes("redirect") ? "redirects are not followed: use the final url" : "could not reach the endpoint";
    return Response.json({ ok: false, ms: Date.now() - t0, problems: [msg] });
  } finally { clearTimeout(timer); }
}
