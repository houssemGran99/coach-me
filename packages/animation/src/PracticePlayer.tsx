"use client";

import {
  memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement,
} from "react";
import { trustLabel, type Lang, type Practice } from "@mourabbi/schemas";
import { buildTimeline, formatClock, seekTarget, stateAt } from "./core";
import { fill, PLAYER_LABELS, type PlayerLabels } from "./labels";
import { MARGIN, PitchSvg, SCALE, STAGE } from "./PitchSvg";

export type PlayerPractice = Pick<Practice, "animation" | "area" | "name"> & Partial<Pick<Practice, "review" | "source">>;

export interface PracticePlayerProps {
  practice: PlayerPractice;
  lang: Lang;
  /** Start playing on mount. Ignored when the user prefers reduced motion. */
  autoplay?: boolean;
  labels?: Partial<PlayerLabels>;
  className?: string;
}

const SPEEDS = [0.5, 1, 2] as const;
const Stage = memo(PitchSvg);

const ICON = {
  play: <path d="M6 4l10 6-10 6z" fill="currentColor" />,
  pause: <path d="M5 4h3.5v12H5zM11.5 4H15v12h-3.5z" fill="currentColor" />,
  prev: <path d="M5 4h2v12H5zM16 4v12L8 10z" fill="currentColor" />,
  next: <path d="M13 4h2v12h-2zM4 4l8 6-8 6z" fill="currentColor" />,
  replay: <path d="M10 3a7 7 0 1 0 7 7h-2a5 5 0 1 1-5-5v3l4-4-4-4z" fill="currentColor" />,
};
const Svg = ({ k }: { k: keyof typeof ICON }) => (
  <svg viewBox="0 0 20 20" width={18} height={18} aria-hidden="true" focusable="false">{ICON[k]}</svg>
);

const CSS = `
.mrb{border:1px solid rgba(233,242,235,.18);border-radius:8px;overflow:hidden;background:${STAGE.bg};color:${STAGE.ink};font-family:inherit;text-align:start}
.mrb:focus-visible{outline:2px solid #E6EFE8;outline-offset:3px}
.mrb[lang=ar] *{letter-spacing:0 !important}
.mrb-head{display:flex;justify-content:space-between;align-items:center;gap:6px 12px;flex-wrap:wrap;padding:10px 14px;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.mrb-time{font-variant-numeric:tabular-nums;letter-spacing:.04em}
.mrb-badge{padding:2px 8px;border-radius:4px;border:1px solid #E7B04A;color:#E7B04A;font-size:11px;letter-spacing:.04em;text-transform:none}
.mrb-say{margin:0;padding:12px 14px 4px;font-size:16px;font-weight:600;line-height:1.5;min-height:4.7em}
.mrb-ctl{display:flex;gap:8px;flex-wrap:wrap;padding:6px 14px;direction:ltr}
.mrb-ctl button{min-height:44px;min-width:44px;padding-inline:14px;border-radius:6px;border:1px solid rgba(233,242,235,.4);background:transparent;color:${STAGE.ink};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-weight:600}
.mrb-ctl button:focus-visible{outline:2px solid #E6EFE8;outline-offset:2px}
.mrb-ctl button.mrb-pl{background:${STAGE.ink};color:${STAGE.bg};border-color:${STAGE.ink}}
.mrb-scrub{direction:ltr;display:block;width:calc(100% - 28px);margin:8px 14px 16px;accent-color:${STAGE.ink};min-height:44px}
.mrb-scrub:focus-visible{outline:2px solid #E6EFE8;outline-offset:2px}
`;

