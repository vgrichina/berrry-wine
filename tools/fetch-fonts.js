#!/usr/bin/env node
'use strict';

// Fetch and build the optional Traditional Chinese (CP950) Ming face.
//
// Nothing this produces is committed. Win98's Traditional Chinese edition drew
// its UI and document text in MingLiU / PMingLiU (細明體 / 新細明體), a Ming
// face with hand-tuned 1-bit bitmap strikes at the small UI sizes. Microsoft's
// MINGLIU.TTC cannot be redistributed, so two sources are supported:
//
//   1. the open default, AR PL UMing TW (face 2 of uming.ttc), downloaded from
//      a pinned Debian source tarball and verified by SHA-256. It carries
//      Firefly's 11-16 px Big5 bitmap strikes, which is what gives it the
//      Win98 small-size look;
//   2. a user-supplied MINGLIU.TTC (--mingliu PATH), processed the same way.
//
// Each is cut to the CP950 repertoire plus ASCII by tools/gen-font-subsets.sh
// with its existing per-font `keep` strike policy, so the EBDT/EBLC tables
// survive, and written as a two-face collection whose faces answer to the
// names a CP950 application asks for. The UMing build is renamed MingLiU /
// PMingLiU (and 細明體 / 新細明體) so both sources are drop-in replacements for
// C:\WINDOWS\FONTS\MINGLIU.TTC; the WAT collection loader then registers each
// face by its own name table, exactly as it would the real file. The Arphic
// Public License explicitly permits renaming and requires a prominent notice
// of how and when the file changed, which goes in name IDs 0 and 10.
//
// Output (gitignored):
//   fonts/fetched/mingliu.ttc        user's MINGLIU.TTC, subset (if supplied)
//   fonts/fetched/mingliu-uming.ttc  AR PL UMing TW stand-in
//   fonts/fetched/ARPHICPL.TXT       Arphic Public License, from the tarball
//   fonts/fetched/fetched.json       what is present, read by the hosts
//
// Absence is the normal state: hosts mount these only for an app whose
// registry entry sets `ansiCodePage: 950` (or test/run.js --codepage=950),
// and only when the files exist. See fonts/README.md.
//
//   node tools/fetch-fonts.js                    # fetch (cached) + build UMing
//   node tools/fetch-fonts.js --mingliu PATH     # also build the user's file
//   node tools/fetch-fonts.js --check [...]      # rebuild in a temp dir and
//                                                # require byte-identical output
//   options: --out DIR  --cache DIR  --tarball FILE  --offline  --no-uming
//
// Needs network on first run (once; the tarball is cached under
// .cache/fonts/), system `tar`, and fontTools (pip install fonttools).

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

const UMING = Object.freeze({
  url: 'https://deb.debian.org/debian/pool/main/f/fonts-arphic-uming/' +
    'fonts-arphic-uming_0.2.20080216.2.orig.tar.bz2',
  file: 'fonts-arphic-uming_0.2.20080216.2.orig.tar.bz2',
  sha256: 'e3c19e04ea7a565b4acff6f1e4248084d2e10752e305bf7dd6c76e80860dc1db',
  bytes: 9608089,
  member: 'ttf-arphic-uming-0.2.20080216.2/uming.ttc',
  license: 'ttf-arphic-uming-0.2.20080216.2/license/english/ARPHICPL.TXT',
  faceIndex: 2,
  family: 'AR PL UMing TW',
});

// The faces a Traditional Chinese Win98 installed from MINGLIU.TTC, in
// collection order. English family names first, then the zh-TW localized ones.
const MING_FACES = Object.freeze([
  { family: 'MingLiU', localized: '細明體', postscript: 'MingLiU' },
  { family: 'PMingLiU', localized: '新細明體', postscript: 'PMingLiU' },
]);

// Fixed so the output is reproducible: the "when" of the APL 2(a) notice is
// the date this transformation was written, not the date a build ran.
const MODIFIED_ON = '2026-10-31';

