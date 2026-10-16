import { Header, Footer } from "./brand";
export type DocSection = { id: string; title: string; body: React.ReactNode };
export function DocLayout({ kicker, title, hush, intro, sections }: { kicker: string; title: string; hush: string; intro: string; sections: DocSection[] }) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6">
        <p className="label"><span className="label-hush">{kicker}</span></p>
        <h1 className="title mt-4 text-5xl sm:text-7xl">{title} <span className="hush-text">{hush}</span></h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">{intro}</p>
        <div className="mt-14 grid gap-12 lg:grid-cols-[220px_1fr]">
          <nav className="hidden lg:block">
            <div className="sticky top-24 space-y-2.5">
              {sections.map((s, i) => (
                <a key={s.id} href={`#${s.id}`} className="block text-sm text-muted hover:text-fg"><span className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</span>&nbsp; {s.title}</a>
              ))}
            </div>
          </nav>
          <article className="max-w-3xl space-y-16">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="rv scroll-mt-24">
                <p className="label"><span className="label-hush">{String(i + 1).padStart(2, "0")}</span></p>
                <h2 className="title mt-2 text-3xl">{s.title}</h2>
                <div className="prose-hush mt-5 space-y-4 text-[15px] leading-7 text-muted">{s.body}</div>
              </section>
            ))}
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
export function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="card overflow-hidden">
      {label && <div className="border-b border-line px-4 py-2 label">{label}</div>}
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-fg/80">{children}</pre>
    </div>
  );
}
