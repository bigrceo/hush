import { Connection, PublicKey } from "@solana/web3.js";
import { Header, Footer } from "@/components/brand";
import { CaChip } from "@/components/ca";
import { LINKS, REPO, TEAM_WALLETS, TOKEN } from "@/lib/token";
import { CLUSTER, RPC_URL } from "@/lib/config";
import { listEpochs, publisherAddress } from "@/lib/epochs";
import { agentGdp, d1 } from "@/lib/store";
import { buybackState } from "@/lib/buyback";

export const metadata = { title: "Proof · HUSH", description: "Open source, on-chain anchors, live usage and token facts for HUSH." };
export const revalidate = 60;

const tx = (sig: string) => `https://solscan.io/tx/${sig}${CLUSTER === "mainnet-beta" ? "" : "?cluster=devnet"}`;
const acct = (a: string) => `https://solscan.io/account/${a}${CLUSTER === "mainnet-beta" ? "" : "?cluster=devnet"}`;
const short = (s: string, n = 6) => `${s.slice(0, n)}…${s.slice(-n)}`;
const when = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC";

async function latestCommit() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.name}/commits/${REPO.branch}`, { headers: { accept: "application/vnd.github+json" }, next: { revalidate: 600 } });
    if (!r.ok) return null;
    const j = await r.json();
    return { sha: String(j.sha), date: String(j.commit?.committer?.date ?? ""), url: String(j.html_url) };
  } catch {
    return null;
  }
}

async function safe<T>(f: () => Promise<T>, fallback: T): Promise<T> {
  try { return await f(); } catch { return fallback; }
}

function Label({ children, hush = false }: { children: React.ReactNode; hush?: boolean }) {
  return <p className={`label ${hush ? "label-hush" : ""}`}>{children}</p>;
}

function Box({ n, title, hush, children }: { n: string; title: string; hush: string; children: React.ReactNode }) {
  return (
    <section className="rv card no-lift p-6 sm:p-8">
      <Label><span className="label-hush">[{n}]</span>&nbsp; {title}</Label>
      <h2 className="title mt-3 text-3xl sm:text-4xl">{title} <span className="hush-text">{hush}</span></h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted">{children}</p>;
}

export default async function Proof() {
  const bb = await safe(() => buybackState(), null);
  const [commit, epochs, publisher, gdp, recent] = await Promise.all([
    latestCommit(),
    safe(() => listEpochs(20), []),
    safe(() => publisherAddress(), ""),
    safe(() => agentGdp(), { sol: 0, usdc: 0, calls: 0, refunds: 0 }),
    safe(async () => (await (await d1()).prepare("SELECT r.listing, r.ok, r.at, e.id AS epoch, e.anchor_sig FROM receipts r LEFT JOIN epochs e ON e.id = r.epoch_id ORDER BY r.at DESC LIMIT 8").all<{ listing: string; ok: number; at: string; epoch: number | null; anchor_sig: string | null }>()).results, []),
  ]);
  const balance = publisher ? await safe(async () => (await new Connection(RPC_URL, "confirmed").getBalance(new PublicKey(publisher))) / 1e9, null as number | null) : null;
  const anchored = epochs.filter((e) => e.anchorStatus === "anchored");

  return (
    <>
      <Header />
      <main className="relative mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
        <div className="glow pointer-events-none absolute inset-0" />
        <div className="relative">
          <Label hush>Proof</Label>
          <h1 className="title mt-4 text-5xl sm:text-7xl">Don&apos;t trust us. <span className="hush-text">Check.</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">Source code, on-chain anchors, live usage and token facts. Everything on this page is read live, and every number links to where you can check it yourself.</p>

          <div className="mt-12 space-y-4">
            <Box n="01" title="Open" hush="source.">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <Label>Repository</Label>
                  {commit ? <a href={`https://github.com/${REPO.owner}/${REPO.name}`} target="_blank" rel="noreferrer" className="mt-2 block text-lg hush-text underline">github.com/{REPO.owner}/{REPO.name} ↗</a> : <p className="mt-2 text-lg">github.com/{REPO.owner}/{REPO.name}</p>}
                  <p className="mt-2 text-sm text-muted">Hush Gate, the x402 client, receipt epochs, the MCP server and this site. MIT licensed.</p>
                </div>
                <div>
                  <Label>Latest commit</Label>
                  {commit ? (
                    <a href={commit.url} target="_blank" rel="noreferrer" className="mt-2 block text-lg underline">{commit.sha.slice(0, 7)} ↗</a>
                  ) : (
                    <p className="mt-2 text-lg text-muted">Repository opens soon</p>
                  )}
                  {commit?.date && <p className="mt-2 text-sm text-muted">{when(Date.parse(commit.date))}</p>}
                </div>
              </div>
            </Box>

            <Box n="02" title="On-chain" hush="anchors.">
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label>Publisher key</Label>
                  {publisher ? <a href={acct(publisher)} target="_blank" rel="noreferrer" className="mt-2 block break-all underline">{publisher} ↗</a> : <p className="mt-2 text-muted">Unavailable</p>}
                  <p className="mt-2 text-sm text-muted">Every epoch root is written on Solana as an SPL Memo signed by this key: <span className="text-fg/80">HUSH receipts root v1 &lt;epoch&gt; &lt;root&gt; &lt;count&gt;</span>.</p>
                </div>
                <div>
                  <Label>Publisher balance</Label>
                  <p className="title mt-2 text-3xl">{balance == null ? "…" : balance.toFixed(4)} <span className="hush-text">SOL</span></p>
                </div>
              </div>
              <div className="mt-8 border-t border-line pt-6">
                {anchored.length === 0 ? (
                  <Empty>First root anchors once the publisher is funded.{epochs.length > 0 ? ` ${epochs.length} sealed epoch${epochs.length > 1 ? "s" : ""} waiting.` : ""}</Empty>
                ) : (
                  <ul className="divide-y divide-line">
                    {anchored.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <span>Epoch {e.id} · {e.leafCount} receipts · root {short(e.root, 8)}</span>
                        <a href={tx(e.anchorSig!)} target="_blank" rel="noreferrer" className="hush-text underline">{short(e.anchorSig!, 8)} ↗</a>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 text-sm text-muted">Hold a receipt? <a href="/verify" className="hush-text underline">Verify it against these roots</a> in your browser.</p>
              </div>
            </Box>

            <Box n="03" title="Live" hush="usage.">
              {gdp.calls === 0 && gdp.refunds === 0 ? (
                <Empty>No paid calls yet. The first receipts land here as soon as agents start paying.</Empty>
              ) : (
                <>
                  <div className="grid gap-6 sm:grid-cols-3">
                    <div><Label>Paid calls</Label><p className="title mt-2 text-4xl">{gdp.calls}</p></div>
                    <div><Label>Refunds</Label><p className="title mt-2 text-4xl">{gdp.refunds}</p></div>
                    <div><Label>Agent GDP</Label><p className="title mt-2 text-4xl">{gdp.sol.toFixed(4)} <span className="hush-text">SOL</span></p>{gdp.usdc > 0 && <p className="mt-1 text-sm text-muted">+ {gdp.usdc.toFixed(2)} USDC</p>}</div>
                  </div>
                  <ul className="mt-8 divide-y divide-line border-t border-line">
                    {recent.map((r, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <span><span className={r.ok ? "hush-text" : "text-muted"}>{r.ok ? "Paid" : "Refunded"}</span> · {r.listing} · {when(Number(r.at))}</span>
                        {r.anchor_sig ? <a href={tx(r.anchor_sig)} target="_blank" rel="noreferrer" className="underline">Anchored in epoch {r.epoch} ↗</a> : <span className="text-muted">{r.epoch ? `Sealed in epoch ${r.epoch}, anchor pending` : "Joins the next epoch"}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Box>

            <Box n="04" title="Buyback" hush="& burn.">
              <p className="text-muted">Every hour, {Math.round(TOKEN.buybackShare * 100)}% of accrued facilitator fees buys $HUSH on Jupiter and the tokens are burned with an SPL burn. The other half pays network fees and ops. Every run is public at <a className="hush-text underline" href="/api/buyback">/api/buyback</a>.</p>
              {!bb || bb.runs.filter((r) => r.status === "done").length === 0 ? (
                <p className="mt-6 text-muted">No burn yet. Fees waiting: {(((bb?.pending.fees ?? 0)) / 1e9).toFixed(6)} SOL.</p>
              ) : (
                <>
                  <div className="mt-6 grid gap-6 sm:grid-cols-3">
                    <div><Label>SOL spent on $HUSH</Label><p className="title mt-2 text-3xl">{bb.totals.solIn.toFixed(6)}</p></div>
                    <div><Label>$HUSH burned</Label><p className="title mt-2 text-3xl hush-text">{bb.totals.tokensBurned.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
                    <div><Label>Runs</Label><p className="title mt-2 text-3xl">{bb.totals.runs}</p></div>
                  </div>
                  <ul className="mt-6 divide-y divide-line border-t border-line">
                    {bb.runs.filter((r) => r.status === "done").slice(0, 10).map((r) => (
                      <li key={String(r.id)} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <span>{when(r.at)} · {r.solIn.toFixed(6)} SOL → {(r.tokensBurned ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} $HUSH burned</span>
                        <span className="flex gap-4">{r.swapSig && <a className="underline" href={tx(String(r.swapSig))} target="_blank" rel="noreferrer">Swap ↗</a>}{r.burnSig && <a className="hush-text underline" href={tx(String(r.burnSig))} target="_blank" rel="noreferrer">Burn ↗</a>}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Box>

            <Box n="05" title="The" hush="token.">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <CaChip />
                {TOKEN.mint && <span className="break-all text-sm text-muted">{TOKEN.mint}</span>}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {LINKS.pump && <a href={LINKS.pump} target="_blank" rel="noreferrer" className="btn btn-ghost">pump.fun ↗</a>}
                {LINKS.dexscreener && <a href={LINKS.dexscreener} target="_blank" rel="noreferrer" className="btn btn-ghost">DexScreener ↗</a>}
                {LINKS.holders && <a href={LINKS.holders} target="_blank" rel="noreferrer" className="btn btn-ghost">Holders on Solscan ↗</a>}
              </div>
              <div className="mt-8 border-t border-line pt-6">
                <Label>Team wallets</Label>
                {TEAM_WALLETS.length === 0 ? (
                  <p className="mt-2 text-muted">Team wallets and locks will be listed here.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line">
                    {TEAM_WALLETS.map((w) => (
                      <li key={w.address} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <span>{w.label} · <a href={acct(w.address)} target="_blank" rel="noreferrer" className="underline">{short(w.address)}</a></span>
                        {w.lockUrl ? <a href={w.lockUrl} target="_blank" rel="noreferrer" className="hush-text underline">Lock ↗</a> : <span className="text-muted">No lock</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Box>

            <Box n="06" title="What HUSH hides," hush="and what it doesn't.">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <Label hush>Hidden</Label>
                  <ul className="mt-3 space-y-2 text-muted">
                    <li>Who pays whom: buys are sent from shared HUSH pool addresses, never from the agent&apos;s own address, to a fresh one-time payee. Payer and payee are not linked on-chain.</li>
                    <li>Links between calls to the same seller, or by the same agent.</li>
                    <li>Receipt contents: only a hash commitment is ever public.</li>
                  </ul>
                </div>
                <div>
                  <Label>Not hidden</Label>
                  <ul className="mt-3 space-y-2 text-muted">
                    <li>That a deposit into HUSH happened: agent deposit address to pool is visible.</li>
                    <li>Amounts and timing of payments. Solana is public, and a small pool with few users gives weak cover.</li>
                    <li>Custodial: the HUSH operator holds the pool keys and the internal ledger of who owns what.</li>
                    <li>Nothing here is zero-knowledge: privacy comes from one-time addresses, verifiability from Merkle roots anchored on-chain.</li>
                    <li>The operator also holds the key that derives payee addresses. Pool payments are SOL only for now.</li>
                  </ul>
                </div>
              </div>
            </Box>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
