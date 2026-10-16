"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { checkProof, MEMO_RE, type ReceiptProof } from "@/lib/merkle";
import { BlurLetters } from "@/components/motion";

const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER || "devnet";
const RPC = process.env.NEXT_PUBLIC_RPC_URL || (CLUSTER === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}${CLUSTER === "mainnet-beta" ? "" : "?cluster=devnet"}`;

type Step = { label: string; ok: boolean | null; detail?: string };
type ParsedTx = { meta: { err: unknown } | null; blockTime: number | null; transaction: { message: { accountKeys: { pubkey: string; signer: boolean }[]; instructions: { program?: string; programId: string; parsed?: unknown }[] } } };

async function getTx(sig: string): Promise<{ tx: ParsedTx | null; via: string }> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [sig, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }] });
  try {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body });
    const j = await r.json();
    if (j.result) return { tx: j.result, via: "Solana RPC from your browser" };
  } catch {}
  const j = await (await fetch(`/api/anchor-tx?sig=${sig}`)).json();
  return { tx: j.result ?? null, via: "HUSH RPC relay (raw transaction, checked here)" };
}

export default function Verify() {
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [verdict, setVerdict] = useState<null | { ok: boolean; msg: string; sig?: string }>(null);
  const [busy, setBusy] = useState(false);
  const [publisher, setPublisher] = useState<string | null>(null);

  useEffect(() => { fetch("/api/publisher").then((r) => r.json()).then((j) => setPublisher(j.publisher)).catch(() => {}); }, []);

  async function run() {
    setBusy(true); setVerdict(null);
    const s: Step[] = [];
    const push = (x: Step) => { s.push(x); setSteps([...s]); };
    try {
      let p: ReceiptProof;
      try { p = JSON.parse(text); } catch { throw new Error("That is not valid JSON."); }
      const c = await checkProof(p);
      push({ label: "Leaf recomputed from the commitment", ok: c.ok || !/leaf/.test(c.reason ?? ""), detail: p.leaf?.slice(0, 16) + "…" });
      push({ label: `Merkle path (${p.path?.length ?? 0} steps) leads to the root`, ok: c.ok || !/path|root/.test(c.reason ?? ""), detail: (c.root ?? "").slice(0, 16) + "…" });
      if (!c.ok) throw new Error(c.reason);
      if (!p.anchor.signature) throw new Error(`Epoch ${p.epoch} is sealed but not anchored yet. Try again later.`);
      const { tx, via } = await getTx(p.anchor.signature);
      if (!tx || !tx.meta || tx.meta.err) throw new Error("Anchor transaction not found or failed on-chain.");
      const memos = tx.transaction.message.instructions.filter((i) => i.program === "spl-memo").map((i) => String(i.parsed));
      const memo = memos.find((m) => MEMO_RE.test(m));
      push({ label: "Anchor transaction fetched", ok: true, detail: via });
      const m = memo ? MEMO_RE.exec(memo) : null;
      const memoOk = !!m && Number(m[1]) === p.epoch && m[2] === p.root && Number(m[3]) === p.leafCount;
      push({ label: "On-chain memo carries this epoch, root and leaf count", ok: memoOk, detail: memo ?? "no HUSH memo in tx" });
      if (!memoOk) throw new Error("The memo on-chain does not match this proof.");
      const signers = tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey);
      const signerOk = signers.includes(p.anchor.publisher) && (!publisher || publisher === p.anchor.publisher);
      push({ label: "Signed by the HUSH publisher key", ok: signerOk, detail: p.anchor.publisher });
      if (!signerOk) throw new Error("The anchor was not signed by the HUSH publisher.");
      setVerdict({ ok: true, msg: `Included in root ${p.root.slice(0, 10)}… (epoch ${p.epoch}, ${p.leafCount} receipts), anchored on Solana${tx.blockTime ? " on " + new Date(tx.blockTime * 1000).toUTCString() : ""}.`, sig: p.anchor.signature });
    } catch (e) {
      setVerdict({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  }

  const onFile = async (f?: File) => { if (f) setText(await f.text()); };

  return (
    <main className="relative mx-auto max-w-[980px] px-4 py-16 sm:px-6">
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="relative">
        <p className="label"><span className="label-hush">Verify</span> &nbsp;{CLUSTER === "mainnet-beta" ? "Solana mainnet" : "Solana devnet"}</p>
        <h1 className="title mt-4 text-5xl sm:text-7xl"><BlurLetters step={0.004} duration={0.3} segments={[{ text: "Verify a" }, { text: "receipt.", className: "hush-text" }]} /></h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">Private, but verifiable. Drop the proof your agent&apos;s owner downloaded. Your browser recomputes the Merkle root and checks it against the memo anchored on Solana. No other receipt is revealed.</p>

        <motion.div initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.7, delay: 0.25 }} className="card no-lift mt-10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="label">Proof JSON</p>
            <label className="btn btn-ghost h-9 cursor-pointer">Upload file<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} /></label>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }} onDragOver={(e) => e.preventDefault()} placeholder='{ "kind": "hush-receipt-proof", ... }' spellCheck={false} className="mt-4 h-56 w-full font-mono text-xs" />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button onClick={run} disabled={busy || !text.trim()} className="btn btn-hush">{busy ? "Verifying…" : "Verify"}</button>
            {publisher && <span className="label">Publisher <span className="text-fg/80">{publisher.slice(0, 4)}…{publisher.slice(-4)}</span></span>}
          </div>
        </motion.div>

        {steps.length > 0 && (
          <div className="card no-lift mt-4 space-y-3 p-6">
            {steps.map((x, i) => (
              <motion.div key={i} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 text-sm">
                <span className={x.ok ? "hush-text" : "text-red-400"}>{x.ok ? "✓" : "✗"}</span>
                <div className="min-w-0"><p>{x.label}</p>{x.detail && <p className="mt-0.5 break-all text-xs text-subtle">{x.detail}</p>}</div>
              </motion.div>
            ))}
          </div>
        )}

        {verdict && (
          <motion.div initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} className={`card no-lift mt-4 p-6 ${verdict.ok ? "border-hush" : "border-red-500/50"}`}>
            <p className="title text-2xl">{verdict.ok ? <><span className="hush-text">✓ Included</span> in a root anchored on Solana</> : <span className="text-red-400">✗ Not verified</span>}</p>
            <p className="mt-2 text-muted">{verdict.msg}</p>
            {verdict.sig && <a href={explorer(verdict.sig)} target="_blank" rel="noreferrer" className="mt-3 inline-block break-all text-sm hush-text underline">tx {verdict.sig.slice(0, 20)}… on Solana Explorer ↗</a>}
          </motion.div>
        )}

        <div className="rg mt-14 grid gap-4 sm:grid-cols-3">
          {[["What's in a proof", "Your receipt's commitment, its leaf, the sibling hashes up to the root, and the anchor transaction."], ["What stays private", "Payer, payees, amounts and every other receipt. The siblings are hashes and reveal nothing."], ["What you trust", "SHA-256 and Solana. The root was written on-chain by the publisher key before you asked."]].map(([t, d]) => (
            <div key={t} className="card p-6"><p className="title text-lg">{t}</p><p className="mt-2 text-sm text-muted">{d}</p></div>
          ))}
        </div>
      </div>
    </main>
  );
}
