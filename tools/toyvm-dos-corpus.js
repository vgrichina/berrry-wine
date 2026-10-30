#!/usr/bin/env node
'use strict';
// Build the original-DOS ToyVM corpus from test/toyvm-dos-corpus/titles.json,
// reading each payload IN PLACE (payloads are gitignored and never copied):
//   test/toyvm-dos-corpus/manifest.json      per-title summary + ToyVM assessment
//   test/toyvm-dos-corpus/files/<id>.json     every file: path, size, sha256, load
// The ToyVM assessment is STATIC: it compares what each program asks for (its
// bytes, its directory layout, its release's own launch config) with what
// ToyVM implements, citing the ToyVM source for each fact. It can say a title
// is blocked; scoped reviewed evidence may qualify a recorded route. Nothing here runs ToyVM.
//   node tools/toyvm-dos-corpus.js            write the manifests
//   node tools/toyvm-dos-corpus.js --check    exit 1 if they are stale (payloads needed)
//   node tools/toyvm-dos-corpus.js --only=ultima4,arena

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scanDosExe } = require('./dos-exe-scan');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'test', 'toyvm-dos-corpus');

// What ToyVM does and does not implement, each with the source that says so
// (origin/main as of 2026-10-05). A blocker cites these ids.
const TOYVM_FACTS = {
  'no-dpmi': { text: 'ToyVM implements no DPMI host (INT 31h); INT 2Fh AX=1687h discovery is unhandled, not a complete DPMI absence protocol.', cite: 'tools/toyvm/dos.js serviceCall (no 0x31); docs/dos-corpus-blockers.md "We implement no DPMI (INT 31h)"' },
  'no-vcpi': { text: 'ToyVM implements no VCPI (INT 67h AX=DExx).', cite: 'tools/toyvm/dos.js INT 67h handler (EMS 4.0 only)' },
  'paging': { text: 'ToyVM implements 386 paging; paging support alone does not qualify an extender or game.', cite: 'tools/toyvm/paging.js; tools/toyvm/paging-exec.js; ops/handoffs/toyvm-paging-complete-20261007.md' },
  'pm-dos-16bit': { text: 'DOS calls made from protected mode are served with 16-bit offsets, so a flat-model caller passing 32-bit pointers is not served correctly.', cite: 'tools/toyvm/dos.js lin() masks the offset to 16 bits' },
  'extenders-run': { text: 'DOS/4GW/CauseWay support is not globally qualified; individual reviewed routes remain scoped. The 2026-10-07 original Daggerfall CauseWay entry reached protected mode but stopped in a repeated decode-failure path; missing DPMI alone is not an observed cause.', cite: 'ops/handoffs/toyvm-native-entry-probes-20261007/FINDINGS.md' },
  'flat-fs': { text: 'ToyVM resolves every DOS path by its basename in one flat directory; there are no subdirectories (no MKDIR/CHDIR).', cite: 'tools/toyvm/dos.js hostPath; INT 21h 39h/3Bh absent' },
  'no-mscdex': { text: 'ToyVM implements no CD-ROM / MSCDEX (INT 2Fh AX=15xx) and cannot mount a disc image.', cite: 'tools/toyvm/dos.js int2f (43xx and 1600 only)' },
  'no-mpu401': { text: 'ToyVM has no MPU-401 MIDI device; ports 0x330/0x331 read 0xFF. Sound Blaster, OPL and GUS are implemented.', cite: 'tools/toyvm/dos.js port table; tools/toyvm/audio.js, opl.js, gus.js' },
  'no-vbe2-lfb': { text: 'ToyVM implements VBE 1.2 banked modes only; the VBE 2.0 linear framebuffer is refused.', cite: 'docs/toyvm-vbe.md "the LFB path stays refused"' },
  'sync-reads': { text: 'ToyVM reads a file whole and synchronously when it is opened, so every file a live session might open must be downloaded before boot; there is no on-demand fetch.', cite: 'tools/toyvm/dos.js open (readFileSync of the whole file); tools/toyvm/bundle-browser.js mount' },
  'no-batch': { text: 'ToyVM has no COMMAND.COM: EXEC runs .EXE/.COM programs (and `COMMAND.COM /C prog`), never a batch file.', cite: 'tools/toyvm/dos.js INT 21h 4Bh' },
  'exec': { text: 'ToyVM implements DOS EXEC (INT 21h 4Bh, AL=00/01), so a launcher can start the next program.', cite: 'tools/toyvm/dos.js INT 21h 4Bh' },
  'no-browser-mouse': { text: 'The browser live page wires keyboard only; INT 33h mouse exists in the CLI but no pointer events reach a live session.', cite: 'tools/toyvm/live.js and docs/dos-corpus/site.js (no mouse handlers)' },
};
const LARGE_PRELOAD = 64 * 1024 * 1024;
// What a GOG release adds AROUND the DOS game: its Windows DOSBox, installer
// scripts and metadata, Windows icons/DLLs, PDF manuals, cloud-save shims and
// the installer's marketing images. None of it is a DOS payload, and a ToyVM
// session would have to download all of it first. Recorded per title.
const WRAPPER_DIRS = ['DOSBOX/', '__redist/', '__support/', 'app/', 'commonappdata/', 'tmp/', 'cloud_saves/'];
const WRAPPER_FILES = [/^goggame-/i, /\.ico$/i, /\.pdf$/i, /\.dll$/i, /\.hashdb$/i, /^dosbox.*\.conf$/i];

