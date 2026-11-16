#!/usr/bin/env node
'use strict';

// Static analysis never executes the original. --prepare emits only authored
// x86 callers; running those requires the task's separately acquired runtime lane.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const EXE = 'test/binaries/candidates/gta2-demo/installed/Program_Executable_Files/gta2.exe';
const EXE_SHA = '97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function image(buffer) {
  const pe = buffer.readUInt32LE(60), optional = pe + 24;
  assert.equal(buffer.readUInt32LE(pe), 0x4550);
  assert.equal(buffer.readUInt16LE(optional), 0x10b);
  const base = buffer.readUInt32LE(optional + 28), sections = [];
  for (let i = 0; i < buffer.readUInt16LE(pe + 6); i++) {
    const at = optional + buffer.readUInt16LE(pe + 20) + i * 40;
    sections.push({ rva: buffer.readUInt32LE(at + 12),
      raw: buffer.readUInt32LE(at + 20), size: buffer.readUInt32LE(at + 16) });
  }
  const offset = va => {
    const s = sections.find(s => va >= base + s.rva && va < base + s.rva + s.size);
    assert(s, `file-backed VA ${va.toString(16)}`);
    return s.raw + va - base - s.rva;
  };
  const bytes = (va, n) => buffer.subarray(offset(va), offset(va) + n);
  const str = va => { const at = offset(va); return buffer.subarray(at, buffer.indexOf(0, at)).toString(); };
  const imports = {};
  let descriptor = offset(base + buffer.readUInt32LE(optional + 104));
  while (buffer.readUInt32LE(descriptor + 12)) {
    const dll = str(base + buffer.readUInt32LE(descriptor + 12));
    const first = buffer.readUInt32LE(descriptor + 16);
    const lookup = buffer.readUInt32LE(descriptor) || first;
    for (let i = 0; ; i++) {
      const entry = buffer.readUInt32LE(offset(base + lookup + i * 4));
      if (!entry) break;
      imports[base + first + i * 4] = `${dll}!${entry & 0x80000000 ? '#' + (entry & 65535) : str(base + entry + 2)}`;
    }
    descriptor += 20;
  }
  return { bytes, str, imports };
}

function staticCheck() {
  const b = fs.readFileSync(path.join(ROOT, EXE));
  assert.equal(b.length, 2893824); assert.equal(sha(b), EXE_SHA);
  const p = image(b);
  const check = (va, hex) => assert.equal(p.bytes(va, hex.length / 2).toString('hex'), hex, `instruction pin ${va.toString(16)}`);
  assert.equal(p.str(0x615958), 'ERROR: Incorrect version of DirectX');
  check(0x5d61b9, 'e83284eeff'); // call 004be5f0
  check(0x5d61be, '817c2410010600007330'); // unsigned >= 0601 skips dialog
  check(0x5d61c8, '6858596100e81efbffff');
  assert.equal(p.imports[0x5f0078], 'KERNEL32.dll!GetVersionExA');
  assert.equal(p.imports[0x5f0094], 'KERNEL32.dll!LoadLibraryA');
  assert.equal(p.imports[0x5f007c], 'KERNEL32.dll!GetProcAddress');
  assert.equal(p.imports[0x5f0318], 'ole32.dll!CoCreateInstance');
  check(0x4be9bb, 'e850ebfdff'); // final DirectMusic capability probe
  check(0x4be9c0, '66813da4c0660001067506c70601060000');
  check(0x49d512, '68a4a66000');
  assert.equal(p.str(0x60a6a4), 'DMUSIC.DLL');
  check(0x49d520, 'ff1594005f008bf085f67437'); // NULL load skips CoCreateInstance
  check(0x49d531, '6840205f006a016a006810205f00ff1518035f00');
  check(0x49d545, '85c07c138b44240466c705a4c066000106');
  assert.equal(p.bytes(0x5f2010, 16).toString('hex'), '109f6b637d0cd11195b20020afdc7421');
  assert.equal(p.bytes(0x5f2040, 16).toString('hex'), '5a1136652d7bd211ba180000f875ac12');
  assert.equal(p.str(0x6106d0), 'DDRAW.DLL');
  assert.equal(p.str(0x6106bc), 'DirectDrawCreate');
  assert.equal(p.str(0x610738), 'DINPUT.DLL');
  assert.equal(p.str(0x610704), 'DirectInputCreateA');
  assert.equal(p.bytes(0x5f0dc0, 16).toString('hex'), 'e0f3a6b3432bcf11a2de00aa00b93356');
  assert.equal(p.bytes(0x5f0e00, 16).toString('hex'), '004e04dab269d011a1d500aa00b8dfbb');
  assert.equal(p.bytes(0x5f0e10, 16).toString('hex'), '30862b0b35add0118ea600609797ea5b');
  check(0x4be8be, '6a086a0050ff5150'); // SetCooperativeLevel(NULL,8)
  check(0x4be8a1, 'c74424246c000000c744242801000000');
  check(0x4be8b1, 'c784248c00000000020000'); // DDSCAPS_PRIMARYSURFACE
  check(0x4be8fb, '6a00528d54242c5250ff5118'); // CreateSurface(desc,out,NULL)
  return { exe: EXE, sha256: EXE_SHA, gate: '005d61be: unsigned capability >= 0x601',
    capabilityProbe: '004be5f0', finalProbe: '0049d510',
    finalModule: 'DMUSIC.DLL', clsid: '636b9f10-0c7d-11d1-95b2-0020afdc7421',
    iid: '6536115a-7b2d-11d2-ba18-0000f875ac12',
    attribution: 'Static control flow only; original public API return trace not retained in predecessor console.' };
}

