"use client";
/**
 * Streak curtain: the HUSH hero background. A field of thin vertical light streaks whose crest rolls across
 * the screen like a slow wave, with a soft haze above it and film grain. One full-screen WebGL1 quad, one
 * fragment shader (original implementation). Pauses off-screen, caps DPR, renders a single still frame
 * under prefers-reduced-motion, and falls back to a CSS gradient when WebGL is missing.
 */
import { useEffect, useRef, useState } from "react";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDpr;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uHot;

float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }

// Height (0..1 from the bottom) of the curtain's crest at horizontal position x (0..1).
float crest(float x, float t){
  float w = 0.44
    + 0.16 * sin(x * 3.6 - t * 0.32)
    + 0.08 * sin(x * 7.9 + t * 0.51 + 1.7)
    + 0.05 * sin(x * 15.0 - t * 0.83);
  // Lift the edges a little so the shape reads as a wide valley/ridge, like a sound field.
  return w + 0.06 * pow(abs(x - 0.5) * 2.0, 2.0);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float t = uTime;

  // Columns: ~7 css px wide, each with its own width, brightness and flicker.
  float colW = 7.0 * uDpr;
  float ci = floor(frag.x / colW);
  float r = h11(ci);
  float r2 = h11(ci + 31.7);
  float fx = fract(frag.x / colW) - 0.5;
  float width = mix(0.08, 0.42, r * r);
  float line = smoothstep(width, 0.0, abs(fx));
  float core = smoothstep(width * 0.35, 0.0, abs(fx));

  float x = (ci * colW + 0.5 * colW) / uRes.x;
  float top = crest(x, t) + (r2 - 0.5) * 0.10;
  float y = uv.y;

  // Body of the streak: bright at the bottom, dissolving towards the crest.
  float body = smoothstep(top + 0.02, top - 0.55, y);
  body = pow(body, 1.6);
  // Each column breathes on its own clock.
  float flick = 0.55 + 0.45 * sin(t * (0.6 + r2 * 1.6) + r * 40.0);
  float skip = step(0.18, r2); // some columns stay dark
  float streak = (line * 1.1 + core * 0.7) * body * flick * skip;

  // Haze riding just above the crest, and a floor glow.
  float haze = exp(-max(y - top, 0.0) * 7.0) * smoothstep(top - 0.5, top, y) * 0.30;
  float floorGlow = exp(-y * 3.2) * 0.22;

  float e = (streak + haze + floorGlow) * 0.95;
  vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.55, e));
  col = mix(col, uHot, smoothstep(0.55, 1.25, e));
  col *= e;

  // Soft vignette on the sides and film grain.
  col *= smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x) * 0.85 + 0.15;
  float g = h21(frag + fract(t * 7.0) * 100.0) - 0.5;
  col += g * 0.035;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];

export function Streaks({ className = "", speed = 1, still = false }: { className?: string; speed?: number; still?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power", premultipliedAlpha: false });
    if (!gl) { setFallback(true); return; }
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
      return s;
    };
    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
    } catch (e) { console.warn("streaks: webgl failed", e); setFallback(true); return; }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U("uRes"), uTime = U("uTime"), uDpr = U("uDpr");
    gl.uniform3fv(U("uDeep"), hex("#2a1580"));
    gl.uniform3fv(U("uMid"), hex("#7a5cff"));
    gl.uniform3fv(U("uHot"), hex("#cbbcff"));

    const reduced = still || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
    let w = 0, h = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width * dpr));
      h = Math.max(1, Math.round(r.height * dpr));
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uDpr, dpr);
      if (reduced) draw(12);
    };
    const draw = (t: number) => { gl.uniform1f(uTime, t); gl.drawArrays(gl.TRIANGLES, 0, 3); };

    let raf = 0, visible = true, t0 = performance.now();
    const loop = (now: number) => {
      if (visible) draw(((now - t0) / 1000) * speed + 12);
      raf = requestAnimationFrame(loop);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);
    if (!reduced) raf = requestAnimationFrame(loop);
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduced) { t0 = performance.now() - 0; raf = requestAnimationFrame(loop); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [speed, still]);

  if (fallback)
    return <div className={className} style={{ background: "radial-gradient(120% 70% at 50% 100%, #7a5cff55, transparent 60%), repeating-linear-gradient(90deg, #9b7bff22 0 1px, transparent 1px 7px)" }} />;
  return <canvas ref={ref} className={className} style={{ display: "block", width: "100%", height: "100%" }} aria-hidden />;
}
