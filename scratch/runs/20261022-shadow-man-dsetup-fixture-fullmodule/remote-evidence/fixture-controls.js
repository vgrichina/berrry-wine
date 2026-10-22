'use strict';
// Evidence-only probes: execute each fixture's real translator and actual
// load/store instructions. No full emulator or guest instructions are run.
const fs = require('fs'), path = require('path'), Module = require('module');
const assert = require('assert'), crypto = require('crypto');
const root = process.cwd(), E = path.join(root, 'evidence-fixture-fullmodule');
const compiler = require(path.join(root, 'tools/watx'));
const realCompile = compiler.compile;
const { GUEST_BASE } = require(path.join(root, 'lib/region-map.generated'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let captured, mutation;
compiler.compile = function(wat, ...args) {
  captured = wat;
  if (mutation === 'export') wat = wat.replace(
    /(\(func \(export "get_guest_base"\) \(result i32\) )([^\n]+)/,
    '$1(i32.add (global.get $GUEST_BASE) (i32.const 8)))');
  if (mutation === 'translation') wat = wat.replace('(func $g2w (param $p i32) (result i32)',
    '(func $g2w (param $p i32) (result i32) (local.set $p (i32.add (local.get $p) (i32.const 8)))');
  if (mutation === 'alias') wat = wat.replace(
    /\(global \$GUEST_BASE i32 \(i32.const [^)]+\)\)/,
    '(global $GUEST_BASE i32 (i32.const 0))');
  wat += `
    (func (export "probe_translate") (param $p i32) (result i32) (call $g2w (local.get $p)))
    (func (export "probe_read") (param $p i32) (result i32) (call $gl8 (local.get $p)))
    (func (export "probe_store") (param $p i32) (param $v i32)
      (i32.store (call $g2w (local.get $p)) (local.get $v)))`;
  return realCompile(wat, ...args);
};
function compile(kind, before) {
  const filename = path.join(root, 'test', kind === 'dsetup' ? 'dsetup-binding-fixture.js' : 'version-source-fixture.js');
  const m = new Module(filename, module); m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(fs.readFileSync(before ? path.join(E, kind === 'dsetup' ? 'dsetup-before.js' : 'version-before.js') : filename, 'utf8'), filename);
  return kind === 'dsetup' ? m.exports.compileBindingFixture() : m.exports.compileSrcWasm();
}
async function probe(binary) {
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const host = {memory};
  for (const n of ['fs_create_file','fs_read_file','fs_close_handle','fs_set_file_pointer','fs_get_file_size']) host[n]=()=>{throw Error('unexpected host call');};
  const {instance} = await WebAssembly.instantiate(binary,{host}), e=instance.exports;
  assert.equal(e.get_guest_base(), GUEST_BASE, 'shared base disagreement');
  const image=e.get_image_base(), u=new Uint8Array(memory.buffer), dv=new DataView(memory.buffer);
  const samples=[image,image+0x1000,0x500000,0xb00000,0x100018b0];
  const rows=samples.map((guest,i)=>({guest,wasm:guest-image+GUEST_BASE,value:0x12345060+i}));
  for (const row of rows) {
    assert(row.wasm>=GUEST_BASE && row.wasm+5<memory.buffer.byteLength, 'bounded direct range');
    assert(row.wasm>0x1400,'guest must not alias fixture metadata');
    assert.equal(e.probe_translate(row.guest),row.wasm,'translation disagreement');
    u.fill(0xa5,row.wasm-1,row.wasm+5);
    e.probe_store(row.guest,row.value);
    assert.equal(dv.getUint32(row.wasm,true),row.value,'write translation');
    assert.equal(e.probe_read(row.guest),row.value&255,'read translation');
    assert.equal(u[row.wasm-1],0xa5); assert.equal(u[row.wasm+4],0xa5);
  }
  assert.equal(new Set(rows.map(r=>r.wasm)).size,rows.length,'no guest aliases');
  assert(u.subarray(0x1000,0x1400).every(x=>x===0),'metadata intact');
  return {image,base:e.get_guest_base(),bufferBytes:memory.buffer.byteLength,rows};
}
(async()=>{
  const result=[];
  for (const kind of ['dsetup','version']) {
    mutation=null; const old=compile(kind,true), oldWat=captured, before=await probe(old);
    const current=compile(kind,false), newWat=captured, after=await probe(current);
    assert.deepStrictEqual(before,after);
    // Compare every verbatim production function from each compiled WAT.
    const {sourceFunction}=require(path.join(root,'test/wat-source-function'));
    const names=kind==='dsetup' ? ['patch_caller_iat','resolve_ordinal','resolve_ordinal_locked','parse_exports','dll_name_match','tolower'] :
      ['version_read_exact','version_rsrc_child','version_ne_resource','file_version_resource',
       'file_version_info_size_named','file_version_info_named','version_is_ne','version_value_offset',
       'version_value_bytes','version_find_node','version_ne_text_path','version_query',
       'handle_GetFileVersionInfoSizeA','handle_GetFileVersionInfoA','handle_GetFileVersionInfoSizeW',
       'handle_GetFileVersionInfoW','handle_VerQueryValueA','handle_VerQueryValueW','tolower','tt_cp1252_to_unicode'];
    for (const n of names) assert.equal(sourceFunction(oldWat,n),sourceFunction(newWat,n),n+' unchanged');
    const controls=[];
    for (mutation of ['export','translation','alias']) {
      const binary=compile(kind,false);
      await assert.rejects(()=>probe(binary), /disagreement|alias/,kind+' '+mutation);
      controls.push({mutation,rejected:true});
    }
    result.push({kind,scope:'source fixture only; flat direct memory, not full module',beforeSHA256:sha(old),afterSHA256:sha(current),identicalBehavior:after,productionFunctionsUnchanged:names.length,controls});
    mutation=null;
  }
  fs.writeFileSync(path.join(E,'fixture-controls.json'),JSON.stringify(result,null,2)+'\n');
  console.log('PASS both fixtures before/after translation, bounds, guards, metadata separation, preserved functions; six executable rejecting controls');
})().catch(e=>{console.error(e);process.exitCode=1;});