// Minimal PE32 producer. All code, strings, descriptors and interfaces below
// are authored test inputs; no original instructions or media are copied.
function fixture(kind, moduleName = 'DMUSIC.DLL') {
  const BASE = 0x400000, RVA = 0x1000, RAW = 0x200;
  const payload = Buffer.alloc(0x6000); let used = 0x1000;
  const allocate = (data, alignment = 4) => {
    used = (used + alignment - 1) & ~(alignment - 1);
    const at = used; data.copy(payload, at); used += data.length; return BASE + RVA + at;
  };
  const zeros = n => allocate(Buffer.alloc(n));
  const string = s => allocate(Buffer.from(s + '\0'));
  const guid = s => allocate(Buffer.from(s, 'hex'));
  const imports = {
    'KERNEL32.dll': ['GetVersionExA', 'LoadLibraryA', 'GetModuleHandleA', 'GetProcAddress', 'FreeLibrary', 'GetLastError', 'OutputDebugStringA', 'ExitProcess'],
    'ole32.dll': ['CoCreateInstance'],
  };
  const iat = {}, descriptors = [];
  for (const [dll, names] of Object.entries(imports)) {
    const dllVA = string(dll), entries = names.map(n => allocate(Buffer.concat([Buffer.alloc(2), Buffer.from(n + '\0')]), 2) - BASE);
    const table = Buffer.alloc((entries.length + 1) * 4); entries.forEach((v, i) => table.writeUInt32LE(v, i * 4));
    const lookup = allocate(table), first = allocate(table);
    names.forEach((n, i) => iat[n] = first + i * 4);
    const d = Buffer.alloc(20); d.writeUInt32LE(lookup - BASE); d.writeUInt32LE(dllVA - BASE, 12); d.writeUInt32LE(first - BASE, 16); descriptors.push(d);
  }
  const directory = allocate(Buffer.concat([...descriptors, Buffer.alloc(20)]));
  const clsid = guid('109f6b637d0cd11195b20020afdc7421');
  const iidMusic = guid('5a1136652d7bd211ba180000f875ac12');
  const iidUnknown = guid('0000000000000000c000000000000046');
  const dd2 = guid('e0f3a6b3432bcf11a2de00aa00b93356');
  const surface2 = guid('004e04dab269d011a1d500aa00b8dfbb');
  const surface3 = guid('30862b0b35add0118ea600609797ea5b');
  const out = zeros(4), dd = zeros(4), surface = zeros(4), qi = zeros(4), version = zeros(148);
  const drawModule = zeros(4), stack = zeros(4);
  payload.writeUInt32LE(148, version - BASE - RVA);
  const desc = Buffer.alloc(108); desc.writeUInt32LE(108); desc.writeUInt32LE(1, 4); desc.writeUInt32LE(0x200, 104);
  const description = allocate(desc);
  const portCaps = Buffer.alloc(308, 0xa7); portCaps.writeUInt32LE(308);
  const caps = allocate(portCaps);
  const code = [], fixups = [], labels = new Map();
  const emit = (...bytes) => code.push(...bytes);
  const u32 = value => { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); emit(...b); };
  const push = value => { emit(0x68); u32(value); };
  const call = name => { emit(0xff, 0x15); u32(iat[name]); };
  const label = name => labels.set(name, code.length);
  const jump = (opcode, name) => { emit(0x0f, opcode); fixups.push({ at: code.length, name }); u32(0); };
  const mark = text => { emit(0x50); push(string(`CAUSAL ${kind}: ${text}`)); call('OutputDebugStringA'); emit(0x58); };
  const nonzero = n => { emit(0x85, 0xc0); jump(0x84, `fail${n}`); };
  const hr = n => { emit(0x85, 0xc0); jump(0x88, `fail${n}`); };
  const load = (name, n) => { mark(`LoadLibraryA(${name})`); push(string(name)); call('LoadLibraryA'); nonzero(n); };
  const getProc = (name, n) => { push(string(name)); emit(0x50); call('GetProcAddress'); nonzero(n); };
  const movEax = va => { emit(0xa1); u32(va); };
  const release = va => { movEax(va); emit(0x50, 0x8b, 0x08, 0xff, 0x51, 0x08); };
  const query = (obj, iid, destination, n) => {
    mark(`QueryInterface stage ${n}`); movEax(obj); emit(0x8b, 0x08); push(destination); push(iid); emit(0x50, 0xff, 0x11); hr(n);
  };
  emit(0x89, 0x25); u32(stack); // save entry ESP; all public callees must balance
  if (kind === 'probe') {
    mark('GetVersionExA'); push(version); call('GetVersionExA'); nonzero(10);
    emit(0x83, 0x3d); u32(version + 16); emit(2); jump(0x85, 'capabilities');
    emit(0x83, 0x3d); u32(version + 4); emit(4); jump(0x84, 'fail34'); jump(0x82, 'fail35');
    label('capabilities');
    load('DDRAW.DLL', 20); emit(0xa3); u32(drawModule); getProc('DirectDrawCreate', 21);
    mark('DirectDrawCreate'); push(0); push(dd); push(0); emit(0xff, 0xd0); hr(22);
    query(dd, dd2, qi, 23); release(qi);
    load('DINPUT.DLL', 24); emit(0x89, 0xc6); getProc('DirectInputCreateA', 25); emit(0x56); call('FreeLibrary');
    mark('SetCooperativeLevel(NULL,DDSCL_NORMAL)'); movEax(dd); emit(0x8b, 0x08); push(8); push(0); emit(0x50, 0xff, 0x51, 0x50); hr(26);
    mark('CreateSurface(primary)'); movEax(dd); emit(0x8b, 0x08); push(0); push(surface); push(description); emit(0x50, 0xff, 0x51, 0x18); hr(27);
    query(surface, surface2, qi, 28); release(qi);
    query(surface, surface3, qi, 29); release(qi); release(surface); release(dd);
    movEax(drawModule); emit(0x50); call('FreeLibrary'); nonzero(32);
  }
  if (kind !== 'com-only') {
    load(moduleName, 30); emit(0x89, 0xc6);
    emit(0x3d); u32(BASE); jump(0x84, 'fail40'); // never accept the EXE alias
    emit(0x66, 0x81, 0x3e, 0x4d, 0x5a); jump(0x85, 'fail40');
    push(string(moduleName)); call('GetModuleHandleA'); emit(0x39, 0xf0); jump(0x85, 'fail40');
    push(string(moduleName.toLowerCase())); call('LoadLibraryA'); emit(0x39, 0xf0); jump(0x85, 'fail40');
    emit(0x50); call('FreeLibrary'); nonzero(32);
    push(string('DirectMusicCreate_NOT_AN_EXPORT')); emit(0x56); call('GetProcAddress');
    emit(0x85, 0xc0); jump(0x85, 'fail41');
  }
  if (kind !== 'load-only') {
    mark('CoCreateInstance(DirectMusic,IDirectMusic)'); push(out); push(iidMusic); push(1); push(0); push(clsid); call('CoCreateInstance'); hr(31);
    query(out, iidUnknown, qi, 36);
    movEax(out); emit(0x3b, 0x05); u32(qi); jump(0x85, 'fail36');
    release(qi); emit(0x83, 0xf8, 1); jump(0x85, 'fail37');
    movEax(out); emit(0x50, 0x8b, 0x08, 0xff, 0x51, 0x04);
    emit(0x83, 0xf8, 2); jump(0x85, 'fail37');
    release(out); emit(0x83, 0xf8, 1); jump(0x85, 'fail37');
    mark('EnumPort ends with S_FALSE and unchanged descriptor');
    movEax(out); emit(0x8b, 0x08); push(caps); push(0); emit(0x50, 0xff, 0x51, 0x0c);
    emit(0x83, 0xf8, 1); jump(0x85, 'fail38');
    emit(0x81, 0x3d); u32(caps); u32(308); jump(0x85, 'fail38');
    emit(0xbf); u32(caps + 4); emit(0xb9); u32(76); emit(0xb8); u32(0xa7a7a7a7);
    emit(0xfc, 0xf3, 0xaf); jump(0x85, 'fail38');
    release(out); emit(0x85, 0xc0); jump(0x85, 'fail39');
  }
  if (kind !== 'com-only') { emit(0x56); call('FreeLibrary'); nonzero(32); }
  emit(0x3b, 0x25); u32(stack); jump(0x85, 'fail33');
  mark('PASS balanced interfaces/module/ESP'); push(0); call('ExitProcess');
  for (const n of [10,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41]) {
    label(`fail${n}`);
    if (n === 30) {
      call('GetLastError'); mark('FAIL stage 30; exit is LoadLibrary GetLastError'); emit(0x50);
    } else {
      mark(`FAIL stage ${n}`); push(n);
    }
    call('ExitProcess');
  }
  for (const f of fixups) { const delta = labels.get(f.name) - f.at - 4; const b = Buffer.alloc(4); b.writeInt32LE(delta); b.forEach((v, i) => code[f.at + i] = v); }
  assert(code.length < 0x1000); Buffer.from(code).copy(payload);
  const rawSize = (used + 511) & ~511, file = Buffer.alloc(RAW + rawSize);
  file.write('MZ'); file.writeUInt32LE(0x80, 60); file.write('PE\0\0', 0x80);
  const coff = 0x84, op = 0x98; file.writeUInt16LE(0x14c, coff); file.writeUInt16LE(1, coff + 2); file.writeUInt16LE(224, coff + 16); file.writeUInt16LE(0x102, coff + 18);
  file.writeUInt16LE(0x10b, op); file.writeUInt32LE(rawSize, op + 4); file.writeUInt32LE(RVA, op + 16); file.writeUInt32LE(RVA, op + 20); file.writeUInt32LE(BASE, op + 28);
  file.writeUInt32LE(0x1000, op + 32); file.writeUInt32LE(0x200, op + 36); file.writeUInt16LE(4, op + 40); file.writeUInt16LE(4, op + 48);
  file.writeUInt32LE((RVA + rawSize + 4095) & ~4095, op + 56); file.writeUInt32LE(RAW, op + 60); file.writeUInt16LE(3, op + 68);
  file.writeUInt32LE(0x100000, op + 72); file.writeUInt32LE(0x1000, op + 76); file.writeUInt32LE(0x100000, op + 80); file.writeUInt32LE(0x1000, op + 84); file.writeUInt32LE(16, op + 92);
  file.writeUInt32LE(directory - BASE, op + 104); file.writeUInt32LE((descriptors.length + 1) * 20, op + 108);
  const section = op + 224; file.write('.fixture', section); file.writeUInt32LE(used, section + 8); file.writeUInt32LE(RVA, section + 12); file.writeUInt32LE(rawSize, section + 16); file.writeUInt32LE(RAW, section + 20); file.writeUInt32LE(0xe0000060, section + 36);
  payload.copy(file, RAW, 0, rawSize); return file;
}

