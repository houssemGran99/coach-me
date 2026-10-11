"use client";

import { useEffect, useRef, useState } from "react";

/** Rondo 4v2 in a phone frame: the ball is passed around the square while the two reds press it. */
const BLUES: readonly (readonly [number, number])[] = [[89, 20], [158, 89], [89, 158], [20, 89]];
const ORDER = [0, 1, 2, 3, 0] as const;
const CAPTIONS = ["Passez au joueur libre", "Changez de côté", "Deux touches maximum", "Gardez le ballon"] as const;
const LEG_S = 1.9;
const TOTAL_S = CAPTIONS.length * LEG_S;

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

function Player({ team, n, at, gRef }: { team: "blue" | "red"; n: number; at?: readonly [number, number]; gRef?: (el: SVGGElement | null) => void }) {
  return (
    <g ref={gRef} transform={at ? `translate(${at[0]} ${at[1]})` : undefined}>
      <circle r={10} fill={team === "blue" ? "#2f6fde" : "#d93a3a"} stroke="#fff" strokeWidth={2} />
      <text y={3.6} textAnchor="middle" fill="#fff" fontWeight={700} fontSize={9}>{n}</text>
    </g>
  );
}

export function PhoneDemo() {
  const ball = useRef<SVGCircleElement>(null);
  const r1 = useRef<SVGGElement | null>(null);
  const r2 = useRef<SVGGElement | null>(null);
  const bar = useRef<HTMLElement>(null);
  const [leg, setLeg] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = -1;
    const draw = (ms: number) => {
      const s = (ms / 1000) % TOTAL_S;
      const i = Math.min(CAPTIONS.length - 1, Math.floor(s / LEG_S));
      const p = ease((s - i * LEG_S) / LEG_S);
      const a = BLUES[ORDER[i]!]!;
      const b = BLUES[ORDER[i + 1]!]!;
      const bx = a[0] + (b[0] - a[0]) * p;
      const by = a[1] + (b[1] - a[1]) * p;
      ball.current?.setAttribute("cx", String(bx));
      ball.current?.setAttribute("cy", String(by));
      const mx = 89 + (bx - 89) * 0.45;
      const my = 89 + (by - 89) * 0.45;
      r1.current?.setAttribute("transform", `translate(${mx - 12} ${my - 6})`);
      r2.current?.setAttribute("transform", `translate(${mx + 13} ${my + 8})`);
      if (bar.current) bar.current.style.width = `${(s / TOTAL_S) * 100}%`;
      if (i !== last) {
        last = i;
        setLeg(i);
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="phone" role="img" aria-label="Aperçu de l'application : un exercice de rondo animé">
      <div className="screen">
        <div className="notch" />
        <div className="s-tags"><span>Technique</span><span>U9–U11</span></div>
        <div className="s-title">Rondo 4 contre 2</div>
        <div className="s-meta">6–10 joueurs · 15×15 m</div>
        <div className="s-stage">
          <svg viewBox="0 0 178 178" aria-hidden="true" fontFamily="var(--f-body)">
            <rect width={178} height={178} fill="#2a7448" />
            {[14, 74, 134].map((x) => <rect key={x} x={x} width={30} height={178} fill="#2f7d4e" />)}
            <rect x={14} y={14} width={150} height={150} fill="none" stroke="#f3f8f4" strokeWidth={2} />
            <g fill="#f28c28" stroke="#1b1f23" strokeWidth={0.8}>
              <polygon points="14,8 9.5,18 18.5,18" /><polygon points="164,8 159.5,18 168.5,18" />
              <polygon points="14,160 9.5,170 18.5,170" /><polygon points="164,160 159.5,170 168.5,170" />
            </g>
            <Player team="red" n={5} gRef={(el) => { r1.current = el; }} />
            <Player team="red" n={6} gRef={(el) => { r2.current = el; }} />
            {BLUES.map((p, i) => <Player key={i} team="blue" n={i + 1} at={p} />)}
            <circle ref={ball} r={4.6} cx={BLUES[0]![0]} cy={BLUES[0]![1]} fill="#fff" stroke="#1b1f23" strokeWidth={1} />
          </svg>
        </div>
        <div className="s-cap"><b>{leg + 1}/{CAPTIONS.length}</b><span>{CAPTIONS[leg]}</span></div>
        <div className="s-bar"><i ref={bar} /></div>
        <div className="s-foot"><span>Relu par un entraîneur</span><span>⏱ 8 min</span></div>
      </div>
    </div>
  );
}