function walk(base, rel, exclude, out, skipped) {
  for (const ent of fs.readdirSync(path.join(base, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const r = rel ? `${rel}/${ent.name}` : ent.name, key = r + (ent.isDirectory() ? '/' : '');
    const dirRule = [...WRAPPER_DIRS, ...exclude].find((x) => key.toLowerCase().startsWith(x.toLowerCase()));
    if (dirRule) { skipped[dirRule] = (skipped[dirRule] || 0) + (ent.isDirectory() ? countFiles(path.join(base, r)) : 1); continue; }
    if (ent.isDirectory()) walk(base, r, exclude, out, skipped);
    else if (ent.isFile()) {
      const fileRule = WRAPPER_FILES.find((re) => re.test(ent.name));
      if (fileRule) { skipped[String(fileRule)] = (skipped[String(fileRule)] || 0) + 1; continue; }
      out.push(r);
    }
  }
  return out;
}
function countFiles(dir) { let n = 0; for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : e.isFile() ? 1 : 0; return n; }
function sha256(file) {
  const h = crypto.createHash('sha256'), fd = fs.openSync(file, 'r'), buf = Buffer.alloc(1 << 20);
  try { for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0;) h.update(buf.subarray(0, n)); } finally { fs.closeSync(fd); }
  return h.digest('hex');
}
const findCi = (files, want) => files.find((f) => f.toLowerCase() === want.toLowerCase().replace(/\\/g, '/')) || null;

function assess(t, files, scans) {
  const blockers = [], cautions = [];
  const add = (list, id, text, facts) => list.push({ id, text, facts });
  const entry = scans.entry;
  if (!entry) add(blockers, 'entry-missing', `The entry program ${t.entry.program} is not in the payload.`, []);
  const pm = [entry, ...scans.others].filter((s) => s && s.mode.startsWith('protected'));
  for (const s of pm) {
    const ext = s.extender ? `${s.extender.id === 'dos4gw' ? 'DOS/4GW' : s.extender.id === 'causeway' ? 'CauseWay' : s.extender.id} (${s.extender.binding})` : 'an unidentified DOS extender';
    if (s === entry || s.name === t.entry.program) add(blockers, 'extender', `${s.name} is a 32-bit program behind ${ext}. This title requires an extender route that static scanning cannot qualify; consult title-specific reviewed evidence.`, ['no-dpmi', 'no-vcpi', 'paging', 'extenders-run', 'pm-dos-16bit']);
  }
  // Launchers that EXEC a protected-mode program are blocked by it too.
  if (entry && !entry.mode.startsWith('protected') && pm.length) add(cautions, 'chained-extender', `${pm.map((s) => s.name).join(', ')} ${pm.length > 1 ? 'are' : 'is'} 32-bit behind a DOS extender; if the entry program starts ${pm.length > 1 ? 'them' : 'it'}, the same extender blocker applies.`, ['no-dpmi', 'extenders-run']);
  const inSub = files.filter((f) => f.path.includes('/'));
  const byBase = new Map();
  for (const f of files) { const b = path.posix.basename(f.path).toUpperCase(); byBase.set(b, (byBase.get(b) || 0) + 1); }
  const collisions = [...byBase].filter(([, n]) => n > 1).map(([b]) => b).sort();
  const entryInSub = t.entry.program.includes('/');
  if (collisions.length) add(blockers, 'flat-fs-collision', `${collisions.length} file name${collisions.length === 1 ? '' : 's'} exist in more than one directory (e.g. ${collisions.slice(0, 3).join(', ')}); ToyVM's single flat directory cannot hold both copies.`, ['flat-fs']);
  else if (inSub.length) add(cautions, 'flat-fs-subdirs', `${inSub.length} file${inSub.length === 1 ? ' lives' : 's live'} in subdirectories; ToyVM would see them only by basename, so a program that changes directory or enumerates one may not find them.`, ['flat-fs']);
  if (entryInSub) add(cautions, 'entry-subdir', `The release starts ${t.entry.program} from inside its directory; ToyVM has no current directory to change into.`, ['flat-fs']);
  if (t.devices?.cdrom) add(blockers, 'cdrom', `The release's own launch mounts ${t.devices.cdImage ? 'the disc image ' + t.devices.cdImage : 'its directory'} as a CD-ROM drive; ToyVM has no MSCDEX.`, ['no-mscdex']);
  if (t.devices?.midiMpu401) add(cautions, 'midi', 'The launch command selects General MIDI on an MPU-401 (port 330h); ToyVM has none, so music would be missing or the driver may fail to initialise.', ['no-mpu401']);
  if (t.devices?.vbe2Lfb) add(blockers, 'vbe2', 'The program requires VESA VBE 2.0 (linear framebuffer); ToyVM refuses the LFB.', ['no-vbe2-lfb']);
  const bytes = files.reduce((n, f) => n + f.size, 0);
  if (bytes > LARGE_PRELOAD) add(cautions, 'preload-size', `All ${(bytes / 1048576).toFixed(0)} MB would have to download before boot and stay in memory: ToyVM cannot fetch a file on demand.`, ['sync-reads']);
  add(cautions, 'keyboard-only', 'A browser session would get keyboard input only.', ['no-browser-mouse']);
  const status = blockers.length ? 'blocked' : 'untested';
  const verdict = blockers.length
    ? `Not expected to run on ToyVM: ${blockers.map((b) => b.id).join(', ')}. Not attempted.`
    : 'No static blocker found, but it has never been run on ToyVM. Untested; not a claim that it works.';
  return { status, verdict, blockers, cautions, flatFs: { filesInSubdirs: inSub.length, collisions: collisions.slice(0, 20), collisionCount: collisions.length } };
}

// Reviewed evidence qualifies only its recorded route and never
// erases independent filesystem/device limitations. Original payload hashing is
// not needed to reconcile an already pinned run into its title metadata.
function applyEvidence(t, assessment) {
  const result = { ...assessment, blockers: assessment.blockers.map(b => ({ ...b })), cautions: assessment.cautions.map(c => ({ ...c })) };
  result.evidence = (t.toyvmEvidence || []).map(e => ({ run: e.run, at: e.at, reached: e.reached, summary: e.summary, ...(e.reviewedGameplay ? { reviewedGameplay: e.reviewedGameplay } : {}) }));
  const history = t.toyvmEvidence || [];
  const last = history.findLast(e => e.reviewedGameplay || e.observedBlocker) || history.at(-1);
  if (!last) return result;
  const reviewed = last.reviewedGameplay;
  if (reviewed) {
    if (!reviewed.reviewer || !reviewed.build?.commit || !/^[a-f0-9]{64}$/.test(reviewed.build.runtimeBundleSha256 || '')
        || !Array.isArray(reviewed.limits) || !reviewed.limits.length || !Array.isArray(reviewed.resolves)
        || reviewed.resolves.some(id => id !== 'extender') || typeof last.run !== 'string' || !last.summary) throw Error('invalid reviewed gameplay evidence');
    result.blockers = result.blockers.filter(b => !reviewed.resolves.includes(b.id));
    result.status = result.blockers.length ? 'blocked' : 'reviewed-gameplay';
    result.verdict = 'Reviewed ToyVM route (' + reviewed.build.commit + '): ' + last.summary + ' ' + reviewed.limits.join(' ');
    return result;
  }
  const observed = last.observedBlocker;
  if (observed) {
    if (![observed.id, observed.text, observed.replaces].every(x => typeof x === 'string' && x.length)
        || typeof last.run !== 'string' || typeof last.summary !== 'string') throw Error('invalid observed native blocker');
    const prior = result.blockers.find(b => b.id === observed.replaces);
    if (prior?.facts?.length) result.cautions.push({
      id: 'remaining-capabilities-' + observed.replaces,
      text: 'Static capability limits from the earlier assessment remain; the recorded startup boundary does not establish that these missing capabilities caused it.',
      facts: [...prior.facts],
    });
    result.blockers = result.blockers.filter(b => b.id !== observed.replaces);
    result.blockers.unshift({ id: observed.id, text: observed.text, facts: [], sourceRun: last.run, observedAt: last.at });
    result.status = 'blocked';
  }
  result.verdict = result.status === 'untested'
    ? `No static blocker; furthest recorded ToyVM run: ${last.reached.replace(/-/g, ' ')} (${last.run}). Gameplay untested; not a claim that it works.`
    : `Observed native ToyVM startup (${last.at}): ${last.summary} Gameplay unqualified; independent static limits remain.`;
  return result;
}

// Explicit original support data is not an exemption for an entire wrapper
// directory. Each required file has a safe source path and an unambiguous root
// guest name, matching ToyVM's existing flat mount contract.
function requiredOriginalFiles(t, base, rels) {
  const result = [], names = new Set(rels.map(p => path.posix.basename(p).toLowerCase()));
  for (const item of t.requiredOriginalFiles || []) {
    const p = item.path, guest = item.guestPath;
    if (typeof p !== 'string' || !p || p.includes('\\') || p.includes('\0') || path.posix.isAbsolute(p)
        || p.split('/').some(part => !part || part === '.' || part === '..')
        || typeof guest !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(guest)
        || guest !== path.posix.basename(p)) throw new Error('invalid required original path for ' + t.id);
    if (names.has(guest.toLowerCase())) throw new Error('required original guest name collision: ' + guest);
    const root = fs.realpathSync(base), source = fs.realpathSync(path.join(base, p));
    if (!source.startsWith(root + path.sep) || !fs.statSync(source).isFile()) throw new Error('required original outside payload: ' + p);
    names.add(guest.toLowerCase()); result.push(p);
  }
  return result;
}

// A selected regeneration must never discard other registered titles or
// silently replace their assessments with metadata from an unscanned payload.
function mergeSelectedManifest(previous, current, only) {
  if (!only || !only.length) return current;
  if (!previous || !Array.isArray(previous.titles)) throw new Error('selected regeneration needs existing manifest');
  const selected = new Set(only), rows = new Map(current.titles.map(t => [t.id, t]));
  for (const id of selected) {
    if (!rows.has(id)) throw new Error('unknown selected title ' + id);
  }
  const refreshFacts = t => {
    if (!(JSON.stringify(t.toyvm) || '').includes('no-paging')) return t;
    const copy = JSON.parse(JSON.stringify(t));
    for (const b of [...(copy.toyvm.blockers || []), ...(copy.toyvm.cautions || [])]) {
      b.facts = (b.facts || []).map(id => id === 'no-paging' ? 'paging' : id);
      b.text = b.text.replace('ToyVM has no DPMI, VCPI or paging and has never run this extender, so it is not expected to start.', 'This title requires an extender route that static scanning cannot qualify; consult title-specific reviewed evidence.');
    }
    return copy;
  };
  return { ...previous, toyvmFacts: current.toyvmFacts || previous.toyvmFacts, titles: [...previous.titles.map(t => selected.has(t.id) ? rows.get(t.id) : refreshFacts(t)), ...current.titles.filter(t => !previous.titles.some(p => p.id === t.id))] };
}

function verifyOriginalFiles(t, files) {
  if (t.originalFiles && (files.length !== t.originalFiles.length || t.originalFiles.some(pin => !files.some(f => f.path === pin.path && f.size === pin.size && f.sha256 === pin.sha256)))) throw Error('original payload hash mismatch: ' + t.id);
}

function build(only) {
  const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'titles.json'), 'utf8'));
  const outTitles = [], fileLists = {};
  for (const t of cfg.titles) {
    if (only && !only.includes(t.id)) continue;
    const base = path.join(ROOT, t.gameDir);
    const row = { id: t.id, title: t.title, candidateId: t.candidateId || null, dosGameId: t.dosGameId || null, dosboxAppIds: t.dosboxAppIds || [],
      gameDir: t.gameDir, entry: t.entry, entrySource: t.entrySource, notes: t.notes || null };
    if (!fs.existsSync(base)) {
      row.payload = { present: false, reason: `${t.gameDir} is not present on this machine (payloads are local-only).` };
      row.toyvm = { status: 'unknown', verdict: 'Payload absent here; nothing assessed.', blockers: [], cautions: [] };
      outTitles.push(row); continue;
    }
    const skipped = {};
    const rels = walk(base, '', t.exclude || [], [], skipped);
    const required = requiredOriginalFiles(t, base, rels);
    rels.push(...required); rels.sort();
    const files = rels.map((r) => { const f = path.join(base, r); return { path: r, size: fs.statSync(f).size, sha256: sha256(f), load: 'preload' }; });
    verifyOriginalFiles(t, files);
    const scanOf = (p) => { const hit = findCi(rels, p); return hit ? { ...scanDosExe(fs.readFileSync(path.join(base, hit)), hit), name: hit } : null; };
    const scans = { entry: scanOf(t.entry.program), others: (t.otherPrograms || []).map(scanOf).filter(Boolean) };
    const bytes = files.reduce((n, f) => n + f.size, 0);
    if (required.length) row.requiredOriginalFiles = t.requiredOriginalFiles;
    row.payload = { present: true, files: files.length, bytes, excluded: Object.fromEntries(Object.entries(skipped).sort()), largest: [...files].sort((a, b) => b.size - a.size).slice(0, 3).map((f) => ({ path: f.path, size: f.size })) };
    row.programs = [scans.entry, ...scans.others].filter(Boolean).map((s) => ({ name: s.name, bytes: s.bytes, mode: s.mode, extender: s.extender, packers: s.packers, newHeader: s.newHeader ? s.newHeader.signature : null }));
    const assessmentFiles = files.map(f => required.includes(f.path) ? { ...f, path: path.posix.basename(f.path) } : f);
    row.toyvm = assess(t, assessmentFiles, scans);
    row.toyvm = applyEvidence(t, row.toyvm);
    row.load = { policy: 'preload-all', preloadFiles: files.length, preloadBytes: bytes, lazyFiles: 0, reason: TOYVM_FACTS['sync-reads'].text };
    row.fileList = `test/toyvm-dos-corpus/files/${t.id}.json`;
    fileLists[t.id] = { schemaVersion: 1, id: t.id, gameDir: t.gameDir, files };
    outTitles.push(row);
  }
  const manifest = { schemaVersion: 1, generatedBy: 'tools/toyvm-dos-corpus.js', source: 'test/toyvm-dos-corpus/titles.json', about: cfg.about,
    wrapperExclusions: { dirs: WRAPPER_DIRS, files: WRAPPER_FILES.map(String) }, toyvmFacts: TOYVM_FACTS, titles: outTitles };
  return { manifest, fileLists };
}

