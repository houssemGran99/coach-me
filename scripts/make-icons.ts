import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { REPO_ROOT } from "./lib/templates";

/** Draws the app icon (a white pitch on green) and writes PNGs without any image library. */
const GREEN: [number, number, number] = [0x16, 0xa3, 0x4a];
const WHITE: [number, number, number] = [255, 255, 255];

const sdBox = (px: number, py: number, hx: number, hy: number) => {
  const qx = Math.abs(px) - hx;
  const qy = Math.abs(py) - hy;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
};

function render(size: number, opts: { inset: number; rounded: boolean }): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const c = size / 2;
  const half = size * (0.5 - opts.inset);
  const hx = half;
  const hy = half * 0.72; // pitch is wider than tall
  const t = size * 0.035;
  const radius = size * 0.18;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5 - c;
      const py = y + 0.5 - c;
      // Background: rounded square (or full bleed for maskable icons).
      const bg = opts.rounded ? sdBox(px, py, c - radius, c - radius) - radius : -1;
      const bgA = Math.min(1, Math.max(0, 0.5 - bg));
      // Pitch lines: outline, halfway line, centre circle.
      const outline = Math.abs(sdBox(px, py, hx, hy)) - t / 2;
      const mid = sdBox(px, py, 0, hy) - t / 2;
      const circle = Math.abs(Math.hypot(px, py) - size * 0.13) - t / 2;
      const d = Math.min(outline, mid, circle);
      const cov = Math.min(1, Math.max(0, 0.5 - d));
      const i = (y * size + x) * 4;
      out[i] = Math.round(GREEN[0] + (WHITE[0] - GREEN[0]) * cov);
      out[i + 1] = Math.round(GREEN[1] + (WHITE[1] - GREEN[1]) * cov);
      out[i + 2] = Math.round(GREEN[2] + (WHITE[2] - GREEN[2]) * cov);
      out[i + 3] = Math.round(255 * bgA);
    }
  }
  return out;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ]);
}

const dir = path.join(REPO_ROOT, "apps/web/public/icons");
mkdirSync(dir, { recursive: true });
const files: [string, number, { inset: number; rounded: boolean }][] = [
  ["icon-192.png", 192, { inset: 0.16, rounded: true }],
  ["icon-512.png", 512, { inset: 0.16, rounded: true }],
  // Maskable icons keep the artwork inside the central 80% "safe zone" and fill the whole square.
  ["icon-maskable-512.png", 512, { inset: 0.27, rounded: false }],
  ["apple-touch-icon.png", 180, { inset: 0.2, rounded: false }],
];
for (const [name, size, opts] of files) {
  writeFileSync(path.join(dir, name), png(size, render(size, opts)));
  console.log("wrote", name);
}
