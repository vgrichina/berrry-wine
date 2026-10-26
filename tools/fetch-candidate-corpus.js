#!/usr/bin/env node

// Parse non-executing requests before imports or any fixture access.
const argv = process.argv.slice(2);
function usage(message) {
  const write = message ? console.error : console.log;
  if (message) write(message);
  write('usage: node tools/fetch-candidate-corpus.js [--id=a,b] [--force|--prepare]');
  write('Without --id, processes all candidates. --prepare uses existing fixtures.');
  process.exit(message ? 2 : 0);
}
if (argv.includes('--help') || argv.includes('-h')) usage();
for (const arg of argv) {
  if (arg === '--force' || arg === '--prepare') continue;
  if (arg.startsWith('--id=') && arg.slice(5).split(',').every(id => id.trim())) continue;
  usage(`unknown or invalid argument: ${arg}`);
}

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { expandSzddFile } = require('./szdd');

const ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'test', 'candidate-corpus', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const ASSET_ROOT = path.resolve(ROOT, manifest.assetRoot);
const force = argv.includes('--force');
const prepare = argv.includes('--prepare');
const idArg = argv.find(arg => arg.startsWith('--id='));
const selectedIds = idArg
  ? new Set(idArg.slice('--id='.length).split(',').map(value => value.trim()).filter(Boolean))
  : null;

function fixtureId(candidate) {
  return candidate.fixture || candidate.id;
}

function assertSafeRelative(value, label) {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]+/).includes('..')) {
    throw new Error(`${label} must be a safe relative path: ${value}`);
  }
}

function sha1(filename) {
  const hash = crypto.createHash('sha1');
  hash.update(fs.readFileSync(filename));
  return hash.digest('hex');
}

function requestToFile(url, destination, redirectsLeft = 10) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'http:' ? http : https;
    const request = client.get(parsed, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WineAssemblyCandidateCorpus/1.0)',
        Accept: '*/*',
      },
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (!redirectsLeft) return reject(new Error(`too many redirects for ${url}`));
        return requestToFile(new URL(response.headers.location, parsed).href, destination, redirectsLeft - 1)
          .then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        response.resume();
        const error = new Error(`HTTP ${response.statusCode} for ${url}`);
        error.statusCode = response.statusCode;
        return reject(error);
      }
      const output = fs.createWriteStream(destination, { flags: 'wx' });
      response.pipe(output);
      output.on('finish', () => output.close(resolve));
      output.on('error', reject);
    });
    request.on('error', reject);
  });
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

// archive.org/download/<item>/<file> redirects to one datanode, and that node
// can be down for the whole item (HTTP 500 on every file) while the item's
// own servers serve it. Ask /metadata for them and try each directly; the
// manifest's pinned SHA-1 still decides whether the bytes are accepted.
async function archiveOrgServerUrls(url) {
  const match = /^https:\/\/archive\.org\/download\/([^/]+)\/(.+)$/.exec(url);
  if (!match) return [];
  try {
    const response = await fetch(`https://archive.org/metadata/${match[1]}`);
    if (!response.ok) return [];
    const meta = await response.json();
    // d1 (the primary) first: a workable server can still crawl at ~20 KB/s.
    const servers = [...new Set([meta.d1, meta.d2, ...(meta.workable_servers || [])]
      .filter(server => typeof server === 'string' && /^[a-z0-9.-]+$/i.test(server)))];
    if (typeof meta.dir !== 'string' || !meta.dir.startsWith('/')) return [];
    return servers.map(server => `https://${server}${meta.dir}/${match[2]}`);
  } catch {
    return [];
  }
}

async function downloadWithRetries(url, destination) {
  try {
    await downloadOneWithRetries(url, destination);
  } catch (error) {
    for (const alternate of await archiveOrgServerUrls(url)) {
      console.log(`MIRROR ${alternate}`);
      try {
        await downloadOneWithRetries(alternate, destination);
        return;
      } catch {}
    }
    throw error;
  }
}

async function downloadOneWithRetries(url, destination) {
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    fs.rmSync(destination, { force: true });
    try {
      await requestToFile(url, destination);
      return;
    } catch (error) {
      lastError = error;
      const retryable = !error.statusCode || retryableStatuses.has(error.statusCode);
      if (!retryable || attempt === 4) break;
      console.log(`RETRY  ${attempt}/3: ${url}`);
      await delay(attempt * 750);
    }
  }
  throw lastError;
}

// Move every entry of `source` into `destination`, replacing what is there.
// A file is unlinked first rather than overwritten, because unlinking needs
// only a writable directory while overwriting needs a writable file.
function mergeExtractedTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      const existing = fs.lstatSync(to, { throwIfNoEntry: false });
      if (existing && !existing.isDirectory()) fs.rmSync(to, { force: true });
      mergeExtractedTree(from, to);
    } else {
      fs.rmSync(to, { recursive: true, force: true });
      fs.renameSync(from, to);
    }
  }
}