function parseOnly(argv) {
  const selectors = argv.filter(a => a === '--only' || a.startsWith('--only='));
  if (!selectors.length) return null;
  if (selectors.length !== 1 || !selectors[0].startsWith('--only=')) throw new Error('expected one nonempty --only=id[,id] selector');
  const ids = selectors[0].slice(7).split(',');
  if (ids.some(id => !/^[a-z0-9][a-z0-9-]*$/.test(id))) throw new Error('expected nonempty --only title IDs');
  return ids;
}
module.exports = { build, assess, TOYVM_FACTS, requiredOriginalFiles, mergeSelectedManifest, parseOnly, applyEvidence, verifyOriginalFiles };

if (require.main === module) {
  const only = parseOnly(process.argv.slice(2));
  const check = process.argv.includes('--check');
  const { manifest, fileLists } = build(only);
  const published = mergeSelectedManifest(only ? JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8')) : null, manifest, only);
  const outputs = [[path.join(DIR, 'manifest.json'), published], ...Object.entries(fileLists).map(([id, v]) => [path.join(DIR, 'files', `${id}.json`), v])];
  let stale = 0;
  for (const [file, value] of outputs) {
    const text = JSON.stringify(value, null, 1) + '\n';
    if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { stale++; console.log(`stale: ${path.relative(ROOT, file)}`); } }
    else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
  }
  for (const t of manifest.titles) console.log(`${t.id.padEnd(15)} ${t.payload.present ? `${String(t.payload.files).padStart(5)} files ${(t.payload.bytes / 1048576).toFixed(1).padStart(7)} MB` : 'absent'.padEnd(24)}  toyvm=${t.toyvm.status}  ${t.toyvm.blockers.map((b) => b.id).join(',')}`);
  if (check) { console.log(stale ? `${stale} stale` : 'up to date'); process.exit(stale ? 1 : 0); }
}
