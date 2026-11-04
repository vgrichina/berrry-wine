'use strict';
// Offline by default. The serialized probe reads the selected production Worker;
// it never runs guest instructions, writes guest memory, or selects a target.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const readiness = require('./deusex-owning-readiness-driver.cjs');
const ADAPTER_GIT = '36661cb71b738cf08d91ad51edf55e97084423af';
const ADAPTER_SHA = 'c33adc61c76406e896e9a0cb2dc373fdffd4c3c330ed758121bc48a63b017092';
const BASELINE = 'scratch/runs/20261104-deusex-complete-driver-input-preflight/next-driver-fixed.cjs';
const RECOVERED = 'scratch/runs/20261104-deusex-owning-original-native/recovered/original-output';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

function originalAdapter() {
  const b = require('node:child_process').execFileSync('git', ['show',
    ADAPTER_GIT + ':lib/deusex-ordered-producer-observer.js']);
  assert.equal(hash(b), ADAPTER_SHA, 'exact original adapter');
  return b; // Compile in memory; do not replace a peer's checkout or archive it.
}

// Puppeteer evaluates this function inside the already selected owning Worker.
// instance/memory/endpointIdentity/workerSlot are the shipped Worker's bindings.
function installPixelBinding(expected) {
  if (!expected || expected.slot !== 0 || workerSlot !== 0 ||
      expected.endpoint !== endpointIdentity || !Number.isSafeInteger(endpointIdentity) ||
      !instance || instance.exports.memory !== memory || instance.exports.get_current_thread_id() !== 1)
    throw Error('pixel binding requires selected owning instance/endpoint/thread/memory');
  const P = DeusExDrawObserver.OwningDrawObserver.prototype;
  if (P.__pixelBinding) throw Error('pixel binding already installed');
  const ex = instance.exports, mem = memory, endpoint = endpointIdentity, previous = P.captureIdentity;
  const state = { version: 1, records: 0, bytesRead: 0, maxRecords: 9, maxBytes: 36 * 1024 * 1024,
    lifetime: 'unknown; identical-address ABA is unobservable', history: 'checkpoints only', stopped: null };
  let owner = null, frame = null, moduleKey = null;
  function identity(o) {
    if (instance.exports !== ex || memory !== mem || ex.memory !== mem || o.ex !== ex ||
        endpointIdentity !== endpoint || workerSlot !== 0 || ex.get_current_thread_id() !== 1)
      throw Error('foreign or replaced owning identity');
    if (!owner) { owner = o; frame = o.frame; moduleKey = JSON.stringify(o.module); }
    if (o !== owner || !frame || o.frame !== frame || JSON.stringify(o.module) !== moduleKey ||
        JSON.stringify(o.resolveModule()) !== moduleKey) throw Error('stale Draw/frame/module');
  }
  function scan(layout) {
    const { bitsWa, width, height, bpp, stride } = layout;
    if (![bitsWa, width, height, bpp, stride].every(Number.isSafeInteger) || bitsWa <= 0xf0 ||
        width < 1 || width > 2048 || height < 1 || height > 2048 || ![16, 32].includes(bpp) ||
        stride < width * (bpp / 8) || stride > 8192 || bitsWa + stride * height > mem.buffer.byteLength)
      throw Error('invalid storage size/depth/stride/pointer');
    const length = stride * height;
    if (length > 4 * 1024 * 1024 || state.bytesRead + length > state.maxBytes)
      throw Error('pixel byte limit');
    state.bytesRead += length;
    const bytes = new Uint8Array(mem.buffer, bitsWa, length), view = new DataView(mem.buffer);
    let fnv1a32 = 2166136261, nonzeroBytes = 0, nonzeroPixels = 0;
    const rows = [], samples = [];
    for (let y = 0; y < height; y++) {
      let row = 0;
      for (let x = 0; x < stride; x++) {
        const b = bytes[y * stride + x]; nonzeroBytes += b !== 0;
        fnv1a32 = Math.imul(fnv1a32 ^ b, 16777619) >>> 0;
      }
      for (let x = 0; x < width; x++) {
        const at = bitsWa + y * stride + x * (bpp / 8);
        // RGB only: opaque black RGBA must not count as nonzero color.
        const rgb = bpp === 16 ? view.getUint16(at, true) : view.getUint32(at, true) & 0xffffff;
        if (rgb) { row++; if (samples.length < 16) samples.push({ x, y, rgb }); }
      }
      rows.push(row); nonzeroPixels += row;
    }
    return { ...layout, length, fnv1a32, nonzeroBytes, nonzeroPixels, rows, samples,
      atomic: false, allocationLifetime: 'unknown' };
  }
  P.captureIdentity = function(point) {
    const answer = previous.apply(this, arguments);
    const snapshot = this.identities?.at(-1);
    if (!snapshot || snapshot.point !== point) return answer;
    const result = snapshot.pixelBinding = { point, endpoint, slot: 0, thread: 1, status: 'unknown', storages: [] };
    if (state.stopped) {
      result.status = 'unavailable'; result.error = state.stopped; result.coverage = { ...state };
      return answer;
    }
    try {
      identity(this);
      if (state.records >= state.maxRecords) throw Error('pixel record limit');
      state.records++;
      const s = snapshot.surface;
      if (!s || !snapshot.modulesStable || snapshot.errors.length) throw Error('unguarded surface identity');
      result.viewport = frame.viewport;
      result.pixels = s.pixels;
      result.hwnd = s.hwnd;
      result.route = s.route;
      const layout = { bitsWa: s.pixelsWa, width: s.width, height: s.height,
        bpp: s.colorBytes * 8, stride: s.stridePixels * s.colorBytes };
      result.storages.push({ role: 'viewport', ...scan(layout) });
      result.candidates = s.candidates.map(c => ({ ...c,
        exactLayout: ['width', 'height', 'bpp', 'stride'].every(k => c[k] === layout[k]),
        sameStorage: c.bitsWa === layout.bitsWa }));
      // The descriptor may rotate away from ScreenPointer during Flip. Preserve
      // both identities; a mismatch after Unlock is not itself a defect.
      for (const c of s.candidates) if (c.bitsWa !== layout.bitsWa)
        result.storages.push({ role: 'current-candidate', ...scan(c) });
      for (const w of s.windowSurfaces)
        result.storages.push({ role: 'window', ...scan(w) });
      identity(this);
      result.status = 'checkpoint-read';
    } catch (error) { result.status = 'unavailable'; result.error = String(error.message || error); state.stopped = result.error; }
    result.coverage = { ...state };
    return answer;
  };
  P.__pixelBinding = state;
  return { installed: true, endpoint, slot: 0, maxRecords: state.maxRecords, maxBytes: state.maxBytes };
}

