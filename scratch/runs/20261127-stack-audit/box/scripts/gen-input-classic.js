#!/usr/bin/env node
// Print the --input= string that replays route.sh (boot -> tutorial level ->
// CYCLES gameplay cycles) without a control session. Same batch numbers as
// route.sh + cycle.sh: a key queued at a frozen batch boundary B is the same
// event as B:keydown. PNG checkpoints land in PNG_DIR when given.
//   node gen-input.js [CYCLES=6] [PNG_DIR]
'use strict';
const cycles = parseInt(process.argv[2] || '6', 10);
const pngDir = process.argv[3] || null;
const ev = [];
const at = (b, a) => ev.push(`${b}:${a}`);
const png = (b, name) => { if (pngDir) at(b, `png:${pngDir}/${name}`); };
png(21000, 'i-b21000-intro.png');
at(21000, 'keydown:13'); at(21020, 'keyup:13');
at(22020, 'keydown:13'); at(22040, 'keyup:13');
png(25040, 'i-b25040-title.png');
at(25040, 'keydown:37'); at(27440, 'keyup:37');
png(27740, 'i-b27740-start-door.png');
at(27740, 'keydown:38'); at(27800, 'keyup:38');
png(29000, 'i-b29000-tutorial.png');
for (let i = 0; i < cycles; i++) {
  const c = 29000 + i * 600;
  const shots = (i === 0 || i === 5) ? `i-cycle${i + 1}` : null;
  // run right + jump (Z), whip (X); run left + jump, whip  (cycle.sh)
  at(c, 'keydown:39'); at(c + 40, 'keydown:90');
  if (shots) png(c + 60, `${shots}-jumpR.png`);
  at(c + 80, 'keyup:90'); at(c + 150, 'keyup:39');
  at(c + 170, 'keydown:88');
  if (shots) png(c + 176, `${shots}-whipR.png`);
  at(c + 200, 'keyup:88');
  at(c + 300, 'keydown:37'); at(c + 340, 'keydown:90');
  if (shots) png(c + 360, `${shots}-jumpL.png`);
  at(c + 380, 'keyup:90'); at(c + 450, 'keyup:37');
  at(c + 470, 'keydown:88');
  if (shots) png(c + 476, `${shots}-whipL.png`);
  at(c + 500, 'keyup:88');
}
png(29000 + cycles * 600, 'i-end.png');
process.stdout.write(ev.join(','));
