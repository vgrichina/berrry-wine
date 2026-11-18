#!/usr/bin/env node
'use strict';
// Cut a long gameplay recording into a short highlight from a JSON cut list.
//
//   node tools/highlight-clip.js CUTS.json [--out=clip.mp4] [--dry-run]
//
//   source.mp4 ──trim/speed/upscale──┐
//                                    ├─ concat ─▶ clip.mp4
//   per segment audio ───────────────┘
//     speed 1   : the segment's own sound
//     speed > 1 : a REAL-TIME "bed" range taken from the same recording
//                 (sped-up game audio is pitch-shifted or smeared, so it is
//                 never used; what you hear is the game, at its own speed)
//
// CUTS.json:
//   { "source": "rec.mp4", "width": 1440, "height": 1080, "fps": 30,
//     "font": "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
//     "segments": [
//       { "from": 600, "to": 604, "text": ["Title line", "smaller line"] },
//       { "from": 190, "to": 520, "speed": 20, "bed": 330, "bedVolume": 0.8 },
//       { "card": 3, "text": ["berrry.wine", "github.com/..."] } ] }
//   Paths are relative to the JSON file. Sped-up segments get a ">> N×" tag.
//   Upscaling is nearest-neighbour so pixel art stays crisp through the
//   platform's re-encode; finish with tools/twitter-clip.js to check caps.
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');

const argv = process.argv.slice(2);
const cutsPath = argv.find(a => !a.startsWith('--'));
if (!cutsPath) { console.error('usage: highlight-clip.js CUTS.json [--out=clip.mp4] [--dry-run]'); process.exit(2); }
const opt = k => (argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || null;
const base = path.dirname(path.resolve(cutsPath));
const cuts = JSON.parse(fs.readFileSync(cutsPath, 'utf8'));
const W = cuts.width || 1440, H = cuts.height || 1080, FPS = cuts.fps || 30;
const font = cuts.font || '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const source = path.resolve(base, cuts.source);
const out = path.resolve(opt('out') || path.join(base, 'highlight.mp4'));
const textDir = path.join(path.dirname(out), path.basename(out, '.mp4') + '-text');
fs.mkdirSync(textDir, { recursive: true });

// drawtext reads text from files: no escaping of ':' ',' '\'' in captions.
let nText = 0;
const textFile = s => { const f = path.join(textDir, `t${nText++}.txt`); fs.writeFileSync(f, s); return f; };
const esc = p => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
const draw = (s, size, y, extra = '') =>
  `drawtext=fontfile='${esc(font)}':textfile='${esc(textFile(s))}':fontsize=${size}:fontcolor=white` +
  `:borderw=${Math.max(2, size >> 4)}:bordercolor=black@0.85:x=(w-text_w)/2:y=${y}${extra}`;
const AFMT = 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo';
const XF = 0.04; // audio fade at each join so cuts do not click

const parts = [];
let total = 0;
cuts.segments.forEach((s, i) => {
  if (s.card) {
    const lines = s.text || [];
    const v = [`color=c=black:s=${W}x${H}:r=${FPS}:d=${s.card}`, 'format=yuv420p',
      ...lines.map((t, k) => draw(t, k ? 44 : 110, k ? `h/2+${40 + 60 * (k - 1)}` : 'h/2-110')),
      `fade=t=in:st=0:d=0.3`].join(',');
    parts.push({ v: `${v}[v${i}]`, a: `anullsrc=r=44100:cl=stereo,atrim=0:${s.card},${AFMT}[a${i}]` });
    total += s.card;
    return;
  }
  const speed = s.speed || 1, dur = (s.to - s.from) / speed;
  const vf = [`[0:v]trim=${s.from}:${s.to}`, `setpts=(PTS-STARTPTS)/${speed}`, `fps=${FPS}`,
    `scale=${W}:${H}:flags=neighbor`, 'setsar=1', 'format=yuv420p'];
  // Plain ASCII ">>": Arial has no U+25B6, and a missing glyph draws nothing.
  if (speed > 1) vf.push(draw(`>> ${speed}×`, 40, 60, ':x=w-text_w-28:box=1:boxcolor=black@0.5:boxborderw=10'));
  // Captions sit near the top, over the map, not on the game's bottom HUD.
  (s.text || []).forEach((t, k) => vf.push(draw(t, k ? 42 : 66, k ? 170 : 80,
    `:box=1:boxcolor=black@0.55:boxborderw=14:enable='lt(t,${s.textFor || dur})'`)));
  let a;
  // An explicit bed wins even at speed 1 (e.g. carry music under a quiet hook).
  if (speed === 1 && s.bed == null) a = `[0:a]atrim=${s.from}:${s.to},asetpts=PTS-STARTPTS`;
  else if (s.bed != null) a = `[0:a]atrim=${s.bed}:${s.bed + dur},asetpts=PTS-STARTPTS,volume=${s.bedVolume ?? 0.8}`;
  else a = `anullsrc=r=44100:cl=stereo,atrim=0:${dur}`;
  a += `,${AFMT},afade=t=in:d=${XF},afade=t=out:st=${Math.max(0, dur - XF)}:d=${XF}`;
  parts.push({ v: vf.join(',') + `[v${i}]`, a: `${a}[a${i}]` });
  total += dur;
});
const n = parts.length;
const graph = [...parts.flatMap(p => [p.v, p.a]),
  parts.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${n}:v=1:a=1[v][a]`].join(';\n');
fs.writeFileSync(path.join(textDir, 'filter.txt'), graph);
console.log(`highlight: ${n} segments, ${total.toFixed(1)}s -> ${out}`);
if (argv.includes('--dry-run')) { console.log(graph); process.exit(0); }
const args = ['-v', 'error', '-y', '-i', source, '-filter_complex_script', path.join(textDir, 'filter.txt'),
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out];
try { execFileSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'pipe'] }); }
catch (e) { console.error(String(e.stderr || e.message)); process.exit(1); }
const d = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`highlight: wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${Number(d).toFixed(2)}s)`);
