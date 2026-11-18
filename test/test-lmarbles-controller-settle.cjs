'use strict';
// Full controller against authored native SDL through production batch PNGs.
// Requires LMARBLES_MODULE_HOLDER and LMARBLES_SETTLE_TEST_OUT. No original game.
// Faults are confined to this authored consumer's transport/presentation.
// (JS form of Codex's test-lmarbles-controller-settle.py from ac58d9074; the
// controller and supervisor are tools/lmarbles-{controller,supervisor}.cjs.)
//
//   node test/test-lmarbles-controller-settle.cjs [positive|late|no-presentation|refusal ...]
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const c = require('../tools/lmarbles-controller.cjs');
for (const k of ['LMARBLES_MODULE_HOLDER', 'LMARBLES_SETTLE_TEST_OUT'])
  if (!process.env[k]) throw new Error(`${k} is required`);
const OUT = path.resolve(process.env.LMARBLES_SETTLE_TEST_OUT);
const now = () => Date.now() / 1000;
const mono = () => performance.now() / 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = n => fs.existsSync(path.join(c.R, n));

const BOOT = String.raw`
const fs=require('node:fs'),rows=[];let active=null,afterInput=false,repaints=0;
const mark=(phase,extra={})=>{if(rows.length<256)rows.push({phase,at:Date.now(),ms:performance.now(),...extra});};
process.once('exit',()=>fs.writeFileSync(process.env.LMARBLES_SETTLE_PHASES,JSON.stringify(rows)));
const hi=require('./lib/host-imports'),oldHi=hi.createHostImports;
hi.createHostImports=(...args)=>{const v=oldHi(...args),old=v.gdi.presentBestDxOffscreen;
 v.gdi.presentBestDxOffscreen=function(...a){if(active)mark('dirty-present-enter',{force:a[0]});const r=old.apply(this,a);if(active)mark('dirty-present-return');return r;};return v;};
const {Win98Renderer}=require('./lib/renderer'),rp=Win98Renderer.prototype.repaint;
Win98Renderer.prototype.repaint=function(...a){if(active){mark('repaint-enter');repaints++;
 if(afterInput&&process.env.LMARBLES_SETTLE_FAULT==='no-presentation'&&repaints===2)throw Error('authored capture presentation refusal');}
 const r=rp.apply(this,a);if(active)mark('repaint-return');return r;};
const raster=require('./lib/raster-canvas'),cc=raster.createCanvas;
raster.createCanvas=(...a)=>{const v=cc(...a);if(a[0]===1024&&a[1]===712){const enc=v.toBufferSync;v.toBufferSync=function(...b){if(active)mark('encode-enter');const r=enc.apply(this,b);if(active)mark('encode-return',{bytes:r.length});return r;};}return v;};
const wr=fs.writeFileSync;
fs.writeFileSync=function(file,...a){const selected=active&&String(file)===active;if(selected)mark('write-enter');const r=wr.call(this,file,...a);if(selected)mark('write-return');return r;};
const transport=require('./lib/control-server'),start=transport.startControlServer;
transport.startControlServer=options=>start({...options,onCommand(command){
 if(command.action==='guarded-input'){
  afterInput=true;
  if(process.env.LMARBLES_SETTLE_FAULT==='refusal')options.onCommand({action:'eval',code:'exports.set_focus(0)'});
 }
 if(command.cmd?.startsWith('png:')){active=command.cmd.slice(4);repaints=0;mark('queued-png-enter');}
 const result=options.onCommand(command);
 if(command.cmd?.startsWith('png:'))return Promise.resolve(result).then(value=>{
  mark('queued-png-complete',{batch:value.batch});active=null;
  if(afterInput&&process.env.LMARBLES_SETTLE_FAULT==='late')return new Promise(resolve=>setTimeout(()=>resolve(value),3100));return value;
 });
 return result;
}});
process.argv=['node','test/run.js',...process.argv.slice(1)];require('./test/run.js');
`;

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  s.on('error', reject);
});

