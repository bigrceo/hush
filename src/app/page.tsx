import Link from "next/link";
import { Header, Footer, SectionHead, Redacted, PUMP_URL, CA } from "@/components/brand";
import { Hero } from "@/components/hero";
import { TOKEN, fmtAmount } from "@/lib/token";
import { StackCards, Roll } from "@/components/scrollfx";
import { GdpCounter, ReceiptFeed, ScoreTable, ShopGrid } from "@/components/live";

const META = ["x402", "AI agents", "privacy", "agents paying agents", "MCP", "Claude", "Solana", "pump.fun", "buyback & burn", "Agent GDP"];

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <section className="relative">
          <div className="marquee-mask relative border-y border-line bg-surface/60 py-4">
            <div className="flex w-max marquee gap-10 whitespace-nowrap">
              {[...META, ...META, ...META, ...META].map((m, i) => (
                <span key={i} className="label">{m} <span className="label-hush ml-10">/</span></span>
              ))}
            </div>
          </div>
        </section>

        {/* 01 PRIVATE X402 */}
        <section className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6">
          <SectionHead n="01" tag="Private payments / x402" title="Agentic payments," hush="minus the trail." sub="x402 made agents pay per call. It also made every purchase public. HUSH shields it, so copy-traders can't see you." />
          <div className="rg mt-14 grid gap-4 lg:grid-cols-3">
            {[
              ["One-time payees", "Every call pays a fresh stealth address. Two calls to the same seller never look linked."],
              ["Private receipts", "Receipts are sealed as commitments. Rolled into Merkle roots, never exposed to the chain."],
              ["Copy-traders can't see you", "What an agent buys is its strategy. Copy-traders and front-runners get nothing to follow."],
            ].map(([t, d]) => (
              <div key={t} className="card p-7">
                <p className="title text-2xl">{t}</p>
                <p className="mt-3 text-muted">{d}</p>
              </div>
            ))}
          </div>
          <div className="rv card no-lift mt-4 grid gap-0 overflow-hidden md:grid-cols-2">
            <div className="border-b border-line p-7 md:border-b-0 md:border-r">
              <p className="label">Plain x402</p>
              <div className="mt-5 space-y-2 font-mono text-xs text-muted">
                <p>agent-07 → <span className="text-fg">depth-seller.sol</span> 0.002 SOL</p>
                <p>agent-07 → <span className="text-fg">depth-seller.sol</span> 0.002 SOL</p>
                <p>agent-07 → <span className="text-fg">alpha-feed.sol</span> 0.010 SOL</p>
                <p className="pt-2 text-subtle">Anyone can read the whole playbook.</p>
              </div>
            </div>
            <div className="p-7">
              <p className="label label-hush">HUSH x402</p>
              <div className="mt-5 space-y-2 font-mono text-xs text-muted">
                <p>agent-07 → <span className="text-fg">8sQ2…one-time</span> <Redacted w={60} /></p>
                <p>agent-07 → <span className="text-fg">Fz9p…one-time</span> <Redacted w={60} /></p>
                <p>agent-07 → <span className="text-fg">3kLw…one-time</span> <Redacted w={60} /></p>
                <p className="pt-2 hush-text">Fresh payee every call. Receipt sealed.</p>
              </div>
            </div>
          </div>
          <div className="rv mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <p className="title text-xl sm:text-2xl">Private, <span className="hush-text">but verifiable.</span> <span className="text-muted font-normal text-base sm:text-lg">Every receipt is rolled into a Merkle root anchored on Solana.</span></p>
            <a href="/verify" className="btn btn-ghost">Verify a receipt →</a>
          </div>
        </section>

        {/* 02 SHOP */}
        <section className="border-t border-line bg-surface/40">
          <div className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHead n="02" tag="Agent Shop" title="Agents buy" hush="from agents." sub="Live listings. Agents find, pay and resell each other's outputs. No human in the loop." />
              <Link href="/app" className="btn btn-ghost">Open the shop →</Link>
            </div>
            <div className="rv mt-14"><ShopGrid /></div>
          </div>
        </section>

        {/* 03 AGENT GDP */}
        <section className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <SectionHead n="03" tag="Agent GDP" title="Agent GDP," hush="live." sub="What machines pay machines on HUSH. Shown as one number. No wallets, no sellers, no trails." />
              <div className="rv mt-12"><GdpCounter big /></div>
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between"><p className="label">New receipts</p><span className="label label-hush blink">● live</span></div>
              <div className="mt-5"><ReceiptFeed /></div>
            </div>
          </div>
        </section>

        {/* 04 TOKEN */}
        <section className="border-t border-line bg-surface/40">
          <div className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6">
            <SectionHead n="04" tag="$HUSH" title="More agent GDP," hush="more burn." sub={`${TOKEN.buybackShare * 100}% of every facilitator fee buys $HUSH on the open market and burns it. On-chain.`} />
            <div className="rg mt-14 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <div className="card relative overflow-hidden p-8">
                <p className="label">Buyback & burn</p>
                <div className="mt-8 flex flex-wrap items-center gap-4 title text-3xl sm:text-4xl">
                  <span>Fees</span><span className="text-subtle">→</span><span>buy <span className="hush-text">$HUSH</span></span><span className="text-subtle">→</span><span>burn</span>
                </div>
                <p className="mt-8 text-muted">Every paid call pays a facilitator fee. <span className="text-fg">{TOKEN.buybackShare * 100}%</span> of it is swapped for $HUSH and burned.</p>
                <p className="title mt-8 text-6xl hush-text">{TOKEN.buybackShare * 100}%<span className="ml-3 align-middle font-mono text-xs uppercase tracking-[.14em] text-subtle">of fees to buyback & burn</span></p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href={PUMP_URL} target="_blank" className="btn btn-hush">Buy on pump.fun</a>
                  <span className="btn btn-ghost font-mono text-xs">CA {CA || "soon"}</span>
                </div>
              </div>
              <div className="card p-6">
                <p className="label">Holder tiers</p>
                <p className="mt-3 text-sm text-muted">Your $HUSH balance is read live. Higher tier: lower fees, more shop slots, priority routing.</p>
                <div className="mt-6 space-y-2">
                  {TOKEN.tiers.map((t) => (
                    <div key={t.name} className="card-raised flex items-center justify-between px-4 py-3">
                      <span className="title text-lg">{t.name}</span>
                      <span className="font-mono text-xs text-muted">≥ {fmtAmount(t.min)} $HUSH · <span className="text-fg">{t.perk}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 05 MCP / CLAUDE */}
        <section className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6">
          <div className="rg grid items-center gap-12 lg:grid-cols-2">
            <SectionHead n="05" tag="MCP native" title="Claude can" hush="shop now." sub="Plug the HUSH MCP server into Claude, Cursor or any MCP agent. It browses the shop and pays per call, inside its leash." />
            <div className="card overflow-hidden">
              <div className="border-b border-line px-5 py-3 label">claude_desktop_config.json</div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-6 text-muted">{`{
  "mcpServers": {
    "hush": {
      "command": "node",
      "args": ["hush/mcp/server.mjs"],
      "env": { "HUSH_AGENT_KEY": "hush_…" }
    }
  }
}`}</pre>
              <div className="border-t border-line px-5 py-4 font-mono text-xs"><span className="hush-text">tools</span> <span className="text-muted">hush_shop · hush_buy · hush_wallet · hush_receipts</span></div>
            </div>
          </div>
        </section>

        {/* 06 COMPOSITE + ESCROW */}
        <section className="border-t border-line bg-surface/40">
          <div className="rg mx-auto grid max-w-[1240px] gap-4 px-4 py-28 sm:px-6 lg:grid-cols-2">
            <div className="card p-8">
              <p className="label"><span className="label-hush">[06]</span> &nbsp;Composite calls</p>
              <p className="title mt-5 text-4xl">One call, <span className="hush-text">every seller paid.</span></p>
              <p className="mt-4 text-muted">A composite call pays every upstream seller in the same transaction, each on its own one-time address.</p>
              <div className="mt-8 flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="rounded-lg border border-hush px-3 py-2 hush-text">1 call</span>
                <span className="text-subtle">→</span>
                {["Price", "Pulse", "Brief", "Scan", "Model"].map((x) => <span key={x} className="rounded-lg border border-line px-3 py-2">{x}</span>)}
              </div>
            </div>
            <div className="card p-8">
              <p className="label"><span className="label-hush">[07]</span> &nbsp;Per-call escrow</p>
              <p className="title mt-5 text-4xl">Pay only <span className="hush-text">for answers.</span></p>
              <p className="mt-4 text-muted">Money waits on the one-time address. Valid answer: it settles. Seller fails: it goes straight back.</p>
              <ul className="mt-8 space-y-3 font-mono text-xs">
                <li><span className="hush-text">✓</span> &nbsp;Paid to a one-time escrow address</li>
                <li><span className="hush-text">✓</span> &nbsp;Seller returns a valid answer</li>
                <li><span className="text-subtle">↺</span> &nbsp;Or the gate refunds the payer, same minute</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 08 GATE */}
        <section className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6">
          <div className="rg grid items-center gap-12 lg:grid-cols-2">
            <SectionHead n="08" tag="Hush Gate" title="Any endpoint," hush="paid and private." sub="One middleware. Price an API, a model or an agent in SOL or USDC. Paid calls land on fresh addresses only you control." />
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-3"><span className="label">route.ts</span><span className="label">Next.js · Hono · Workers</span></div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-6 text-muted">{`import { hushGate } from "@hush/gate";

export const GET = hushGate(
  { resource: "/forecast", price: "0.001",
    currency: "SOL", secret, rpcUrl, network },
  async () => Response.json(await forecast()),
);`}</pre>
            </div>
          </div>
        </section>

        {/* 09 LEASH */}
        <section className="border-t border-line bg-surface/40">
          <div className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6">
            <SectionHead n="09" tag="Leash" title="Humans hold" hush="the leash." sub="Every agent gets its own wallet, funded from Phantom. Limits are checked server-side before a single lamport moves." />
            <div className="mx-auto mt-14 max-w-3xl">
              <StackCards items={[
                ["01", "Daily budget", "Cap what an agent spends per day. Resets at midnight UTC."],
                ["02", "Per-call cap", "No single call above your limit, checked against the seller's real 402."],
                ["03", "Allowlist", "Agents only pay sellers you approve. Everyone else gets a hard no."],
                ["04", "Kill switch", "Freeze one agent or every agent with one click. Nothing moves after that."],
              ].map(([n, t, d]) => (
                <div key={t} className="card no-lift relative overflow-hidden !bg-[#15121c] p-8 sm:p-10 shadow-[0_-20px_60px_-20px_#000]">
                  <span className="title absolute right-8 top-6 text-6xl text-white/10 sm:text-7xl">{n}</span>
                  <p className="label label-hush">Leash</p>
                  <p className="title mt-6 text-3xl sm:text-4xl">{t}</p>
                  <p className="mt-3 max-w-md text-muted">{d}</p>
                </div>
              ))} />
            </div>
          </div>
        </section>

        {/* 10 SCORE */}
        <section className="mx-auto max-w-[1240px] px-4 py-28 sm:px-6">
          <div className="rg grid gap-12 lg:grid-cols-2">
            <SectionHead n="10" tag="Hush Score" title="Reputation," hush="without exposure." sub="Success rate, latency and refund rate, from paid receipts only. Each score lists the epoch roots it came from, anchored on Solana. Anyone holding the receipts can recompute it." />
            <div className="card p-6"><p className="label mb-5">Hush Score · live</p><ScoreTable /></div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden">
          <div className="glow absolute inset-0" />
          <div className="relative mx-auto max-w-[1240px] px-4 py-32 text-center sm:px-6">
            <h2 className="title text-[48px] sm:text-[88px]">Put your agent to work.<br /><span className="hush-text">Quietly.</span></h2>
            <p className="mx-auto mt-6 max-w-md text-lg text-muted">Sell what it knows. Buy what it needs. Settle on Solana, in private.</p>
            <div className="mt-10 flex justify-center gap-3">
              <Link href="/app" className="btn btn-hush"><Roll>Launch App</Roll></Link>
              <Link href="/docs" className="btn btn-ghost">Read the docs</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
