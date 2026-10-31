#!/usr/bin/env node
'use strict';

// Small source fixture: actual loader/identity/GetProcAddress WAT, actual VFS
// host imports and JS dependency planners. No interpreter or x86 execution.
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const {execFileSync} = require('child_process');
const {sourceFunction} = require('./wat-source-function');
const {compile} = require('../tools/watx');
const registry = require('../lib/dll-registry');
const loader = require('../lib/dll-loader');
const boot = require('../lib/process-boot');
const {VirtualFS} = require('../lib/filesystem');
const {createHostImports} = require('../lib/host-imports');
const {buildVersionPe, buildVersionBlob, findVersionBlob} = require('../tools/pe-version');
const api = require('../src/api_table.json');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

function fixture() {
  const ref = process.argv.find(a => a.startsWith('--source-ref='));
  const read = file => ref && file==='src/09a0-handlers-base.wat'
    ? execFileSync('git', ['show', ref.slice(13) + ':' + file], {encoding:'utf8',maxBuffer:4*1024*1024})
    : fs.readFileSync(require.resolve('../' + file), 'utf8');
  const sources = fs.readdirSync(require('path').join(__dirname,'../src'))
    .filter(n=>n.endsWith('.wat')).map(n=>read('src/'+n));
  const extract = n => {
    const s=sources.find(s=>new RegExp('\\(func \\$'+n+'(?=[\\s(])').test(s));
    assert(s,'missing fixture declaration '+n); return sourceFunction(s,n);
  };
  const names = ['handle_LoadLibraryA', 'loadlib_normalize_name', 'loadlib_path_in_dir',
    'loadlib_path_in_system_dirs', 'loadlib_absent_on_win98', 'guest_name_has_dll_ext',
    'guest_name_tail_is_dll', 'guest_name_is_static_system_dll', 'static_sys_dll_name_at',
    'static_sys_dll_from_handle', 'static_sys_dll_ensure_locked', 'native_module_headers',
    'handle_GetModuleHandleA_locked', 'handle_GetProcAddress_pinned', 'dll_name_match',
    'tolower', 'str_eq', 'freelib_mark_loaded', 'dll_synthetic_reference',
    'resolve_static_module_ordinal', 'gl_dynamic_api_unsupported'];
  for (const n of ['static_sys_dll_names', 'loadlib_builtin_only', 'loadlib_name_is_qualified'])
    if (sources.some(s=>s.includes('(func $' + n + ' '))) names.push(n);
  let body = names.map(extract).join('\n');
  // Fixture-local layout, not a copy of any engine-allocated address.
  body = body.replace(/\(region.addr \$DLL_LOAD_LOCK 16\)/g, '(i32.const 12304)')
    .replace(/\(region.addr \$KERNEL32_MODULE 4\)/g, '(i32.const 12548)')
    .replace(/\(region.addr \$RESERVED_PAGE_STRINGS 0x30\)/g, '(i32.const 12800)');
  const globals = {reg_base:4096, DLL_SHARED:8192, DLL_TABLE:8448, DLL_LOAD_LOCK:12288,
    STATIC_SYS_DLL_IMAGES:13312, DLL_SYNTHETIC_REFS:13568, STATIC_SYS_DLL_NAMES:13824,
    image_base:0x400000, GUEST_BASE:0x400000, THUNK_BASE:65536, exe_name_wa:14592};
  const globalText = [...new Set([...body.matchAll(/\(global\.(?:get|set) \$(\w+)/g)].map(m=>m[1]))]
    .map(n=>`(global $${n} (mut i32) (i32.const ${globals[n] || 0}))`).join('\n');
  const custom = `
    (import "host" "has_dll_file" (func $host_has_dll_file (param i32) (result i32)))
    (import "host" "fs_get_file_attributes" (func $host_fs_get_file_attributes (param i32 i32) (result i32)))
    (import "host" "lookup" (func $lookup_api_id (param i32) (result i32)))
    (import "host" "unexpected" (func $unexpected (param i32)))
    (global $heap (mut i32) (i32.const 196608))
    (func $heap_alloc (param $n i32) (result i32) (local $p i32)
      (local.set $p (global.get $heap)) (global.set $heap (i32.add (local.get $p) (local.get $n))) (local.get $p))
    (func $g2w (param $p i32) (result i32) (local.get $p))
    (func $gl8 (param $p i32) (result i32) (i32.load8_u (local.get $p)))
    (func $gl16 (param $p i32) (result i32) (i32.load16_u (local.get $p)))
    (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
    (func $gs8 (param $p i32) (param $v i32) (i32.store8 (local.get $p) (local.get $v)))
    (func $gs16 (param $p i32) (param $v i32) (i32.store16 (local.get $p) (local.get $v)))
    (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
    (func $find_loaded_dll (param i32) (result i32) (i32.const -1))
    (func $lock_owner_id (result i32) (i32.const 1))
    (func $dll_row_init_pending (param i32) (result i32) (i32.const 0))
    (func $dll_load_lock_begin) (func $lock_release (param i32))
    (func $kernel32_is_module (param i32) (result i32) (i32.const 0))
    (func $thunk_reserve (result i32) (global.get $num_thunks))
    (func $update_thunk_end)
    (func $guest_strlen (param $p i32) (result i32) (local $n i32)
      (block $end (loop $l (br_if $end (i32.eqz (i32.load8_u (i32.add (local.get $p) (local.get $n)))))
        (local.set $n (i32.add (local.get $n) (i32.const 1))) (br $l))) (local.get $n))
    (func $memcpy (param $d i32) (param $s i32) (param $n i32)
      (memory.copy (local.get $d) (local.get $s) (local.get $n)))`;
  const defined = new Set([...custom.matchAll(/\(func \$(\w+)/g)].map(m=>m[1]).concat(names));
  // Branches outside this fixture's policy checks trap, rather than silently
  // modeling native mapping, ordinal exports, locks or GL driver behavior.
  const traps = [...new Set([...body.matchAll(/\(call \$(\w+)/g)].map(m=>m[1]))]
    .filter(n=>!defined.has(n)).map(n=>{
      const f = extract(n);
      const sig = f.match(/^\(func \$\w+\s*((?:(?:\(param[^)]*\)|\(result[^)]*\))\s*)*)/)[1];
      return `(func $${n} ${sig} (call $unexpected "${n}") (unreachable))`;
    }).join('\n');
  const wrappers = ['load:handle_LoadLibraryA', 'module:handle_GetModuleHandleA_locked',
    'proc:handle_GetProcAddress_pinned'].map(pair=>{
      const [n, target] = pair.split(':');
      return `(func (export "${n}") (param $a i32) (param $b i32) (result i32)
        (i32.store (i32.const 4112) (i32.const 16000))
        (global.set $yield_reason (i32.const 0))
        (call $${target} (local.get $a) (local.get $b) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
        (i32.load (i32.const 4096)))`;
    }).join('\n');
  const wat = `(import "host" "memory" (memory 32 32 shared)) ${globalText}
    ${custom} ${traps} ${body} ${wrappers}
    (func (export "index") (param $p i32) (result i32) (call $guest_name_is_static_system_dll (local.get $p)))
    (func (export "name") (param $i i32) (result i32) (call $static_sys_dll_name_at (local.get $i)))
    (func (export "yielded") (result i32) (global.get $yield_reason))
    (func (export "error") (result i32) (global.get $last_error))`;
  const r = compile(wat, new Map(), {mode:'production', standardWat:true,
    runtimeBuiltins:false, strictDeclarations:true});
  assert(r.success, JSON.stringify(r));
  return r.wasmBinary;
}

function importPe(dll) {
  const b = buildVersionPe(buildVersionBlob([]));
  b.fill(0, 0x200); b.writeUInt32LE(0x1000, 0x98 + 104);
  b.writeUInt32LE(0x1040, 0x200); b.writeUInt32LE(0x1060, 0x20c);
  b.writeUInt32LE(0x1040, 0x210); b.writeUInt32LE(0x1080, 0x240);
  b.write(dll + '\0', 0x260); b.write('DdEntry1\0', 0x282);
  return b;
}

async function main() {
  const arg = process.argv.find(a=>a.startsWith('--authentic='));
  const original = arg ? fs.readFileSync(arg.slice(12)) : buildVersionPe(buildVersionBlob([]));
  if (arg) assert.equal(hash(original), 'c999fb98e33efaf1c2667501de5cb91fdd816f5f3c1f87f4f76b7a60e8efafbe');
  const before = hash(original), version = findVersionBlob(original);
  const vfs = new VirtualFS(); boot.mountDirectXSystemModules(vfs);
  const full = 'c:\\windows\\system\\d3d8.dll';
  vfs.files.set(full, {data:original, attrs:0x20}); boot.mountDirectXSystemModules(vfs);
  const memory = new WebAssembly.Memory({initial:32, maximum:32, shared:true});
  const bytes = new Uint8Array(memory.buffer);
  const ctx = {getMemory:()=>memory.buffer, vfs, resourceJson:{}, availableDllFiles:new Set(['d3d8.dll'])};
  const imports = createHostImports(ctx); imports.host.memory = memory;
  const str = p => {let end=p; while(bytes[end]) end++; return Buffer.from(bytes.subarray(p,end)).toString('latin1');};
  imports.host.lookup = p => {const i=api.findIndex(a=>a.name===str(p)); return i<0 ? 65535 : i;};
  imports.host.unexpected = p => {throw new Error('Unexpected fixture branch: '+str(p));};
  const {instance} = await WebAssembly.instantiate(fixture(), imports), e=instance.exports;
  let cursor=0x20000;
  const write = s => {const p=cursor; bytes.set(Buffer.from(s+'\0'),p); cursor+=s.length+1; return p;};
  bytes.set(Buffer.from('KERNEL32.dll\0'),12800);
  bytes.set(Buffer.from('ole32\0user32\0comctl32\0gdi32\0dplayx\0ddraw\0dsound\0d3drm\0glide2x\0glide3x\0oleaut32\0\0'),13824);
  bytes.set(Buffer.from('fixture.exe\0'),14592);
  const fullPtr = write(full);
  assert.equal(imports.host.has_dll_file(fullPtr),1,'real byte visibility still reports the original');
  const handle=e.load(fullPtr,0)>>>0;
  assert.equal(e.yielded(),0,'authentic full-path D3D8 must select builtin execution, not native mapping');
  assert(handle && handle!==0x400000,'D3D8 has its own module identity');
  for (const name of ['d3d8.dll','D3D8',full,'C:/WINDOWS/SYSTEM/D3D8.DLL']) {
    assert.equal(e.load(write(name),0)>>>0,handle,name);
    assert.equal(e.module(write(name),0)>>>0,handle,name+' GetModuleHandle');
  }
  const proc=e.proc(handle,write('Direct3DCreate8'))>>>0;
  assert(proc,'builtin export returns an API thunk');
  assert.equal(new DataView(memory.buffer).getUint32(proc+4,true),api.findIndex(a=>a.name==='Direct3DCreate8'));
  assert.equal(e.proc(handle,write('DdEntry1')),0,'private native imports are not fabricated exports');
  for (const name of ['C:\\missing\\d3d8.dll','C:\\WINDOWS\\SYSTEM\\missing\\ddraw.dll']) {
    assert.equal(e.load(write(name),0),0,name+' must fail despite a basename/catalog alias');
    assert.equal(e.error(),126);
  }
  const handles=new Set();
  for (const stem of registry.WINDOWS_SYSTEM_DLLS) {
    if (!registry.isBuiltinOnlyDll(stem) || stem==='kernel32') continue;
    const name=stem.includes('.')?stem:stem+'.dll', p=write(name);
    const h=e.load(p,0)>>>0;
    assert(h && e.yielded()===0,name+' builtin policy');
    assert.equal(e.module(p,0)>>>0,h,name+' identity');
    assert(!handles.has(h),name+' distinct identity'); handles.add(h);
    assert.throws(()=>loader.loadDll({},null,original,name),/Builtin-only/);
  }
  for (const name of ['msvcrt.dll','d3drm.dll','ole32.dll','comctl32.dll','oleaut32.dll','dsetup.dll','vendor.dll']) {
    vfs.files.set('c:\\'+name,{data:original,attrs:0x20});
    e.load(write(name),0); assert.equal(e.yielded(),5,name+' keeps native mapping route');
  }
  const requested=[];
  await boot.resolveDllGraph({exeBytes:importPe('d3d8.dll'), detectRequiredDlls:loader.detectRequiredDlls,
    loadSpec:async n=>{requested.push(n);return null;}});
  assert.deepEqual(requested,[],'startup keeps builtin imports');
  const deps=boot.loadLibraryDependencies(importPe('ddraw.dll'),'d3d8.dll',new Set(),()=>false);
  assert(deps.next().done,'native dependency walk keeps DDRAW builtin');
  assert.deepEqual(await loader.missingImportDependencies(importPe('d3d8.dll'),()=>false,async()=>false),[]);
  await boot.resolveDllGraph({exeBytes:importPe('dsetup.dll'),detectRequiredDlls:loader.detectRequiredDlls,
    loadSpec:async n=>{requested.push(n);return null;}});
  assert.deepEqual(requested,['dsetup.dll'],'native-loadable startup negative control');
  assert.equal(hash(boot.findVfsDllBytes(vfs,'d3d8.dll',full)),before);
  assert.equal(vfs.files.get(full).staticModule,undefined);
  assert.deepEqual(findVersionBlob(vfs.files.get(full).data),version);
  assert.equal(hash(original),before);
  console.log(`PASS builtin execution, identity, exports, startup/dependency policy, native and missing-path controls; ${arg?'authentic':'synthetic'} bytes/resources unchanged; no x86 executed`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
