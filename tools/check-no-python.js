#!/usr/bin/env node
'use strict';
// Build gate: no new Python. Scripts in this repo are JavaScript only.
//
//   git ls-files (tracked + untracked, not ignored)
//        |
//        +-- *.py file ................ must be in allowlist.pyFiles
//        +-- js/cjs/mjs/sh that runs python (spawn('python3'..),
//            "#!/usr/bin/env python", `python3 x.py` in a shell script)
//                                        must be in allowlist.callers
//
// The allowlist (tools/no-python-allowlist.json) is a ratchet: it only
// shrinks. An entry whose file is gone or no longer runs python fails the
// gate until it is removed, so ports get recorded. `--prune` removes those
// stale entries; nothing ever adds entries automatically.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const listPath = path.join(root, 'tools', 'no-python-allowlist.json');
const prune = process.argv.includes('--prune');

const lsFiles = (...a) => execFileSync('git', ['ls-files', '-z', ...a],
  { cwd: root, maxBuffer: 256 << 20 }).toString('utf8').split('\0').filter(Boolean);
// Tracked files come from the index, NOT the disk: a worktree missing some
// tracked scratch/ files once made --prune drop 54 committed .py entries
// (8212da1f6). Untracked files count too, so new Python is caught before it is
// committed, except untracked scratch/ evidence (per-machine, never built).
// Only regular files: a worktree's node_modules symlink is reported as an
// untracked file (".gitignore"'s "node_modules/" matches only a directory).
const isFile = f => { try { return fs.statSync(path.join(root, f)).isFile(); } catch (_) { return false; } };
const tracked = new Set(lsFiles('--cached'));
const present = new Set([...tracked,
  ...lsFiles('--others', '--exclude-standard').filter(f => !f.startsWith('scratch/') && isFile(f))]);

const SPAWN = /\b(?:spawn|spawnSync|execFile|execFileSync|exec|execSync|fork)\s*\(\s*['"`](?:[^'"`]*\/)?python[0-9.]*['"`]/;
const ARGV = /\[\s*['"`](?:[^'"`]*\/)?python[0-9.]*['"`]\s*,/;
const SHEBANG = /^#!.*\bpython/;
const SHELL = /(?:^|[\s;&|(`])(?:[^\s;&|(`]*\/)?python[0-9.]*\s+(?:-[A-Za-z]+\s+)*\S/m;

function runsPython(file) {
  const ext = path.extname(file);
  if (!['.js', '.cjs', '.mjs', '.sh', ''].includes(ext)) return false;
  if (file === 'tools/check-no-python.js') return false; // its own patterns
  let text;
  try { text = fs.readFileSync(path.join(root, file), 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (!tracked.has(file)) return false;
    // A tracked script absent from this checkout still exists in a full one.
    // Classify its index content so --prune cannot erase a valid legacy caller.
    // A failed index read must fail the gate rather than hide a new caller.
    text = execFileSync('git', ['show', `:${file}`],
      { cwd: root, maxBuffer: 16 << 20 }).toString('utf8');
  }
  if (ext === '') return SHEBANG.test(text);
  if (SHEBANG.test(text)) return true;
  if (ext === '.sh') return SHELL.test(text.replace(/^\s*#.*$/gm, ''));
  return SPAWN.test(text) || ARGV.test(text);
}

const pyAll = [...present].filter(f => f.endsWith('.py')).sort();
if (process.argv.includes('--seed')) {
  // One-time bootstrap only: refuses once the allowlist exists.
  if (fs.existsSync(listPath)) { console.error('no-python: allowlist exists; --seed refused'); process.exit(1); }
  const callers = [...present].filter(f => !f.endsWith('.py') && runsPython(f)).sort();
  fs.writeFileSync(listPath, JSON.stringify({
    note: 'Legacy Python, ratchet: entries may only be removed (tools/check-no-python.js).',
    pyFiles: pyAll, callers }, null, 1) + '\n');
  console.log(`no-python: seeded ${pyAll.length} .py + ${callers.length} callers`);
  process.exit(0);
}
const allow = JSON.parse(fs.readFileSync(listPath, 'utf8'));
// The allowlist may only ever shrink: every entry must already be in the
// seeded list of commit 115c56ec7. Adding a line here to admit new Python is
// refused, so the only way past this gate is writing the script in Node.
const SEED = '115c56ec7';
let seed = null;
try {
  seed = JSON.parse(execFileSync('git', ['show', `${SEED}:tools/no-python-allowlist.json`],
    { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
} catch { /* shallow clone without history: shrink-only check skipped */ }
if (seed) {
  const seedPy = new Set(seed.pyFiles), seedCallers = new Set(seed.callers);
  const grown = [...allow.pyFiles.filter(f => !seedPy.has(f)), ...allow.callers.filter(f => !seedCallers.has(f))];
  if (grown.length) {
    console.error('no-python: tools/no-python-allowlist.json GREW. It only shrinks; write these in Node instead:');
    for (const f of grown) console.error('  ' + f);
    process.exit(1);
  }
}
const allowPy = new Set(allow.pyFiles), allowCallers = new Set(allow.callers);
const pyNow = [...present].filter(f => f.endsWith('.py')).sort();
const callersNow = [...present].filter(f => !f.endsWith('.py') && runsPython(f)).sort();

const newPy = pyNow.filter(f => !allowPy.has(f));
const newCallers = callersNow.filter(f => !allowCallers.has(f));
const pyNowSet = new Set(pyNow), callersNowSet = new Set(callersNow);
const stalePy = allow.pyFiles.filter(f => !pyNowSet.has(f));
const staleCallers = allow.callers.filter(f => !callersNowSet.has(f));

if (prune && (stalePy.length || staleCallers.length)) {
  allow.pyFiles = allow.pyFiles.filter(f => pyNowSet.has(f));
  allow.callers = allow.callers.filter(f => callersNowSet.has(f));
  fs.writeFileSync(listPath, JSON.stringify(allow, null, 1) + '\n');
  console.log(`no-python: pruned ${stalePy.length} .py + ${staleCallers.length} caller entries`);
  stalePy.length = staleCallers.length = 0;
}

let bad = false;
const show = (title, list) => {
  if (!list.length) return;
  bad = true;
  console.error(title);
  for (const f of list.slice(0, 40)) console.error('  ' + f);
  if (list.length > 40) console.error(`  ... ${list.length - 40} more`);
};
show('no-python: NEW Python file(s). Scripts are JavaScript only; write this in Node:', newPy);
show('no-python: NEW file(s) that run python. Use Node instead:', newCallers);
show('no-python: allowlisted .py gone (ported?). Run `node tools/check-no-python.js --prune`:', stalePy);
show('no-python: allowlisted caller no longer runs python. Run `node tools/check-no-python.js --prune`:', staleCallers);
if (bad) process.exit(1);
console.log(`no-python: ok (${pyNow.length} legacy .py, ${callersNow.length} legacy callers; allowlist only shrinks)`);
