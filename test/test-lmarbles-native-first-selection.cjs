'use strict';
// Independently authored public-SDL consumer. No LMarbles executable, level,
// private SDL offsets, game state, or route is loaded by this fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const { createHostImports } = require('../lib/host-imports');
const { inputEventHwnd } = require('../lib/host-window');
const { ThreadManager } = require('../lib/thread-manager');
const dll = require('../lib/dll-loader');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const sha = v => crypto.createHash('sha256').update(v).digest('hex');

function verifyMedia() {
  const source = fs.readFileSync('tools/verify-lmarbles-108.js', 'utf8');
  const manifestPath = require('node:path').resolve('test/binaries/candidates/lmarbles-108/.wine-assembly-browser.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  function verify(transform) {
    const data = structuredClone(manifest); transform(data);
    const fakeFs = Object.create(fs);
    fakeFs.readFileSync = (file, ...args) => require('node:path').resolve(file) === manifestPath
      ? Buffer.from(JSON.stringify(data)) : fs.readFileSync(file, ...args);
    vm.runInNewContext(source, { require: name => name === 'fs' ? fakeFs : require(name),
      __dirname: require('node:path').resolve('tools'), process: { argv: ['node', 'verify'] }, console: { log() {} } });
  }
  verify(() => {});
  for (const mutate of [
    m => { delete m.files[0].sha256; },
    m => { m.files[0].sha256 = '0'.repeat(64); },
    m => { m.files.find(v => v.url.endsWith('/lmarbles.exe')).sha256 = '0'.repeat(64); },
    m => { m.files[0].size++; },
    m => { m.files[0].vfsPath += 'x'; },
    m => { m.files.pop(); },
    m => { m.files.push(m.files[0]); },
  ]) assert.throws(() => verify(mutate), /86 exact SHA-pinned file mappings/);
  console.log('PASS exact original inventory/CRT and all 86 SHA-bearing rows; seven manifest corruptions rejected');
}

function controllerTest() {
  const result = require('node:child_process').spawnSync('python3', ['-B', '-c', String.raw`
import pathlib,json,subprocess,time,os,socket,importlib.util
root=pathlib.Path.cwd()
spec=importlib.util.spec_from_file_location('manual',root/'tools/lmarbles-controller.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
out=pathlib.Path(os.environ['LMARBLES_NATIVE_TEST_OUT']).resolve();out.mkdir(parents=True)
c.R=out
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
c.URL='http://127.0.0.1:'+str(port)+'/ctl'
os.environ['LMARBLES_CONTROL_URL']=c.URL;os.environ['LMARBLES_CONTROL_OUT']=str(out)
args=['node','test/run.js','--app=sol','--no-build','--threads','--real-ticks','--screen=1024x712',
      '--max-seconds=45','--max-batches=10000000','--control='+str(port),'--quiet-api','--quiet-blocks','--no-close']
c.save('recipe.json',dict(cwd=str(root),args=args,seconds=315,reserveSeconds=300,watchdogGrace=2,nativeScene=True,
                        inputPolicy=dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=5,menuFreshnessSeconds=30),
                        moduleHolder=os.environ['LMARBLES_MODULE_HOLDER']))
p=subprocess.Popen(['python3','-B','tools/lmarbles-supervisor.py','durablewait',str(out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
    end=time.time()+20
    while True:
        try:
            s=c.call({'action':'snapshot'},1)
            if s['mainHwnd']!='0x0' and s['focusWindow']['live'] and s['physicalUp']:break
        except Exception:pass
        assert time.time()<end,'synthetic native scene startup';time.sleep(.02)
    time.sleep(.3)
    c.capture('binding');r=c.read('binding.json')
    c.save('binding-review.json',dict(at=time.time(),pngSHA256=r['pngSHA256'],scene='game',observation='Automated synthetic Solitaire controller fixture, no original/personal review claim'))
    c.bind('binding')
    c.pulse('finite',['keydown:40'],100,'binding','automated synthetic controller fixture')
    while time.time()<c.reserve():time.sleep(.01)
    c.capture('quit-reserve')
    assert c.read('quit-phase.json')['irreversible']
    try:c.policy('gameplay',['keydown:39']);raise RuntimeError('cutoff accepted gameplay')
    except c.ReserveRejected:pass
    assert not (out/'terminal-input-failure.json').exists()
    c.save('controller-assertions.json',dict(nativeSceneBound=True,finiteUp=c.read('finite-up.json')['state'],
        captureLatchedQuit=True,noAfterCutoffDown=True))
finally:
    try:c.call({'action':'quit'})
    except Exception:pass
    a,b=p.communicate(timeout=15)
    c.save('tool-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
for name in ('native-wait.json','watchdog-wait.json','outer-child-wait.json','outer-wait.json'):
    w=c.read(name);assert w['exit']==0 and w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'],w
for image in out.glob('*.png'):image.unlink()
print('PASS reviewed native-scene binding, actual finite DOWN/independent UP, capture cutoff irreversible, actual native/watchdog/supervisor waits')
`], { encoding: 'utf8', timeout: 65000, env: process.env });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  assert.equal(result.status, 0, 'actual native controller fixture');
}