function verifyLogs(phase, directory) {
  assert(['baseline', 'repaired'].includes(phase));
  const result = [];
  for (const kind of ['probe', 'load-only', 'com-only', 'missing-module']) {
    const out = path.resolve(directory, `${phase}-${kind}`);
    const log = fs.readFileSync(path.join(out, 'native.stdout.log'), 'utf8');
    const expected = kind === 'missing-module' || (phase === 'baseline' && kind !== 'com-only') ? 126 : 0;
    assert.match(log, new RegExp(`\\[Exit\\] code=${expected}\\b`), `${kind} guest exit`);
    const receipts = ['native-wait.json', 'watchdog-wait.json', 'outer-child-wait.json', 'actual-outer-wait.json'];
    for (const name of receipts) {
      const w = JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
      for (const field of ['actualWait', 'stdoutEOF', 'stderrEOF']) assert.equal(w[field], true, `${kind}/${name}/${field}`);
      assert.equal(w.exit, 0, `${kind}/${name}: host completion does not replace guest exit`);
    }
    const armed = JSON.parse(fs.readFileSync(path.join(out, 'watchdog-armed.json'), 'utf8'));
    const launch = JSON.parse(fs.readFileSync(path.join(out, 'launch.json'), 'utf8'));
    assert.equal(armed.independent, true); assert(armed.at <= launch.at);
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'watchdog-exit.json'), 'utf8')).reason, 'actual-native-wait');
    if (expected === 0) assert.match(log, /PASS balanced interfaces\/module\/ESP/);
    else assert.match(log, /FAIL stage 30; exit is LoadLibrary GetLastError/);
    if (kind === 'probe') {
      assert.match(log, /QueryInterface stage 29/);
      assert.match(log, /LoadLibraryA\(DMUSIC.DLL\)/);
    }
    result.push({ kind, guestExit: expected, hostExit: 0, actualWaitBothEOF: true });
  }
  return result;
}

