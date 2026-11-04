'use strict';
// Run-only original Zephyr start guard. No launcher, guest writes or lifecycle.
const {createHash} = require('node:crypto');
const {PNG} = require('pngjs');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };

// Exact RGB patches from personally reviewed f5f75afb3 captures. No fuzzy
// threshold, toolbar/log pixels, screenshot filenames or caller scene labels.
// Intentionally limited to the retained 1200x900, DPR=1, nearest-fit route.
const PATCHES = Object.freeze([
  {name: 'zephyr-description', box: [440,455,270,100],
    scenario: ['9aad37f9fcb0c6367f4ff0efdcfc5880579866fa2b60534c1a9df5124547386d']},
  {name: 'normal-game-gold', box: [75,570,230,65],
    scenario: ['aa3ac86e9a6b30d0e705adb01042aa9745b2c2b09d746425de565b7b40a312cd']},
  {name: 'world-terrain', box: [400,275,32,32],
    world: ['fcac766a8085ebb50ad5ab046244f61d92404f8f4725459a3c223c08ed437743']},
  {name: 'world-minimap', box: [635,750,20,30],
    world: ['48b050d41a9f1f681f6b87a50ee5822155c5d5023dd607f76e6261fa344a7c45']},
  {name: 'world-advisor', box: [787,670,30,30],
    world: ['0e41d6161fc33067a5ee492eef35a99eab9aa02b0f6a87f209c34542023a9612',
      '76f9793b35e5d2002613eae5625a7df93f9afdf6772bc84f73f363ce775c0723']},
]);

function classifyPNG(bytes) {
  const p = PNG.sync.read(bytes);
  if (p.width !== 1200 || p.height !== 900) fail('unsupported screenshot geometry');
  const patches = PATCHES.map(spec => {
    const [x,y,w,h] = spec.box, rgb = Buffer.alloc(w*h*3);
    for (let j=0; j<h; j++) for (let i=0; i<w; i++) {
      const from = ((y+j)*p.width+x+i)*4, to = (j*w+i)*3;
      if (p.data[from+3] !== 255) fail('nonopaque scene patch');
      for (let c=0; c<3; c++) rgb[to+c] = p.data[from+c];
    }
    return {name: spec.name, sha256: sha256(rgb)};
  });
  const matches = kind => PATCHES.every((spec,i) => !spec[kind] || spec[kind].includes(patches[i].sha256));
  const scenario = matches('scenario'), world = matches('world');
  return {scene: scenario && !world ? 'scenario' : world && !scenario ? 'world' : 'unknown',
    sha256: sha256(bytes), patches};
}

function assertReady(state, mask = 0) {
  const m = state?.main, t = m?.tick;
  if (!m || m.running !== true || m.guestWorker !== true || m.threadBackend !== 'worker' ||
      m.isolated !== true || t?.frozen !== true || t.hosts !== 1 ||
      !Number.isInteger(t.steps) || t.steps <= 0 || t.tickMs !== 16) fail('guest not ready');
  const windows = m.windows?.filter(w => w.visible);
  if (windows?.length !== 1 || windows[0].title !== 'Crusader Demo' ||
      windows[0].x !== 0 || windows[0].y !== 0 || windows[0].w !== 800 || windows[0].h !== 600)
    fail('original guest window not ready');
  for (const id of ['screen','screen-present']) {
    const r = m.canvases?.find(c => c.id === id)?.rect;
    if (!r || r.x !== 10 || r.y !== 194 || r.width !== 860 || r.height !== 668)
      fail('unsupported presentation geometry');
  }
  if (!Array.isArray(m.inputQueue) || m.activeInput !== null || m.lastInput !== null ||
      m.inputQueue.length || m.mouseButtonsMask !== mask) fail('input not drained');
  return windows[0].hwnd;
}

