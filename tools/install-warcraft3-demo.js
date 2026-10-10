#!/usr/bin/env node

'use strict';

// Unpack the Warcraft III demo install tree out of Blizzard's W3Demo.exe.
//
//   node tools/install-warcraft3-demo.js [--installer=downloads/W3Demo.exe]
//                                        [--out=test/binaries/candidates/warcraft3-demo]
//                                        [--force]
//
// W3Demo.exe is a small PE with an MPQ appended at 0x47000. That archive holds
// the installer's own SetupDat resources plus every game file under a
// `Files100\` prefix, and `war3.mpq` — the 101 MB data archive — as one stored
// block. So the whole install is recoverable host-side with tools/mpq.js and
// no emulator in the loop: this walks the archive's own `SetupDat\Inst_Files.ins`
// layout rather than a list typed out here, reading the `.lst` manifests for
// the map and support file sets so the tree matches what Setup would write.
//
// Files the real installer only *creates* at runtime (BnCache.dat, War3Inst.log,
// registry keys, Start Menu links) are not produced; the game recreates the ones
// it needs. The `war3.mpq` backup copies of the patchable files are skipped too
// — they are Setup's rollback store, not something the game reads.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mpq = require('./mpq');

const ROOT = path.join(__dirname, '..');
const DEFAULT_INSTALLER = path.join(ROOT, 'downloads', 'W3Demo.exe');
const DEFAULT_OUT = path.join(ROOT, 'test', 'binaries', 'candidates', 'warcraft3-demo');

// SHA-1 of the archive.org `wc3-demo` item's W3Demo.exe (104,680,620 bytes),
// which is the package this layout was derived from.
const INSTALLER_SHA1 = '7e4ed3a32289f1293f5bc132ce7c525301631a73';

const BUILD = 'Files100';

// Destination-relative directory -> the archive prefix its files live under,
// and the SetupDat `.lst` naming them. A null list means the names are given
// inline below.
const LIST_DIRS = [
  { dest: 'Maps', prefix: `${BUILD}\\Maps`, list: 'SetupDat\\maps.lst' },
  { dest: path.join('support', 'BattleNet'), prefix: `${BUILD}\\support\\BattleNet`, list: 'SetupDat\\BattleNet.lst' },
  { dest: path.join('support', 'Images'), prefix: `${BUILD}\\support\\Images`, list: 'SetupDat\\Images.lst' },
  { dest: path.join('support', 'Layout'), prefix: `${BUILD}\\support\\Layout`, list: 'SetupDat\\Layout.lst' },
  { dest: path.join('support', 'Readme'), prefix: `${BUILD}\\support\\Readme`, list: 'SetupDat\\Readme.lst' },
  { dest: path.join('support', 'Support'), prefix: `${BUILD}\\support\\Support`, list: 'SetupDat\\Support.lst' },
];

// The program files, from the first two FileBlocks of Inst_Files.ins. The
// optional ones are installed only when the build carries them, so a miss is
// reported rather than fatal.
const PROGRAM_FILES = [
  { name: 'Warcraft III Demo.exe', optional: false },
  { name: 'War3Demo.exe', optional: false },
  { name: 'Game.dll', optional: false },
  { name: 'ijl15.dll', optional: false },
  { name: 'Mss32.dll', optional: false },
  { name: 'Storm.dll', optional: false },
  { name: 'BNUpdate.exe', optional: false },
  { name: 'License.txt', optional: false },
  { name: 'blizzard.ax', optional: true },
];

const MILES_FILES = ['Mp3dec.asi', 'Mssdolby.m3d', 'Msseax2.m3d', 'Mssfast.m3d', 'Reverb3.flt'];
const MOVIE_FILES = ['TutorialIn.mpq', 'TutorialOp.mpq'];

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

function sha(buf, algo) {
  return crypto.createHash(algo).update(buf).digest('hex');
}