function extractArchive(archive, destination, options = {}) {
  fs.mkdirSync(destination, { recursive: true });
  const result = spawnSync('7z', ['x', '-y', `-o${destination}`, archive], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status === 0) return;

  if (options.cleanFallback) {
    fs.rmSync(destination, { recursive: true, force: true });
    fs.mkdirSync(destination, { recursive: true });
  }
  // unar extracts into a fresh directory that is then merged over the
  // destination. A 7z that fails partway leaves the entries it could not
  // decode behind as empty files, and a RAR's read-only attribute makes them
  // read-only, so `unar -f` straight into the destination fails on every one
  // (Battlezone demo on a boat's codec-less 7z: 257 files).
  const staging = fs.mkdtempSync(`${destination.replace(/[\\/]+$/, '')}.unar-`);
  const fallbackArgs = ['-f'];
  if (options.noDirectory) fallbackArgs.push('-D');
  fallbackArgs.push('-o', staging, archive);
  const fallback = spawnSync('unar', fallbackArgs, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (fallback.status === 0) {
    mergeExtractedTree(staging, destination);
    fs.rmSync(staging, { recursive: true, force: true });
    return;
  }
  fs.rmSync(staging, { recursive: true, force: true });

  const primary = result.error && result.error.code === 'ENOENT'
    ? '7z unavailable'
    : `7z exit ${result.status}`;
  const secondary = fallback.error && fallback.error.code === 'ENOENT'
    ? 'unar unavailable'
    : `unar exit ${fallback.status}`;
  const detail = `${fallback.stdout || ''}\n${fallback.stderr || ''}`.trim().split('\n').slice(-8).join('\n');
  // Ubuntu's `7zip` package is the DFSG build without the RAR codec, so on a
  // fresh boat fork every RAR candidate lands here; unar opens them.
  const hint = fallback.error && fallback.error.code === 'ENOENT'
    ? '\n(install unar for RAR and other formats 7z cannot open: sudo apt-get install -y unar)' : '';
  throw new Error(`archive extraction failed (${primary}; ${secondary})${detail ? `:\n${detail}` : ''}${hint}`);
}

function extractRawCd(image, destination, mode = 1) {
  if (mode !== 1 && mode !== 2) throw new Error('Unsupported raw CD sector mode');
  const RAW_SECTOR_SIZE = 2352;
  const ISO_SECTOR_SIZE = 2048;
  const USER_DATA_OFFSET = mode === 2 ? 24 : 16;
  const sectorsPerChunk = 128;
  const size = fs.statSync(image).size;
  if (!size || size % RAW_SECTOR_SIZE !== 0) {
    throw new Error(`${image} is not a whole-sector MODE${mode}/2352 image`);
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-raw-cd-'));
  const iso = path.join(temporary, 'disc.iso');
  try {
    const input = fs.openSync(image, 'r');
    const output = fs.openSync(iso, 'wx');
    const raw = Buffer.allocUnsafe(RAW_SECTOR_SIZE * sectorsPerChunk);
    const cooked = Buffer.allocUnsafe(ISO_SECTOR_SIZE * sectorsPerChunk);
    try {
      let position = 0;
      while (position < size) {
        const bytes = fs.readSync(input, raw, 0, Math.min(raw.length, size - position), position);
        if (!bytes || bytes % RAW_SECTOR_SIZE !== 0) {
          throw new Error(`${image} has a truncated MODE${mode}/2352 sector`);
        }
        const sectors = bytes / RAW_SECTOR_SIZE;
        for (let sector = 0; sector < sectors; sector++) {
          const rawOffset = sector * RAW_SECTOR_SIZE;
          if (raw[rawOffset] !== 0 || raw[rawOffset + 11] !== 0 || raw[rawOffset + 15] !== mode) {
            throw new Error(`${image} contains a non-MODE${mode} sector at ${position / RAW_SECTOR_SIZE + sector}`);
          }
          if (mode === 2 && (raw.subarray(rawOffset + 1, rawOffset + 11).some(b => b !== 255) ||
              !raw.subarray(rawOffset + 16, rawOffset + 20).equals(raw.subarray(rawOffset + 20, rawOffset + 24)) ||
              (raw[rawOffset + 18] & 0x20))) {
            throw new Error(`${image} requires MODE2 Form1 sectors with matching XA subheaders at ${position / RAW_SECTOR_SIZE + sector}`);
          }
          raw.copy(cooked, sector * ISO_SECTOR_SIZE,
            rawOffset + USER_DATA_OFFSET, rawOffset + USER_DATA_OFFSET + ISO_SECTOR_SIZE);
        }
        fs.writeSync(output, cooked, 0, sectors * ISO_SECTOR_SIZE);
        position += bytes;
      }
    } finally {
      fs.closeSync(input);
      fs.closeSync(output);
    }
    extractArchive(iso, destination);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

// SZDD (*.DL_, *.EX_) expansion lives in tools/szdd.js so it can also be run
// by hand; pinned retail recipes still need no host msexpand build.
function expandSzdd(source, destination) {
  expandSzddFile(source, destination);
}

function runPostExtract(candidate, destination) {
  for (const [index, step] of (candidate.postExtract || []).entries()) {
    if (step.type === 'extractArchive') {
      assertSafeRelative(step.archive, `${candidate.id}.postExtract[${index}].archive`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const into = path.join(destination, step.into);
      fs.rmSync(into, { recursive: true, force: true });
      extractArchive(path.join(destination, step.archive), into, {
        cleanFallback: true,
        noDirectory: true,
      });
    } else if (step.type === 'unshield') {
      assertSafeRelative(step.cab, `${candidate.id}.postExtract[${index}].cab`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      if (!step.group || typeof step.group !== 'string') {
        throw new Error(`${candidate.id}.postExtract[${index}].group is required`);
      }
      const cab = path.join(destination, step.cab);
      const into = path.join(destination, step.into);
      fs.mkdirSync(into, { recursive: true });
      let result = spawnSync('unshield', ['-d', into, '-g', step.group, 'x', cab], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      });
      // No unshield on this host (the ops box has none), or unshield failed:
      // tools/is5-extract.js reads InstallShield 5 cabs and its --group writes
      // unshield's layout, so the manifest's later copy steps find the same
      // paths. unshield 1.5 exits 1 on files split across volumes -- the
      // Requiem demo's 4.3 MB Art\HW\ReqArt3D.art and maps\demopp3.jam span
      // data1..data5.cab -- which is5-extract joins.
      const unshieldMissing = result.error && result.error.code === 'ENOENT';
      if (unshieldMissing || result.status !== 0) {
        result = spawnSync(process.execPath, [
          path.join(ROOT, 'tools', 'is5-extract.js'), cab, `--group=${step.group}`, `--out=${into}`,
        ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      }
      if (result.status !== 0) {
        const detail = `${result.stdout || ''}\n${result.stderr || ''}`.trim().split('\n').slice(-8).join('\n');
        throw new Error(`InstallShield extraction failed (${unshieldMissing ? 'unshield unavailable; ' : 'unshield failed; '}is5-extract exit ${result.status})${detail ? `:\n${detail}` : ''}`);
      }
    } else if (step.type === 'is3Extract') {
      // InstallShield 3 DATA.Z (1996-98 installers); 7z and unshield refuse it.
      assertSafeRelative(step.archive, `${candidate.id}.postExtract[${index}].archive`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const into = path.join(destination, step.into);
      fs.mkdirSync(into, { recursive: true });
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'tools', 'is3-extract.js'),
        path.join(destination, step.archive), `--out=${into}`,
      ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (result.status !== 0) {
        const detail = `${result.stdout || ''}\n${result.stderr || ''}`.trim().split('\n').slice(-8).join('\n');
        throw new Error(`InstallShield 3 extraction failed (exit ${result.status})${detail ? `:\n${detail}` : ''}`);
      }
    } else if (step.type === 'is5Extract') {
      // Early InstallShield 5 data1.cab sets (version 0x01000004) that
      // unshield mis-reads; see tools/is5-extract.js.
      assertSafeRelative(step.cab, `${candidate.id}.postExtract[${index}].cab`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const into = path.join(destination, step.into);
      fs.mkdirSync(into, { recursive: true });
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'tools', 'is5-extract.js'),
        path.join(destination, step.cab), `--out=${into}`,
      ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (result.status !== 0) {
        const detail = `${result.stdout || ''}\n${result.stderr || ''}`.trim().split('\n').slice(-8).join('\n');
        throw new Error(`InstallShield 5 extraction failed (exit ${result.status})${detail ? `:\n${detail}` : ''}`);
      }
    } else if (step.type === 'innoextract') {
      assertSafeRelative(step.installer, `${candidate.id}.postExtract[${index}].installer`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      if (typeof step.language !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(step.language)) {
        throw new Error(`${candidate.id}.postExtract[${index}].language is required`);
      }
      const result = spawnSync('innoextract', [
        '--language', step.language, '--exclude-temp', '--silent',
        '-d', path.join(destination, step.into), path.join(destination, step.installer),
      ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (result.status !== 0) {
        throw new Error(`Inno extraction failed: ${result.error || result.stderr || result.stdout}`);
      }
    } else if (step.type === 'msiFiles') {
      for (const key of ['msi', 'cabinets', 'source', 'into']) {
        assertSafeRelative(step[key], `${candidate.id}.postExtract[${index}].${key}`);
      }
      const { installMsiFiles } = require('./msi-file-layout');
      const count = installMsiFiles({
        msiFile: path.join(destination, step.msi),
        cabinetRoot: path.join(destination, step.cabinets),
        sourceRoot: path.join(destination, step.source),
        destination: path.join(destination, step.into),
        rootDirectory: step.rootDirectory,
        directoryAliases: step.directoryAliases,
      });
      console.log(`MSI    ${candidate.id}: ${count} payload files`);
    } else if (step.type === 'copyTree') {
      assertSafeRelative(step.from, `${candidate.id}.postExtract[${index}].from`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const from = path.join(destination, step.from);
      const into = path.join(destination, step.into);
      fs.mkdirSync(into, { recursive: true });
      for (const entry of fs.readdirSync(from)) {
        fs.cpSync(path.join(from, entry), path.join(into, entry), {
          recursive: true,
          force: true,
        });
      }
    } else if (step.type === 'copyFile') {
      assertSafeRelative(step.from, `${candidate.id}.postExtract[${index}].from`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const from = path.join(destination, step.from);
      const into = path.join(destination, step.into);
      fs.mkdirSync(path.dirname(into), { recursive: true });
      fs.copyFileSync(from, into);
    } else if (step.type === 'extractRawMode1Cd' || step.type === 'extractRawMode2Cd') {
      assertSafeRelative(step.image, `${candidate.id}.postExtract[${index}].image`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      extractRawCd(path.join(destination, step.image), path.join(destination, step.into), step.type === 'extractRawMode2Cd' ? 2 : 1);
    } else if (step.type === 'expandSzdd') {
      assertSafeRelative(step.from, `${candidate.id}.postExtract[${index}].from`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      expandSzdd(path.join(destination, step.from), path.join(destination, step.into));
    } else if (step.type === 'writeText') {
      assertSafeRelative(step.file, `${candidate.id}.postExtract[${index}].file`);
      if (typeof step.text !== 'string') {
        throw new Error(`${candidate.id}.postExtract[${index}].text must be a string`);
      }
      const file = path.join(destination, step.file);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, step.text);
    } else if (step.type === 'replaceText') {
      assertSafeRelative(step.file, `${candidate.id}.postExtract[${index}].file`);
      if (!Array.isArray(step.replacements) || !step.replacements.length) {
        throw new Error(`${candidate.id}.postExtract[${index}].replacements is required`);
      }
      const file = path.join(destination, step.file);
      let text = fs.readFileSync(file, 'utf8');
      for (const [replacementIndex, replacement] of step.replacements.entries()) {
        const label = `${candidate.id}.postExtract[${index}].replacements[${replacementIndex}]`;
        if (!replacement || typeof replacement.from !== 'string' ||
            typeof replacement.to !== 'string' || !replacement.from) {
          throw new Error(`${label} needs non-empty from and string to values`);
        }
        if (!text.includes(replacement.from)) {
          // Let a previously prepared local tree remain idempotent while still
          // rejecting silently changed upstream installer contents.
          if (text.includes(replacement.to)) continue;
          throw new Error(`${label} did not match ${step.file}`);
        }
        text = text.split(replacement.from).join(replacement.to);
      }
      fs.writeFileSync(file, text);
    } else if (step.type === 'installDeusExDemo') {
      assertSafeRelative(step.installer, `${candidate.id}.postExtract[${index}].installer`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'tools', 'install-deus-ex-demo.js'),
        `--installer=${path.join(destination, step.installer)}`,
        `--output=${path.join(destination, step.into)}`,
      ], {
        cwd: ROOT,
        stdio: 'inherit',
      });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`authentic Deus Ex installer failed with exit ${result.status}`);
      }
    } else if (step.type === 'installQuake3Demo') {
      // Q3ADemo.exe is an Installer VISE package no host tool unpacks; the
      // tree comes from running that installer in the emulator
      // (tools/install-quake3-demo.js), as the quake3_demo registry entry
      // expects under installed/ with its browser manifest.
      assertSafeRelative(step.installer, `${candidate.id}.postExtract[${index}].installer`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'tools', 'install-quake3-demo.js'),
        `--installer=${path.join(destination, step.installer)}`,
        `--output=${path.join(destination, step.into)}`,
      ], { cwd: ROOT, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`authentic Quake III demo installer failed with exit ${result.status}`);
      }
    } else if (step.type === 'installThps2Demo') {
      assertSafeRelative(step.installer, `${candidate.id}.postExtract[${index}].installer`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'tools', 'install-thps2-demo.js'),
        `--installer=${path.join(destination, step.installer)}`,
        `--output=${path.join(destination, step.into)}`,
      ], { cwd: ROOT, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`THPS2 installer failed with exit ${result.status}`);
    } else if (step.type === 'installHomeworldDemo') {
      // HWDemo.exe is a Wise package; the tree comes from running that
      // installer in the emulator (tools/install-homeworld-demo.js), as the
      // homeworld_demo registry entry expects under installed/.
      assertSafeRelative(step.installer, `${candidate.id}.postExtract[${index}].installer`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'tools', 'install-homeworld-demo.js'),
        `--installer=${path.join(destination, step.installer)}`,
        `--output=${path.join(destination, step.into)}`,
      ], { cwd: ROOT, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`authentic Homeworld demo installer failed with exit ${result.status}`);
      }
    } else if (step.type === 'installWarcraft3Demo') {
      // W3Demo.exe is a small PE with an MPQ appended, not a 7-Zip/RAR
      // self-extractor: 7z and unar both fail on it on every host ("cannot
      // open as archive"), which is what broke fresh boat forks. The install
      // tree is unpacked from that MPQ by tools/install-warcraft3-demo.js.
      assertSafeRelative(step.installer, `${candidate.id}.postExtract[${index}].installer`);
      assertSafeRelative(step.into, `${candidate.id}.postExtract[${index}].into`);
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'tools', 'install-warcraft3-demo.js'),
        `--installer=${path.join(destination, step.installer)}`,
        `--out=${path.join(destination, step.into)}`,
      ], { cwd: ROOT, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`Warcraft III demo MPQ install failed with exit ${result.status}`);
      }
    } else if (step.type === 'installBaldursGate2Demo') {
      assertSafeRelative(step.source, `${candidate.id}.postExtract[${index}].source`);
      if (prepare) {
        // Preparing an installed fixture must not rerun its one-shot extraction.
        // Verify required original bytes; preserve additional saves and metadata.
        const checked = spawnSync(process.execPath, [
          path.join(ROOT, 'tools', 'bg2-source-recovery.js'), 'verify-installed', destination,
          path.join(ROOT, 'test', 'candidate-corpus', 'baldurs-gate2-demo-files.json'),
        ], { cwd: ROOT, stdio: 'inherit', timeout: 300000 });
        if (checked.error) throw checked.error;
        if (checked.status !== 0) throw new Error('BG2 installed-file verification failed; fixture unchanged');
        continue;
      }
      // Preserve original split media and detailed recovery receipts outside the
      // final browser fixture, including when --force removes its staging dir.
      const source = path.join(destination, step.source);
      if (!fs.statSync(source).isDirectory()) throw new Error('BG2 source directory missing');
      const recovery = fs.mkdtempSync(path.join(ASSET_ROOT, '.bg2-recovery-'));
      const retainedSource = path.join(recovery, 'source');
      fs.renameSync(source, retainedSource);
      console.log(`BG2 original sources and recovery receipts: ${recovery}`);
      if (fs.readdirSync(destination).length) {
        throw new Error(`BG2 fresh fixture must be empty; original sources retained at ${recovery}`);
      }
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'tools', 'bg2-source-recovery.js'), 'recover', retainedSource,
      ], { cwd: ROOT, stdio: 'inherit', timeout: 1500000, killSignal: 'SIGKILL' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`BG2 original recovery failed; evidence retained at ${recovery}`);
      const receipt = JSON.parse(fs.readFileSync(path.join(retainedSource, 'assembly.json'), 'utf8'));
      if (!receipt.complete || !receipt.comparison.ok || receipt.comparison.actual !== 645 || receipt.comparison.expected !== 645)
        throw new Error('BG2 requires all645 original-file comparisons before publication');
      const installed = path.join(retainedSource, 'installed');
      for (const name of fs.readdirSync(installed)) fs.renameSync(path.join(installed, name), path.join(destination, name));
    } else if (step.type === 'installUnrealDemo') {
      for (const field of ['id', 'source', 'into']) {
        assertSafeRelative(step[field], `${candidate.id}.postExtract[${index}].${field}`);
      }
      const result = spawnSync(process.execPath, [
        path.join(ROOT, 'tools', 'install-unreal-demo.js'),
        `--id=${step.id}`,
        `--source=${path.join(destination, step.source)}`,
        `--output=${path.join(destination, step.into)}`,
      ], { cwd: ROOT, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`authentic Unreal demo installer failed with exit ${result.status}`);
      }
    } else if (step.type === 'prepareInfinityFullInstall') {
      for (const field of ['key', 'data', 'into', 'outputKey']) {
        assertSafeRelative(step[field], `${candidate.id}.postExtract[${index}].${field}`);
      }
      const dataDir = path.join(destination, step.data);
      const intoDir = path.join(destination, step.into);
      fs.mkdirSync(intoDir, { recursive: true });
      const installedBifs = new Set();
      const dataEntries = fs.readdirSync(dataDir);
      const dataNames = new Set(dataEntries.map(name => name.toLowerCase()));
      for (const entry of dataEntries) {
        if (!/\.cbf$/i.test(entry)) continue;
        const source = fs.readFileSync(path.join(dataDir, entry));
        if (source.subarray(0, 8).toString('ascii') !== 'BIF V1.0' || source.length < 24) {
          throw new Error(`${step.data}/${entry} is not an Infinity compressed BIF`);
        }
        const nameLength = source.readUInt32LE(8);
        const sizeOffset = 12 + nameLength;
        if (nameLength < 2 || sizeOffset + 8 > source.length) {
          throw new Error(`${step.data}/${entry} has an invalid compressed BIF header`);
        }
        const embeddedName = source.subarray(12, sizeOffset - 1).toString('ascii');
        if (path.basename(embeddedName) !== embeddedName || !/\.bif$/i.test(embeddedName)) {
          throw new Error(`${step.data}/${entry} has an unsafe embedded BIF name`);
        }
        const expectedSize = source.readUInt32LE(sizeOffset);
        const compressedSize = source.readUInt32LE(sizeOffset + 4);
        const compressedOffset = sizeOffset + 8;
        if (compressedOffset + compressedSize !== source.length) {
          throw new Error(`${step.data}/${entry} has an invalid compressed payload size`);
        }
        const output = zlib.inflateSync(source.subarray(compressedOffset));
        if (output.length !== expectedSize || output.subarray(0, 8).toString('ascii') !== 'BIFFV1  ') {
          throw new Error(`${step.data}/${entry} did not inflate to the expected BIFF payload`);
        }
        fs.writeFileSync(path.join(intoDir, embeddedName), output);
        installedBifs.add(embeddedName.toLowerCase());
      }

      const key = fs.readFileSync(path.join(destination, step.key));
      if (key.subarray(0, 8).toString('ascii') !== 'KEY V1  ' || key.length < 24) {
        throw new Error(`${step.key} is not an Infinity KEY V1 file`);
      }
      const bifCount = key.readUInt32LE(8);
      const resourceCount = key.readUInt32LE(12);
      const bifOffset = key.readUInt32LE(16);
      const resourceOffset = key.readUInt32LE(20);
      const availableBifs = new Set(dataEntries
        .filter(name => /\.bif$/i.test(name))
        .map(name => name.toLowerCase()));
      for (const name of installedBifs) availableBifs.add(name);
      const bifAvailable = new Array(bifCount).fill(false);
      let patched = 0;
      for (let bif = 0; bif < bifCount; bif++) {
        const entryOffset = bifOffset + bif * 12;
        if (entryOffset + 12 > key.length) throw new Error(`${step.key} has a truncated BIF table`);
        const nameOffset = key.readUInt32LE(entryOffset + 4);
        const nameLength = key.readUInt16LE(entryOffset + 8);
        if (nameOffset + nameLength > key.length) throw new Error(`${step.key} has a truncated BIF name`);
        const name = key.subarray(nameOffset, nameOffset + nameLength)
          .toString('ascii').replace(/\0+$/, '').replace(/\\/g, '/');
        const base = path.basename(name).toLowerCase();
        const location = key.readUInt16LE(entryOffset + 10);
        if (location === 9 && dataNames.has(base)) installedBifs.add(base);
        if (location === 9 && installedBifs.has(base)) {
          key.writeUInt16LE(1, entryOffset + 10);
          patched++;
        }
        bifAvailable[bif] = availableBifs.has(base);
      }
      if (patched !== installedBifs.size) {
        throw new Error(`${step.key} patched ${patched}/${installedBifs.size} CD2 BIF locations`);
      }
      if (resourceOffset + resourceCount * 14 > key.length) {
        throw new Error(`${step.key} has a truncated resource table`);
      }
      const resources = [];
      for (let resource = 0; resource < resourceCount; resource++) {
        const entryOffset = resourceOffset + resource * 14;
        const locator = key.readUInt32LE(entryOffset + 10);
        const bif = locator >>> 20;
        if (bif < bifAvailable.length && bifAvailable[bif]) {
          resources.push(key.subarray(entryOffset, entryOffset + 14));
        }
      }
      const output = Buffer.concat([
        key.subarray(0, resourceOffset),
        ...resources,
      ]);
      output.writeUInt32LE(resources.length, 12);
      fs.writeFileSync(path.join(destination, step.outputKey), output);
    } else {
      throw new Error(`unsupported postExtract type: ${step.type}`);
    }
  }
}