async function controllerControls() {
  const { connection, boundedOperation, devtoolsEndpoint } = require('../tools/gta2-paired-controller.cjs');
  const temporary = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'gta2-endpoint-input-'));
  try {
    const file = path.join(temporary, 'DevToolsActivePort');
    assert.equal(devtoolsEndpoint(file), null);
    for (const contents of ['', '12345', '12345\n', '12345\n/devtools/browser/01234567', '0\n/devtools/browser/01234567-89ab-cdef-0123-456789abcdef']) {
      fs.writeFileSync(file, contents); assert.equal(devtoolsEndpoint(file), null, 'partial/invalid endpoint must not construct a transport');
    }
    fs.writeFileSync(file, '12345\n/devtools/browser/01234567-89ab-cdef-0123-456789abcdef');
    assert.equal(devtoolsEndpoint(file), 'ws://127.0.0.1:12345/devtools/browser/01234567-89ab-cdef-0123-456789abcdef');
  } finally { fs.rmSync(temporary, { recursive: true }); }
  const previous = globalThis.WebSocket, requests = [], unknown = [];
  class ImmediateReplySocket {
    constructor() { queueMicrotask(() => this.onopen()); }
    send(payload) {
      const request = JSON.parse(payload); requests.push({ at: Date.now(), ...request });
      queueMicrotask(() => this.onmessage({ data: JSON.stringify({ id: request.id, result: {} }) }));
    }
    close() {}
  }
  globalThis.WebSocket = ImmediateReplySocket;
  try {
    const c = connection('fixture://aggregate-operation', v => unknown.push(v)); await c.ready;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    let work;
    const started = Date.now();
    await assert.rejects(boundedOperation(c, 'authored aggregate capture', () => {
      work = (async () => {
        await c.send('Runtime.evaluate'); await pause(1800);
        await c.send('Runtime.evaluate'); await pause(1800);
        await c.send('Page.captureScreenshot');
      })();
      return work;
    }), /UNKNOWN/);
    assert(Date.now() - started >= 2900);
    assert.equal(c.closed, true); assert.equal(unknown.length, 1);
    assert.match(unknown[0].reason, /exceeded 3000ms/);
    assert.equal(unknown[0].laterRequestsAllowed, 0);
    await assert.rejects(work, /permanently closed/);
    for (const method of ['Input.dispatchKeyEvent', 'Runtime.evaluate', 'Target.attachToTarget', 'Browser.close']) {
      await assert.rejects(c.send(method), /permanently closed/);
    }
    assert.equal(requests.length, 2, 'both individually fast replies precede aggregate UNKNOWN; zero later requests');
    return { aggregateDeadlineMS: 3000, requestsBeforeUNKNOWN: 2, requestsAfterUNKNOWN: 0,
      input: 0, rebind: 0, replay: 0, originalLaunched: false, browserClaim: false };
  } finally { globalThis.WebSocket = previous; }
}