// A .lst is one quoted file name per line, CRLF-terminated.
function parseList(buf) {
  return buf.toString('latin1').split(/\r?\n/)
    .map(line => line.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
}

function main() {
  const installer = path.resolve(getArg('installer', DEFAULT_INSTALLER));
  const out = path.resolve(getArg('out', DEFAULT_OUT));
  if (!fs.existsSync(installer)) {
    console.error(`missing installer: ${installer}\n` +
      'Fetch it with:\n' +
      "  curl -L -o downloads/W3Demo.exe 'https://archive.org/download/wc3-demo/W3Demo.exe'");
    process.exit(1);
  }

  const sha1 = sha(fs.readFileSync(installer), 'sha1');
  if (sha1 !== INSTALLER_SHA1) {
    console.warn(`warning: installer sha1 ${sha1} is not the recorded ${INSTALLER_SHA1};` +
      ' the layout below may not match this package.');
  }

  const archive = mpq.openArchive(installer);
  console.log(`${path.relative(ROOT, installer)}  sha1=${sha1}`);
  console.log(`  MPQ at 0x${archive.base.toString(16)}  ${archive.blockTableSize} blocks`);

  const wanted = [];
  for (const file of PROGRAM_FILES) {
    wanted.push({ name: `${BUILD}\\${file.name}`, dest: file.name, optional: file.optional });
  }
  wanted.push({ name: 'war3.mpq', dest: 'war3.mpq', optional: false });
  for (const name of MILES_FILES) {
    wanted.push({
      name: `${BUILD}\\redist\\miles\\${name}`,
      dest: path.join('redist', 'miles', name),
      optional: false,
    });
  }
  for (const name of MOVIE_FILES) {
    wanted.push({
      name: `${BUILD}\\movies\\${name}`,
      dest: path.join('movies', name),
      optional: true,
    });
  }
  for (const dir of LIST_DIRS) {
    const list = mpq.extractByName(archive, dir.list);
    if (!list) {
      console.warn(`  ${dir.list}: absent, skipping ${dir.dest}`);
      continue;
    }
    for (const name of parseList(list.data)) {
      wanted.push({
        name: `${dir.prefix}\\${name}`,
        dest: path.join(dir.dest, name),
        optional: false,
      });
    }
  }

  let written = 0;
  let bytes = 0;
  const missing = [];
  const notable = new Map();
  for (const item of wanted) {
    let got = null;
    try {
      got = mpq.extractByName(archive, item.name);
    } catch (err) {
      throw new Error(`${item.name}: ${err.message}`);
    }
    if (!got) {
      if (!item.optional) missing.push(item.name);
      continue;
    }
    const target = path.join(out, item.dest);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target) && !hasFlag('force') &&
        fs.statSync(target).size === got.data.length) {
      // Same size already on disk: the 101 MB war3.mpq is the expensive one,
      // and re-hashing it every run buys nothing. --force rewrites regardless.
      bytes += got.data.length;
      continue;
    }
    fs.writeFileSync(target, got.data);
    written += 1;
    bytes += got.data.length;
    if (/\.(exe|dll|mpq)$/i.test(item.dest)) {
      notable.set(item.dest, sha(got.data, 'sha256'));
    }
  }

  fs.mkdirSync(path.join(out, 'save'), { recursive: true });
  fs.mkdirSync(path.join(out, 'replay'), { recursive: true });

  console.log(`\ninstalled ${wanted.length - missing.length} files ` +
    `(${written} written, ${(bytes / (1024 * 1024)).toFixed(1)} MB) into ${path.relative(ROOT, out)}`);
  for (const [name, digest] of [...notable].sort()) {
    console.log(`  ${digest}  ${name}`);
  }
  if (missing.length) {
    console.log(`\n${missing.length} required entries were not in the archive:`);
    for (const name of missing) console.log(`  ${name}`);
    process.exit(1);
  }
}

main();
