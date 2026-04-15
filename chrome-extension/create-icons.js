#!/usr/bin/env node
// create-icons.js — Generate PNG icons for NetFree Inspector
// No external dependencies — uses only Node.js built-ins.
// Usage: node create-icons.js
//
// Generates three colour variants per size:
//   icons/icon{size}.png          — default (blue, used in store listing)
//   icons/icon{size}-green.png    — clean state: no blocks on page
//   icons/icon{size}-red.png      — alert state: blocks detected on page

'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Output directory ──────────────────────────────────────────────────────────
const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG writer ────────────────────────────────────────────────────────────────
function chunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(size, rgba /* Uint8Array size*size*4 */) {
  const scanline = 1 + size * 4;
  const raw = Buffer.allocUnsafe(size * scanline);
  for (let y = 0; y < size; y++) {
    raw[y * scanline] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * scanline + 1 + x * 4;
      raw[dst]     = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function setPixel(rgba, size, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  rgba[i] = r; rgba[i+1] = g; rgba[i+2] = b; rgba[i+3] = a;
}

function fillCircleAA(rgba, size, cx, cy, radius, r, g, b) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius - 1));
  const x1 = Math.min(size - 1, Math.ceil(cx + radius + 1));
  const y0 = Math.max(0, Math.floor(cy - radius - 1));
  const y1 = Math.min(size - 1, Math.ceil(cy + radius + 1));

  const SUBS = 4;
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      let hits = 0;
      for (let sy = 0; sy < SUBS; sy++) {
        for (let sx = 0; sx < SUBS; sx++) {
          const fx = px + (sx + .5) / SUBS - cx;
          const fy = py + (sy + .5) / SUBS - cy;
          if (fx * fx + fy * fy <= r2) hits++;
        }
      }
      if (hits === 0) continue;
      const a = Math.round(255 * hits / (SUBS * SUBS));
      const i = (py * size + px) * 4;
      const alpha = a / 255;
      rgba[i]     = Math.round(rgba[i]     * (1 - alpha) + r * alpha);
      rgba[i + 1] = Math.round(rgba[i + 1] * (1 - alpha) + g * alpha);
      rgba[i + 2] = Math.round(rgba[i + 2] * (1 - alpha) + b * alpha);
      rgba[i + 3] = Math.min(255, rgba[i + 3] + a);
    }
  }
}

