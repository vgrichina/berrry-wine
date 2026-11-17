#!/usr/bin/env node
'use strict';

// Which binaries in the corpus name a GL entry point the WAT mirror cannot
// reproduce?  `node tools/gl-name-census.js [path ...] [--families=a,b]
// [--list] [--json]`
//
// WHY THIS IS A STRING SEARCH AND NOT AN IMPORT WALK. Every GL engine we run
// resolves GL through GetProcAddress rather than the import table -- Quake II's
// QGL layer and GoldSrc both do -- so `tools/pe-imports.js ref_gl.dll` lists
// KERNEL32, USER32 and GDI32 and no OpenGL at all. The names are still in the
// file as literals, because that is what GetProcAddress is handed. So the
// strings are the only static evidence there is.
//
// WHAT A HIT MEANS, AND WHAT IT DOES NOT. A hit means the binary can reach
// that entry point. It does NOT mean it calls it on any route we run: Quake
// II's ref_gl.dll names glPushAttrib and a 40000-batch menu census counted
// zero calls to it. This is the same static-reach-versus-hotness distinction
// that tools/find-loops.js carries, and it cuts the same way -- use this to
// decide what MIGHT matter, and `test/run.js --gl-census` to find out what
// did.
//
// TWO KINDS OF HIT, AND ONLY ONE OF THEM IS EVIDENCE. A binary that
// IMPLEMENTS or LOADS the whole GL API names all of it by construction: the
// 3dfx/PowerVR MCDs (`3dfxgl.dll`, `pvrgl.dll`), and SDL, whose GL loader
// table is the same list in every DOSBox and ScummVM build in the corpus. A
// hit in one of those says nothing about any app. The hits that mean something
// are engine and game code -- Quake II's `ref_gl.dll`, whose QGL table is
// hand-written and lists only what the renderer actually uses, GoldSrc's
// `hw.dll`, the Unreal `opengldrv.dll`s, `IDDemo.exe`. Read the --list output
// and sort the rows yourself; the percentage alone is an upper bound.
//
// The point of the count is the mirror in src/09a8f-gl-matrix.wat, which
// latches UNTRUSTED on any family it cannot follow and then refuses to build
// a descriptor at all. A family named by one binary is a one-app problem; one
// named by most of them is a gate on the whole approach.

const fs = require('fs');
const path = require('path');

const { CALLS } = require('../lib/gl-command-stream.js');

// The families src/09a8f-gl-matrix.wat does not mirror. Kept as a default
// rather than read from the WAT, because the honest version of this question
// is "what would it cost to mirror X", which needs names that are not in that
// list yet.
const DEFAULT_FAMILIES = ['glPushAttrib', 'glPopAttrib'];

// A binary counts as a GL user if it names any of these. wgl* is the giveaway
// for a Win32 GL program specifically; glBegin catches a renderer DLL that
// leaves context creation to its host.
const MARKERS = ['wglCreateContext', 'wglMakeCurrent', 'glBegin', 'glViewport'];

// A substring search per name, not a strings(1)-style scan of every printable
// run. The corpus is gigabytes and the run scan was a per-byte JavaScript loop
// over all of it; Buffer.indexOf is native, so this is the difference between
// a tool that finishes and one that does not. A GL name is distinctive enough
// that substring matching needs no word boundary: nothing else in a PE
// contains "glPushAttrib".
function namesIn(buffer, wanted) {
  const found = new Set();
  for (const name of wanted) {
    if (buffer.indexOf(name, 0, 'latin1') >= 0) found.add(name);
  }
  return found;
}

function* walk(root) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    // Symlinked directories are how test/binaries is assembled, and skipping
    // them would silently scan nothing at all -- but following one can loop,
    // so directories are resolved and visited at most once (see seen below).
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) yield* walkOnce(full);
    else if (stat.isFile()) yield full;
  }
}

const seen = new Set();
function* walkOnce(dir) {
  const real = fs.realpathSync(dir);
  if (seen.has(real)) return;
  seen.add(real);
  yield* walk(dir);
}

function main(argv) {
  const flags = argv.filter(a => a.startsWith('--'));
  const roots = argv.filter(a => !a.startsWith('--'));
  const flag = name => flags.find(f => f.startsWith(`--${name}=`))?.split('=')[1];
  const families = (flag('families') || DEFAULT_FAMILIES.join(',')).split(',');
  const list = flags.includes('--list');
  const json = flags.includes('--json');

  const wanted = new Set([...families, ...MARKERS]);
  const glCalls = new Set(CALLS);
  for (const name of families) {
    if (!glCalls.has(name)) {
      console.error(`[gl-name-census] note: ${name} is not in lib/gl-command-stream.js`
        + ' CALLS, so no run can ever count it -- the mirror cannot see it either');
    }
  }

  const scanned = [];
  for (const root of (roots.length ? roots : ['test/binaries'])) {
    for (const file of walkOnce(root)) {
      let buffer;
      try { buffer = fs.readFileSync(file); } catch { continue; }
      if (buffer.length < 64 || buffer.readUInt16LE(0) !== 0x5a4d) continue; // 'MZ'
      const found = namesIn(buffer, wanted);
      if (!MARKERS.some(m => found.has(m))) continue;
      scanned.push({ file, families: families.filter(f => found.has(f)) });
    }
  }

  const counts = {};
  for (const name of families) {
    counts[name] = scanned.filter(row => row.families.includes(name)).length;
  }

  if (json) {
    console.log(JSON.stringify({ glBinaries: scanned.length, counts, scanned }, null, 2));
    return 0;
  }

  console.log(`[gl-name-census] ${scanned.length} GL-using binaries`
    + ` (named at least one of ${MARKERS.join(', ')})`);
  for (const name of families) {
    const n = counts[name];
    console.log(`  ${String(n).padStart(4)}  ${name}`
      + (scanned.length ? `  (${(100 * n / scanned.length).toFixed(0)}%)` : ''));
  }
  if (list) {
    for (const row of scanned) {
      if (row.families.length) console.log(`  ${row.file}: ${row.families.join(', ')}`);
    }
  }
  console.log('[gl-name-census] static reach, not hotness -- a name here means the'
    + ' binary CAN reach it; only --gl-census on a real route says it did.');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { namesIn };
