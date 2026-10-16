"use client";
// HUSH motion language: blur-in reveals with a soft rise, word-by-word stagger on titles, count-ups in view.
import { animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, y = 18, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" | "p" }) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </M>
  );
}

/** Children appear one after another as the group scrolls in. */
export function Stagger({ children, className, step = 0.08 }: { children: ReactNode; className?: string; step?: number }) {
  const reduce = useReducedMotion();
  const v: Variants = { hidden: {}, show: { transition: { staggerChildren: step } } };
  return (
    <motion.div className={className} variants={v} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "0px 0px -10% 0px" }}>
      {children}
    </motion.div>
  );
}
export const item: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE } },
};
export function Item({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={item}>{children}</motion.div>;
}

/** Word-by-word blur-in. Segments let a title mix plain and brand-coloured words. */
export function BlurText({ segments, className, delay = 0, step = 0.06, immediate = false }: { segments: { text: string; className?: string; br?: boolean }[]; className?: string; delay?: number; step?: number; immediate?: boolean }) {
  const reduce = useReducedMotion();
  let i = 0;
  const words = segments.flatMap((s, si) => {
    const ws = s.text.split(" ").filter(Boolean).map((w) => ({ w, cls: s.className, k: `${si}-${i}`, idx: i++ }));
    return s.br ? [...ws, { br: true as const, k: `br-${si}` }] : ws;
  });
  const anim = { opacity: 1, y: 0, filter: "blur(0px)" };
  return (
    <span className={className}>
      {words.map((x) =>
        "br" in x ? <br key={x.k} /> : (
          <motion.span
            key={x.k}
            className={`inline-block ${x.cls ?? ""}`}
            initial={reduce ? false : { opacity: 0, y: "0.25em", filter: "blur(12px)" }}
            {...(immediate ? { animate: anim } : { whileInView: anim, viewport: { once: true, margin: "0px 0px -8% 0px" } })}
            transition={{ duration: 0.85, delay: delay + x.idx * step, ease: EASE }}
          >
            {x.w}&nbsp;
          </motion.span>
        ),
      )}
    </span>
  );
}

/** Counts from 0 to `value` once it scrolls into view, then follows live updates. */
export function Counter({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) { setShown(value); return; }
    const c = animate(from.current, value, { duration: from.current === 0 ? 1.6 : 0.6, ease: EASE, onUpdate: (v) => { from.current = v; setShown(v); } });
    return () => c.stop();
  }, [inView, value, reduce]);
  return <span ref={ref} className={className}>{shown.toFixed(decimals)}</span>;
}

/** Letter-by-letter blur-in (hero headline). */
export function BlurLetters({ segments, className, delay = 0, step = 0.022, duration = 0.7 }: { segments: { text: string; className?: string; br?: boolean }[]; className?: string; delay?: number; step?: number; duration?: number }) {
  const reduce = useReducedMotion();
  let n = 0;
  return (
    <span className={className} aria-label={segments.map((s) => s.text).join(" ")}>
      {segments.map((s, si) => (
        <span key={si}>
          {s.text.split(" ").map((w, wi, arr) => (
            <span key={wi} className={`inline-block whitespace-nowrap ${s.className ?? ""}`} aria-hidden>
              {[...w].map((ch, ci) => {
                const i = n++;
                return (
                  <motion.span key={ci} className="inline-block" initial={reduce ? false : { opacity: 0, filter: "blur(14px)", y: "0.18em" }} animate={{ opacity: 1, filter: "blur(0px)", y: 0 }} transition={{ duration, delay: delay + i * step, ease: EASE }}>
                    {ch}
                  </motion.span>
                );
              })}
              {wi < arr.length - 1 || !s.br ? " " : ""}
            </span>
          ))}
          {s.br && <br />}
        </span>
      ))}
    </span>
  );
}
