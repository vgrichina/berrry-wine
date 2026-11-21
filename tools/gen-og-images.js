#!/usr/bin/env node
// One 1200x630 Open Graph card per app screenshot.
//
//   node tools/gen-og-images.js [--in=screenshots/apps] [--out=screenshots/og] [id ...]
//
// Every app page used to share icons/og-image.png, so a link to the
// Minesweeper page unfurled as a picture of Pinball. This puts the app's own
// (window-cropped) capture at the 1200x630 the link previews want, so the card
// shows the program the page is about -- and only the program:
//
//   +-------------------------------------------+  backdrop: the same capture,
//   |░░░░░░░+-----------------------+░░░░░░░░░░|  scaled to COVER the card,
//   |░blur░░|   capture, full card  |░░blur░░░░|  blurred and darkened, so the
//   |░░░░░░░|   height, nearest     |░░░░░░░░░░|  margins carry the game's own
//   |░░░░░░░+-----------------------+░░░░░░░░░░|  colours instead of a desktop
//   +-------------------------------------------+
//
// Scaling: a capture that fits a whole-number enlargement of at least 2x gets
// it (a 170x251 Minesweeper stays a crisp 2x); otherwise it is scaled to the
// card's height -- nearest-neighbour when enlarging, so pixel art stays hard
// edged, box-averaged when shrinking. Aspect ratio is always kept. No text is
// drawn: the unfurl already prints the page title beside the picture.
//
// The cards are generated, not committed: tools/gen-site-pages.js calls
// ogCard() for each app page it writes, and tools/deploy-berrry.js uploads the
// directory. This CLI exists to run or inspect the step on its own.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const W = 1200, H = 630;
const BLUR_W = 48, BLUR_H = 25; // backdrop detail: one cell per ~25 card px
const BACKDROP_DIM = 0.45;      // backdrop brightness, so the capture stands out

// Nearest-neighbour resize to w x h (whole or fractional factor).
function nearest(src, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, (y * src.height / h) | 0);
    for (let x = 0; x < w; x++) {
      const si = (sy * src.width + Math.min(src.width - 1, (x * src.width / w) | 0)) * 4, o = (y * w + x) * 4;
      out.data[o] = src.data[si]; out.data[o + 1] = src.data[si + 1]; out.data[o + 2] = src.data[si + 2]; out.data[o + 3] = 255;
    }
  }
  return out;
}

// Box-average shrink of the source rectangle (cx, cy, cw, ch) to w x h.
function downscale(src, w, h, cx = 0, cy = 0, cw = src.width, ch = src.height) {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    const sy0 = cy + Math.floor(y * ch / h), sy1 = Math.max(sy0 + 1, cy + Math.floor((y + 1) * ch / h));
    for (let x = 0; x < w; x++) {
      const sx0 = cx + Math.floor(x * cw / w), sx1 = Math.max(sx0 + 1, cx + Math.floor((x + 1) * cw / w));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
        const i = (sy * src.width + sx) * 4; r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; n++;
      }
      const o = (y * w + x) * 4;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
    }
  }
  return out;
}

// Bilinear enlargement of a tiny image to w x h, scaled by `dim`: the blur.
function smoothUp(src, w, h, dim) {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, Math.min(src.height - 1, (y + 0.5) * src.height / h - 0.5));
    const y0 = fy | 0, y1 = Math.min(src.height - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, Math.min(src.width - 1, (x + 0.5) * src.width / w - 0.5));
      const x0 = fx | 0, x1 = Math.min(src.width - 1, x0 + 1), tx = fx - x0, o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const p = (yy, xx) => src.data[(yy * src.width + xx) * 4 + c];
        const top = p(y0, x0) * (1 - tx) + p(y0, x1) * tx, bot = p(y1, x0) * (1 - tx) + p(y1, x1) * tx;
        out.data[o + c] = (top * (1 - ty) + bot * ty) * dim;
      }
      out.data[o + 3] = 255;
    }
  }
  return out;
}

// The capture scaled to cover the card (centre crop), blurred and darkened.
function backdrop(shot) {
  const s = Math.max(W / shot.width, H / shot.height);
  const cw = Math.min(shot.width, Math.round(W / s)), ch = Math.min(shot.height, Math.round(H / s));
  const tiny = downscale(shot, BLUR_W, BLUR_H, (shot.width - cw) >> 1, (shot.height - ch) >> 1, cw, ch);
  return smoothUp(tiny, W, H, BACKDROP_DIM);
}

function fitted(shot) {
  const k = Math.floor(Math.min(W / shot.width, H / shot.height));
  if (k >= 2) return nearest(shot, shot.width * k, shot.height * k);
  const s = Math.min(W / shot.width, H / shot.height);
  const w = Math.max(1, Math.round(shot.width * s)), h = Math.max(1, Math.round(shot.height * s));
  if (s === 1) return shot;
  return s > 1 ? nearest(shot, w, h) : downscale(shot, w, h);
}

