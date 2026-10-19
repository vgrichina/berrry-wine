'use strict';
// Run only after the root agent grants the sole runtime lane. No automatic input.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = '/tmp/wa-recovery-20261014';
const shared = '/home/user/wine-assembly';
const id = process.argv[2];
const captureCrc = process.argv[3] === '--capture-crc';
const traceReads = captureCrc || process.argv[3] === '--trace-reads';
assert(process.argv.length <= (traceReads ? 4 : 3), 'Unexpected controller arguments');
assert(id && /^20261019-dungeon-siege-[a-z0-9-]+$/.test(id), 'Provide a fresh run ID');
const out = path.join(shared, 'scratch/runs', id);
assert(!fs.existsSync(out), 'Never reuse evidence');
const preflight = JSON.parse(cp.execFileSync(process.execPath,
  [path.join(__dirname, 'dungeon-siege-retry-preflight.js'), root], { encoding: 'utf8' }));
assert(preflight.ready);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const free = () => { const s = fs.statfsSync(root); return s.bavail * s.bsize; };
const wasm = path.join(root, 'build/wine-assembly.wasm');
const rel = 'test/binaries/win98-games-a-d/DungeonSiege demo-D3D/extracted';
const manifest = JSON.parse(fs.readFileSync(path.join(root, rel, '.original-package.json')));
const tracked = cp.execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0')
  .filter(f => f && (/^(src|lib|tools|test)\//.test(f) || ['host.js', 'package.json', 'package-lock.json'].includes(f)))
  .map(f => path.join(root, f)).filter(p => fs.existsSync(p) && fs.statSync(p).isFile());
const pins = [...new Set([...tracked, wasm, ...manifest.files.map(f => path.join(root, rel, f.path)),
  ...preflight.fixtures.filter(f => f.ready).map(f => f.target)])].map(p => ({ path: p, sha256: hash(p) }));
fs.mkdirSync(out);
const save = (n, v) => fs.writeFileSync(path.join(out, n), JSON.stringify(v, null, 2) + '\n');
save('preflight.json', preflight); save('physical-pins.json', pins);
fs.copyFileSync(__filename, path.join(out, 'controller.js'));
fs.copyFileSync(path.join(__dirname, 'dungeon-siege-retry-preflight.js'), path.join(out, 'preflight-source.js'));
if (traceReads) fs.copyFileSync(path.join(__dirname, 'dungeon-siege-trace-control.js'), path.join(out, 'trace-control-source.js'));
if (captureCrc) fs.copyFileSync(path.join(__dirname, 'dungeon-siege-crc-capture.js'), path.join(out, 'crc-capture-source.js'));
const args = ['test/run.js', '--app=dungeon_siege_demo', '--no-build', '--wasm=' + wasm,
  '--quiet-api', '--no-close', '--no-threads', '--batch-size=200000', '--max-batches=10000000',
  '--max-seconds=90', '--control=8141', '--control-stdin', '--png=' + out + '/final.png',
  '--reg-export=' + out + '/registry.json'];
if (traceReads) args.push(
  '--trace-api=CreateFileA,ReadFile,SetFilePointer,SetFilePointerEx,GetFileSize,GetFileSizeEx,GetLastError,SetLastError,CloseHandle,MessageBoxA',
  '--trace-api-paused', '--trace-stack=ReadFile:2,GetLastError:2,SetLastError:2');
if (captureCrc) {
  args.splice(args.indexOf('--control-stdin'), 1); // Debugger alone owns stdin; normal controls use HTTP.
  // Breakpoints observe block entries: CRC CALL returns here, before ADD ESP.
  args.push('--break=0x00628d67', '--break-once');
}
save('launch.json', { root, args, traceReads, captureCrc, vfsExport: false, purpose: 'Original game observation, not installation or saved-game persistence' });
const fd = fs.openSync(path.join(out, 'output.log'), 'wx');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !(/^(WA_|WINE_)/.test(k) || ['NODE_OPTIONS', 'NODE_PATH'].includes(k))));
const child = cp.spawn(process.execPath, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'], detached: true });
save('child.json', { pid: child.pid, controllerPid: process.pid });
console.log(JSON.stringify({ out, pid: child.pid }));
let bytes = 0, reason = null, minFree = free();
let captureProcess = null, captureStarted = false, captureComplete = false, promptTail = '';
const kill = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } };
const quit = why => {
  if (!reason) {
    reason = why; save('stop.json', { at: new Date().toISOString(), reason });
    if (!child.stdin.destroyed) child.stdin.write(captureCrc ? 'q\n' : '{"action":"quit"}\n');
  }
  // A stalled guest main event loop cannot postpone this outer group kill.
  if (why !== 'soft-deadline') kill();
};
child.stdin.on('error', () => {});
const receive = b => {
  const room = Math.max(0, 4 * 1024 ** 2 - bytes);
  if (room) fs.writeSync(fd, b.subarray(0, room));
  bytes += b.length;
  if (bytes > 4 * 1024 ** 2) { quit('log-cap'); return; }
  if (captureCrc && !captureStarted && !reason) {
    promptTail = (promptTail + b.toString()).slice(-512);
    if (promptTail.includes('[s]tep/[c]ont/[d]ump')) {
      captureStarted = true;
      captureProcess = cp.execFile(process.execPath, [path.join(__dirname, 'dungeon-siege-crc-capture.js'), id],
        { timeout: 12000, killSignal: 'SIGKILL', maxBuffer: 65536 }, (error, stdout, stderr) => {
          captureProcess = null;
          save('capture-completion.json', { at: new Date().toISOString(), success: !error, error: error && error.message, stdout, stderr,
            debuggerCommand: 'q', registryExportExpected: false });
          if (error) { quit('capture-failed'); return; }
          captureComplete = true;
          if (!child.stdin.destroyed) child.stdin.write('q\n'); // Existing debugger quit; never executes guest input.
        });
    }
  }
};
child.stdout.on('data', receive); child.stderr.on('data', receive);
const allocated = p => fs.readdirSync(p, { withFileTypes: true }).reduce((n, d) => {
  const q = path.join(p, d.name); return n + (d.isDirectory() ? allocated(q) : fs.lstatSync(q).blocks * 512);
}, 0);
const check = setInterval(() => { minFree = Math.min(minFree, free()); if (minFree < 2214592512) quit('disk-floor'); if (allocated(out) > 32 * 1024 ** 2) quit('output-cap'); }, 250);
const soft = setTimeout(() => quit('soft-deadline'), 105000);
const hard = setTimeout(() => { quit('hard-deadline'); kill(); }, 120000);
child.once('close', (code, signal) => {
  clearInterval(check); clearTimeout(soft); clearTimeout(hard); fs.closeSync(fd);
  if (captureProcess) captureProcess.kill('SIGKILL');
  kill(); // Terminate any descendants left after the runner closes; inventory below verifies absence.
  const changed = pins.filter(f => !fs.existsSync(f.path) || hash(f.path) !== f.sha256);
  const inventory = cp.execFileSync('ps', ['-eo', 'pid,ppid,pgid,stat,comm'], { encoding: 'utf8' });
  const survivors = inventory.split('\n').filter(r => { const c = r.trim().split(/\s+/); return +c[0] === child.pid || +c[2] === child.pid; });
  save('postflight.json', { at: new Date().toISOString(), code, signal, reason, bytes, minFree, changed, survivors, inventory, wasmSha256: hash(wasm), vfsExport: false, captureComplete });
  console.log(JSON.stringify({ code, signal, reason, changed: changed.length, survivors }));
  process.exitCode = code || signal || reason || changed.length || survivors.length || (captureCrc && !captureComplete) ? 1 : 0;
});
