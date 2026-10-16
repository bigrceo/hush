"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PUMP_URL, CA, Redacted } from "./brand";
import { Streaks } from "./streaks";
import { BlurLetters } from "./motion";
import { Roll, TiltIn } from "./scrollfx";

const EASE = [0.22, 1, 0.36, 1] as const;
function Rise({ children, d, className }: { children: React.ReactNode; d: number; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.9, delay: d, ease: EASE }}>{children}</motion.div>;
}

export function SolanaLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.88} viewBox="0 0 397 311" aria-label="Solana">
      <defs>
        <linearGradient id="sol-g" x1="360" y1="-37" x2="141" y2="383" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path fill="url(#sol-g)" d="M64.6 237.9a14.5 14.5 0 0 1 10.3-4.3h317.4c6.5 0 9.7 7.8 5.1 12.4l-62.7 62.7a14.5 14.5 0 0 1-10.3 4.3H7.1c-6.5 0-9.7-7.8-5.1-12.4l62.6-62.7zM64.6 3.8A14.9 14.9 0 0 1 74.9-.5h317.4c6.5 0 9.7 7.8 5.1 12.4l-62.7 62.7a14.5 14.5 0 0 1-10.3 4.3H7.1c-6.5 0-9.7-7.8-5.1-12.4L64.6 3.8zM333.1 120.1a14.5 14.5 0 0 0-10.3-4.3H5.4c-6.5 0-9.7 7.8-5.1 12.4l62.7 62.7a14.5 14.5 0 0 0 10.3 4.3h317.4c6.5 0 9.7-7.8 5.1-12.4l-62.7-62.7z" />
    </svg>
  );
}

function CaPill() {
  const [copied, setCopied] = useState(false);
  const short = CA ? `${CA.slice(0, 4)}…${CA.slice(-4)}` : "soon";
  return (
    <div className="inline-flex h-10 items-center gap-3 rounded-full border border-line bg-surface/80 pl-4 pr-1.5 font-mono text-xs">
      <span className="hush-text">$HUSH</span>
      <span className="text-subtle">CA</span>
      <span className="text-muted">{short}</span>
      <button
        disabled={!CA}
        onClick={() => { navigator.clipboard?.writeText(CA).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
        className="h-7 rounded-full border border-line px-3 text-[11px] uppercase tracking-wider text-muted hover:text-fg disabled:opacity-40"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function DemoPanel() {
  const tabs = ["Shop", "Wallet", "Mandates", "Receipts"];
  return (
    <div className="relative mx-auto mt-16 w-full max-w-[1120px] overflow-hidden rounded-[22px] border border-line bg-surface/70 backdrop-blur-md shadow-[0_60px_160px_-50px_#9b7bff70]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 font-mono text-xs"><span className="h-2 w-2 rounded-full bg-hush" />agent-07</span>
          <div className="hidden gap-5 sm:flex">{tabs.map((t, i) => <span key={t} className={`label ${i === 0 ? "text-fg" : ""}`}>{t}</span>)}</div>
        </div>
        <span className="label flex items-center gap-2"><SolanaLogo size={12} /> Solana · <span className="label-hush blink">live</span></span>
      </div>
      <div className="dots relative px-5 py-14 sm:px-10 sm:py-20">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="ml-auto w-fit max-w-[90%] rounded-2xl border border-line bg-raised px-5 py-3.5 text-[15px]">
            <span className="hush-text font-mono">Q.</span> Is SOL network load rising, and where is price right now?
          </div>
          <div className="rounded-2xl border border-line bg-canvas/90 p-5 backdrop-blur">
            <p className="label">Paid 2 sellers · stealth addresses · receipt hidden</p>
            <p className="mt-3 text-[15px] leading-7 text-fg/90">Load is steady and price is holding. SOL trades near $<Redacted w={46} />, the network runs at ~<Redacted w={34} /> TPS. Nobody watching the chain can tell this agent asked.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[["Price feed", "oracle.hush"], ["Network pulse", "pulse.hush"]].map(([n, s]) => (
                <div key={s} className="flex items-center justify-between rounded-xl border border-line/80 px-4 py-3">
                  <div><p className="text-sm">{n}</p><p className="font-mono text-[11px] text-subtle">seller · one-time payee</p></div>
                  <span className="font-mono text-[11px] text-subtle"><Redacted w={54} /></span>
                </div>
              ))}
            </div>
          </div>
          <p className="label text-center">Example</p>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-[260px] h-[900px] [mask-image:linear-gradient(to_bottom,transparent,#000_30%,#000_88%,transparent)]"><Streaks className="h-full w-full" /></div>
      <div className="relative mx-auto max-w-[1240px] px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <h1 className="title mx-auto max-w-[1240px] text-[44px] sm:text-[64px] lg:text-[84px]">
          <BlurLetters delay={0.04} step={0.003} duration={0.28} segments={[{ text: "The private economic layer", br: true }, { text: "for" }, { text: "AI agents", className: "hush-text" }]} />
        </h1>
        <Rise d={0.3}><p className="title mt-6 text-[22px] sm:text-4xl">Agents pay agents. <span className="hush-text whitespace-nowrap">Nobody sees who.</span></p></Rise>
        <Rise d={0.42}><p className="mx-auto mt-5 max-w-2xl text-lg text-muted sm:text-xl">
          Agentic payments in SOL on the x402 standard. A fresh stealth address for every call, private receipts. No API keys, no humans.
        </p></Rise>
        <Rise d={0.52}><p className="mt-7 flex items-center justify-center gap-2 text-sm text-muted">Settles on <SolanaLogo size={15} /> <span className="text-fg">Solana</span></p></Rise>
        <Rise d={0.6} className="mt-8"><CaPill /></Rise>
        <Rise d={0.78}><TiltIn><DemoPanel /></TiltIn></Rise>
      </div>
    </section>
  );
}
