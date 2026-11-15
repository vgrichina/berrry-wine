'use strict';

// Explicit media/compiled modes; the default checks inputs without executing
// any original program. No installer, registry seed or scalar thunk settlement.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const PINS = Object.freeze({
  pe: ['test/binaries/dlls/comctl32.dll', 577808,
    '28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4'],
  ne: ['test/binaries/sims-native-common-controls/kommctrl.dll', 155136,
    '39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9'],
});
async function guardControls() {
  // Host-only negative control of the exact run preload, before any WASM or
  // original execution. A mock dispatch proves where observation stops.
  const vm = require('node:vm');
  assert(process.env.NEVERHOOD_GUARD_SCRIPT && process.env.NEVERHOOD_GUARD_RESULTDIR);
  const bytes = new Uint8Array(512), calls = [];
  const host = {memory: {buffer: bytes.buffer}, log: (...args) => calls.push(args)};
  const registers = Object.freeze({get_eip: () => 0x401234, get_esp: () => 0x7408000,
    get_eax: () => 0, guest_read32: () => 0});
  const sandbox = {require, Buffer, __dirname: process.cwd(),
    process: {pid: process.pid, env: {NEVERHOOD_EVIDENCE_DIR: process.env.NEVERHOOD_GUARD_RESULTDIR}},
    WebAssembly: {instantiate: async () => ({instance: {exports: registers}})}};
  vm.runInNewContext(fs.readFileSync(process.env.NEVERHOOD_GUARD_SCRIPT, 'utf8'), sandbox);
  await sandbox.WebAssembly.instantiate(null, {host});
  for (const name of ['ThunkConnect32', 'FT_Prolog', 'DirectXSetupA']) {
    bytes.fill(0); bytes.set(Buffer.from(name)); host.log(0, name.length);
  }
  assert.equal(calls.length, 3, 'implemented genuine dependencies are allowed');
  bytes.fill(0); bytes.set(Buffer.from('DirectXSetup')); const before = Buffer.from(bytes);
  assert.throws(() => host.log(0, 12), /ORIGINAL_UNSUPPORTED_BOUNDARY: DirectXSetup/);
  assert.equal(calls.length, 3, 'unsupported handler dispatch never proceeds');
  assert.deepEqual(Buffer.from(bytes), before, 'observation never patches the guest');
  console.log('PASS exact observation preload allows native thunks and stops before DirectXSetup scalar success');
}
function media() {
  const inputs = {};
  for (const [kind, [path, size, hash]] of Object.entries(PINS)) {
    const bytes = fs.readFileSync(path);
    assert.equal(bytes.length, size); assert.equal(sha(bytes), hash);
    inputs[kind] = bytes;
  }
  const {inspectNeDll} = require('../lib/ne-image');
  const info = inspectNeDll(inputs.ne);
  assert.equal(info.dllEntryOrdinal, 300);
  const header = inputs.pe.indexOf(Buffer.from('LS01'));
  assert.equal(header, 430828);
  assert.equal(inputs.pe.readUInt32LE(header + 4), 7834);
  assert.equal(inputs.pe.toString('ascii', header + 12, header + 16), 'LB01');
  assert.equal(inputs.pe.readUInt32LE(header + 28), 36);
  assert.equal(inputs.pe.readUInt32LE(header + 32), 68);
  return inputs;
}
async function compiled(inputs) {
  assert(process.env.WA_TEST_WASM, 'explicit production WASM path required');
  assert(process.env.NEVERHOOD_THUNK_RESULT, 'unique result path required');
  const resultPath = process.env.NEVERHOOD_THUNK_RESULT;
  assert(!fs.existsSync(resultPath), 'no result reuse');
  const {VirtualFS} = require('../lib/filesystem');
  const {createHostImports} = require('../lib/host-imports');
  const {makeFixture} = require('../tools/kernel32-native-fixture');
  const loader = require('../lib/dll-loader');
  const boot = require('../lib/process-boot');
  const {createNeLifecycle} = require('../lib/ne-lifecycle');
  const vfs = new VirtualFS();
  const mountedPath = 'c:\\windows\\system\\commctrl.dll';
  vfs.files.set(mountedPath, {data: inputs.ne, attrs: 0x21});
  assert.equal(boot.findVfsDllBytes(vfs, 'commctrl.dll', 'commctrl.dll'), inputs.ne);
  const memory = new WebAssembly.Memory({initial: 8192, maximum: 8192, shared: true});
  const imports = createHostImports({getMemory: () => memory.buffer, renderer: null, resourceJson: {}});
  imports.host.memory = memory;
  const wasm = fs.readFileSync(process.env.WA_TEST_WASM);
  const e = (await WebAssembly.instantiate(wasm, imports)).instance.exports;
  const fixture = makeFixture();
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert.equal(e.load_pe(fixture.length), 0x402000);
  e.set_eip(0x402100); e.set_esp(0x7408000);
  const events = [], resolutions = [], entries = [];
  let headerAddress = 0, restoredAtNativeDetach = null;
  const owner = {...e, memory};
  for (const name of ['win16_bridge_ft_publish', 'win16_guest_ft_connect_settle',
    'win16_guest_ft_detach', 'win16_bridge_ls32_release', 'win16_bridge_ft_begin']) {
    owner[name] = (...args) => {
      const value = e[name](...args);
      events.push({name, args: args.map(x => typeof x === 'bigint' ? String(x) : x), value});
      if (name === 'win16_guest_ft_detach' && value > 0)
        restoredAtNativeDetach = Buffer.from(Array.from({length: 100}, (_, i) => e.guest_read8(headerAddress + i)));
      return value;
    };
  }
  owner.win16_bridge_invoke_begin = (...args) => {
    entries.push({far: args[1] >>> 0, offset: args[1] & 65535});
    return e.win16_bridge_invoke_begin(...args);
  };
  const context = () => ['eip','esp','ebp','ebx','esi','edi','sreg_cs','sreg_ds',
    'sreg_es','sreg_ss','sync_msg_depth'].map(n => e['get_' + n]());
  const service = () => boot.serviceLoadLibraryYieldSync({exports: owner, memoryBuffer: memory.buffer,
    findDllSync(file, full) {
      resolutions.push({file, full, mountedPath});
      assert.equal(file.toLowerCase(), 'commctrl.dll');
      const bytes = boot.findVfsDllBytes(vfs, file, full);
      assert.equal(bytes, inputs.ne, 'only the explicitly mounted original companion');
      return bytes;
    }});
  const before = context();
  const mapped = loader.loadDll(owner, memory.buffer, inputs.pe, 'comctl32.dll');
  loader.patchDllImports(owner, memory.buffer, [{name: 'comctl32.dll', bytes: inputs.pe}], [mapped], () => {});
  const header = mapped.loadAddr + 0x682ec;
  headerAddress = header;
  const original = Buffer.from(Array.from({length: 100}, (_, i) => e.guest_read8(header + i)));
  const invoke = reason => loader.callDllMain(owner, mapped.loadAddr, mapped.dllMain, () => {},
    {reason, lpReserved: 0, maxBlocks: 100000, requireCompletion: true, onLoadLibraryYield: service});
  let attach, detach, error;
  try {
    attach = invoke(1);
    assert(attach.completed && attach.returnValue === 1, 'actual original DllMain attach');
    // The production load path publishes ATTACHED/LIVE only after observing
    // the actual callback outcome. FreeLibrary must see that publication.
    loader.finishDllInitialization(owner, memory.buffer, mapped, attach);
    assert.equal(new DataView(memory.buffer).getUint32(e.get_dll_lifecycle_table() +
      mapped.index * e.get_dll_lifecycle_stride(), true), 2, 'actual PE attach published LIVE');
    assert.deepEqual(context(), before, 'PE caller restored after attach');
    assert(e.guest_read32(header + 8), 'actual relocated target table published');
    assert.deepEqual(Array.from({length: 6}, (_, i) => e.guest_read8(header + 68 + i)),
      [0x0f,0xb6,0xd1,0x8b,0x14,0x95], 'actual checked FT relay');
    assert(createNeLifecycle(owner, memory, []).liveModule('COMMCTRL'));
    // Production FreeLibrary drain owns the real reason-0 callback and PE
    // generation retirement. No host-supplied DllMain success is accepted.
    detach = loader.drainDllUnload({exports: owner, memoryBuffer: memory.buffer,
      log: () => {}, onLoadLibraryYield: service}, mapped.loadAddr);
    assert.equal(detach, true, 'ordinary loader unload completed its original callback');
    assert.deepEqual(context(), before, 'PE caller restored after detach');
    assert.deepEqual(restoredAtNativeDetach, original,
      'owned original header and relay bytes restored before image retirement');
    assert.equal(new DataView(memory.buffer).getUint32(e.get_dll_lifecycle_table() +
      mapped.index * e.get_dll_lifecycle_stride(), true), 0, 'actual PE generation retired');
    assert.equal(createNeLifecycle(owner, memory, []).liveModule('COMMCTRL'), false,
      'matching NE detach/WEP releases companion');
    assert.equal(e.win16_ft_checkpoint(), 0n);
    assert.equal(e.win16_guest_request_valid(e.win16_guest_request_token()), 0);
    assert(events.some(x => x.name === 'win16_guest_ft_connect_settle' && x.value === 1));
    assert(events.some(x => x.name === 'win16_guest_ft_detach' && x.value > 0));
    const neInfo = require('../lib/ne-image').inspectNeDll(inputs.ne);
    const notification = neInfo.entries.get(300), wep = neInfo.entries.get(neInfo.names.get('WEP'));
    assert.equal(entries.filter(x => x.offset === notification.offset).length, 2,
      'genuine Win4 attach and matching detach entries executed');
    assert(entries.some(x => x.offset === wep.offset), 'genuine final WEP executed');
  } catch (failure) { error = {message: failure.message, stack: failure.stack}; }
  for (const [kind, [path, , hash]] of Object.entries(PINS))
    assert.equal(sha(fs.readFileSync(path)), hash, kind + ' original unchanged');
  const result = {pins: PINS, wasmSHA256: sha(wasm), mountedPath, mapped, attach, detach,
    events, entries, resolutions, before, after: context(), error: error || null,
    genuineFTExecution: events.some(x => x.name === 'win16_bridge_ft_begin' && x.value === 1),
    installerExecuted: false, gameplay: false};
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  assert.equal(error, undefined, error?.message);
  console.log('PASS unchanged genuine COMCTL32 attach/detach, explicit COMMCTRL mount, native FT publication/retirement');
}
if (require.main === module) (async () => {
  if (process.argv.includes('--guard')) await guardControls();
  if (process.argv.includes('--media') || process.argv.includes('--compiled')) {
    const inputs = media();
    console.log('PASS exact genuine common-controls identity and current Win4 metadata');
    if (process.argv.includes('--compiled')) await compiled(inputs);
  } else {
    assert.equal(PINS.pe[1], 577808); assert.equal(PINS.ne[1], 155136);
    console.log('Input contract only; use --media/--compiled for explicit qualification');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {PINS, media, compiled, guardControls};
