#!/usr/bin/env node
// Derive the character sets the vendored Traditional Chinese face is cut to.
//
// Two lists, both committed under fonts/noto-sans-tc/:
//
//   repertoire-chars.txt — every code point the emulator's Big5 layer can
//     produce: the WHATWG Big5 index (the same TextDecoder('big5') source
//     tools/gen_big5_table.js builds the WAT decode table from), restricted
//     to the table's own domain, leads 0xA1..0xFE. tools/gen-noto-tc.py cuts
//     the vendored source statics to this, so the "full" font a host mounts
//     without subsetting still answers for anything CP950 can name.
//
//   subset-chars.txt — the deployed subset's repertoire: the Big5 symbol
//     block and first-level (common) kanji, the CP1252 repertoire every
//     other vendored face carries, and the characters one real Big5 corpus
//     — the RichMan 4 game files — actually uses, including second-level
//     characters the common set would miss. The game-derived portion is
//     frozen data: regenerate it with --game-dir=<extracted game folder>.
//     Without --game-dir the committed subset list is left untouched.
//
// Corpus extraction is a plausibility filter over the program's
// text-bearing files, not a raw scan of the whole folder. The remaining
// archives (.mkf graphics/audio containers) are low-entropy binary whose
// byte patterns decode as endless plausible pairs — measured: they alone
// "find" ~14,000 distinct characters, the whole repertoire, in noise.
// Text lives where the program keeps it: the executable's string tables
// (everything it draws through GDI) and the help book archive. Within
// those files a second filter applies: a large minority of random byte
// pairs decode as *some* Big5 character, and real text is mostly common
// characters while random decodings are mostly rare ones, so a maximal
// run of >= 3 valid pairs counts only when >= 60% of its characters are
// in the common set (symbol block + first-level kanji) — and then all of
// its characters count, which is how the genuine rare characters in real
// sentences (names, loanwords) get in.
//
// Usage:
//   node tools/big5_charset.js [--game-dir=<dir> [--game-text=<name>]...]
//                              [--check]
//
// --check verifies repertoire-chars.txt (and subset-chars.txt's non-game
// portion is not derivable without the corpus, so it is not checked).
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'fonts', 'noto-sans-tc');

const decoder = new TextDecoder('big5', { fatal: true });
function decodePair(lead, trail) {
  try {
    const s = decoder.decode(new Uint8Array([lead, trail]));
    return s.codePointAt(0);
  } catch {
    return 0;
  }
}
function isTrail(t) {
  return (t >= 0x40 && t <= 0x7e) || (t >= 0xa1 && t <= 0xfe);
}

// code point -> lowest Big5 code that produces it (scan order), over the
// exact domain of the WAT decode table: leads 0xA1..0xFE.
function big5Repertoire() {
  const map = new Map();
  for (let lead = 0xa1; lead <= 0xfe; lead++) {
    for (let trail = 0x40; trail <= 0xfe; trail++) {
      if (!isTrail(trail)) continue;
      const cp = decodePair(lead, trail);
      if (cp && !map.has(cp)) map.set(cp, (lead << 8) | trail);
    }
  }
  return map;
}

// The repertoire's own bands, by Big5 code: the symbol block below the
// first kanji, then the two kanji levels of the original Big5 layout.
function bandOf(code) {
  if (code < 0xa440) return 'symbols';
  if (code <= 0xc67e) return 'level1';
  if (code >= 0xc940 && code <= 0xf9d5) return 'level2';
  return 'other';
}

function cp1252Repertoire() {
  const out = new Set();
  for (let b = 0x20; b <= 0xff; b++) {
    try {
      out.add(new TextDecoder('windows-1252').decode(new Uint8Array([b])).codePointAt(0));
    } catch { /* undefined byte */ }
  }
  return out;
}

// Flat decode table over the WAT table's domain, built once: scanning a
// few hundred megabytes of game files through a fresh TextDecoder per byte
// pair would take minutes.
function decodeTable() {
  const table = new Uint16Array(0x100 * 0x100);
  for (let lead = 0xa1; lead <= 0xfe; lead++) {
    for (let trail = 0x40; trail <= 0xfe; trail++) {
      if (!isTrail(trail)) continue;
      table[(lead << 8) | trail] = decodePair(lead, trail);
    }
  }
  return table;
}