function transform(source) {
  let body = readiness.transform(source);
  const before = "write('producer-installed.json',await owner.evaluate(require('./producer.cjs').installProducer));";
  assert.equal(body.split(before).length, 2, 'exact original producer anchor');
  body = body.replace(before,
    "write('pixel-binding-installed.json',await bounded(owner.evaluate(require(process.cwd()+'/tools/deusex-black-frame-binding.cjs').installPixelBinding,await page.evaluate(require(process.cwd()+'/tools/deusex-owning-readiness-driver.cjs').owningIdentity)),5000));\n " + before);
  return body;
}

function analyze(root = RECOVERED) {
  const read = name => readiness.read(root + '/' + name);
  const json = name => JSON.parse(read(name));
  const collector = json('result.json').collector.result;
  const ids = collector.identityObservations;
  const raw = json('raw-surfaces.json').find(r => r.bitsWa === 475484160);
  assert(raw && raw.targetHwnd === 65539 && raw.width === 640 && raw.height === 480 && raw.bpp === 16 && raw.stride === 1280);
  const pixels = read(raw.file);
  assert.equal(hash(pixels), raw.sha256);
  assert.equal(pixels.length, 614400);
  const publications = json('page-publications.json');
  const producer = json('producer.json');
  const verification = JSON.parse(readiness.read('scratch/runs/20261104-deusex-owning-original-native/inherited-verification.json'));
  const pins = JSON.parse(verification.stdout).pins;
  const relevant = ['host.js', 'lib/renderer.js', 'lib/gdi-surface.js', 'lib/host-imports.js', 'lib/region-map.generated.js', 'lib/guest-worker.js',
    'lib/guest-rpc.js', 'lib/deusex-draw-observer.js', 'src/09a8-handlers-directx.wat'];
  const sourcePins = relevant.map(path => {
    const pin = pins.find(p => p.path === path); assert(pin, 'retained source pin ' + path);
    const b = fs.readFileSync(path);
    assert.equal(hash(b), pin.sha256, 'trace uses exact original production source ' + path);
    assert.equal(b.length, pin.size);
    return pin;
  });
  return { offline: true, originalAttemptGit: 'ca5e30e544f5104296ad21cc77ea680d87af4976',
    sourcePins,
    adapter: { git: ADAPTER_GIT, sha256: hash(originalAdapter()) },
    inputs: ['result.json', 'raw-surfaces.json', raw.file, 'page-publications.json', 'producer.json', 'ordered.json']
      .map(name => { const b = read(name); return { path: root + '/' + name, bytes: b.length, sha256: hash(b) }; }),
    checkpoints: ids.map(i => ({ point: i.point, pixels: i.surface?.pixels, pixelsWa: i.surface?.pixelsWa,
      candidates: i.surface?.candidates, errors: i.errors })),
    raw: { ...raw, nonzeroBytes: pixels.reduce((n, b) => n + (b !== 0), 0) },
    presentationEvents: publications.events.map(e => ({ serial: e.serial, name: e.name, args: e.args,
      surfaces: e.after.presentations.filter(s => s.directDraw).map(s => ({ bitsWa: s.bitsWa,
        width: s.width, height: s.height, bpp: s.bpp, stride: s.stride, targetHwnd: s.targetHwnd,
        canonical: s.canonical, pendingGuestUpload: s.pendingGuestUpload, version: s.version, writeSeq: s.writeSeq })) })),
    publicationLimitReached: publications.limitReached, publicationErrors: publications.errors,
    engineStorageReads: producer.engine.map(e => ({ pc: e.pc, surface: e.surface })),
    sampledOutputPointers: producer.pixelInputs.samples.map(s => ({ eip: s.eip, edi: s.regs.edi,
      esi: s.regs.esi, surfacePixels: s.surface.pixels, paletteEntry: s.paletteEntry, light: s.light })),
    conclusion: 'Observed storage was zero before host upload; Flip rotation is not a demonstrated binding defect. Cause of zero production remains unknown.',
    unknowns: ['allocation lifetime/ABA', 'interior instruction store history', 'full cache history',
      'atomic raw/PNG equality', 'gameplay'], box: { id: null, state: 'NA offline', expiry: null } };
}
module.exports = { installPixelBinding, transform, analyze, originalAdapter, ADAPTER_SHA, ADAPTER_GIT, BASELINE, RECOVERED };
if (require.main === module) {
  const [mode, destination] = process.argv.slice(2);
  assert(['--analyze', '--check', '--generate'].includes(mode), 'offline usage: --analyze [JSON] | --check | --generate FILE');
  const body = transform(readiness.read(BASELINE).toString());
  new (require('node:vm').Script)(body);
  readiness.helperClosure(); originalAdapter();
  if (mode === '--analyze') {
    const report = JSON.stringify(analyze(), null, 2) + '\n';
    if (destination) fs.writeFileSync(destination, report); else process.stdout.write(report);
  } else if (mode === '--generate') { assert(destination); fs.writeFileSync(destination, body); }
  else console.log('PASS exact original driver, 20-helper closure and Git-recovered original adapter; offline diagnostic composition');
}