async function main() {
  const moduleBytes = fs.readFileSync(process.env.LMARBLES_FIXTURE_MODULE || 'build/wine-assembly.wasm');
  const compiled = await WebAssembly.compile(moduleBytes);
  const renderer = new Win98Renderer(createCanvas(1024, 712));
  const scope = { console, performance, WebAssembly, setTimeout, clearTimeout,
    setInterval, clearInterval, createHostImports, inputEventHwnd };
  vm.runInNewContext(fs.readFileSync('host.js', 'utf8') + '\nthis.Host = WineAssembly;', scope);
  const host = new scope.Host();
  host.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  host.renderer = renderer; host.logToUI = () => {};
  const imports = host.getImports(); imports.host.memory = host.memory;
  host.instance = await WebAssembly.instantiate(compiled, imports);
  renderer.wasm = host.instance; renderer.wasmMemory = host.memory;
  const api = host.instance.exports;
  const view = new DataView(host.memory.buffer);
  const bytes = new Uint8Array(host.memory.buffer);
  const wa = p => api.guest_to_wasm(p >>> 0) >>> 0;
  const fixture = makeFixture(); bytes.set(fixture, api.get_staging());
  assert(api.load_pe(fixture.length)); api.init_dx_com_thunks();
  host.threadManager = new ThreadManager(compiled, host.memory, host.instance, threadId => {
    let instance;
    const table = host.getImports({ detached: true, threadId,
      instance: () => instance, exports: () => instance?.exports });
    table.host.memory = host.memory; table.__setInstance = i => { instance = i; };
    return table;
  });
  const media = 'test/binaries/candidates/lmarbles-108/game/LMARBLES/';
  const libraries = ['SDL.dll', 'libgcc_s_sjlj-1.dll', 'libwinpthread-1.dll'].map(name =>
    ({ name, path: 'C:\\fixture\\' + name, bytes: fs.readFileSync(media + name) }));
  assert.equal(sha(libraries[0].bytes), 'd6c4166c6a00525b68ef1e8e5422963c88907589e150c85693518a93722d5d61');
  libraries.push({ name: 'msvcrt.dll', path: 'C:\\windows\\system\\msvcrt.dll',
    bytes: fs.readFileSync('test/binaries/dlls/msvcrt.dll') });
  const loaded = dll.loadDlls(api, host.memory.buffer, fixture, libraries, () => {});
  const sdlBase = loaded.find(v => v.name.toLowerCase() === 'sdl.dll').loadAddr;
  const stack = api.guest_alloc(32768) + 32700;
  function invoke(name, args = []) {
    const target = dll._test.findDllExport(api, host.memory.buffer, sdlBase, name);
    assert(target, name); api.set_esp(stack); api.call_func(target, ...args);
    const esp = api.get_esp() >>> 0;
    for (let i = 0; api.get_eip() && i < 100000; i++) {
      api.run(1000); assert.equal(api.get_yield_reason(), 0, name);
    }
    assert.equal(api.get_eip(), 0, name + ' bounded return');
    assert.equal(api.get_esp() >>> 0, esp + 4, name + ' cdecl');
    return api.get_eax() >>> 0;
  }
  assert.equal(invoke('SDL_Init', [0x20]), 0);
  assert(invoke('SDL_SetVideoMode', [640, 480, 16, 0]));
  const event = api.guest_alloc(24);
  function poll() {
    const result = [];
    for (let i = 0; i < 100; i++) {
      if (!invoke('SDL_PollEvent', [event])) return result;
      result.push({ type: view.getUint8(wa(event)), x: view.getInt16(wa(event) + 4, true),
        y: view.getInt16(wa(event) + 6, true), key: view.getInt32(wa(event) + 8, true) });
    }
    throw Error('unbounded public event pump');
  }
  poll();
  const win = Object.values(renderer.windows).find(w => w.visible && !w.isChild);
  const origin = renderer._mouseMsgOriginScreen(win.hwnd);
  const move = (x, y) => renderer.handleMouseMove(origin.x + x, origin.y + y);
  const down = (x, y) => renderer.handleMouseDown(origin.x + x, origin.y + y, 1);
  const up = (x, y) => renderer.handleMouseUp(origin.x + x, origin.y + y, 1);
  renderer._coordinatePressHoverMs = 30; renderer._buttonHoldFloorMs = -1;
  let clock = 0;
  renderer._inputNowMs = () => clock;
  move(510, 350); assert(poll().some(e => e.type === 4 && e.x === 510));
  clock = 100;
  // Modal application phase accepts the selector using public button events.
  // It leaves its lastMotion classification intact when returning to the board.
  let phase = 'selector', lastMotion = [510, 350], selected = false;
  function consume(events) {
    for (const e of events) {
      if (e.type === 4) lastMotion = [e.x, e.y];
      if (e.type === 2 && e.key === 121 && phase === 'confirmation') phase = 'board';
      if (e.type === 5) {
        if (phase === 'selector') phase = 'confirmation';
        else if (phase === 'board') {
          if (lastMotion[0] === 510) phase = 'confirmation';
          else selected = lastMotion[0] === 140 && lastMotion[1] === 150;
        }
      }
    }
  }
  down(510, 350); consume(poll()); up(510, 350); consume(poll());
  assert.equal(phase, 'confirmation');
  // The fixture's confirmation accepts an ordinary native SDL Y event. Its
  // application state is independent of original game/DLL private state.
  renderer.handleKeyDown(89); consume(poll());
  renderer.handleKeyUp(89); consume(poll());
  assert.equal(phase, 'board', 'public key event closes fixture confirmation');
  clock = 1000;
  renderer._inputNowMs = () => (clock += 12);
  // Native posted messages remain after host check_input temporarily says 0.
  // Time spent servicing them must not admit DOWN in that same SDL pump.
  for (let i = 0; i < 10; i++) api.post_message_q(win.hwnd, 0, 0, 0);
  down(140, 150);
  const arrival = poll(); consume(arrival);
  const button = poll(); consume(button);
  up(140, 150); const release = poll(); consume(release);
  const report = { module: sha(moduleBytes), arrival, button, release, phase, lastMotion, selected };
  console.log(JSON.stringify(report));
  assert(arrival.some(e => e.type === 4 && e.x === 140 && e.y === 150),
    'real SDL must publish motion before the first board DOWN despite posted work');
  assert.equal(selected, true, 'first board selection must use the newly consumed motion');
  assert(arrival.findIndex(e => e.type === 4) < arrival.findIndex(e => e.type === 5),
    'native motion must precede the native button');

  const { matches } = require('../lib/cli-native-scene');
  const { createGuardedInput } = require('../lib/cli-guarded-input');
  const hex = n => '0x' + (n >>> 0).toString(16);
  function scene() {
    const window = h => ({ hwnd: hex(h), generation: String(api.wnd_lookup_generation(h)),
      processId: api.get_process_id() >>> 0, threadId: api.get_window_thread(h) >>> 0,
      live: !!api.wnd_lookup_live(h), visible: !!renderer.windows[h]?.visible,
      isChild: !!renderer.windows[h]?.isChild, title: renderer.windows[h]?.title || '',
      owner: hex(api.wnd_get_owner(h)), parent: hex(api.wnd_get_parent(h)) });
    const main = api.get_main_hwnd(), focus = api.get_focus_hwnd();
    return { mainHwnd: hex(main), windows: Object.keys(renderer.windows).map(h => window(+h)),
      focus: hex(focus), focusTopLevel: hex(api.wnd_top_level(focus)), focusWindow: window(focus),
      capture: hex(api.get_capture_hwnd()), physicalUp: !renderer._mouseButtonsMask,
      modalHwnd: hex(api.modal_dialog_hwnd()), nativeMessageBox: null,
      nativeProcess: { pid: process.pid, executable: 'independently-authored-public-SDL-fixture' },
      eip: hex(api.get_eip()), quit: !!api.get_quit_flag(), screen: { w: 1024, h: 712 } };
  }
  // Pause at entry to a public SDL call: native EIP/focus/generation are live,
  // not forged snapshot fields or reads of an original application's state.
  const startPoll = () => {
    api.set_esp(stack);
    api.call_func(dll._test.findDllExport(api, host.memory.buffer, sdlBase, 'SDL_PollEvent'), event);
  };
  const finishPoll = () => {
    for (let n = 0; api.get_eip() && n < 100000; n++) api.run(1000);
    assert.equal(api.get_eip(), 0, 'bounded public call after guard probe');
  };
  startPoll();
  const current = scene(); assert(matches(current, current), 'actual native USER scene valid');
  const refs = { queue: renderer.inputQueue, window: renderer.windows[api.get_main_hwnd()] };
  let effects = 0;
  const guard = createGuardedInput({ snapshot: () => ({ healthy: true, refs }),
    cleanup: () => {}, validateIntent: expected => matches(scene(), expected) });
  const owner = guard.bind();
  const prepare = (nonce, intent) => guard.prepare({ ...owner, nonce, intent,
    reviewed: true, deadline: Date.now() + 10000 }, { action: 'mousemove', x: 160, y: 170 });
  for (const [name, change] of [
    ['stale-focus', s => { s.focus = '0xdead'; }],
    ['stale-focus-generation', s => { s.focusWindow.generation = '0'; }],
    ['stale-window-generation', s => { s.windows.find(w => w.hwnd === s.mainHwnd).generation = '0'; }],
  ]) {
    const stale = structuredClone(current); change(stale);
    const before = renderer.inputQueue.slice(), t = prepare(name, stale);
    assert.equal(guard.consume(t, () => { effects++; down(160, 170); }).state, 'CANCELLED');
    assert.deepEqual(renderer.inputQueue, before, name + ': no native/public input effects');
  }
  assert.equal(effects, 0); guard.close(); finishPoll();
  invoke('SDL_QuitSubSystem', [0x20]);
  assert.equal(invoke('SDL_InitSubSystem', [0x20]), 0);
  assert(invoke('SDL_SetVideoMode', [640, 480, 16, 0])); poll();
  startPoll();
  assert(!matches(scene(), current), 'actual native SDL window recreation retires the old reviewed scene');
  finishPoll();
  invoke('SDL_Quit');
  console.log('PASS authentic SDL motion/button ordering, modal Y transition, stale focus/window generation refusal, native video recreation; no original game loaded');
}
if (process.argv.includes('--verifier')) verifyMedia();
else if (process.argv.includes('--controller')) controllerTest();
else main().catch(e => { console.error(e.stack); process.exitCode = 1; });