function drawThickLine(rgba, size, x0, y0, x1, y1, w, r, g, b) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const ux = dx / len, uy = dy / len;
  const hw = w / 2;
  const steps = Math.ceil(len) + 1;

  for (let s = 0; s <= steps; s++) {
    const t  = s / steps;
    const mx = x0 + ux * len * t;
    const my = y0 + uy * len * t;
    fillCircleAA(rgba, size, mx, my, hw, r, g, b);
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ── Colour palettes ───────────────────────────────────────────────────────────
// Each palette defines: gradient top/bottom (circle bg) + symbol colour
const PALETTES = {
  blue: {
    topHex:    0x3B8BFF,   // light blue
    bottomHex: 0x0845C8,   // dark blue
    symbolHex: 0x1A6DFF,   // NetFree blue
    symbol:    'check',
  },
  green: {
    topHex:    0x34D399,   // emerald-400
    bottomHex: 0x059669,   // emerald-600
    symbolHex: 0x065F46,   // emerald-800
    symbol:    'check',
  },
  red: {
    topHex:    0xF87171,   // red-400
    bottomHex: 0xB91C1C,   // red-700
    symbolHex: 0x7F1D1D,   // red-900
    symbol:    'exclaim',
  },
};

// ── Icon painter ──────────────────────────────────────────────────────────────
function drawIcon(size, palette) {
  const rgba = new Uint8Array(size * size * 4); // all transparent

  const cx = size / 2;
  const cy = size / 2;
  const circR = size * 0.48;

  const tR = (palette.topHex    >> 16) & 0xFF;
  const tG = (palette.topHex    >>  8) & 0xFF;
  const tB = (palette.topHex         ) & 0xFF;
  const bR = (palette.bottomHex >> 16) & 0xFF;
  const bG = (palette.bottomHex >>  8) & 0xFF;
  const bB = (palette.bottomHex      ) & 0xFF;

  // ── Background circle: vertical gradient ──────────────────────────────────
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > circR) continue;

      const t = y / size;
      const R = Math.round(lerp(tR, bR, t));
      const G = Math.round(lerp(tG, bG, t));
      const B = Math.round(lerp(tB, bB, t));

      const i = (y * size + x) * 4;
      rgba[i] = R; rgba[i+1] = G; rgba[i+2] = B; rgba[i+3] = 255;
    }
  }

  // ── White shield ──────────────────────────────────────────────────────────
  const shW = size * 0.52;
  const shH = size * 0.60;
  const sx  = cx - shW / 2;
  const sy  = cy - shH * 0.52;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - sx) / shW;
      const ny = (y - sy) / shH;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) continue;

      let inside = false;
      if (ny < 0.22) {
        const arcR = 0.22;
        const distL = Math.hypot(nx - arcR, ny - arcR);
        const distR = Math.hypot(nx - (1 - arcR), ny - arcR);
        inside = distL <= arcR || distR <= arcR || (nx >= arcR && nx <= 1 - arcR && ny <= arcR);
      } else if (ny <= 0.68) {
        inside = nx >= 0 && nx <= 1;
      } else {
        const t  = (ny - 0.68) / 0.32;
        const hw = (1 - t) * 0.5;
        inside = Math.abs(nx - 0.5) <= hw;
      }

      if (inside) {
        const i = (y * size + x) * 4;
        rgba[i] = 255; rgba[i+1] = 255; rgba[i+2] = 255; rgba[i+3] = 255;
      }
    }
  }

  // ── Symbol inside shield (sizes ≥ 32) ─────────────────────────────────────
  if (size >= 32) {
    const sR = (palette.symbolHex >> 16) & 0xFF;
    const sG = (palette.symbolHex >>  8) & 0xFF;
    const sB = (palette.symbolHex      ) & 0xFF;
    const stroke = Math.max(1, Math.round(size * 0.055));

    if (palette.symbol === 'check') {
      const p1x = cx - size * 0.11, p1y = cy + size * 0.04;
      const p2x = cx - size * 0.02, p2y = cy + size * 0.13;
      const p3x = cx + size * 0.14, p3y = cy - size * 0.09;
      drawThickLine(rgba, size, p1x, p1y, p2x, p2y, stroke, sR, sG, sB);
      drawThickLine(rgba, size, p2x, p2y, p3x, p3y, stroke, sR, sG, sB);
    } else if (palette.symbol === 'exclaim') {
      // Exclamation mark: vertical stem + dot below
      const topY    = cy - size * 0.12;
      const stemEnd = cy + size * 0.05;
      const dotY    = cy + size * 0.14;
      drawThickLine(rgba, size, cx, topY, cx, stemEnd, stroke, sR, sG, sB);
      fillCircleAA(rgba, size, cx, dotY, stroke * 0.65, sR, sG, sB);
    }
  }

  return rgba;
}

// ── Generate all sizes × variants ─────────────────────────────────────────────
const SIZES = [16, 32, 48, 128];
const VARIANTS = [
  { name: '',        palette: PALETTES.blue  }, // default: icon{size}.png
  { name: '-green',  palette: PALETTES.green },
  { name: '-red',    palette: PALETTES.red   },
];

for (const variant of VARIANTS) {
  for (const sz of SIZES) {
    const rgba = drawIcon(sz, variant.palette);
    const png  = makePNG(sz, rgba);
    const file = path.join(outDir, `icon${sz}${variant.name}.png`);
    fs.writeFileSync(file, png);
    console.log(`  ✓  icons/icon${sz}${variant.name}.png  (${png.length} bytes)`);
  }
}

console.log('\n✅  Icons generated in icons/\n');
