import { readSession } from "@/lib/auth";
import { d1 } from "@/lib/store";
import { toCsv } from "@/lib/csv";
import { CLUSTER } from "@/lib/config";
export const dynamic = "force-dynamic";
// Owner only. ?role=buyer (default): every receipt of your agents. ?role=seller: every paid call to your self-serve listings.
// ?from=YYYY-MM-DD&to=YYYY-MM-DD (UTC, inclusive), ?format=csv (default) | json.
export async function GET(req: Request) {
  const owner = await readSession(req);
  if (!owner) return Response.json({ error: "sign in" }, { status: 401 });
  const u = new URL(req.url);
  const role = u.searchParams.get("role") === "seller" ? "seller" : "buyer";
  const day = (s: string | null, end: boolean) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + "T00:00:00Z") + (end ? 86_400_000 : 0) : null);
  const from = day(u.searchParams.get("from"), false) ?? 0;
  const to = day(u.searchParams.get("to"), true) ?? Date.now() + 60_000;
  const db = await d1();
  type Row = { at: string; nonce: string; listing: string; currency: string; total: string; ok: number; signature: string; refund_signature: string | null; latency_ms: number; epoch_id: number | null; commitment: string; who: string | null; swept_sig?: string | null };
  const { results } = role === "buyer"
    ? await db.prepare("SELECT r.at, r.nonce, r.listing, r.currency, r.total, r.ok, r.signature, r.refund_signature, r.latency_ms, r.epoch_id, r.commitment, a.name AS who FROM receipts r JOIN agents a ON a.id = r.agent_id WHERE a.owner = ? AND r.at >= ? AND r.at < ? ORDER BY r.at DESC LIMIT 10000").bind(owner, from, to).all<Row>()
    : await db.prepare("SELECT r.at, r.nonce, r.listing, r.currency, r.total, r.ok, r.signature, r.refund_signature, r.latency_ms, r.epoch_id, r.commitment, s.name AS who, r.swept_sig FROM receipts r JOIN sellers s ON r.listing = 's-' || s.id WHERE s.owner = ? AND r.at >= ? AND r.at < ? ORDER BY r.at DESC LIMIT 10000").bind(owner, from, to).all<Row>();
  const q = CLUSTER === "mainnet-beta" ? "" : "?cluster=devnet";
  const tx = (s: string | null | undefined) => (s ? `https://solscan.io/tx/${s}${q}` : "");
  const rows = results.map((r) => ({
    time_utc: new Date(Number(r.at)).toISOString(),
    [role === "buyer" ? "agent" : "listing_name"]: r.who ?? "",
    listing: r.listing,
    status: r.ok ? "paid" : "refunded",
    amount: r.total,
    currency: r.currency,
    payment_tx: tx(r.signature),
    refund_tx: tx(r.refund_signature),
    ...(role === "seller" ? { sweep_tx: tx(r.swept_sig) } : {}),
    latency_ms: r.latency_ms,
    epoch: r.epoch_id ?? "",
    commitment: r.commitment,
    receipt_id: r.nonce,
  }));
  if (u.searchParams.get("format") === "json") return Response.json({ role, count: rows.length, rows });
  const header = rows[0] ? Object.keys(rows[0]) : ["time_utc", role === "buyer" ? "agent" : "listing_name", "listing", "status", "amount", "currency", "payment_tx", "refund_tx", "latency_ms", "epoch", "commitment", "receipt_id"];
  const name = `hush-${role}-receipts-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(toCsv(header, rows.map((r) => header.map((h) => (r as Record<string, unknown>)[h]))), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
}
