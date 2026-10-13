/**
 * Export drill animations as short MP4 videos for social posts.
 *
 *   pnpm videos:export                          # every template, French, 9:16
 *   pnpm videos:export --id rondo_4v2_u10       # one template (repeatable, or comma-separated)
 *   pnpm videos:export --lang ar --format square
 *
 * Options: --id <id[,id]>  --lang fr|en|ar  --format vertical|square|landscape
 *          --fps <n> (default 30)  --out <dir> (default out/videos)  --partial (skip validation failures)
 *
 * Frames are drawn with the same core and pitch as the app (buildTimeline/stateAt/PitchSvg),
 * rasterised by the Chromium that Playwright already installs for e2e tests, and encoded by ffmpeg.
 * Requires `ffmpeg` on PATH. No new dependencies. If Playwright's browser build does not match,
 * run `pnpm exec playwright install chromium` or set CHROMIUM_PATH to any Chromium/Chrome executable.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { buildTimeline, stateAt, viewBoxOf } from "@mourabbi/animation";
import { renderPitchSvgString } from "@mourabbi/animation/static";
import type { Lang, Practice } from "@mourabbi/schemas";
import { REPO_ROOT, validateTemplates } from "./lib/templates";

const BRAND = "Coach Me";
const FORMATS = {
  vertical: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
  landscape: { w: 1920, h: 1080 },
} as const;
type FormatName = keyof typeof FORMATS;

const UI: Record<Lang, { kind: Record<string, string>; reviewedBy: (n: string) => string; aiDraft: string; players: string; outro: string; outroSub: string; step: string }> = {
  fr: {
    kind: { warmup: "Échauffement", technical: "Technique", game_related: "Situation de jeu", main: "Exercice principal", game: "Jeu", cooldown: "Retour au calme" },
    reviewedBy: (n) => `Relu par ${n}`,
    aiDraft: "Brouillon IA",
    players: "joueurs",
    outro: "Préparez votre séance en 30 secondes",
    outroSub: "Exercices animés · séance chronométrée · lien à partager",
    step: "Étape",
  },
  en: {
    kind: { warmup: "Warm-up", technical: "Technical", game_related: "Game-related", main: "Main practice", game: "Game", cooldown: "Cool-down" },
    reviewedBy: (n) => `Reviewed by ${n}`,
    aiDraft: "AI draft",
    players: "players",
    outro: "Plan your session in 30 seconds",
    outroSub: "Animated drills · timed session · shareable link",
    step: "Step",
  },
  ar: {
    kind: { warmup: "إحماء", technical: "تمرين تقني", game_related: "وضعية لعب", main: "التمرين الرئيسي", game: "مباراة", cooldown: "تهدئة" },
    reviewedBy: (n) => `راجعه ${n}`,
    aiDraft: "مسودة بالذكاء الاصطناعي",
    players: "لاعبين",
    outro: "حضّر حصتك التدريبية في 30 ثانية",
    outroSub: "تمارين متحركة · حصة مؤقتة · رابط للمشاركة",
    step: "المرحلة",
  },
  de: {
    kind: { warmup: "Aufwärmen", technical: "Technik", game_related: "Spielform", main: "Hauptübung", game: "Spiel", cooldown: "Abwärmen" },
    reviewedBy: (n) => `Geprüft von ${n}`,
    aiDraft: "KI-Entwurf",
    players: "Spieler",
    outro: "Plane dein Training in 30 Sekunden",
    outroSub: "Animierte Übungen · Trainingseinheit mit Zeitplan · Link zum Teilen",
    step: "Schritt",
  },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function parseArgs(argv: string[]) {
  const a: { ids: string[]; lang: Lang; format: FormatName; fps: number; out: string; partial: boolean } = {
    ids: [], lang: "fr", format: "vertical", fps: 30, out: path.join(REPO_ROOT, "out/videos"), partial: false,
  };
  const need = (i: number, flag: string) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i]!;
    if (f === "--id") a.ids.push(...need(i++, f).split(",").filter(Boolean));
    else if (f === "--lang") {
      const v = need(i++, f);
      if (v !== "fr" && v !== "en" && v !== "ar") throw new Error("--lang must be fr, en or ar");
      a.lang = v;
    } else if (f === "--format") {
      const v = need(i++, f);
      if (!(v in FORMATS)) throw new Error(`--format must be one of ${Object.keys(FORMATS).join(", ")}`);
      a.format = v as FormatName;
    } else if (f === "--fps") {
      a.fps = Number(need(i++, f));
      if (!Number.isInteger(a.fps) || a.fps < 10 || a.fps > 60) throw new Error("--fps must be an integer from 10 to 60");
    } else if (f === "--out") a.out = path.resolve(need(i++, f));
    else if (f === "--partial") a.partial = true;
    else throw new Error(`unknown option ${f}`);
  }
  return a;
}

function pageHtml(w: number, h: number, lang: Lang): string {
  const rtl = lang === "ar";
  const wide = w > h;
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:#0D1A13;color:#E9F2EB;
  font-family:'Barlow','IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif}
#root{position:relative;width:${w}px;height:${h}px;display:flex;flex-direction:${wide ? "row" : "column"};padding:${wide ? 56 : 64}px;gap:${wide ? 56 : 40}px;direction:${rtl ? "rtl" : "ltr"}}
#head{display:flex;flex-direction:column;gap:14px;${wide ? "width:560px;flex:none;justify-content:center" : ""}}
#tags{display:flex;gap:10px;flex-wrap:wrap}
.tag{font-size:30px;font-weight:600;padding:6px 18px;border-radius:999px;background:#1B3326;color:#BFE3CB}
.tag.ok{background:#F2C230;color:#1B1F23}
#title{font-size:${wide ? 64 : 76}px;line-height:1.08;font-weight:800;letter-spacing:-.01em}
#meta{font-size:32px;color:#9DB4A5}
#stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
#stage{overflow:hidden}
#stage svg{width:100%!important;height:100%!important;border-radius:20px}
#side{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;gap:${wide || w === h ? 24 : 36}px}
#cap{min-height:${wide ? 150 : 190}px;display:flex;align-items:flex-start;gap:20px;font-size:${wide ? 44 : 52}px;line-height:1.2;font-weight:600}
#cap b{flex:none;min-width:72px;height:72px;border-radius:36px;background:#F2C230;color:#1B1F23;display:grid;place-items:center;font-size:42px}
#bar{height:10px;background:#1B3326;border-radius:5px;overflow:hidden;direction:ltr}
#bar i{display:block;height:100%;width:0;background:#F2C230}
#brand{font-size:34px;font-weight:800;color:#9DB4A5;letter-spacing:.02em}
#outro{position:absolute;inset:0;background:#14532D;display:none;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center;padding:80px}
#outro h1{font-size:${wide ? 84 : 92}px;line-height:1.1;font-weight:800}
#outro p{font-size:40px;color:#CFE8D7}
#outro .brand{margin-top:24px;font-size:64px;font-weight:800;color:#F2C230}
</style><div id="root">
<div id="head"><div id="tags"></div><div id="title"></div><div id="meta"></div></div>
<div id="side"><div id="stage"></div><div id="cap"></div><div id="bar"><i></i></div><div id="brand">${BRAND}</div></div>
<div id="outro"><h1></h1><p></p><div class="brand">${BRAND}</div></div>
</div></html>`;
}

function intro(p: Practice, lang: Lang) {
  const t = UI[lang];
  const tags = [`<span class="tag">${esc(t.kind[p.kind] ?? p.kind)}</span>`, `<span class="tag">${p.ageGroups[0]}${p.ageGroups.length > 1 ? "–" + p.ageGroups.at(-1) : ""}</span>`];
  // Never present unreviewed content as reviewed: only a named, reviewed practice gets the badge.
  if (p.review.status === "reviewed" && p.review.reviewedBy) tags.push(`<span class="tag ok">${esc(t.reviewedBy(p.review.reviewedBy))}</span>`);
  else if (p.review.status === "ai_draft") tags.push(`<span class="tag">${esc(t.aiDraft)}</span>`);
  const players = p.minPlayers === p.maxPlayers ? `${p.minPlayers}` : `${p.minPlayers}–${p.maxPlayers}`;
  return { tags: tags.join(""), title: esc(p.name[lang]), meta: `${players} ${t.players} · ⁦${p.area.lengthM}×${p.area.widthM} m⁩` };
}

async function exportOne(p: Practice, opts: ReturnType<typeof parseArgs>, browser: import("@playwright/test").Browser): Promise<string> {
  const { w, h } = FORMATS[opts.format];
  const { lang, fps } = opts;
  const tl = buildTimeline(p.animation);
  const HOLD_START = 0.8;
  const HOLD_END = 1.2;
  const OUTRO = 2.2;
  const animEnd = HOLD_START + tl.total + HOLD_END;
  const totalS = animEnd + OUTRO;
  const frames = Math.ceil(totalS * fps);

  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(pageHtml(w, h, lang));
  const info = intro(p, lang);
  const t = UI[lang];
  await page.evaluate(
    ({ info, outro, sub }) => {
      document.getElementById("tags")!.innerHTML = info.tags;
      document.getElementById("title")!.innerHTML = info.title;
      document.getElementById("meta")!.textContent = info.meta;
      document.querySelector("#outro h1")!.textContent = outro;
      document.querySelector("#outro p")!.textContent = sub;
    },
    { info, outro: t.outro, sub: t.outroSub },
  );

  mkdirSync(opts.out, { recursive: true });
  const file = path.join(opts.out, `${p.id}.${lang}.${opts.format}.mp4`);
  const ff = spawn(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise<void>((res, rej) => {
    ff.on("error", (e) => rej(new Error(`could not run ffmpeg (is it on PATH?): ${e.message}`)));
    ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited with code ${code}`))));
  });
  ff.stdin.on("error", () => {}); // surfaced through `done`

  let lastKey = "";
  for (let i = 0; i < frames; i++) {
    const now = i / fps;
    const inOutro = now >= animEnd;
    const at = Math.min(Math.max(now - HOLD_START, 0), tl.total);
    const frame = stateAt(tl, at);
    const step = p.animation.steps[frame.stepIndex]!;
    const key = `${inOutro}`;
    const svg = renderPitchSvgString(p, lang, frame);
    await page.evaluate(
      ({ svg, cap, n, count, pct, inOutro, setOutro }) => {
        document.getElementById("stage")!.innerHTML = svg;
        document.getElementById("cap")!.innerHTML = `<b>${n}/${count}</b><span></span>`;
        document.querySelector("#cap span")!.textContent = cap;
        (document.querySelector("#bar i") as HTMLElement).style.width = pct + "%";
        if (setOutro) document.getElementById("outro")!.style.display = inOutro ? "flex" : "none";
      },
      { svg, cap: step.caption[lang], n: frame.stepIndex + 1, count: tl.segments.length, pct: +(((at / tl.total) * 100) || 0).toFixed(2), inOutro, setOutro: key !== lastKey },
    );
    lastKey = key;
    const png = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(png)) await new Promise<void>((r) => ff.stdin.once("drain", () => r()));
  }
  ff.stdin.end();
  await done;
  await page.close();
  void viewBoxOf; // pitch scales to the stage width via CSS; viewBox ratio is preserved by the SVG
  return file;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { practices, problems } = validateTemplates({ partial: true });
  if (problems.length) {
    console.warn(`${problems.length} validation problem(s); run pnpm templates:validate.`);
    if (!opts.partial) throw new Error("fix the problems above or pass --partial");
  }
  let list = practices;
  if (opts.ids.length) {
    const missing = opts.ids.filter((id) => !practices.some((p) => p.id === id));
    if (missing.length) throw new Error(`unknown template id: ${missing.join(", ")}`);
    list = practices.filter((p) => opts.ids.includes(p.id));
  }
  if (!list.length) throw new Error("no templates to export");

  // @playwright/test lives in apps/web (e2e dependency); reuse it and its installed Chromium.
  const req = createRequire(path.join(REPO_ROOT, "apps/web/package.json"));
  const { chromium } = req("@playwright/test") as typeof import("@playwright/test");
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    for (const p of list) {
      process.stdout.write(`${p.id} … `);
      const file = await exportOne(p, opts, browser);
      console.log(path.relative(REPO_ROOT, file));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
