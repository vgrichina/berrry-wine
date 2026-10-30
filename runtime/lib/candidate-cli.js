// Launch-plan for the CLI candidate corpus manifest (test/candidate-corpus/
// manifest.json). test/test-cli-candidate-corpus.js runs one candidate from an
// entry: this module owns the generated test/run.js argument list and the
// schema/media validation around it, so regression tests can inspect exactly
// what a candidate would launch without spawning a guest.
//
// Generic schema extension for dual-drive media layouts (documented for the
// Silver demo in docs/re-notes/silver-demo.md): one launch plus a second mount
// that reads the *unchanged original archive* as its own drive with CD-ROM
// semantics:
//
//   cli.exeGuestPath  guest path of the executable, not just a basename
//   cli.cwd           initial guest working directory (run.js --cwd)
//   cli.vfsTrees      mount fixture directories at C:\ preserving their
//                     relative paths (run.js --vfs-tree=DIR: game/SILVER
//                     becomes guest C:\SILVER and can be the working
//                     directory)
//   cli.zipMounts     mount an unchanged archive read-only under a guest root
//                     (run.js --zip=PATH --zip-root=DIR)
//
// Everything stays generic: no candidate-specific code lives here, and
// candidates that set only the older cli fields generate exactly the same
// arguments as before.

const fs = require('fs');
const path = require('path');

function fixtureId(candidate) {
  return candidate.fixture || candidate.id;
}