// Invert browser-input.eventPointFromClient + renderer._mapExclusiveInputPoint.
// Aim at the native pixel centre, then round-trip the browser's floor first.
function projectNative(g, x, y) {
  const v = g?.viewport, r = g?.rect;
  if (!v || !r || ![r.x,r.y,r.width,r.height,g.width,g.height,
      v.outputW,v.outputH,v.dstX,v.dstY,v.dstW,v.dstH,v.nativeX,v.nativeY,v.nativeW,v.nativeH].every(Number.isFinite) ||
      [r.width,r.height,g.width,g.height,v.outputW,v.outputH,v.dstW,v.dstH,v.nativeW,v.nativeH].some(n => n <= 0) ||
      x < v.nativeX || y < v.nativeY || x >= v.nativeX+v.nativeW || y >= v.nativeY+v.nativeH)
    fail('missing or invalid native viewport');
  // The logical pixel must map into the requested native pixel AFTER both
  // floors. A native pixel centre alone can round back to its predecessor.
  const logicalX = Math.ceil((v.dstX+(x-v.nativeX)*v.dstW/v.nativeW)*g.width/v.outputW);
  const logicalY = Math.ceil((v.dstY+(y-v.nativeY)*v.dstH/v.nativeH)*g.height/v.outputH);
  const client = {x:r.x+(logicalX+.5)*r.width/g.width, y:r.y+(logicalY+.5)*r.height/g.height};
  const cx = Math.floor((client.x-r.x)*g.width/r.width);
  const cy = Math.floor((client.y-r.y)*g.height/r.height);
  const nx = Math.floor(v.nativeX+(cx*v.outputW/g.width-v.dstX)*v.nativeW/v.dstW);
  const ny = Math.floor(v.nativeY+(cy*v.outputH/g.height-v.dstY)*v.nativeH/v.dstH);
  if (nx !== x || ny !== y) fail('native point cannot round-trip');
  return client;
}

function assertGeometry(g) {
  const v = g?.viewport, r = g?.rect;
  if (!v || !r || g.width !== 800 || g.height !== 600 ||
      r.x !== 10 || r.y !== 194 || r.width !== 860 || r.height !== 668 ||
      v.outputW !== 860 || v.outputH !== 668 || v.dstX !== 0 || v.dstY !== 11 ||
      v.dstW !== 860 || v.dstH !== 645 || v.nativeX !== 0 || v.nativeY !== 0 ||
      v.nativeW !== 800 || v.nativeH !== 600 || g.scaleMode !== 'nearest' || g.dpr !== 1)
    fail('unsupported native presentation');
}

function assertAck(ack, before, n) {
  if (!Number.isInteger(n) || n < 1 || n > 64 || ack?.requested !== n || ack.ran !== n ||
      ack.timedOut || ack.error || ack.frozen !== true || ack.hosts !== 1 ||
      ack.steps !== before+n || ack.tickMs !== 16 || ack.guests?.length !== 1 ||
      ack.guests.some(g => g.requested !== n || g.ran !== n || !g.running || !g.frozen ||
        g.steps !== ack.steps || g.tickMs !== 16 || g.timedOut || g.error))
    fail('incomplete frozen ACK');
}