/** Plays a practice's animation with play/pause, step controls, scrubbing and speed. */
export function PracticePlayer({ practice, lang, autoplay = false, labels, className }: PracticePlayerProps): ReactElement {
  const L: PlayerLabels = { ...PLAYER_LABELS[lang], ...labels };
  const spec = practice.animation;
  const area = practice.area;
  const tl = useMemo(() => buildTimeline(spec), [spec]);

  const svgRef = useRef<SVGSVGElement>(null);
  const stepEl = useRef<HTMLSpanElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const sayEl = useRef<HTMLParagraphElement>(null);
  const scrubEl = useRef<HTMLInputElement>(null);
  const nodes = useRef<Record<string, Element>>({});
  const run = useRef({ t: 0, playing: false, speed: 1, last: 0, raf: 0 });

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [speed, setSpeed] = useState(1);

  /** Writes the current frame straight to the DOM; nothing re-renders per frame. */
  const draw = useCallback(() => {
    const t = Math.max(0, Math.min(tl.total, run.current.t));
    const f = stateAt(tl, t);
    for (const id of Object.keys(f.pos)) {
      const el = nodes.current[id];
      if (!el) continue;
      const [x, y] = f.pos[id]!;
      const X = (MARGIN + x * SCALE).toFixed(2);
      const Y = (MARGIN + y * SCALE).toFixed(2);
      if (tl.objects[id]!.kind === "ball") {
        el.setAttribute("cx", X);
        el.setAttribute("cy", Y);
      } else {
        el.setAttribute("transform", `translate(${X} ${Y})`);
        const team = f.team[id];
        if (team && el.getAttribute("data-team") !== team) {
          el.setAttribute("data-team", team);
          el.firstElementChild?.setAttribute("fill", STAGE.team[team]);
          el.lastElementChild?.setAttribute("fill", STAGE.teamText[team]);
        }
      }
    }
    if (stepEl.current) {
      stepEl.current.textContent = `${L.title} · ${fill(L.step, { n: f.stepIndex + 1, m: tl.segments.length })}`;
    }
    if (timeEl.current) timeEl.current.textContent = `${formatClock(t)} / ${formatClock(tl.total)}`;
    if (sayEl.current) sayEl.current.textContent = spec.steps[f.stepIndex]?.caption[lang] ?? "";
    if (scrubEl.current && document.activeElement !== scrubEl.current) scrubEl.current.value = String(Math.round(t * 100));
  }, [tl, spec, lang, L.title, L.step]);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const loop = useRef<(ts: number) => void>(() => {});
  loop.current = (ts: number) => {
    const r = run.current;
    r.raf = 0;
    if (!r.playing) return;
    if (!r.last) r.last = ts;
    // Cap the step so a hidden tab never makes the animation jump.
    const dt = Math.min(0.1, (ts - r.last) / 1000);
    r.last = ts;
    r.t += dt * r.speed;
    if (r.t >= tl.total) {
      r.t = tl.total;
      r.playing = false;
      setPlaying(false);
      setEnded(true);
    }
    drawRef.current();
    if (r.playing) r.raf = requestAnimationFrame((n) => loop.current(n));
  };

  const play = useCallback(() => {
    const r = run.current;
    if (r.t >= tl.total - 0.01) r.t = 0;
    r.playing = true;
    r.last = 0;
    setPlaying(true);
    setEnded(false);
    if (!r.raf) r.raf = requestAnimationFrame((n) => loop.current(n));
  }, [tl]);

  const pause = useCallback(() => {
    const r = run.current;
    r.playing = false;
    if (r.raf) cancelAnimationFrame(r.raf);
    r.raf = 0;
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => (run.current.playing ? pause() : play()), [pause, play]);

  const seek = useCallback(
    (dir: -1 | 1) => {
      const r = run.current;
      r.t = seekTarget(tl, r.t, dir);
      setEnded(!r.playing && r.t >= tl.total - 0.01);
      drawRef.current();
    },
    [tl],
  );

  // (Re)start whenever the animation itself changes.
  useEffect(() => {
    const r = run.current;
    nodes.current = {};
    svgRef.current?.querySelectorAll("[data-aid]").forEach((n) => {
      nodes.current[n.getAttribute("data-aid")!] = n;
    });
    r.t = 0;
    r.playing = false;
    setPlaying(false);
    setEnded(false);
    drawRef.current();
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (autoplay && !reduce) play();
    return () => {
      r.playing = false;
      if (r.raf) cancelAnimationFrame(r.raf);
      r.raf = 0;
    };
  }, [tl, autoplay, play]);

  // Texts depend on language and labels.
  useLayoutEffect(() => {
    draw();
  }, [draw]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT") return;
    if (e.key === " " && tag !== "BUTTON") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seek(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seek(1);
    }
  };

  const nextSpeed = () => {
    const i = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    const s = SPEEDS[(i + 1) % SPEEDS.length]!;
    run.current.speed = s;
    setSpeed(s);
  };

  const name = practice.name[lang];
  const aiDraft = !!practice.review && !!practice.source && trustLabel({ review: practice.review, source: practice.source }) === "ai_draft";
  const playLabel = playing ? L.pause : ended ? L.replay : L.play;

  return (
    <div
      className={`mrb ${className ?? ""}`.trim()}
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      role="group"
      aria-label={`${name} — ${L.title}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mrb-head">
        <span ref={stepEl} />
        {aiDraft && <span className="mrb-badge">{L.aiDraft}</span>}
        <span ref={timeEl} className="mrb-time" dir="ltr" />
      </div>
      <Stage spec={spec} area={area} lang={lang} title={`${name} — ${L.title}`} svgRef={svgRef} />
      <p ref={sayEl} className="mrb-say" aria-live={playing ? "off" : "polite"} />
      <div className="mrb-ctl">
        <button type="button" onClick={() => seek(-1)} aria-label={L.prev} title={L.prev}><Svg k="prev" /></button>
        <button type="button" className="mrb-pl" onClick={toggle} aria-label={playLabel}>
          <Svg k={playing ? "pause" : ended ? "replay" : "play"} />
          <span>{playLabel}</span>
        </button>
        <button type="button" onClick={() => seek(1)} aria-label={L.next} title={L.next}><Svg k="next" /></button>
        <button type="button" onClick={nextSpeed} aria-label={`${L.speed}: ${speed}×`}>{speed}×</button>
      </div>
      <input
        ref={scrubEl}
        className="mrb-scrub"
        type="range"
        min={0}
        max={Math.round(tl.total * 100)}
        step={1}
        defaultValue={0}
        aria-label={L.scrub}
        onChange={(e) => {
          pause();
          run.current.t = Number(e.currentTarget.value) / 100;
          setEnded(false);
          drawRef.current();
        }}
      />
    </div>
  );
}
