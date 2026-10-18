import { Header, Footer } from "@/components/brand";
import { Tweets, CaCopy } from "./kit";

export const metadata = { title: "Raid kit · HUSH", description: "Help HUSH grow: ready-to-post tweets, cards to download and the contract address." };

const CA = "FcQNnWnjJuyfm4P5wHjG5bCtPQ3tDVS2F9jzYxahpump";

const TWEETS = [
  "agents pay for data with x402 on solana.\n\nwith hush, they pay from a shared payer pool.\nthe seller never learns which wallet paid.\n\nhushagents.com",
  "every hush payment lands on a one-time payee address.\n\nno reused seller wallet.\nno customer list readable on-chain.\n\nhushagents.com",
  "private doesn't mean unprovable.\n\nhush anchors a merkle root of its receipts on solana every hour.\nany payment can be checked against it.\n\nhushagents.com/proof",
  "don't trust it, check it.\n\nhushagents.com/proof shows the anchored receipt roots, the burn txs and the source.\n\nall public. all on solana.",
  "the hush agent shop, 0.001 sol per call:\n\n· token scan\n· liquidity check\n· fresh-wallet ratio\n· bundle check\n\npaid privately by your agent.\nhushagents.com",
  "give claude a private wallet with limits:\n\nnpm i hush-mcp\n\ndaily budget, per-call cap, seller allowlist, kill switch.\n\nhushagents.com/docs",
  "selling an api to agents?\n\nnpm i hush-x402\n\nanswer 402, get paid in sol, fresh address per call.\n\nhushagents.com/sell",
  "hush is open source.\n\nfacilitator, receipts, anchoring, the shop. read it, fork it, audit it:\n\ngithub.com/bigrceo/hush",
  "1% fee on every hush payment.\n\nhalf of it buys back $HUSH and burns it, every hour.\nevery run is public on hushagents.com/proof",
  "holding $HUSH lowers your agent's fees:\n\n100k → -10%\n1m → -25%\n5m → -50%\n10m → zero\n\nhushagents.com",
];

const CARDS = [
  ["two-txs-zero-link.png", "Two txs. Zero link."],
  ["liquidity-check.png", "Liquidity check"],
  ["fresh-wallets.png", "Fresh wallets"],
  ["bundle-check.png", "Bundle check"],
  ["holder-tiers.png", "Holder tiers"],
  ["buyback-burn.png", "Buyback & burn"],
  ["npm-packages.png", "hush-mcp & hush-x402"],
  ["hush-ticker.png", "$HUSH"],
];

export default function Page() {
  return (
    <>
      <Header />
      <main className="relative mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
        <div className="glow pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="label"><span className="label-hush">Raid kit</span> &nbsp;For holders</p>
          <h1 className="title mt-4 text-5xl sm:text-7xl">Help HUSH grow. <span className="hush-text">Copy, post, done.</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">Ten posts about what is live today, eight cards to attach, the contract address. Post in your own words if you prefer, and keep it factual.</p>

          <h2 className="title mt-14 text-3xl">Posts</h2>
          <div className="mt-6"><Tweets tweets={TWEETS} /></div>

          <h2 className="title mt-14 text-3xl">Cards</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {CARDS.map(([f, l]) => (
              <div key={f} className="card no-lift overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/raid/${f}`} alt={l} width={1600} height={900} loading="lazy" className="block aspect-video w-full object-cover" />
                <div className="flex items-center justify-between gap-3 p-4">
                  <p className="text-sm font-medium">{l}</p>
                  <a href={`/raid/${f}`} download={f} className="btn btn-ghost h-9 px-4">Download</a>
                </div>
              </div>
            ))}
          </div>

          <h2 className="title mt-14 text-3xl">Contract & links</h2>
          <div className="mt-6"><CaCopy ca={CA} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/proof" className="btn btn-ghost">Proof</a>
            <a href="/stats" className="btn btn-ghost">Stats</a>
            <a href="https://github.com/bigrceo/hush" target="_blank" rel="noreferrer" className="btn btn-ghost">GitHub</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
