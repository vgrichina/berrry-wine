'use strict';
// Exercise the actual browser loadExe -> GuestThreadHost.loadPe sequence with
// three real instances: owning guest, idle page shadow, later guest thread.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { GuestThreadHost } = require('../lib/guest-thread-host');
const ProcessBoot = require('../lib/process-boot');
const hostSource = fs.readFileSync(require.resolve('../host.js'), 'utf8');
const start = hostSource.indexOf('  async loadExe(url, opts = {}) {');
const end = hostSource.indexOf('\n    return entry;\n  }', start) + '\n    return entry;\n  }'.length;
assert(start > 0 && end > start);
const loadExe = new Function('ProcessBoot', 'WineAssembly', 'VfsSeed',
  'return ({' + hostSource.slice(start, end) + '}).loadExe')(ProcessBoot, {}, {});
const extra = `
 (func (export "test_dd") (param $v i32) (result i32)
  (call $dx_create_com_obj (i32.const 1) (if (result i32) (i32.eq (local.get $v) (i32.const 4))
   (then (global.get $DX_VTBL_DDRAW4)) (else (global.get $DX_VTBL_DDRAW7)))))
 (func (export "test_create") (param $dd i32) (param $desc i32) (param $out i32) (result i32)
  (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
  (call $handle_IDirectDraw_CreateSurface (local.get $dd) (local.get $desc) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "test_desc") (param $surface i32) (param $desc i32) (result i32)
  (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
  (call $handle_IDirectDrawSurface_GetSurfaceDesc (local.get $surface) (local.get $desc) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
`;
(async () => {
 const wasm = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extra : source);
 const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
 const imports = createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});
 imports.host.memory = memory;
 const instantiate = async () => (await WebAssembly.instantiate(wasm, imports)).instance.exports;
 const owner = await instantiate(), shadow = await instantiate();
 const guestWorker = {
  memory, callExport: async (name,...args) => owner[name](...args),
  readExports: async names => Object.fromEntries(names.map(n=>[n,owner[n]()]))
 };
 guestWorker.loadPe = (...args) => GuestThreadHost.prototype.loadPe.apply(guestWorker,args);
 const app = {instance:{exports:shadow},memory,guestWorker,
  _publishWorkerDllCount(){},_applyExeCompatibilityPatches(){},async _loadWin16Dlls(){}};
 const exe = fs.readFileSync('test/binaries/calc.exe');
 await loadExe.call(app,'calc.exe',{bytes:exe});
 const worker = await instantiate();
 const init = e => e.init_thread(2,owner.get_image_base(),owner.get_code_start(),owner.get_code_end(),
  owner.get_thunk_base(),owner.get_thunk_end(),owner.get_num_thunks(),owner.get_rsrc_rva());
 init(worker);
 for(const version of [4,7]){
  const dd=owner.test_dd(version),desc=owner.guest_alloc(124),out=owner.guest_alloc(4);
  for(let i=0;i<124;i+=4)owner.guest_write32(desc+i,0);
  for(const [offset,value] of [[0,124],[4,0x1007],[8,8],[12,16],[72,32],[76,0x40],[84,16],[88,0xf800],[92,0x7e0],[96,0x1f],[104,0x1800]])owner.guest_write32(desc+offset,value);
  assert.equal(worker.test_create(dd,desc,out)>>>0,0);
  const surface=owner.guest_read32(out);
  assert.equal(worker.test_desc(surface,desc)>>>0,0,
   `browser worker boot preserves DirectDraw${version} creator identity for later threads`);
  owner.guest_write32(desc,108);
  assert.equal(worker.test_desc(surface,desc)>>>0,0x80070057,'strict descriptor ABI remains');
 }
 // The local boot path still creates its COM tables.
 const local=await instantiate();
 const localApp={instance:{exports:local},memory,_applyExeCompatibilityPatches(){},async _loadWin16Dlls(){}};
 await loadExe.call(localApp,'calc.exe',{bytes:exe});
 assert(local.test_dd(4),'local boot initializes DirectDraw4');
 console.log('PASS browser owner/shadow/later-thread DirectDraw4/7 identity and local boot');
})().catch(e=>{console.error(e);process.exitCode=1});
