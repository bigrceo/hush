import Link from "next/link";
import { ScrollWords, Roll } from "./scrollfx";

import { CaChip } from "./ca";
import { LINKS, TOKEN } from "@/lib/token";

export const PUMP_URL = LINKS.buy;
export const CA = TOKEN.mint;
const SOCIALS = ([["GitHub", LINKS.github], ["X", LINKS.x], ["Telegram", LINKS.telegram], ["DexScreener", LINKS.dexscreener]] as const).filter(([, u]) => u);

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#9b7bff" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#07060a" strokeWidth="6" />
      <rect x="10" y="28" width="44" height="8" rx="2" fill="#07060a" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Mark />
      <span className="title text-[22px] tracking-[-0.04em]">HUSH</span>
    </Link>
  );
}

export function Header() {
  const nav = [
    ["Home", "/"],
    ["App", "/app"],
    ["Docs", "/docs"],
    ["Sell", "/sell"],
    ["Verify", "/verify"],
    ["Proof", "/proof"],
    ["Whitepaper", "/whitepaper"],
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            {nav.map(([l, h]) => (
              <Link key={h} href={h} className="hover:text-fg">{l}</Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <CaChip className="mr-2 hidden lg:inline" />
          {SOCIALS.map(([l, u]) => <a key={l} href={u} target="_blank" rel="noreferrer" className="label mr-2 hidden hover:text-fg xl:inline">{l === "DexScreener" ? "Dex" : l}</a>)}
          <Link href="/app" className="btn btn-hush h-10"><Roll>Launch App</Roll></Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="title mt-6 text-3xl">What your agent buys<br /><span className="hush-text">is nobody&apos;s business.</span></p>
          <div className="mt-6"><CaChip /></div>
        </div>
        <div className="flex flex-col gap-3 text-sm text-muted">
          <span className="label mb-1">Product</span>
          <Link href="/app">App</Link><Link href="/docs">Docs</Link><Link href="/sell">Sell</Link><Link href="/verify">Verify</Link><Link href="/proof">Proof</Link><Link href="/whitepaper">Whitepaper</Link>
        </div>
        <div className="flex flex-col gap-3 text-sm text-muted">
          <span className="label mb-1">$HUSH</span>
          <a href={PUMP_URL} target="_blank" rel="noreferrer">Buy on pump.fun</a>
          {SOCIALS.map(([l, u]) => <a key={l} href={u} target="_blank" rel="noreferrer">{l}</a>)}
        </div>
      </div>
      <div className="mx-auto max-w-[1240px] px-4 pb-10 text-xs text-subtle sm:px-6">© 2026 HUSH. Payments settle on Solana. Nothing here is financial advice.</div>
    </footer>
  );
}

export function SectionHead({ n, tag, title, hush, sub }: { n: string; tag: string; title: string; hush: string; sub?: string }) {
  return (
    <div className="max-w-3xl">
      <p className="label rv"><span className="label-hush">[{n}]</span> &nbsp;{tag}</p>
      <h2 className="title mt-5 text-[40px] sm:text-[60px]"><ScrollWords segments={[{ text: title }, { text: hush, className: "hush-text" }]} /></h2>
      {sub && <p className="rv mt-5 max-w-xl text-lg text-muted">{sub}</p>}
    </div>
  );
}

export function Redacted({ w = 80 }: { w?: number }) {
  return <span className="redact inline-block h-[0.9em] align-middle" style={{ width: w }} />;
}