const OUTPUTS = Object.freeze({
  user: 'mingliu.ttc',
  uming: 'mingliu-uming.ttc',
  license: 'ARPHICPL.TXT',
  manifest: 'fetched.json',
});

// ---- small sfnt readers (no fontTools needed to inspect results) ---------

function sfntTables(buf, base = 0) {
  const n = buf.readUInt16BE(base + 4);
  const tables = new Map();
  for (let i = 0; i < n; i++) {
    const r = base + 12 + i * 16;
    tables.set(buf.toString('latin1', r, r + 4),
      { offset: buf.readUInt32BE(r + 8), length: buf.readUInt32BE(r + 12) });
  }
  return tables;
}

// Offsets of each face's table directory: [0] for a bare TTF.
function faceOffsets(buf) {
  if (buf.toString('latin1', 0, 4) !== 'ttcf') return [0];
  const count = buf.readUInt32BE(8);
  return Array.from({ length: count }, (_, i) => buf.readUInt32BE(12 + i * 4));
}

function nameRecords(buf, base = 0) {
  const t = sfntTables(buf, base).get('name');
  if (!t) return [];
  const count = buf.readUInt16BE(t.offset + 2);
  const strings = t.offset + buf.readUInt16BE(t.offset + 4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = t.offset + 6 + i * 12;
    const platform = buf.readUInt16BE(r), encoding = buf.readUInt16BE(r + 2);
    const language = buf.readUInt16BE(r + 4), nameId = buf.readUInt16BE(r + 6);
    const len = buf.readUInt16BE(r + 8), off = strings + buf.readUInt16BE(r + 10);
    const raw = buf.subarray(off, off + len);
    let text;
    if (platform === 0 || platform === 3) {
      const be = Buffer.from(raw);
      text = be.swap16().toString('utf16le');
    } else {
      text = raw.toString('latin1');
    }
    out.push({ platform, encoding, language, nameId, text });
  }
  return out;
}

// The English (Windows, then Mac) family name of one face.
function familyName(buf, base = 0) {
  const recs = nameRecords(buf, base).filter(r => r.nameId === 1);
  const pick = recs.find(r => r.platform === 3 && r.language === 0x409) ||
    recs.find(r => r.platform === 1 && r.language === 0) || recs[0];
  return pick ? pick.text : null;
}

// ppem of each EBLC bitmapSizeTable, in file order.
function strikeSizes(buf, base = 0) {
  const t = sfntTables(buf, base).get('EBLC');
  if (!t) return [];
  const n = buf.readUInt32BE(t.offset + 4);
  const sizes = [];
  for (let i = 0; i < n; i++) {
    const s = t.offset + 8 + i * 48;
    sizes.push({ ppemX: buf[s + 44], ppemY: buf[s + 45], bitDepth: buf[s + 46],
      glyphs: buf.readUInt16BE(s + 42) - buf.readUInt16BE(s + 40) + 1 });
  }
  return sizes;
}

