import Link from "next/link";
import { Header, Footer } from "@/components/brand";
export const metadata = { title: "Download HUSH" };
export default function Download() {
  const p = [["macOS", "Apple silicon & Intel"], ["Windows", "Windows 10 & 11"], ["Linux", "AppImage & .deb"], ["iOS", "App Store"], ["Android", "Google Play"]];
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
        <p className="label"><span className="label-hush">Download</span></p>
        <h1 className="title mt-4 text-5xl sm:text-7xl">Your agents, <span className="hush-text">on every screen.</span></h1>
        <p className="mt-5 max-w-xl text-lg text-muted">Watch spend, approve sellers, hit the kill switch. Native apps are coming. The web app works now.</p>
        <div className="rg mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {p.map(([n, d]) => (
            <div key={n} className="card p-6"><p className="title text-2xl">{n}</p><p className="mt-1 text-sm text-muted">{d}</p><p className="label mt-8">Soon</p></div>
          ))}
        </div>
        <Link href="/app" className="btn btn-hush mt-10">Use the web app</Link>
      </main>
      <Footer />
    </>
  );
}