class NativeStartDriver {
  constructor(io, {maxSteps = 4096, review} = {}) {
    if (!Number.isInteger(maxSteps) || maxSteps < 64 || maxSteps > 16384 || typeof review !== 'function')
      fail('finite step budget and explicit capture review required');
    this.io = io; this.review = review; this.maxSteps = maxSteps;
    this.used = 0; this.phase = 'scenario-required'; this.held = false; this.busy = false;
  }
  async step() {
    if (this.used+64 > this.maxSteps) fail('native start step budget exhausted');
    const before = (await this.io.state()).main.tick.steps;
    const ack = await this.io.step(64); this.used += 64;
    assertAck(ack, before, 64);
  }
  async capture(mask = 0) {
    const controls = this.io.controls();
    if (!controls || controls.keys?.length !== 0 || controls.buttons?.length !== 0)
      fail('foreign held controls');
    const before = await this.io.state(); assertReady(before, mask);
    const cap = await this.io.capture();
    const after = await this.io.state(); assertReady(after, mask);
    assertReady(cap.state, mask); assertGeometry(cap.geometry);
    const key = s => JSON.stringify([s.main.tick, s.main.canvases, s.main.windows]);
    if (key(before) !== key(cap.state) || key(before) !== key(after)) fail('capture crossed execution boundary');
    return {...cap, ...classifyPNG(cap.png)};
  }
  async reviewed(cap) {
    const receipt = await this.review(cap);
    if (receipt?.sha256 !== cap.sha256 || receipt.scene !== cap.scene) fail('capture review mismatch');
  }
  async drain(mask) {
    for (;;) {
      const s = await this.io.state();
      try { assertReady(s, mask); return; }
      catch (error) {
        // Only input drainage is waitable here. Exit/geometry/window failures stop.
        if (error.message !== 'input not drained') throw error;
      }
      await this.step();
    }
  }
  async input(action, point, msg, mask, hwnd) {
    await this.io[action](point);
    if (action === 'down') this.held = true;
    if (action === 'up') this.held = false;
    const m = (await this.io.state()).main;
    if (m.mouseButtonsMask !== mask || !m.inputQueue?.some(e => e.msg === msg &&
        e.hwnd === hwnd && e.mouseX === 718 && e.mouseY === 569 && e.mouseButtons === mask))
      fail('native input target/coordinates not observed');
    await this.step(); // Require guest execution after each input, even a fast drain.
    await this.drain(mask);
  }
  async start() {
    if (this.busy || this.phase !== 'scenario-required') fail('native start already attempted');
    this.busy = true; this.phase = 'starting';
    try {
      const initial = await this.capture();
      if (initial.scene !== 'scenario') fail('reviewed Zephyr scenario required');
      await this.reviewed(initial);
      // Recheck after potentially long personal review. No stale screenshot input.
      const current = await this.capture();
      if (current.sha256 !== initial.sha256) fail('scenario changed during review');
      const hwnd = assertReady(current.state), point = projectNative(current.geometry,718,569);
      await this.input('move', point, 0x200, 0, hwnd);
      const hovered = await this.capture();
      if (hovered.scene !== 'scenario') fail('scenario changed before press');
      await this.input('down', point, 0x201, 1, hwnd);
      await this.input('up', point, 0x202, 0, hwnd);
      for (;;) {
        const cap = await this.capture();
        if (cap.scene === 'world') {
          await this.reviewed(cap);
          const fresh = await this.capture();
          if (fresh.sha256 !== cap.sha256) fail('world changed during review');
          this.phase = 'world-ready'; this.worldSHA256 = cap.sha256;
          return {scene:'world', sha256:cap.sha256, steps:this.used, native:{x:718,y:569}, client:point};
        }
        // A consumed press can leave a menu picture visible during loading.
        // No second activation: advance execution only; never call it world.
        await this.step();
        await this.drain(0);
      }
    } catch (error) {
      this.phase = 'failed';
      // Balance our own held control on failure. No subsequent gameplay/steps.
      if (this.held) {
        try { await this.io.up(); this.held = false; }
        catch (cleanup) { error.cleanupError = String(cleanup); }
      }
      throw error;
    } finally { this.busy = false; }
  }
  async requireWorld() {
    if (this.phase !== 'world-ready' || this.busy) fail('world controls locked');
    try {
      const cap = await this.capture();
      if (cap.scene !== 'world') fail('genuine world entry absent');
      return cap;
    } catch (error) { this.phase = 'failed'; throw error; }
  }
}

// Adapter for the retained Puppeteer driver's page/state/shot functions. Call
// start/requireWorld inside its EvidenceBoundary.run queue, not raw mailbox I/O.
// shot(name) MUST save a fresh PNG and its state, return {png,state}; review is
// a separate operator acknowledgement after personally inspecting that PNG.
function pageAdapter(page, state, shot, controls) {
  if (typeof controls !== 'function') fail('driver held-control census required');
  let captures = 0;
  const geometry = () => page.evaluate(() => {
    const r = sharedRenderer;
    return {rect:r.canvas.getBoundingClientRect().toJSON(),width:r.canvas.width,height:r.canvas.height,
      viewport:r._exclusivePresentationViewport ? {...r._exclusivePresentationViewport} : null,
      scaleMode:r.presentationScaleMode,dpr:devicePixelRatio};
  });
  return {
    state, controls,
    step: n => page.evaluate(n => WineFrozen.step(n), n),
    capture: async () => {
      const g = await geometry(); assertGeometry(g);
      return {...await shot('native-boundary-'+captures++), geometry:g};
    },
    move: async p => {
      const target = await page.evaluate(p => document.elementFromPoint(p.x,p.y)?.id, p);
      if (target !== 'screen') fail('native input canvas occluded');
      await page.mouse.move(p.x,p.y);
    },
    down: () => page.mouse.down({button:'left'}),
    up: () => page.mouse.up({button:'left'}),
  };
}

// Install at the reviewed scenario checkpoint. Preserve the predecessor's
// immutable queue: queue.run(() => guarded(command,index)). Raw input paths
// after installation cannot bypass the positive world check.
function guardNativeCommands(driver, command) {
  const input = new Set(['click','mousemove','mousedown','mouseup','keydown','keyup']);
  return async (c,i) => {
    if (c.action === 'native-start') return driver.start();
    if (input.has(c.action)) await driver.requireWorld();
    if (driver.phase === 'failed' && !['state','shot','snapshot','quit'].includes(c.action))
      fail('first native start failure preserved');
    return command(c,i);
  };
}

module.exports = {NativeStartDriver,pageAdapter,guardNativeCommands,classifyPNG,assertReady,assertGeometry,assertAck,projectNative,sha256,PATCHES};