function compileGuards(output, metadata) {
  const { watxSourceClosure, compileClosure } = require('../tools/watx-closure');
  const { appendSection, layoutHash } = require('../tools/region-layout-hash');
  assert(!fs.existsSync(output)); assert(!fs.existsSync(metadata));
  const closure = watxSourceClosure();
  const tests = ['test-native-ft-relay', 'test-ne-thunkconnect16', 'test-native-ls32-connection',
    'test-win16-system-color-brush', 'test-win16-native-quit-exit'];
  const extra = tests.map(name => require('./' + name).extraWat || '').join('\n');
  for (const key of ['13-exports.wat', 'src/13-exports.wat', './13-exports.wat']) {
    if (closure.vfs.has(key)) closure.vfs.set(key, closure.vfs.get(key) + '\n' + extra);
  }
  const pins = [...closure.vfs].filter(([name]) => !name.includes('/'))
    .map(([name, source]) => ({ path: 'src/' + name, sha256: sha(Buffer.from(source)) }));
  const result = compileClosure(closure, { tailCalls: true });
  assert(result.success, result.error);
  const bytes = appendSection(Buffer.from(result.wasmBinary), layoutHash(result.regions.regions));
  fs.writeFileSync(output, bytes, { flag: 'wx' });
  const record = { output, bytes: bytes.length, sha256: sha(bytes), tests, pins,
    meaning: 'Current-source native guard exports; no original or genuine FT target execution claim' };
  fs.writeFileSync(metadata, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  return record;
}

if (require.main === module) {
  const result = staticCheck();
  if (process.argv[2] === '--compile-guards') console.log(JSON.stringify(compileGuards(process.argv[3], process.argv[4])));
  if (process.argv[2] === '--controller-controls') controllerControls().then(controller => console.log(JSON.stringify({ controller }))).catch(error => { console.error(error); process.exitCode = 1; });
  if (process.argv[2] === '--verify-logs') console.log(JSON.stringify({ phase: process.argv[3], native: verifyLogs(process.argv[3], process.argv[4]) }));
  if (process.argv[2] === '--prepare') {
    const destination = path.resolve(process.argv[3] || 'scratch/runs/20261115-gta2-directx-version-causal-repair/fixtures');
    fs.mkdirSync(destination, { recursive: true });
    for (const kind of ['probe', 'load-only', 'com-only']) {
      const b = fixture(kind); const target = path.join(destination, `${kind}.exe`);
      fs.writeFileSync(target, b); console.log(JSON.stringify({ kind, path: target, size: b.length, sha256: sha(b), executed: false }));
    }
    const missing = fixture('load-only', 'wa-not-installed-music-vendor.dll');
    const target = path.join(destination, 'missing-module.exe');
    fs.writeFileSync(target, missing);
    console.log(JSON.stringify({ kind: 'missing-module', path: target, size: missing.length, sha256: sha(missing), executed: false, expectedLoadError: 126 }));
  }
  console.log(JSON.stringify({ static: 'PASS', ...result }));
}
module.exports = { staticCheck, fixture, verifyLogs, controllerControls, compileGuards };