// One authored session: start(name) ... finish(). Mirrors the Python Queued case.
async function start(name) {
  const st = { out: path.join(OUT, name), intent: 'press' };
  fs.mkdirSync(st.out, { recursive: true });
  if (fs.readdirSync(st.out).length) throw new Error(`${st.out} must be new`);
  c.R = st.out;
  const fixture = process.env.LMARBLES_SETTLE_FIXTURE_JSON ? JSON.parse(process.env.LMARBLES_SETTLE_FIXTURE_JSON)
    : JSON.parse(execFileSync(process.execPath, ['test/test-ltris-sdl-keyboard.cjs'], { cwd: ROOT, encoding: 'utf8' }));
  c.save('authored-fixture.json', fixture);
  const port = await freePort();
  c.URL = `http://127.0.0.1:${port}/ctl`;
  const env = { ...process.env, LMARBLES_CONTROL_OUT: st.out, LMARBLES_CONTROL_URL: c.URL,
    LMARBLES_SETTLE_FAULT: name, LMARBLES_SETTLE_PHASES: path.join(st.out, 'phases.json'),
    WINE_CONTROL_PHASE_TRACE: path.join(st.out, 'http-phases.json') };
  Object.assign(process.env, { LMARBLES_CONTROL_OUT: st.out, LMARBLES_CONTROL_URL: c.URL });
  let args = ['node', '-e', BOOT, '--', '--exe=' + fixture.file, '--no-build', '--threads', '--real-ticks', '--screen=1024x712',
    '--max-seconds=40', '--max-batches=10000000', '--control=' + port, '--quiet-api', '--quiet-blocks', '--no-close'];
  if (process.env.LMARBLES_SETTLE_DRIVER) args.push('--env=SDL_VIDEODRIVER=' + process.env.LMARBLES_SETTLE_DRIVER);
  const media = path.join(ROOT, 'test/binaries/candidates/lmarbles-108/game/LMARBLES');
  args.push(...['SDL.dll', 'libgcc_s_sjlj-1.dll', 'libwinpthread-1.dll'].map(n => '--dll-seed=' + path.join(media, n)));
  args.push('--dll-seed=' + path.join(ROOT, 'test/binaries/dlls/msvcrt.dll'));
  c.save('recipe.json', { cwd: ROOT, args, seconds: 340, reserveSeconds: 300, watchdogGrace: 2, nativeScene: true,
    inputPolicy: { confirmationMs: 500, physicalUpMs: 1750, observationMs: 3000, gameFreshnessSeconds: 5, menuFreshnessSeconds: 30 },
    moduleHolder: process.env.LMARBLES_MODULE_HOLDER });
  const p = spawn(process.execPath, ['tools/lmarbles-supervisor.cjs', 'durablewait', st.out], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let so = '', se = '';
  p.stdout.on('data', d => { so += d; }); p.stderr.on('data', d => { se += d; });
  st.p = p;
  st.done = new Promise(resolve => p.on('close', (code, signal) => resolve({ code, signal, stdout: so, stderr: se })));
  const end = mono() + 20;
  for (;;) {
    try {
      const s = await c.call({ action: 'snapshot' }, 1);
      if (s.mainHwnd !== '0x0' && s.focusWindow.live && s.physicalUp) break;
    } catch {}
    assert(mono() < end, 'authored SDL startup');
    await sleep(20);
  }
  await c.capture('fresh');
  const r = c.read('fresh.json');
  c.save('fresh-review.json', { at: now(), pngSHA256: r.pngSHA256, scene: 'game', observation: 'Automated authored SDL fixture review only' });
  await c.bind('fresh');
  return st;
}

async function finish(st) {
  // Never query a terminal input context, even for teardown.
  if (!exists('cancel-request.json')) c.save('cancel-request.json', { at: now(), reason: 'authored fixture complete', nativeQuit: false });
  const w = await Promise.race([st.done, sleep(20000).then(() => { st.p.kill('SIGKILL'); throw new Error('TimeoutExpired: durablewait'); })]);
  c.save('tool-wait.json', { pid: st.p.pid, exit: w.code, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: w.stdout, stderr: w.stderr });
  assert.equal(w.code, 0);
  for (const name of ['native-wait.json', 'watchdog-wait.json', 'outer-child-wait.json', 'outer-wait.json']) {
    const x = c.read(name); assert.equal(x.exit, 0); assert(x.actualWait && x.stdoutEOF && x.stderrEOF, name);
  }
  const phases = c.read('phases.json');
  assert(phases.some(r => r.phase === 'queued-png-complete'));
  if (process.env.LMARBLES_SETTLE_DRIVER === 'directx') {
    assert(phases.some(r => r.phase === 'dirty-present-enter' && r.force === true));
    phases.forEach((row, i) => {
      if (row.phase !== 'encode-enter') return;
      let s = -1; for (let j = 0; j < i; j++) if (phases[j].phase === 'queued-png-enter') s = j;
      assert(phases.slice(s, i).some(r => r.phase === 'dirty-present-return'));
    });
  }
  c.save('assertions.json', { fullController: true, productionQueuedPNG: true, normalGuestBatches: true,
    wholeLosslessPixels: exists('pixels.json'), stickyClosed: exists('terminal-input-failure.json'),
    release: exists(st.intent + '-up.json') ? c.read(st.intent + '-up.json').state : 'NOT_SENT', phaseCount: phases.length });
}

async function pulse(st) {
  let review = 'fresh';
  for (let attempt = 0; attempt < 4; attempt++) {
    st.intent = attempt === 0 ? 'press' : 'press' + attempt;
    const result = await c.pulse(st.intent, ['keydown:13'], 100, review, 'authored SDL Enter changes full native surface');
    if (!String(result).startsWith('NOT_SENT')) return result;
    assert(!exists(st.intent + '-dispatch.json'));
    review = 'retry' + attempt; await c.capture(review);
    const r = c.read(review + '.json');
    c.save(review + '-review.json', { at: now(), pngSHA256: r.pngSHA256, scene: 'game', observation: 'Fresh automated authored fixture review after local NOT_SENT' });
  }
  assert.fail('four local NOT_SENT admissions; no delivery attempted');
}

function closed() {
  assert(c.read('terminal-input-failure.json').noReplay);
  assert.throws(() => c.opened(), /sticky UNKNOWN/);
}

// Run the body, then finish() exactly like unittest's addCleanup.
async function session(name, body) {
  const st = await start(name);
  let err = null;
  try { await body(st); } catch (e) { err = e; }
  try { await finish(st); } catch (e) { err = err || e; }
  if (err) throw err;
}

const CASES = {
  positive: () => session('positive', async st => {
    await pulse(st);
    const op = c.read(st.intent + '-operation.json'), result = c.read(st.intent + '.json'), up = c.read(st.intent + '-up.json');
    assert(result.completedAt < op.deadline); assert.equal(op.deadline, op.startedAt + 3);
    assert.equal(up.state, 'ACK'); assert(up.reply.released);
    assert(up.at - c.read(st.intent + '-dispatch.json').at <= 1.75);
    const s = await c.call({ action: 'snapshot' }); assert(s.physicalUp); assert.equal(s.capture, '0x0');
    const { PNG } = require('pngjs');
    const pixels = [path.join(st.out, 'fresh.png'), path.join(st.out, st.intent + '.png')].map(p => {
      const v = PNG.sync.read(fs.readFileSync(p)), i = (200 * v.width + 400) * 4;
      return { w: v.width, h: v.height, pixel: [...v.data.slice(i, i + 4)] };
    });
    assert.deepEqual(pixels, [{ w: 1024, h: 712, pixel: [0, 0, 0, 255] }, { w: 1024, h: 712, pixel: [0, 255, 0, 255] }]);
    c.save('pixels.json', pixels);
  }),
  late: () => session('late', async st => {
    await assert.rejects(pulse(st));
    assert.equal(c.read(st.intent + '-up.json').state, 'ACK'); closed();
  }),
  'no-presentation': () => session('no-presentation', async st => {
    await assert.rejects(pulse(st), e => e.code === 'ENOENT');
    assert(!exists(st.intent + '.png')); assert.equal(c.read(st.intent + '-up.json').state, 'ACK'); closed();
  }),
  refusal: () => session('refusal', async st => {
    await assert.rejects(pulse(st), e => e.name === 'AssertionError');
    assert(!c.read(st.intent + '-receipt.json').consumed); assert.equal(c.read(st.intent + '-up.json').state, 'ACK'); closed();
  }),
};
const pick = process.argv.slice(2).filter(a => a in CASES);
for (const name of pick.length ? pick : Object.keys(CASES)) test(name, { concurrency: false }, CASES[name]);