// ---- process helpers ----------------------------------------------------

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 << 20, ...opts });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}):\n` +
      String(r.stderr || '') + String(r.stdout || ''));
  }
  return String(r.stdout || '');
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function requireFontTools() {
  const r = spawnSync('python3', ['-c', 'import fontTools'], { stdio: 'ignore' });
  if (r.status !== 0) throw new Error('fontTools not installed: pip install fonttools');
}

function fonttools(args) { return run('python3', ['-m', 'fontTools.ttLib', ...args]); }
function ttx(args) { return run('python3', ['-m', 'fontTools.ttx', ...args]); }

// ---- download -----------------------------------------------------------

function download(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (!redirects) return reject(new Error(`too many redirects: ${url}`));
        return resolve(download(new URL(res.headers.location, url).href, dest,
          redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`GET ${url}: HTTP ${res.statusCode}`));
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

// Returns the verified tarball path. A cached copy is reused and re-verified;
// a mismatch is fatal rather than silently re-fetched, because it means the
// pinned bytes are not what is on disk.
async function ensureTarball({ cache, tarball, offline, log }) {
  const verify = file => {
    const got = sha256(file);
    if (got !== UMING.sha256) {
      throw new Error(`SHA-256 mismatch for ${file}\n  expected ${UMING.sha256}\n` +
        `  got      ${got}\nRefusing to use it. Delete it to re-download.`);
    }
    return file;
  };
  if (tarball) return verify(path.resolve(tarball));
  const cached = path.join(cache, UMING.file);
  if (fs.existsSync(cached)) {
    log(`cache  ${path.relative(ROOT, cached) || cached}`);
    return verify(cached);
  }
  if (offline) throw new Error(`--offline and no cached ${cached}`);
  fs.mkdirSync(cache, { recursive: true });
  const part = cached + '.part';
  log(`fetch  ${UMING.url}`);
  await download(UMING.url, part);
  try { verify(part); } catch (e) { fs.rmSync(part, { force: true }); throw e; }
  fs.renameSync(part, cached);
  return cached;
}

// ---- name rewriting (ttx XML, fontTools CLI only) -----------------------

function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nameRecordXml(nameId, platform, encoding, language, text) {
  const uni = platform === 1 ? ' unicode="True"' : '';
  return `    <namerecord nameID="${nameId}" platformID="${platform}" ` +
    `platEncID="${encoding}" langID="0x${language.toString(16)}"${uni}>\n` +
    `      ${xmlEscape(text)}\n    </namerecord>\n`;
}

// Rewrite the identifying name records of `src` into `dest`. The copyright
// gains the APL 2(a) modification notice; every other record (license, URL,
// version, the font's own localized strings for other IDs) is kept.
function renameFace(src, dest, face, notice, work) {
  const xmlPath = path.join(work, `${face.postscript}.name.ttx`);
  ttx(['-q', '-t', 'name', '-o', xmlPath, src]);
  let xml = fs.readFileSync(xmlPath, 'utf8');
  const REPLACED = new Set([1, 3, 4, 6, 10, 16, 17]);
  xml = xml.replace(/ *<namerecord nameID="(\d+)"[^>]*>[\s\S]*?<\/namerecord>\n/g,
    (all, id) => (REPLACED.has(Number(id)) ? '' : all));
  xml = xml.replace(/(<namerecord nameID="0"[^>]*>\s*)([\s\S]*?)(\s*<\/namerecord>)/g,
    (all, open, text, close) => open + text + ' ' + xmlEscape(notice) + close);
  let records = '';
  for (const [platform, encoding, language] of [[1, 0, 0], [3, 1, 0x409]]) {
    records += nameRecordXml(1, platform, encoding, language, face.family);
    records += nameRecordXml(3, platform, encoding, language,
      `wine-assembly ${face.family} stand-in from ${UMING.family}`);
    records += nameRecordXml(4, platform, encoding, language, face.family);
    records += nameRecordXml(6, platform, encoding, language, face.postscript);
    records += nameRecordXml(10, platform, encoding, language, notice);
  }
  records += nameRecordXml(1, 3, 1, 0x404, face.localized);
  records += nameRecordXml(4, 3, 1, 0x404, face.localized);
  xml = xml.replace('  </name>', records + '  </name>');
  fs.writeFileSync(xmlPath, xml);
  ttx(['-q', '--no-recalc-timestamp', '-m', src, '-o', dest, xmlPath]);
}

// ---- build steps ---------------------------------------------------------

function extractFace(ttc, index, dest) {
  fonttools(['-y', String(index), '--no-recalc-timestamp', ttc, '-o', dest]);
}

function subsetCp950(src, dest, subsetScript) {
  run('bash', [subsetScript, '--one', src, dest, 'cp950', 'keep']);
}

function collect(faces, dest) {
  fonttools(['--no-recalc-timestamp', ...faces, '-o', dest]);
}

// Build the AR PL UMing TW stand-in from a verified tarball.
function buildUming({ tarballPath, out, work, subsetScript, log }) {
  const x = path.join(work, 'uming-src');
  fs.mkdirSync(x, { recursive: true });
  run('tar', ['-xjf', tarballPath, '-C', x, UMING.member, UMING.license]);
  const ttc = path.join(x, UMING.member);
  const buf = fs.readFileSync(ttc);
  const offsets = faceOffsets(buf);
  // Verify the face by its name, not by its index.
  const want = offsets.findIndex(off => familyName(buf, off) === UMING.family);
  if (want < 0) {
    throw new Error(`${UMING.member} has no face named "${UMING.family}" ` +
      `(faces: ${offsets.map(o => familyName(buf, o)).join(', ')})`);
  }
  if (want !== UMING.faceIndex) {
    throw new Error(`"${UMING.family}" is face ${want}, expected ${UMING.faceIndex}: ` +
      'the pinned tarball changed shape');
  }
  const face = path.join(work, 'uming-tw.ttf');
  extractFace(ttc, want, face);
  log(`face   ${UMING.family} = uming.ttc #${want}`);
  const sub = path.join(work, 'uming-tw-cp950.ttf');
  subsetCp950(face, sub, subsetScript);
  const notice = `Modified ${MODIFIED_ON} by wine-assembly tools/fetch-fonts.js: ` +
    `face ${want} (${UMING.family}) of uming.ttc from ${UMING.file} ` +
    '(Debian), subset to the CP950 (Big5) repertoire plus ASCII keeping its ' +
    'EBDT/EBLC bitmap strikes, renamed MingLiU/PMingLiU as a substitute. ' +
    'Distributed under the ARPHIC PUBLIC LICENSE (ARPHICPL.TXT).';
  const dest = buildStandIn({ subset: sub, dest: path.join(out, OUTPUTS.uming),
    notice, work });
  fs.copyFileSync(path.join(x, UMING.license), path.join(out, OUTPUTS.license));
  return dest;
}

