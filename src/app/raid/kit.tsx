"use client";
import { useState } from "react";

function useCopy() {
  const [k, setK] = useState<string | null>(null);
  const copy = (key: string, text: string) =>
    navigator.clipboard?.writeText(text).then(() => { setK(key); setTimeout(() => setK(null), 1400); }).catch(() => {});
  return { k, copy };
}

export function Tweets({ tweets }: { tweets: string[] }) {
  const { k, copy } = useCopy();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tweets.map((t, i) => (
        <div key={i} className="card no-lift flex flex-col p-5 sm:p-6">
          <p className="label">Post {String(i + 1).padStart(2, "0")}</p>
          <p className="mt-3 flex-1 whitespace-pre-line text-[15px] leading-relaxed text-fg">{t}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => copy(`t${i}`, t)} className="btn btn-ghost h-10 px-4">{k === `t${i}` ? "Copied" : "Copy"}</button>
            <a href={`https://x.com/intent/post?text=${encodeURIComponent(t)}`} target="_blank" rel="noreferrer" className="btn btn-hush h-10 px-4">Post on X</a>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CaCopy({ ca }: { ca: string }) {
  const { k, copy } = useCopy();
  return (
    <div className="card no-lift flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <p className="label">Contract address · Solana</p>
        <p className="mt-2 break-all text-[15px] font-medium text-fg">{ca}</p>
      </div>
      <button onClick={() => copy("ca", ca)} className="btn btn-hush h-10 shrink-0 px-5">{k === "ca" ? "Copied" : "Copy CA"}</button>
    </div>
  );
}
