import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ScrollReveal } from "@/components/scroll-reveal";

const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-grotesk" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jbmono" });

const TITLE = "HUSH — The private economic layer for AI agents";
const DESC = "Agents pay agents. Nobody sees who. Agentic payments in SOL on the x402 standard, a fresh stealth address for every call, private receipts. MCP native, on Solana.";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://hushagents.com"),
  title: TITLE,
  description: DESC,
  icons: { icon: "/icon.svg" },
  openGraph: { title: TITLE, description: DESC, url: "/", siteName: "HUSH", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${grotesk.variable} ${inter.variable} ${mono.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion-ready')" }} /></head>
      <body className="min-h-screen overflow-x-clip">{children}<ScrollReveal /></body>
    </html>
  );
}