// Captures are cropped to the window but often keep a few rows of the Win98
// desktop around it. Peel off any edge row/column that is (almost) all
// desktop teal, so neither the card nor its blurred backdrop shows desktop.
const DESKTOP = [0, 128, 128];
function trimDesktop(shot) {
  const isDesk = (x, y) => {
    const i = (y * shot.width + x) * 4;
    return Math.abs(shot.data[i] - DESKTOP[0]) + Math.abs(shot.data[i + 1] - DESKTOP[1]) + Math.abs(shot.data[i + 2] - DESKTOP[2]) < 24;
  };
  const rowDesk = (y, x0, x1) => { let n = 0; for (let x = x0; x < x1; x++) n += isDesk(x, y); return n >= 0.9 * (x1 - x0); };
  const colDesk = (x, y0, y1) => { let n = 0; for (let y = y0; y < y1; y++) n += isDesk(x, y); return n >= 0.9 * (y1 - y0); };
  let x0 = 0, y0 = 0, x1 = shot.width, y1 = shot.height;
  for (let changed = true; changed;) {
    changed = false;
    if (y1 - y0 > 8 && rowDesk(y0, x0, x1)) { y0++; changed = true; }
    if (y1 - y0 > 8 && rowDesk(y1 - 1, x0, x1)) { y1--; changed = true; }
    if (x1 - x0 > 8 && colDesk(x0, y0, y1)) { x0++; changed = true; }
    if (x1 - x0 > 8 && colDesk(x1 - 1, y0, y1)) { x1--; changed = true; }
  }
  if (x0 === 0 && y0 === 0 && x1 === shot.width && y1 === shot.height) return { shot, trimmed: false };
  const out = new PNG({ width: x1 - x0, height: y1 - y0 });
  PNG.bitblt(shot, out, x0, y0, x1 - x0, y1 - y0, 0, 0);
  return { shot: out, trimmed: true };
}

// A Win98 caption bar: a row near the top that is mostly the active-caption
// navy-to-blue gradient (or the inactive grey one, which reads as windowed too).
function hasCaption(shot) {
  for (let y = 0; y < Math.min(32, shot.height); y++) {
    let n = 0;
    for (let x = 0; x < shot.width; x++) {
      const i = (y * shot.width + x) * 4, r = shot.data[i], g = shot.data[i + 1], b = shot.data[i + 2];
      if (r < 40 && b >= 110 && b > g + 40) n++;
    }
    if (n >= 0.6 * shot.width) return true;
  }
  return false;
}

// Windowed program: the window on the Win98 desktop, as it would look there.
const MARGIN = 40, SHADOW = 10, SHADOW_RGB = [0, 72, 72];
const MIN_WIDTH = 0.5, MAX_ZOOM = 3.5;
function desktopCard(shot) {
  const card = new PNG({ width: W, height: H });
  const put = (x0, y0, w, h, rgb) => {
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
      const o = (y * W + x) * 4; card.data[o] = rgb[0]; card.data[o + 1] = rgb[1]; card.data[o + 2] = rgb[2]; card.data[o + 3] = 255;
    }
  };
  put(0, 0, W, H, DESKTOP);
  const maxW = W - 2 * MARGIN, maxH = H - 2 * MARGIN;
  // Fill the card: fit the window inside the margins at any scale, but never
  // narrower than MIN_WIDTH of the card -- a tall window (Minesweeper) is
  // zoomed to that width instead and runs off the bottom edge, top kept.
  const s = Math.min(maxW / shot.width, Math.max(maxH / shot.height, MIN_WIDTH * W / shot.width), MAX_ZOOM);
  const w = Math.max(1, Math.round(shot.width * s)), h = Math.max(1, Math.round(shot.height * s));
  const img = s === 1 ? shot : s > 1 ? nearest(shot, w, h) : downscale(shot, w, h);
  const x = ((W - img.width) / 2) | 0, y = img.height > maxH ? MARGIN : ((H - img.height) / 2) | 0;
  put(x + SHADOW, y + SHADOW, img.width, img.height, SHADOW_RGB);
  PNG.bitblt(img, card, 0, 0, img.width, Math.min(img.height, H - y), x, y);
  return { card, img };
}

// Fullscreen game: the capture at card height over its own blurred backdrop.
function gameCard(shot) {
  const img = fitted(shot), card = backdrop(shot);
  PNG.bitblt(img, card, 0, 0, img.width, img.height, ((W - img.width) / 2) | 0, ((H - img.height) / 2) | 0);
  return { card, img };
}

function ogCard(shotFile, outFile) {
  const { shot, trimmed } = trimDesktop(PNG.sync.read(fs.readFileSync(shotFile)));
  const windowed = trimmed || hasCaption(shot);
  const { card, img } = windowed ? desktopCard(shot) : gameCard(shot);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, PNG.sync.write(card));
  return { from: `${shot.width}x${shot.height}`, placed: `${img.width}x${img.height}`, kind: windowed ? "desktop" : "game" };
}

module.exports = { ogCard, W, H };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name, def) => { const a = args.find(s => s.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def; };
  const inDir = opt('in', 'screenshots/apps'), outDir = opt('out', 'screenshots/og');
  const only = args.filter(a => !a.startsWith('--'));
  const ids = only.length ? only : fs.readdirSync(inDir).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4));
  for (const id of ids) {
    const r = ogCard(path.join(inDir, `${id}.png`), path.join(outDir, `${id}.png`));
    console.log(`${id.padEnd(16)} ${r.from} -> ${r.placed} on ${W}x${H} (${r.kind})`);
  }
}