// One subset face -> a MingLiU/PMingLiU two-face collection. The faces share
// every table but `name`, so the collection costs about one face.
function buildStandIn({ subset, dest, notice, work }) {
  const renamed = MING_FACES.map(f => {
    const face = path.join(work, `standin-${f.postscript}.ttf`);
    renameFace(subset, face, f, notice, work);
    return face;
  });
  collect(renamed, dest);
  return dest;
}

// Subset a user's MINGLIU.TTC, both faces, strikes kept, names untouched.
// `expect` defaults to MingLiU/PMingLiU; tests pass their fixture's names.
function buildUserCollection({ src, out, work, subsetScript, log,
  expect = MING_FACES.map(f => f.family), destName = OUTPUTS.user }) {
  const buf = fs.readFileSync(src);
  const offsets = faceOffsets(buf);
  const names = offsets.map(o => familyName(buf, o));
  const subs = expect.map((family, i) => {
    const index = names.indexOf(family);
    if (index < 0) {
      throw new Error(`${src}: no face named "${family}" (faces: ${names.join(', ')})`);
    }
    const one = path.join(work, `user-${i}.ttf`);
    if (buf.toString('latin1', 0, 4) === 'ttcf') extractFace(src, index, one);
    else fs.copyFileSync(src, one);
    const sub = path.join(work, `user-${i}-cp950.ttf`);
    subsetCp950(one, sub, subsetScript);
    log(`face   ${family} = #${index}`);
    return sub;
  });
  const dest = path.join(out, destName);
  if (subs.length === 1) fs.copyFileSync(subs[0], dest);
  else collect(subs, dest);
  return dest;
}