function walkBrowserFiles(directory, relative = '', output = []) {
  for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
    const name = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) walkBrowserFiles(directory, name, output);
    else if (entry.isFile()) output.push(name);
  }
  return output;
}

// Browser app entries cannot enumerate an ignored retail tree at runtime.
// Preparation therefore writes a tiny, untracked inventory beside the local
// fixture. It contains paths and optional file metadata; no proprietary bytes enter git.
function writeBrowserManifest(candidate, destination) {
  const browser = candidate.browser;
  if (!browser) return;
  assertSafeRelative(browser.fileRoot, `${candidate.id}.browser.fileRoot`);
  assertSafeRelative(browser.exe, `${candidate.id}.browser.exe`);
  if (browser.cue) assertSafeRelative(browser.cue, `${candidate.id}.browser.cue`);

  const modes = ['required', 'lazy', 'background'];
  if (browser.defaultLoadMode !== undefined && !modes.includes(browser.defaultLoadMode)) throw new Error('Invalid browser.defaultLoadMode');
  const fileModes = browser.fileLoadModes || {};
  for (const [name, mode] of Object.entries(fileModes)) {
    assertSafeRelative(name, 'browser.fileLoadModes');
    if (!modes.includes(mode)) throw new Error('Invalid browser.fileLoadModes value: ' + name);
  }
  const fileRoot = path.join(destination, browser.fileRoot);
  const executable = path.normalize(browser.exe);
  if (!fs.statSync(fileRoot).isDirectory()) {
    throw new Error(`${candidate.id}.browser.fileRoot is not a directory`);
  }
  if (!fs.statSync(path.join(destination, executable)).isFile()) {
    throw new Error(`${candidate.id}.browser.exe is not a file`);
  }
  // `vfsPaths` places a file somewhere other than beside the exe, for a file
  // the retail installer puts elsewhere: WinG's LibMain refuses to run from
  // anywhere but the system directory.
  const vfsPaths = browser.vfsPaths || {};
  // `cdMirror` (e.g. "d:\\civ2") also places every file where it sits on the
  // disc, for a game that proves its CD is present by opening a file there.
  // Aliases of one URL share a single fetch, so the mirror costs no bytes.
  const cdMirror = browser.cdMirror || null;
  // Prepared caches may retain exact FILETIME values from a save bundle.
  // Keep this optional sidecar local alongside the ignored fixture bytes.
  const metadataPath = path.join(destination, '.wine-assembly-file-metadata.json');
  const fileMetadata = fs.existsSync(metadataPath)
    ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')) : {};
  // These exact fixture-root sidecars belong to the host, not the guest.
  // Exclude by full path so nested game files and other dotfiles survive.
  const hostSidecars = new Set([
    '.candidate-source.json', '.wine-assembly-browser.json',
    '.wine-assembly-file-metadata.json',
  ].map(name => path.join(destination, name)));
  const files = walkBrowserFiles(fileRoot)
    .filter(relative => !hostSidecars.has(path.join(fileRoot, relative)))
    .sort((a, b) => a.localeCompare(b))
    .map(relative => {
      const fixtureRelative = path.join(browser.fileRoot, relative);
      const url = fixtureRelative.split(path.sep).join('/');
      const onDisc = cdMirror && `${cdMirror}\\${relative.split(path.sep).join('\\')}`;
      if (path.normalize(fixtureRelative) === executable) {
        return onDisc ? { url, vfsPath: onDisc } : null;
      }
      const key = relative.split(path.sep).join('/');
      const vfsPath = vfsPaths[key] || 'c:\\' + relative.split(path.sep).join('\\');
      const metadata = fileMetadata[url] || {};
      const times = {};
      for (const key of ['creationTime', 'lastAccessTime', 'lastWriteTime']) {
        if (metadata[key] !== undefined) times[key] = metadata[key];
      }
      const size = fs.statSync(path.join(fileRoot, relative)).size;
      if (!Number.isSafeInteger(size) || size < 0) throw new Error('Invalid file size: ' + url);
      // Native modules and fonts can be read during synchronous initialization.
      // They stay required even when the asset tree opts into on-demand data.
      const synchronous = /\.(?:exe|dll|ocx|vbx|drv|ttf|ttc|fon)$/i.test(relative);
      const requestedMode = fileModes[key] || browser.defaultLoadMode;
      const loadMode = requestedMode === undefined ? undefined : synchronous ? 'required' : requestedMode;
      const loading = {size, ...(loadMode === undefined ? {} : {loadMode})};
      return onDisc ? { url, vfsPaths: [vfsPath, onDisc], ...times, ...loading } : { url, vfsPath, ...times, ...loading };
    }).filter(Boolean);

  const trackSizes = {};
  if (browser.cue) {
    const cuePath = path.join(destination, browser.cue);
    const cue = fs.readFileSync(cuePath, 'utf8');
    for (const match of cue.matchAll(/^\s*FILE\s+(?:"([^"]+)"|(\S+))\s+\S+/gmi)) {
      const name = match[1] || match[2];
      assertSafeRelative(name, `${candidate.id}.browser CUE FILE`);
      trackSizes[name] = fs.statSync(path.join(path.dirname(cuePath), name)).size;
    }
    if (!Object.keys(trackSizes).length) {
      throw new Error(`${candidate.id}.browser.cue has no FILE entries`);
    }
  }

  fs.writeFileSync(path.join(destination, '.wine-assembly-browser.json'),
    `${JSON.stringify({ schemaVersion: 1, files,
      ...(browser.cue ? { trackSizes } : {}) }, null, 2)}\n`);
}

