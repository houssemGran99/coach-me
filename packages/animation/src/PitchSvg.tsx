import type { CSSProperties, ReactElement, Ref } from "react";
import type { Area, AnimationSpec, ConeColor, Lang, Team } from "@mourabbi/schemas";
import { buildTimeline, stateAt, stepMidTime, type FrameState } from "./core";

/** Pitch geometry: 10 units per metre, 14 units of margin. */
export const SCALE = 10;
export const MARGIN = 14;

/**
 * The stage is a fixed dark card that looks the same in light and dark UI themes,
 * so every colour here is a literal, never a UI token.
 */
export const STAGE = {
  bg: "#0D1A13",
  ink: "#E9F2EB",
  turfA: "#2F7D4E",
  turfB: "#2A7448",
  chalk: "#F3F8F4",
  team: { a: "#2F6FDE", b: "#D93A3A", n: "#F2C230", k: "#20262B", c: "#F3F3F3" } as Record<Team, string>,
  teamText: { a: "#FFFFFF", b: "#FFFFFF", n: "#1B1F23", k: "#FFFFFF", c: "#1B1F23" } as Record<Team, string>,
  cone: { o: "#F28C28", y: "#F2C230", w: "#F3F3F3", r: "#E5484D" } as Record<ConeColor, string>,
  font: "'Barlow',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
} as const;

export function viewBoxOf(area: Area): { width: number; height: number } {
  return { width: area.lengthM * SCALE + 2 * MARGIN, height: area.widthM * SCALE + 2 * MARGIN };
}

export interface PitchSvgProps {
  spec: AnimationSpec;
  area: Area;
  lang: Lang;
  /** Positions and teams to draw. Defaults to the initial layout. */
  frame?: FrameState;
  title?: string;
  className?: string;
  style?: CSSProperties;
  svgRef?: Ref<SVGSVGElement>;
}

const px = (m: number) => +(MARGIN + m * SCALE).toFixed(2);

/** Static pitch with objects at `frame`. In the player, positions are then driven through attributes. */
export function PitchSvg({ spec, area, lang, frame, title, className, style, svgRef }: PitchSvgProps): ReactElement {
  const { width: VW, height: VH } = viewBoxOf(area);
  const w = area.lengthM;
  const h = area.widthM;
  const X0 = MARGIN, Y0 = MARGIN, X1 = MARGIN + w * SCALE, Y1 = MARGIN + h * SCALE, r = SCALE;
  const stripes = Math.max(4, Math.round(w / 3));
  const sw = (w * SCALE) / stripes;
  const at = (id: string, x: number, y: number): [number, number] => {
    const p = frame?.pos[id];
    return p ? [p[0], p[1]] : [x, y];
  };
  const line = { fill: "none", stroke: STAGE.chalk, strokeWidth: 2.2 } as const;
  const mark = { fill: "none", stroke: STAGE.chalk, strokeWidth: 1.6, opacity: 0.85 } as const;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VW} ${VH}`}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: "block", width: "100%", height: "auto", direction: "ltr", ...style }}
    >
      {Array.from({ length: stripes }, (_, i) => (
        <rect key={i} x={+(MARGIN + i * sw).toFixed(2)} y={MARGIN} width={+sw.toFixed(2)} height={h * SCALE} fill={i % 2 ? STAGE.turfB : STAGE.turfA} />
      ))}
      <rect x={X0} y={Y0} width={w * SCALE} height={h * SCALE} {...line} />
      <path
        {...mark}
        d={`M${X0} ${Y0 + r}A${r} ${r} 0 0 0 ${X0 + r} ${Y0}M${X1 - r} ${Y0}A${r} ${r} 0 0 0 ${X1} ${Y0 + r}M${X1} ${Y1 - r}A${r} ${r} 0 0 0 ${X1 - r} ${Y1}M${X0 + r} ${Y1}A${r} ${r} 0 0 0 ${X0} ${Y1 - r}`}
      />
      {spec.halfway && (
        <>
          <path {...mark} d={`M${MARGIN + (w * SCALE) / 2} ${Y0}V${Y1}`} />
          <circle {...mark} cx={MARGIN + (w * SCALE) / 2} cy={MARGIN + (h * SCALE) / 2} r={3 * SCALE} />
        </>
      )}
      {spec.zones.map((z, i) => {
        const txt = z.label[lang];
        const zx = px(z.x), zy = px(z.y);
        const tw = txt.length * 4.4 + 10;
        return (
          <g key={`z${i}`}>
            <rect x={zx} y={zy} width={z.w * SCALE} height={z.h * SCALE} fill="rgba(255,255,255,.08)" stroke={STAGE.chalk} strokeWidth={1.4} strokeDasharray="5 4" />
            <rect x={zx} y={zy - 11} width={+tw.toFixed(1)} height={11} rx={2} fill="rgba(8,18,12,.85)" />
            <text x={zx + 5} y={zy - 3.2} fill="#fff" fontFamily={STAGE.font} fontSize={7} fontWeight={600}>{txt}</text>
          </g>
        );
      })}
      {spec.goals.map((g, i) => (
        <rect key={`g${i}`} x={px(g.x)} y={px(g.y)} width={g.w * SCALE} height={g.h * SCALE} rx={1} fill="rgba(255,255,255,.2)" stroke={STAGE.chalk} strokeWidth={1.8} />
      ))}
      {spec.cones.map((c, i) => {
        const cx = px(c.x), cy = px(c.y);
        return (
          <polygon key={`c${i}`} points={`${cx},${cy - 6} ${cx - 4.5},${cy + 4} ${cx + 4.5},${cy + 4}`} fill={STAGE.cone[c.color]} stroke="#1B1F23" strokeWidth={0.8} />
        );
      })}
      {spec.actors.map((a) => {
        const [x, y] = at(a.id, a.x, a.y);
        const team = frame?.team[a.id] ?? a.team;
        const small = a.label.length > 1;
        return (
          <g key={a.id} data-aid={a.id} data-kind="actor" transform={`translate(${px(x)} ${px(y)})`}>
            <circle r={SCALE} fill={STAGE.team[team]} stroke="#fff" strokeWidth={2} />
            <text
              y={small ? 2.4 : 3.4}
              textAnchor="middle"
              fill={STAGE.teamText[team]}
              fontFamily={STAGE.font}
              fontWeight={700}
              fontSize={small ? 6.5 : 9}
            >
              {a.label}
            </text>
          </g>
        );
      })}
      {spec.balls.map((b) => {
        const [x, y] = at(b.id, b.x, b.y);
        return <circle key={b.id} data-aid={b.id} data-kind="ball" r={4.4} cx={px(x)} cy={px(y)} fill="#fff" stroke="#1B1F23" strokeWidth={1} />;
      })}
    </svg>
  );
}

/** Frame used for static previews: the middle of step 1 (or any step). */
export function previewFrame(spec: AnimationSpec, stepIndex = 0): FrameState {
  const tl = buildTimeline(spec);
  return stateAt(tl, stepMidTime(tl, stepIndex));
}

/** Static preview of a practice: the pitch at the middle of its first step. */
export function PitchPreview(props: Omit<PitchSvgProps, "frame"> & { stepIndex?: number }): ReactElement {
  const { stepIndex, ...rest } = props;
  return <PitchSvg {...rest} frame={previewFrame(props.spec, stepIndex ?? 0)} />;
}
