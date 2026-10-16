"use client";
import { useState } from "react";
import { TOKEN } from "@/lib/token";

/** Bare mono-caps contract address with a copy action. Shows "CA soon" until the mint is set. */
export function CaChip({ className = "" }: { className?: string }) {
  const [ok, setOk] = useState(false);
  const m = TOKEN.mint;
  if (!m) return <span className={`label ${className}`}>CA <span className="text-fg/70">soon</span></span>;
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(m).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); }).catch(() => {})}
      className={`label hover:text-fg ${className}`}
      title="Copy contract address"
    >
      CA <span className="text-fg/80">{m.slice(0, 4)}…{m.slice(-4)}</span> <span className="label-hush">{ok ? "copied" : "copy"}</span>
    </button>
  );
}