// What the hosts read: present files, their hashes, sizes and strike ppems.
// Deterministic (no timestamps), so --check covers it too.
function writeManifest(out) {
  const files = {};
  for (const [kind, name] of [['user', OUTPUTS.user], ['uming', OUTPUTS.uming]]) {
    const file = path.join(out, name);
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    const offsets = faceOffsets(buf);
    files[name] = {
      source: kind === 'user' ? 'user-supplied MINGLIU.TTC'
        : `${UMING.family}, ${UMING.url} sha256 ${UMING.sha256}`,
      license: kind === 'user' ? 'Microsoft; user-supplied, never redistributed'
        : 'ARPHIC PUBLIC LICENSE (ARPHICPL.TXT)',
      bytes: buf.length,
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
      faces: offsets.map(o => familyName(buf, o)),
      strikes: [...new Set(strikeSizes(buf, offsets[0]).map(s => s.ppemY))],
    };
  }
  const manifest = { generator: 'tools/fetch-fonts.js', files };
  fs.writeFileSync(path.join(out, OUTPUTS.manifest),
    JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

async function build(opts) {
  const { out, log } = opts;
  requireFontTools();
  fs.mkdirSync(out, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-fetch-fonts-'));
  const subsetScript = opts.subsetScript || path.join(ROOT, 'tools', 'gen-font-subsets.sh');
  try {
    if (opts.uming) {
      const tarballPath = await ensureTarball(opts);
      log(`wrote  ${buildUming({ tarballPath, out, work, subsetScript, log })}`);
    }
    if (opts.mingliu) {
      log(`wrote  ${buildUserCollection({ src: path.resolve(opts.mingliu), out,
        work, subsetScript, log })}`);
    }
    return writeManifest(out);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const opts = {
    out: path.join(ROOT, 'fonts', 'fetched'),
    cache: path.join(ROOT, '.cache', 'fonts'),
    uming: true, check: false, offline: false, mingliu: null, tarball: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const eq = a.indexOf('=');
      if (eq >= 0) return a.slice(eq + 1);
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--check') opts.check = true;
    else if (a === '--offline') opts.offline = true;
    else if (a === '--no-uming') opts.uming = false;
    else if (a.startsWith('--mingliu')) opts.mingliu = val();
    else if (a.startsWith('--out')) opts.out = path.resolve(val());
    else if (a.startsWith('--cache')) opts.cache = path.resolve(val());
    else if (a.startsWith('--tarball')) opts.tarball = val();
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n')
      .filter(l => l.startsWith('//')).slice(0, 48).join('\n'));
    return 0;
  }
  const log = msg => console.log(msg);
  if (!opts.check) {
    const manifest = await build({ ...opts, log });
    for (const [name, f] of Object.entries(manifest.files)) {
      log(`  ${name}: ${f.bytes} bytes, faces ${f.faces.join(' / ')}, ` +
        `strikes ${f.strikes.join(',') || 'none'} px, sha256 ${f.sha256}`);
    }
    return 0;
  }
  // --check: rebuild into a scratch dir and compare byte for byte.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-fetch-fonts-check-'));
  try {
    await build({ ...opts, out: scratch, log });
    let bad = 0;
    for (const name of fs.readdirSync(scratch).sort()) {
      const mine = path.join(opts.out, name);
      const same = fs.existsSync(mine) &&
        Buffer.compare(fs.readFileSync(mine), fs.readFileSync(path.join(scratch, name))) === 0;
      log(`  ${same ? 'ok  ' : 'DIFF'} ${name}`);
      if (!same) bad++;
    }
    if (bad) { console.error(`${bad} file(s) differ from a fresh build`); return 1; }
    return 0;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

module.exports = {
  UMING, MING_FACES, OUTPUTS, faceOffsets, familyName, nameRecords, strikeSizes,
  sfntTables, buildUserCollection, buildStandIn, subsetCp950, writeManifest,
  requireFontTools,
};

if (require.main === module) {
  main().then(code => process.exit(code), err => {
    console.error(`fetch-fonts: ${err.message}`);
    process.exit(1);
  });
}
