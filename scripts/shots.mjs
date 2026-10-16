// Screenshots + hero frames. usage: node scripts/shots.mjs [base] [chromiumPath]
import fs from "node:fs";
import { chromium } from "playwright-core";
const BASE = process.argv[2] || "http://localhost:4048";
const out = new URL("../screenshots/", import.meta.url).pathname;
fs.mkdirSync(out + "hero-frames", { recursive: true });
const b = await chromium.launch({ executablePath: process.argv[3] || process.env.CHROMIUM_PATH, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto(BASE + "/", { waitUntil: "networkidle" });
for (let i = 0; i < 8; i++) { await p.screenshot({ path: `${out}hero-frames/f${String(i).padStart(2, "0")}.png` }); await p.waitForTimeout(250); }
await p.waitForTimeout(1500);
await p.screenshot({ path: out + "hero.png" });
const scrollTo = async (sel) => { const y = await p.evaluate((s) => { const e = [...document.querySelectorAll("h2")].find((h) => h.innerText.replace(/\u00a0/g, " ").replace(/\s+/g, " ").includes(s)); return e ? e.getBoundingClientRect().top + scrollY : 0; }, sel); for (let cur = await p.evaluate(() => scrollY); cur < y - 300; cur += 350) { await p.mouse.wheel(0, 350); await p.waitForTimeout(120); } await p.waitForTimeout(1200); };
await scrollTo("Agents buy"); await p.screenshot({ path: out + "mid-1.png" });
await scrollTo("more burn"); await p.screenshot({ path: out + "token.png" });
await scrollTo("Humans hold"); await p.mouse.wheel(0, 700); await p.waitForTimeout(1200); await p.screenshot({ path: out + "mid-2.png" });
const m = await b.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(BASE + "/", { waitUntil: "networkidle" }); await m.waitForTimeout(2500);
await m.screenshot({ path: out + "hero-mobile.png" });
await b.close();
