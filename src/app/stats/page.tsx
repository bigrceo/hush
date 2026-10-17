import { Header, Footer } from "@/components/brand";
import { publicStats } from "@/lib/statsdaily";
import { CLUSTER } from "@/lib/config";

export const metadata = { title: "Stats · HUSH", description: "Live public usage of HUSH: paid agent calls, SOL volume, refunds, anchors and buyback, straight from the receipts database." };
export const revalidate = 60;

const tx = (s: string) => `https://solscan.io/tx/${s}${CLUSTER === "mainnet-beta" ? "" : "?cluster=devnet"}`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card no-lift p-6">
      <p className="label">{label}</p>
      <p className="title mt-2 text-4xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Bars({ data }: { data: { day: string; paid: number; refunded: number; sol: number }[] }) {
  const W = 960, H = 220, gap = 4, bw = (W - gap * (data.length - 1)) / data.length;
  const max = Math.max(1, ...data.map((d) => d.paid));
  return (
    <svg viewBox={`0 -20 ${W} ${H + 44}`} className="w-full" role="img" aria-label="Paid calls per day, last 30 days">
      {[0.5, 1].map((f) => <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="currentColor" strokeOpacity={0.08} />)}
      {data.map((d, i) => {
        const h = d.paid ? Math.max(3, (d.paid / max) * (H - 10)) : 0;
        return (
          <g key={d.day}>
            <rect x={i * (bw + gap)} y={0} width={bw} height={H} fill="transparent"><title>{`${d.day}: ${d.paid} paid, ${d.refunded} refunded, ${d.sol.toFixed(4)} SOL`}</title></rect>
            {h > 0 && <rect x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={3} fill="#9b7bff" pointerEvents="none" />}
          </g>
        );
      })}
      <text x={0} y={H + 18} fontSize={12} fill="currentColor" opacity={0.5}>{data[0]?.day}</text>
      <text x={W} y={H + 18} fontSize={12} fill="currentColor" opacity={0.5} textAnchor="end">{data.at(-1)?.day}</text>
      <text x={0} y={-6} fontSize={12} fill="currentColor" opacity={0.5}>max {max} / day</text>
    </svg>
  );
}

export default async function Page() {
  const s = await publicStats();
  const last7 = s.daily.slice(-7).reduce((a, d) => a + d.paid, 0);
  return (
    <>
      <Header />
      <main className="relative mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
        <div className="glow pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="label"><span className="label-hush">Stats</span> &nbsp;Live from the receipts database</p>
          <h1 className="title mt-4 text-5xl sm:text-7xl">Usage, <span className="hush-text">in the open.</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">Counts and volumes only. No payer, no payee, no signature: the same private-by-default view as the public receipts feed. Refreshed every minute. JSON at <a className="underline" href="/api/stats/daily">/api/stats/daily</a>.</p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Paid agent calls" value={s.totals.paidCalls.toLocaleString()} sub={`${last7} in the last 7 days`} />
            <Tile label="SOL paid to sellers" value={s.totals.sol.toFixed(4)} sub="sum of paid calls" />
            <Tile label="Refunds" value={s.totals.refunds.toLocaleString()} sub="seller failed → escrow refund" />
            <Tile label="Median latency" value={s.totals.medianLatencyMs == null ? "–" : `${s.totals.medianLatencyMs} ms`} sub="payment verified → answer" />
            <Tile label="Agents created" value={s.totals.agents.toLocaleString()} sub={`${s.totals.activeAgents7d} paid for something in 7 days`} />
            <Tile label="Shop listings" value={String(s.totals.listings)} sub={`${s.totals.sellerListings} from self-serve sellers`} />
            <Tile label="Receipt epochs anchored" value={`${s.anchors.anchored}`} sub="Merkle roots via SPL Memo" />
            <Tile label="$HUSH burned" value={s.buyback.tokensBurned.toLocaleString(undefined, { maximumFractionDigits: 2 })} sub={`${s.buyback.runs} buyback run(s) executed`} />
          </div>

          <div className="card no-lift mt-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="label">Paid calls per day · since launch (UTC)</p><p className="label">hover a day for details</p></div>
            <div className="mt-6 text-fg"><Bars data={s.daily} /></div>
          </div>

          <div className="card no-lift mt-6 p-6 sm:p-8">
            <p className="label">By listing · all time</p>
            <table className="mt-4 w-full text-sm">
              <thead><tr className="text-left text-muted"><th className="py-2 font-medium">Listing</th><th className="py-2 text-right font-medium">Paid calls</th><th className="py-2 text-right font-medium">SOL</th></tr></thead>
              <tbody>{s.perListing.map((l) => <tr key={l.listing} className="border-t border-line"><td className="py-2">{l.listing}</td><td className="py-2 text-right">{l.paid}</td><td className="py-2 text-right">{l.sol.toFixed(4)}</td></tr>)}</tbody>
            </table>
            {s.anchors.latest?.anchorSig && <p className="mt-4 text-xs text-muted">Latest anchored epoch #{s.anchors.latest.id} ({s.anchors.latest.leafCount} receipts): <a className="underline" href={tx(s.anchors.latest.anchorSig)} target="_blank" rel="noreferrer">memo tx ↗</a></p>}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
