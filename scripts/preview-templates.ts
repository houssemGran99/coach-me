import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildTimeline, stateAt, viewBoxOf } from "@mourabbi/animation";
import { renderPitchSvgString } from "@mourabbi/animation/static";
import type { Practice } from "@mourabbi/schemas";
import { REPO_ROOT, validateTemplates } from "./lib/templates";

const OUT = path.join(REPO_ROOT, "out/preview");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Strip the outer <svg> of a rendered pitch so it can be nested with explicit size. */
function nested(p: Practice, t: number, x: number, y: number, w: number): string {
  const tl = buildTimeline(p.animation);
  const frame = stateAt(tl, t);
  const { width, height } = viewBoxOf(p.area);
  const inner = renderPitchSvgString(p, "en", frame)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
  const h = (w * height) / width;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h.toFixed(1)}" viewBox="0 0 ${width} ${height}">${inner}</svg>`;
}

function sheetSvg(p: Practice): string {
  const tl = buildTimeline(p.animation);
  const endOfFirst = tl.segments[0]!.t1;
  const W = 520;
  const { width, height } = viewBoxOf(p.area);
  const h = (W * height) / width;
  const total = 2 * W + 40;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${(h + 70).toFixed(1)}" width="${total}" font-family="system-ui,sans-serif">` +
    `<rect width="100%" height="100%" fill="#EDF2EE"/>` +
    `<text x="20" y="28" font-size="18" font-weight="700" fill="#10201A">${esc(p.name.en)}</text>` +
    `<text x="20" y="48" font-size="12" fill="#51635A">${esc(p.id)} · ${p.kind} · ${p.ageGroups[0]}-${p.ageGroups.at(-1)} · ${p.minPlayers}-${p.maxPlayers} players · ${p.area.lengthM}x${p.area.widthM} m · ${p.review.status}</text>` +
    nested(p, endOfFirst, 20, 60, W) +
    nested(p, tl.total, W + 40, 60, W) +
    `<text x="20" y="${(h + 66).toFixed(1)}" font-size="11" fill="#51635A">End of step 1</text>` +
    `<text x="${W + 40}" y="${(h + 66).toFixed(1)}" font-size="11" fill="#51635A">End of step ${tl.segments.length}</text>` +
    `</svg>`
  );
}

const { practices, problems } = validateTemplates({ partial: true });
if (problems.length) console.warn(`Note: ${problems.length} validation problem(s); run pnpm templates:validate.`);

mkdirSync(OUT, { recursive: true });
const cards: string[] = [];
for (const p of practices) {
  const svg = sheetSvg(p);
  writeFileSync(path.join(OUT, `${p.id}.svg`), svg);
  cards.push(
    `<figure><a href="${p.id}.svg">${svg}</a><figcaption>${p.animation.steps
      .map((s, i) => `${i + 1}. ${esc(s.caption.en)}`)
      .join("<br>")}</figcaption></figure>`,
  );
}
writeFileSync(
  path.join(OUT, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Template contact sheet</title><style>body{font:14px system-ui;background:#EDF2EE;margin:16px}figure{margin:0 0 24px;background:#fff;padding:8px;border-radius:8px}svg{max-width:100%;height:auto}figcaption{color:#51635A;font-size:12px;padding:6px 12px}</style><h1>${practices.length} templates</h1>${cards.join("")}`,
);
console.log(`Wrote ${practices.length} previews to ${path.relative(REPO_ROOT, OUT)} (open index.html).`);
