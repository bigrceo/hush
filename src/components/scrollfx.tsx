"use client";
// Scroll-linked effects: words light up as the title crosses the viewport, the hero panel un-tilts, cards stack.
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";

function Word({ p, range, children, className }: { p: MotionValue<number>; range: [number, number]; children: string; className?: string }) {
  const o = useTransform(p, range, [0.16, 1]);
  const f = useTransform(p, range, ["blur(4px)", "blur(0px)"]);
  return <motion.span style={{ opacity: o, filter: f }} className={`inline-block ${className ?? ""}`}>{children}&nbsp;</motion.span>;
}

/** Title whose words go from dim to full as it scrolls through the lower half of the screen. */
export function ScrollWords({ segments, className }: { segments: { text: string; className?: string }[]; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 92%", "start 40%"] });
  const words = segments.flatMap((s) => s.text.split(" ").filter(Boolean).map((w) => ({ w, c: s.className })));
  if (reduce) return <span className={className}>{segments.map((s, i) => <span key={i} className={s.className}>{s.text} </span>)}</span>;
  return (
    <span ref={ref} className={className}>
      {words.map((x, i) => (
        <Word key={i} p={scrollYProgress} range={[i / words.length, Math.min(1, (i + 1.5) / words.length)]} className={x.c}>{x.w}</Word>
      ))}
    </span>
  );
}

/** Hero product panel: tilted back and slightly smaller, flattens as you scroll into it. */
export function TiltIn({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 25%"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);
  return (
    <div ref={ref} className={className} style={{ perspective: 1400 }}>
      <motion.div style={reduce ? undefined : { rotateX, scale, y, transformOrigin: "50% 0%" }}>{children}</motion.div>
    </div>
  );
}

function StackCard({ i, n, p, children }: { i: number; n: number; p: MotionValue<number>; children: ReactNode }) {
  const start = i / n;
  const scale = useTransform(p, [start, 1], [1, 1 - (n - 1 - i) * 0.05]);
  const dim = useTransform(p, [start, Math.min(1, start + 1 / n)], ["brightness(1)", i === n - 1 ? "brightness(1)" : "brightness(0.45)"]);
  return (
    <div className="sticky" style={{ top: `calc(110px + ${i * 22}px)` }}>
      <motion.div style={{ scale, filter: dim, transformOrigin: "50% 0%" }}>{children}</motion.div>
    </div>
  );
}

/** Sticky stacking cards: each card pins under the previous one and the stack recedes. */
export function StackCards({ items }: { items: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 110px", "end end"] });
  if (reduce) return <div className="space-y-4">{items}</div>;
  return (
    <div ref={ref} className="relative space-y-6 pb-[10vh]">
      {items.map((c, i) => <StackCard key={i} i={i} n={items.length} p={scrollYProgress}>{c}</StackCard>)}
    </div>
  );
}

/** Button label that rolls up to a copy of itself on hover. */
export function Roll({ children }: { children: string }) {
  return (
    <span className="roll" aria-label={children}>
      <span aria-hidden>{children}</span>
      <span aria-hidden>{children}</span>
    </span>
  );
}
