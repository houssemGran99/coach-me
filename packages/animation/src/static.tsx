import { renderToStaticMarkup } from "react-dom/server";
import type { Lang, Practice } from "@mourabbi/schemas";
import { buildTimeline, stateAt, type FrameState } from "./core";
import { PitchSvg, viewBoxOf } from "./PitchSvg";

export { viewBoxOf };
export type PracticeLike = Pick<Practice, "animation" | "area" | "name">;

/** Render the pitch as a standalone SVG string (for previews and scripts). Not used by the web bundle. */
export function renderPitchSvgString(practice: PracticeLike, lang: Lang, frame?: FrameState): string {
  return renderToStaticMarkup(
    <PitchSvg spec={practice.animation} area={practice.area} lang={lang} frame={frame} title={practice.name[lang]} />,
  );
}

/** Frame at the end of step `index` (0-based). */
export function frameAtEndOfStep(practice: PracticeLike, index: number): FrameState {
  const tl = buildTimeline(practice.animation);
  const seg = tl.segments[Math.min(index, tl.segments.length - 1)]!;
  return stateAt(tl, seg.t1);
}
