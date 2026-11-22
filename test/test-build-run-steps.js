'use strict';

// tools/build-run-steps.js runs build.sh's gates concurrently. What must not
// change by running them that way: a failing gate fails the build with its
// full output, `quiet` steps stay silent unless they fail, after= orders a
// step behind its prerequisites, a `kill` step is terminated rather than
// awaited, and failures are reported in DECLARED order whatever order they
// finished in.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join(ROOT, 'tools', 'build-run-steps.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-run-steps-'));
const node = process.execPath;

function list(steps) {
  const file = path.join(dir, `list-${Math.random().toString(16).slice(2)}`);
  const tok = [];
  for (const [id, opts, argv] of steps) tok.push('@step', id, ...opts, '--', ...argv);
  fs.writeFileSync(file, tok.map((t) => `${t}\0`).join(''));
  return file;
}
const js = (code) => [node, '-e', code];
function run(file, env = {}) {
  // WINE_BUILD_RECORDS unset: the runner must work without the preload too.
  const e = Object.assign({}, process.env, env);
  delete e.WINE_BUILD_RECORDS;
  return spawnSync(node, [RUNNER, file, `--out=${path.join(dir, 'steps.json')}`],
    { encoding: 'utf8', env: e, timeout: 30000 });
}

try {
  // Passing build: quiet output hidden, loud output shown, after= respected.
  const order = path.join(dir, 'order.txt');
  const ok = run(list([
    ['a', [], js(`require('fs').appendFileSync(${JSON.stringify(order)}, 'a\\n'); console.log('loud-a')`)],
    ['b', ['quiet'], js("console.log('hidden-b')")],
    ['c', ['after=a'], js(`setTimeout(() => require('fs').appendFileSync(${JSON.stringify(order)}, 'c\\n'), 300)`)],
    ['d', ['last'], js(`require('fs').appendFileSync(${JSON.stringify(order)}, 'd\\n')`)],
  ]));
  assert.strictEqual(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /loud-a/);
  assert.doesNotMatch(ok.stdout, /hidden-b/);
  assert.strictEqual(fs.readFileSync(order, 'utf8'), 'a\nc\nd\n');

  // Failing build: both failures printed in declared order (late finishes
  // first), the quiet failure's output shown, the kill step cancelled, the
  // dependent of a failure never started.
  const t0 = Date.now();
  const bad = run(list([
    ['slow-fail', ['quiet'], js("setTimeout(() => { console.log('slow-out'); process.exit(3); }, 800)")],
    ['fast-fail', [], js("console.error('fast-err'); process.exit(2)")],
    ['long', ['kill'], js('setTimeout(() => {}, 20000)')],
    ['dependent', ['after=fast-fail'], js("console.log('must-not-run')")],
  ]));
  assert.strictEqual(bad.status, 1);
  assert.ok(Date.now() - t0 < 15000, 'kill step was awaited instead of terminated');
  const all = bad.stdout + bad.stderr;
  assert.match(all, /slow-out/);
  assert.match(all, /fast-err/);
  assert.doesNotMatch(all, /must-not-run/);
  assert.ok(bad.stderr.indexOf('FAILED: slow-fail') < bad.stderr.indexOf('FAILED: fast-fail'),
    'failures must be reported in declared order');
  assert.match(bad.stderr, /cancelled after the failure: long/);

  // Serial mode keeps the literal order even without after=.
  const serialOrder = path.join(dir, 'serial.txt');
  const ser = run(list([
    ['x', [], js(`setTimeout(() => require('fs').appendFileSync(${JSON.stringify(serialOrder)}, 'x\\n'), 300)`)],
    ['y', [], js(`require('fs').appendFileSync(${JSON.stringify(serialOrder)}, 'y\\n')`)],
  ]), { WINE_BUILD_JOBS: '1' });
  assert.strictEqual(ser.status, 0, ser.stderr);
  assert.strictEqual(fs.readFileSync(serialOrder, 'utf8'), 'x\ny\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('test-build-run-steps: OK');