// Publication is a same-filesystem, single-writer transaction. The journal is
// durable before either rename; restart reconciliation runs before KEEP/PREP.
// An unjournalled/foreign stage is evidence, never a source of trusted assets.
function publicationStat(filename) {
  return fs.lstatSync(filename, { throwIfNoEntry: false });
}

function publicationIdentity(filename) {
  const stat = publicationStat(filename);
  if (!stat) return null;
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe publication directory: ${filename}`);
  return `${stat.dev}:${stat.ino}`;
}

function publicationSync(filename) {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function publicationTree(directory, durable = false) {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.alloc(64 * 1024);
  function walk(at, relative) {
    publicationIdentity(at);
    hash.update(JSON.stringify(['directory', relative]));
    for (const name of fs.readdirSync(at).sort()) {
      const filename = path.join(at, name);
      const child = `${relative}/${name}`;
      const stat = publicationStat(filename);
      if (stat.isDirectory() && !stat.isSymbolicLink()) walk(filename, child);
      else if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1) {
        hash.update(JSON.stringify(['file', child, stat.size]));
        const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        try {
          let count;
          while ((count = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, count));
          if (durable) fs.fsyncSync(fd);
        } finally { fs.closeSync(fd); }
      } else throw new Error(`unsafe publication entry: ${filename}`);
    }
    if (durable) publicationSync(at);
  }
  walk(directory, '');
  return hash.digest('hex');
}

function publicationKey(candidate, finalDestination) {
  return crypto.createHash('sha256').update(JSON.stringify({ candidate, finalDestination })).digest('hex');
}

function publicationParent(finalDestination) {
  const parent = path.dirname(finalDestination);
  const relative = path.relative(ASSET_ROOT, finalDestination);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !relative) throw new Error('unsafe publication destination');
  let at = ASSET_ROOT;
  publicationIdentity(at);
  for (const part of path.relative(at, parent).split(path.sep).filter(Boolean)) {
    at = path.join(at, part);
    publicationIdentity(at);
  }
  return parent;
}

function reconcilePublication(candidate, finalDestination) {
  const parent = publicationParent(finalDestination);
  if (!publicationStat(parent)) return;
  const prefix = path.basename(finalDestination) + '.replacement-';
  const stages = fs.readdirSync(parent).filter(name => name.startsWith(prefix));
  if (!stages.length) return;
  if (stages.length !== 1) throw new Error(`ambiguous publication stages for ${finalDestination}; retained`);
  const staging = path.join(parent, stages[0]);
  const stageIdentity = publicationIdentity(staging);
  const journal = path.join(staging, 'publication.json');
  const stat = publicationStat(journal);
  if (!stat || !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 65536) {
    throw new Error(`unsafe or incomplete publication journal: ${journal}; retained`);
  }
  const record = JSON.parse(fs.readFileSync(journal, 'utf8'));
  if (record.schema !== 1 || record.key !== publicationKey(candidate, finalDestination) ||
      record.stage !== stageIdentity || !/^[a-f0-9]{64}$/.test(record.nextHash) ||
      !(record.old === null || (typeof record.old === 'string' && /^[a-f0-9]{64}$/.test(record.oldHash)))) {
    throw new Error(`foreign or stale publication journal: ${journal}; retained`);
  }
  const entries = fs.readdirSync(staging);
  if (entries.some(name => !['publication.json', 'fixture', 'previous'].includes(name))) throw new Error('foreign publication entries; retained');
  const fixture = path.join(staging, 'fixture');
  const previous = path.join(staging, 'previous');
  const next = publicationIdentity(fixture);
  const old = publicationIdentity(previous);
  const final = publicationIdentity(finalDestination);
  if (next && (next !== record.next || publicationTree(fixture) !== record.nextHash)) throw new Error('unverified publication stage; retained');
  if (old && old !== record.old) throw new Error('foreign previous fixture; retained');
  if (!final && old && next) {
    if (publicationTree(previous) !== record.oldHash) throw new Error('changed previous fixture; retained');
    // Prefer the original (including saves) to completing an interrupted replacement.
    fs.renameSync(previous, finalDestination);
    publicationSync(parent);
    publicationSync(staging);
  } else if (!final && !old && next && record.old === null) {
    fs.renameSync(fixture, finalDestination);
    publicationSync(parent);
    publicationSync(staging);
  } else if (final === record.old && next && !old) {
    if (publicationTree(finalDestination) !== record.oldHash) throw new Error('changed original fixture; retained');
  } else if (final === record.next && !next) {
    if (publicationTree(finalDestination) !== record.nextHash) throw new Error('changed published fixture; retained');
  } else throw new Error(`ambiguous publication state: ${staging}; retained`);
  fs.rmSync(staging, { recursive: true });
  publicationSync(parent);
  console.log(`RECOVER ${candidate.id}: reconciled interrupted publication`);
}

function journalPublication(candidate, finalDestination, staging, destination) {
  const parent = publicationParent(finalDestination);
  const old = publicationIdentity(finalDestination);
  const record = { schema: 1, key: publicationKey(candidate, finalDestination),
    stage: publicationIdentity(staging), next: publicationIdentity(destination), old,
    oldHash: old ? publicationTree(finalDestination) : null,
    nextHash: publicationTree(destination, true) };
  const fd = fs.openSync(path.join(staging, 'publication.json'), 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(record) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  publicationSync(staging);
  publicationSync(parent);
}

async function fetchCandidate(candidate) {
  const fixture = fixtureId(candidate);
  assertSafeRelative(fixture, `${candidate.id}.fixture`);
  const finalDestination = path.join(ASSET_ROOT, fixture);
  let destination = finalDestination;
  if (candidate.fixture && candidate.fixture !== candidate.id) {
    console.log(`SHARED ${candidate.id}: uses fixture ${candidate.fixture}`);
    return { shared: 1 };
  }
  reconcilePublication(candidate, finalDestination);
  const provenanceFile = path.join(destination, '.candidate-source.json');
  if (prepare) {
    if (!fs.existsSync(destination)) {
      throw new Error(`cannot prepare missing candidate fixture: ${path.relative(ROOT, destination)}`);
    }
    runPostExtract(candidate, destination);
    writeBrowserManifest(candidate, destination);
    console.log(`PREP   ${candidate.id}: ${path.relative(ROOT, destination)}`);
    return { kept: 1 };
  }
  if (!candidate.packages.length) {
    console.log(`MANUAL ${candidate.id}: ${candidate.manual || 'no automated package is pinned'}`);
    return { manual: 1 };
  }
  if (fs.existsSync(provenanceFile) && !force) {
    writeBrowserManifest(candidate, destination);
    console.log(`KEEP   ${candidate.id}: ${path.relative(ROOT, destination)}`);
    return { kept: 1 };
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `wa-candidate-${candidate.id}-`));
  let staging;
  let backup;
  const provenance = [];
  try {
    if (force) {
      // Keep the replacement on the destination filesystem for rename publication.
      fs.mkdirSync(path.dirname(finalDestination), { recursive: true });
      staging = fs.mkdtempSync(`${finalDestination}.replacement-`);
      destination = path.join(staging, 'fixture');
    }
    fs.mkdirSync(destination, { recursive: true });
    for (let index = 0; index < candidate.packages.length; index++) {
      const pkg = candidate.packages[index];
      if (!pkg.url || !/^[0-9a-f]{40}$/.test(pkg.sha1 || '')) {
        throw new Error(`package ${index + 1} needs a URL and pinned SHA-1`);
      }
      const download = path.join(temp, `package-${index + 1}`);
      console.log(`FETCH  ${candidate.id}: ${pkg.url}`);
      await downloadWithRetries(pkg.url, download);
      const actual = sha1(download);
      if (actual !== pkg.sha1.toLowerCase()) {
        throw new Error(`SHA-1 mismatch for ${pkg.url}: expected ${pkg.sha1}, got ${actual}`);
      }
      const into = pkg.into || '.';
      assertSafeRelative(into === '.' ? 'root' : into, `${candidate.id}.packages[${index}].into`);
      if (pkg.type === 'archive') {
        extractArchive(download, path.join(destination, into));
      } else if (pkg.type === 'file') {
        assertSafeRelative(pkg.destination, `${candidate.id}.packages[${index}].destination`);
        const target = path.join(destination, pkg.destination);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(download, target);
      } else {
        throw new Error(`unsupported package type: ${pkg.type}`);
      }
      provenance.push({ url: pkg.url, sha1: actual, type: pkg.type, into, destination: pkg.destination || null });
    }
    runPostExtract(candidate, destination);
    writeBrowserManifest(candidate, destination);
    fs.writeFileSync(path.join(destination, '.candidate-source.json'), `${JSON.stringify({
      id: candidate.id,
      name: candidate.name,
      version: candidate.version,
      sourcePage: candidate.sourcePage,
      packages: provenance,
      postExtract: candidate.postExtract || [],
    }, null, 2)}\n`);
    if (force) {
      journalPublication(candidate, finalDestination, staging, destination);
      if (fs.lstatSync(finalDestination, { throwIfNoEntry: false })) {
        const previous = path.join(staging, 'previous');
        fs.renameSync(finalDestination, previous);
        backup = previous;
        publicationSync(staging);
        publicationSync(path.dirname(finalDestination));
      }
      try {
        fs.renameSync(destination, finalDestination);
        publicationSync(staging);
        publicationSync(path.dirname(finalDestination));
      } catch (error) {
        if (backup) {
          try {
            fs.renameSync(backup, finalDestination);
            backup = null;
            publicationSync(staging);
            publicationSync(path.dirname(finalDestination));
          } catch (rollbackError) {
            throw new Error(`${error.message}; rollback failed: ${rollbackError.message}; previous fixture retained at ${backup}`);
          }
        }
        throw error;
      }
      // Publication succeeded; only now may cleanup remove the previous tree.
      backup = null;
    }
    console.log(`READY  ${candidate.id}: ${path.relative(ROOT, finalDestination)}`);
    return { fetched: 1 };
  } catch (error) {
    console.error(`ERROR  ${candidate.id}: ${error.message}`);
    return { failed: 1 };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
    // A failed rollback must never delete the only remaining previous fixture.
    if (staging && !backup) fs.rmSync(staging, { recursive: true, force: true });
  }
}

(async () => {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.candidates)) usage('unsupported candidate manifest');
  const known = new Set(manifest.candidates.map(candidate => candidate.id));
  if (known.size !== manifest.candidates.length) usage('candidate IDs must be unique');
  if (selectedIds) {
    const unknown = [...selectedIds].filter(id => !known.has(id));
    if (unknown.length) usage(`unknown candidate IDs: ${unknown.join(', ')}`);
  }
  fs.mkdirSync(ASSET_ROOT, { recursive: true });
  const wantedIds = selectedIds ? new Set(selectedIds) : null;
  if (wantedIds) {
    for (const candidate of manifest.candidates) {
      if (wantedIds.has(candidate.id) && candidate.fixture) wantedIds.add(candidate.fixture);
    }
  }
  const candidates = manifest.candidates.filter(candidate => !wantedIds || wantedIds.has(candidate.id));
  const totals = { fetched: 0, kept: 0, shared: 0, manual: 0, failed: 0 };
  for (const candidate of candidates) {
    const result = await fetchCandidate(candidate);
    for (const [key, value] of Object.entries(result)) totals[key] += value;
  }
  console.log(`candidate fetch: ${totals.fetched} fetched, ${totals.kept} kept, ${totals.shared} shared, ${totals.manual} manual, ${totals.failed} failed`);
  process.exit(totals.failed ? 1 : 0);
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
