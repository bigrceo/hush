import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "HUSH — The private economic layer for AI agents";

// Deterministic "streak curtain" made of thin bars, matching the hero shader.
function bars() {
  const out = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 150; i++) {
    const x = i * 8;
    const crest = 0.48 + 0.16 * Math.sin(i * 0.05) + 0.07 * Math.sin(i * 0.17 + 1.7);
    const h = Math.max(0, (1 - crest) * 630 * (0.75 + rnd() * 0.4));
    if (rnd() < 0.18) continue;
    const w = 1 + Math.round(rnd() * 3);
    const a = 0.35 + rnd() * 0.6;
    out.push({ x, h, w, a });
  }
  return out;
}

async function grotesk(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap", { headers: { "user-agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.24 (KHTML, like Gecko)" } })).text();
    const url = /src: url\(([^)]+)\) format\('(truetype|opentype)'\)/.exec(css)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function ogImage() {
  const font = await grotesk();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#07060a", color: "#f5f3fa", fontFamily: font ? "Grotesk" : "sans-serif" }}>
        {bars().map((b, i) => (
          <div key={i} style={{ position: "absolute", left: b.x, bottom: 0, width: b.w, height: b.h, opacity: b.a, background: "linear-gradient(to top, #cbbcff, #7a5cff 40%, rgba(42,21,128,0))" }} />
        ))}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(to bottom, #07060a 30%, rgba(7,6,10,0.65) 62%, rgba(7,6,10,0.15))" }} />
        <div style={{ position: "absolute", left: 80, top: 70, display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="16" fill="#9b7bff" />
            <circle cx="32" cy="32" r="17" fill="none" stroke="#07060a" strokeWidth="6" />
            <rect x="10" y="28" width="44" height="8" rx="2" fill="#07060a" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -2 }}>HUSH</div>
          <div style={{ marginLeft: 18, fontSize: 18, letterSpacing: 4, color: "#9b7bff" }}>SOLANA · X402</div>
        </div>
        <div style={{ position: "absolute", left: 80, top: 190, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>The private economic layer</div>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02, display: "flex" }}>
            for&nbsp;<span style={{ color: "#9b7bff" }}>AI agents</span>
          </div>
          <div style={{ marginTop: 30, fontSize: 38, fontWeight: 700, display: "flex" }}>
            Agents pay agents.&nbsp;<span style={{ color: "#9b7bff" }}>Nobody sees who.</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: font ? [{ name: "Grotesk", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