function gameChars(dir, table, common, textFiles) {
  const found = new Set();
  const walk = d => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      // Text-bearing files only: executables and DLLs (string tables) plus
      // the archives named by --game-text. Everything else in a game folder
      // is graphics/audio/code data, not encoded text.
      if (!/\.(exe|dll)$/i.test(name) && !textFiles.has(name)) continue;
      const buf = fs.readFileSync(p);
      let run = [];
      const flush = () => {
        if (run.length >= 3) {
          let hits = 0;
          for (const cp of run) if (common.has(cp)) hits++;
          if (hits * 5 >= run.length * 3) for (const cp of run) found.add(cp);
        }
        run = [];
      };
      for (let i = 0; i + 1 < buf.length; i++) {
        const cp = table[(buf[i] << 8) | buf[i + 1]];
        if (cp) { run.push(cp); i++; continue; }
        flush();
      }
      flush();
    }
  };
  walk(dir);
  return found;
}

function writeList(file, header, cps) {
  const lines = [...cps].sort((a, b) => a - b)
    .map(cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
  fs.writeFileSync(file, header + lines.join('\n') + '\n');
  return lines.length;
}

function readList(file) {
  return fs.readFileSync(file, 'utf8').split('\n')
    .filter(l => /^U\+[0-9A-F]+$/.test(l))
    .map(l => parseInt(l.slice(2), 16));
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const gameDirArg = args.find(a => a.startsWith('--game-dir='));
  const repertoire = big5Repertoire();
  const bands = { symbols: 0, level1: 0, level2: 0, other: 0 };
  for (const code of repertoire.values()) bands[bandOf(code)]++;

  const repFile = path.join(FONT_DIR, 'repertoire-chars.txt');
  const repHeader =
    '# Big5 repertoire: every code point the WHATWG Big5 index maps into\n' +
    '# the WAT decode table domain (leads 0xA1..0xFE). Generated by\n' +
    '# tools/big5_charset.js — do not hand-edit.\n' +
    `# ${repertoire.size} code points (symbols ${bands.symbols}, ` +
    `level-1 ${bands.level1}, level-2 ${bands.level2}, other ${bands.other}).\n`;

  if (check) {
    const committed = readList(repFile);
    const fresh = [...repertoire.keys()].sort((a, b) => a - b);
    if (JSON.stringify(committed) !== JSON.stringify(fresh)) {
      console.error('MISMATCH repertoire-chars.txt is stale; regenerate with tools/big5_charset.js');
      process.exit(1);
    }
    console.log(`ok   repertoire-chars.txt ${committed.length} code points`);
    return;
  }

  fs.mkdirSync(FONT_DIR, { recursive: true });
  const n = writeList(repFile, repHeader, repertoire.keys());
  console.log(`wrote ${path.relative(ROOT, repFile)}: ${n} code points`);

  if (!gameDirArg) {
    console.log('subset-chars.txt left untouched (no --game-dir given)');
    return;
  }
  const gameDir = gameDirArg.slice('--game-dir='.length);
  const textFiles = new Set(args
    .filter(a => a.startsWith('--game-text='))
    .map(a => a.slice('--game-text='.length)));
  const common = new Set();
  for (const [cp, code] of repertoire) {
    const band = bandOf(code);
    if (band === 'symbols' || band === 'level1') common.add(cp);
  }
  const game = gameChars(gameDir, decodeTable(), common, textFiles);
  const subset = new Set();
  for (let cp = 0x20; cp <= 0x7e; cp++) subset.add(cp);
  for (const cp of cp1252Repertoire()) subset.add(cp);
  for (const cp of common) subset.add(cp);
  let gameExtra = 0;
  for (const cp of game) {
    if (!subset.has(cp)) gameExtra++;
    subset.add(cp);
  }
  const subFile = path.join(FONT_DIR, 'subset-chars.txt');
  const subHeader =
    '# Deployed subset repertoire for the Traditional Chinese face:\n' +
    '# printable ASCII + the CP1252 repertoire + the Big5 symbol block and\n' +
    '# first-level (common) kanji + every character the corpus below uses.\n' +
    `# Corpus: ${game.size} distinct characters from plausible text runs\n` +
    '# (>= 3 valid Big5 pairs, >= 60% common characters) in the text-\n' +
    '# bearing files of the RichMan 4 folder (rich4.exe string tables,\n' +
    `# help.mkf help text; ${gameExtra} outside the common set).\n` +
    '# Generated by tools/big5_charset.js --game-dir=<extracted RichMan 4\n' +
    '# folder> --game-text=help.mkf — do not hand-edit.\n';
  const m = writeList(subFile, subHeader, subset);
  console.log(`wrote ${path.relative(ROOT, subFile)}: ${m} code points ` +
    `(game corpus ${game.size}, ${gameExtra} beyond the common set)`);
}

main();