function requireString(candidate, field, value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${candidate.id}.cli.${field} must be a non-empty string`);
  }
  return value;
}

function requireStringArray(candidate, field, value) {
  if (!Array.isArray(value) || !value.length ||
      value.some(entry => typeof entry !== 'string' || !entry.trim())) {
    throw new Error(`${candidate.id}.cli.${field} must be a non-empty string array`);
  }
}

// Accepts CLI-style guest spellings (C:/SILVER/) and returns the backslash form
// (C:\SILVER\).
function guestPath(candidate, field, value) {
  requireString(candidate, field, value);
  const normalized = path.win32.normalize(String(value).trim().replace(/\//g, '\\'));
  if (!/^[a-z]:\\/i.test(normalized)) {
    throw new Error(`${candidate.id}.cli.${field} needs a drive-rooted guest path: ${value}`);
  }
  return normalized;
}

function guestFile(candidate, field, value) {
  const normalized = guestPath(candidate, field, value);
  if (/[\\/]$/.test(normalized)) {
    throw new Error(`${candidate.id}.cli.${field} needs a file path, not a directory: ${value}`);
  }
  return normalized;
}

function guestDir(candidate, field, value) {
  let normalized = guestPath(candidate, field, value);
  if (!/[\\/]$/.test(normalized)) normalized += '\\';
  return normalized;
}

// Fixture-relative reference: absolute paths and `..` are data, not paths, and
// a manifest entry naming anything outside its own fixture is refused instead
// of resolved.
function fixtureRef(candidate, field, value) {
  requireString(candidate, field, value);
  const raw = String(value).trim().replace(/\\/g, '/');
  if (path.isAbsolute(raw) || /^[a-z]:/i.test(raw)) {
    throw new Error(`${candidate.id}.cli.${field} must be fixture-relative: ${value}`);
  }
  const parts = raw.split('/');
  if (parts.some(part => part === '' || part === '..' || part === '.')) {
    throw new Error(`${candidate.id}.cli.${field} must not leave the fixture root: ${value}`);
  }
  return { referral: raw, join: root => path.join(root, ...parts) };
}

function mediaError(candidate, field, referral) {
  const error = new Error(`${candidate.id}.cli.${field} media is not present: ${referral}`);
  error.media = referral;
  return error;
}

// The exact test/run.js arguments a candidate launch uses (runPath and
// executable come from the caller; --wasm is spliced in only when given, so
// dry-run inspection does not need a build). Throws on a malformed cli section,
// or on declared-but-missing media with error.media set to the fixture-relative
// miss, which the survey classifies and reports instead of launching an
// incomplete configuration.
function buildLaunchArgs(candidate, options) {
  const opts = options || {};
  const exists = opts.exists || fs.existsSync;
  if (!opts.runPath || !opts.executable) {
    throw new Error('buildLaunchArgs needs runPath and executable');
  }
  if (!opts.fixtureRoot) throw new Error('buildLaunchArgs needs fixtureRoot');
  const cli = candidate.cli || {};

  const args = [
    opts.runPath,
    `--exe=${opts.executable}`,
    ...((opts.wasmPath !== undefined && opts.wasmPath !== null) ? [`--wasm=${opts.wasmPath}`] : []),
    '--no-build',
    '--no-close',
    '--quiet-api',
    '--quiet-blocks',
    '--stuck-after=50',
    `--max-batches=${cli.maxBatches || 80}`,
    `--batch-size=${cli.batchSize || 10000}`,
  ];

  if (cli.args !== undefined) {
    args.push(`--args=${requireString(candidate, 'args', cli.args)}`);
  }
  if (cli.exeGuestPath !== undefined) {
    args.push(`--exe-guest-path=${guestFile(candidate, 'exeGuestPath', cli.exeGuestPath)}`);
  }
  if (cli.cue !== undefined) {
    requireString(candidate, 'cue', cli.cue);
    const cueRef = fixtureRef(candidate, 'cue', cli.cue);
    const cue = cueRef.join(opts.fixtureRoot);
    if (!exists(cue)) throw new Error(`${candidate.id}.cli.cue is missing: ${cue}`);
    args.push(`--cue=${cue}`);
  }
  if (cli.dlls !== undefined) {
    requireStringArray(candidate, 'dlls', cli.dlls);
    for (const referral of cli.dlls) {
      const dll = fixtureRef(candidate, 'dlls', referral).join(opts.fixtureRoot);
      if (!exists(dll)) throw new Error(`${candidate.id}.cli.dlls is missing: ${dll}`);
      args.push(`--dll-seed=${dll}`);
    }
  }
  if (cli.vfsInclude !== undefined) {
    requireStringArray(candidate, 'vfsInclude', cli.vfsInclude);
    for (const pattern of cli.vfsInclude) args.push(`--vfs-include=${pattern}`);
  }
  if (cli.cwd !== undefined) {
    args.push(`--cwd=${guestDir(candidate, 'cwd', cli.cwd)}`);
  }
  if (cli.vfsTrees !== undefined) {
    requireStringArray(candidate, 'vfsTrees', cli.vfsTrees);
    for (const referral of cli.vfsTrees) {
      const treeRef = fixtureRef(candidate, 'vfsTrees', referral);
      const tree = treeRef.join(opts.fixtureRoot);
      if (!exists(tree)) throw mediaError(candidate, 'vfsTrees', treeRef.referral);
      if (!(opts.isDirectory || (filename => fs.statSync(filename).isDirectory()))(tree)) {
        throw mediaError(candidate, 'vfsTrees', treeRef.referral);
      }
      // run.js resolves --vfs-tree through appAsset: absolute or ROOT-relative
      // only, so a fixture-rooted reference must be passed absolute.
      args.push(`--vfs-tree=${tree}`);
    }
  }
  if (cli.zipMounts !== undefined) {
    if (!Array.isArray(cli.zipMounts) || !cli.zipMounts.length ||
        cli.zipMounts.some(mount => !mount || typeof mount !== 'object' ||
          typeof mount.file !== 'string' || typeof mount.root !== 'string')) {
      throw new Error(`${candidate.id}.cli.zipMounts entries need {file, root}`);
    }
    if (cli.zipMounts.length !== 1) {
      throw new Error(`${candidate.id}.cli.zipMounts supports exactly one mount: test/run.js has one global ZIP root`);
    }
    for (const mount of cli.zipMounts) {
      requireString(candidate, 'zipMounts file', mount.file);
      requireString(candidate, 'zipMounts root', mount.root);
      if (!/[\\/]$/.test(mount.root.trim())) {
        throw new Error(`${candidate.id}.cli.zipMounts root needs a trailing separator: ${mount.root}`);
      }
      const zip = fixtureRef(candidate, 'zipMounts', mount.file).join(opts.fixtureRoot);
      if (!exists(zip)) throw mediaError(candidate, 'zipMounts', mount.file.trim());
      const root = guestDir(candidate, 'zipMounts', mount.root);
      args.push(`--zip-root=${root}`);
      args.push(`--zip=${zip}`);

    }
  }
  return args;
}

module.exports = { fixtureId, buildLaunchArgs };
