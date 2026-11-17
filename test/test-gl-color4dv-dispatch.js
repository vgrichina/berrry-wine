#!/usr/bin/env node
'use strict';
// Production dispatch -> guest scalar loads -> canonical encoder -> current
// state / display-list capture and replay -> packed vertex. Only unrelated
// renderer/platform endpoints are fixture seams; unexpected calls trap.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {compile} = require('../tools/watx');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const {closure,supply}=require('./helpers/wat-closure-fixture');
const files=['src/09b2-dispatch-table.generated.wat','src/09a8b-handlers-opengl.wat',
  'src/09a8c-gl-encoder.wat','src/09a8d-gl-abi.generated.wat',
  'src/09a8e-gl-state.wat','src/09a8ca-gl-lists.wat','src/03-registers.wat',
  // The selection/feedback (91da9cb83) and evaluator (4ec8732ba) query and
  // enable intercepts run on every encoded call; non-matching ops pass through.
  'src/09a8ce-gl-selection.wat','src/09a8cd-gl-evaluators.wat'];
const api=JSON.parse(read('src/api_table.json'));
const id=4235;assert.strictEqual(api[id].name,'glColor4dv');
const rgbId=4222;assert.strictEqual(api[rgbId].name,'glColor3dv');
const vertexId=4448;assert.strictEqual(api[vertexId].name,'glVertex2dv');
const page='$dispatch_api_table_page_'+Math.floor(id/256);
const vertexPage='$dispatch_api_table_page_'+Math.floor(vertexId/256);
const roots=['$dispatch_api_table',page,vertexPage,'$wgl_api_available','$handle_glColor3dv','$handle_glColor4dv','$handle_glVertex2dv',
  '$gl_wat_encode_call','$gl_append_vertex','$gl_append_vertex4'];
// No matrix/raster/backend work is needed for a color or list setter. These
// observers are inert fixture endpoints. All other excluded paths trap.
const seams=new Map([
  // WGL ownership is a host stream round trip (09a8cw). Answer what production
  // sets for an untagged host reply: WGL not WAT-owned, GPU stream off.
  ['$gl_wgl_query_mode','(global.set $gl_owned (i32.const 0))'],
  // General state queries have a separate full-source resolved-ABI fixture.
  ['$gl_native_query','(param i32 i32) (result i32) (i32.const 0)'],
  ['$gl_sw_consume','(param i32 i32)'],['$gl_mtx_observe','(param i32 i32)'],['$gl_sw_observe','(param i32 i32)'],
  ['$gl_bitmap_context_init','(param i32)'],['$gl_stencil_init','(param i32)'],
  ['$d3dim_worker_fence','(unreachable)'],
  // Drawable selection is covered by the full-source pixel fixtures. These
  // isolated color/rectangle tests exercise no draw/read-buffer commands.
  ['$gl_color_buffer_validate','(param i32 i32 i32) (result i32) (i32.const 0)'],
  ['$gl_color_selection_intercept','(param i32 i32) (result i32) (i32.const 0)'],
  ...['$gl_stencil_intercept','$gl_color_mask_intercept','$gl_bitmap_intercept','$gl_stipple_intercept',
    '$gl_stencil_validate'].map(n=>[n,'(param i32 i32'+(n==='$gl_stencil_validate'?' i32':'')+') (result i32) (i32.const 0)'])
]);
// Full-source 1D pixel fixtures cover allocation/reclamation. Trap those
// unrelated endpoints in this isolated current-state/list ABI fixture.
const excluded=new Set(['$gl_pixels_validate','$gl_pixels_execute','$gl_pixel_map_validate','$gl_pixel_map_set','$gl_pixel_map_get','$gl_texture_get_image','$gl_2d_upload','$gl_texture_copy_validate','$gl_texture_copy_execute','$gl_2d_store','$gl_texture_storage_free','$gl_texture_image_level','$gl_1d_store','$gl_1d_free','$gl_emit_record','$gl_pointer_length',
  '$gl_state_set_context','$gl_state_context_deleted','$gl_state_context_changed','$gs32','$gs64','$gs8','$gs16','$gl_copy_from_guest']);
// Real production bodies: the files above plus the per-producer state claim.
// Any other production callee is an exact-signature trap.
// gl_sw_state_defaults seeds the template the per-producer state copies; the
// host runs it at launch through gl_sw_set_enabled, the fixture at start.
const {selected,traps}=closure({roots:[...roots,'$gl_sw_state_defaults'],excluded,seams,
  real:[...files,'$gl_sw_private_state','$gl_sw_state_defaults','$gl_stipple_defaults','$gl_period_defaults','$gl_stipple_mask',
  // Per-call observers and intercepts; each passes through ops it does not own.
  // glColorMaterial tracking (09a8g) is gated on its enable bit, off here.
  '$gl_period_observe','$gl_period_validate','$gl_period_color','$gl_period_track',
  '$gl_stipple_intercept','$gl_sw_context_publish','$gl_wgl_owned']});
function boot(mutation='',failAlloc=false,failPage=-1,colorId=id) {
  const parts=[...selected.values()];
  if(mutation==='vertex-route') {
    const i=parts.findIndex(s=>s.startsWith('(func '+vertexPage+' '));
    const before=parts[i];parts[i]=before.replace('(call $handle_glVertex2dv ', '(call $handle_gl_unimplemented ');
    assert.notStrictEqual(parts[i],before);
  } else if(mutation==='rgb-route') {
    const i=parts.findIndex(s=>s.startsWith('(func '+page+' '));
    const before=parts[i];parts[i]=before.replace('(call $handle_glColor3dv ', '(call $handle_gl_unimplemented ');
    assert.notStrictEqual(parts[i],before);
  } else if(mutation) {
    const i=parts.findIndex(s=>s.startsWith(mutation==='cleanup'?'(func $handle_glColor3dv ':'(func $gl_color_dv '));
    assert(i>=0);
    const before=parts[i];
    if(['r','g','b','a'].includes(mutation))parts[i]=before.replace(`(local.get $${mutation}))`,'(f32.const 1))');
    else if(mutation==='stride')parts[i]=before.replace('(i32.const 24)', '(i32.const 12)');
    else if(mutation==='opcode')parts[i]=before.replace('(i32.const 25)', colorId===rgbId?'(i32.const 28)':'(i32.const 23)');
    else if(mutation==='rgb-alpha')parts[i]=before.replace('(local.set $a (f32.const 1))','(local.set $a (f32.const 0))');
    else if(mutation==='rgb-stride')parts[i]=before.replace('(i32.const 16)', '(i32.const 12)');
    else if(mutation==='cleanup')parts[i]=before.replace('(i32.const 8))))','(i32.const 12))))');
    assert.notStrictEqual(parts[i],before,'mutation must change production body');
  }
  const src=`(memory 64 64 shared) (export "memory" (memory 0))
    (import "fixture" "g2w" (func $g2w (param i32) (result i32)))
    (import "fixture" "alloc" (func $heap_alloc (param i32) (result i32)))
    (import "fixture" "free" (func $heap_free (param i32)))
    (import "fixture" "gpu" (func $host_gpu_gl_call (param i32 i32 i32) (result i32)))
    (func $w2g (param $p i32) (result i32) (i32.add (local.get $p) (i32.const 4190208)))
    (global $reg_base i32 (i32.const 256))
    (global $image_base i32 (i32.const 4194304)) (global $GUEST_BASE i32 (i32.const 4096))
    (global $NULL_SENTINEL i32 (i32.const 240)) (global $fault_sync_epoch (mut i32) (i32.const 0))
    (defmacro (g2w-fast $ga) (call $g2w $ga))
    (start $gl_sw_state_defaults)
    ;;@supply
    ${[...seams].map(([n,s])=>`(func ${n} ${s})`).join('\n')}
    ${[...traps.values()].join('\n')}
    ${parts.join('\n')}
    (func (export "invoke") (param $p i32)
      (call $dispatch_api_table (i32.const ${colorId}) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "invokeVertex") (param $p i32)
      (call $dispatch_api_table (i32.const ${vertexId}) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "other") (param $id i32)
      (call $dispatch_api_table (local.get $id) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "vertexAvailable") (result i32) (call $wgl_api_available (i32.const ${vertexId})))
    (func (export "available") (result i32) (call $wgl_api_available (i32.const ${colorId})))
    (func (export "encode") (param $op i32) (param $stack i32) (result i32)
      (call $gl_wat_encode_call (local.get $op) (local.get $stack) (i32.const 0)))
    (func (export "context") (global.set $gl_current_context (i32.const 1)))
    (func (export "mode") (param $m i32) (global.set $gl_immediate_mode (local.get $m)))
    (func (export "vertex") (call $gl_append_vertex (f32.const 2) (f32.const -3) (f32.const 4)))
    (func (export "vertices") (result i32) (global.get $gl_immediate_wa))
    (func (export "stream") (result i32) (global.get $gl_stream_wa))
    (func (export "bytes") (result i32) (global.get $gl_stream_used_bytes))
    (func (export "count") (result i32) (global.get $gl_immediate_floats))`;
  const transformed=src.replace(';;@supply',supply(src)).replaceAll('(region.end $DIRECT_WINDOW)','(i32.const 65536)');
  const result=compile(transformed,new Map(),{mode:'production'});
  let next=0x10000, frees=0;
  const t=p=>(p>>>12)===failPage?240:p>=0x50000000?
    0x8000+(((p-0x50000000)>>>12)*0x2000)+(p&4095):p-0x400000+4096;
  // The host side of a stream flush (0x10001): keep the batch, answer 0 as
  // the GL host does for a batch with no query in it.
  const sent=[];let mem=null;
  const gpu=(cmd,wa,len)=>{assert.strictEqual(cmd,0x10001);sent.push(mem.buffer.slice(wa,wa+len));return 0;};
  const e=new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary),{fixture:{g2w:t,gpu,
    alloc:n=>{if(failAlloc)return 0;const p=next;next=(next+n+7)&~7;return p+4190208;},free:()=>frees++}}).exports;
  mem=e.memory;
  // Everything this producer emitted: flushed batches, then the pending one.
  const batches=()=>[...sent.map(b=>({buffer:b,byteOffset:0,bytes:b.byteLength})),
    {buffer:e.memory.buffer,byteOffset:e.stream(),bytes:e.bytes()}];
  const emitted=()=>sent.reduce((n,b)=>n+b.byteLength,e.bytes());
  return {e,t,v:new DataView(e.memory.buffer),sent,batches,emitted,components:colorId===rgbId?3:4,failAlloc:()=>{failAlloc=true;},frees:()=>frees,moduleSHA:hash(result.wasmBinary),transformSHA:hash(transformed)};
}
function acceptance(h) {
  const {e,t,v}=h;
  const cases=[[0x404003,[-1.25,2.75,0.10000000000000002,.375]],
    [0x50000ff5,[Math.PI,-Math.E,1.000000059604645,.123456789]],
    [0x50002fff,[-0,1e30,-1e-30,-.625]],
    [0x50004fe8,[.25,.5,.75,1.0000000596046448]]].map(([p,a])=>[p,h.components===3?[...a.slice(0,3),1]:a]);
  const write=(p,a)=>{const b=Buffer.alloc(h.components*8);a.slice(0,h.components).forEach((x,i)=>b.writeDoubleLE(x,i*8));for(let i=0;i<b.length;i++)v.setUint8(t(p+i),b[i]);};
  const color=()=>{e.mode(4);const n=e.count();e.vertex();return Array.from(new Float32Array(e.memory.buffer,e.vertices()+n*4+12,4));};
  const call=(op,args=[])=>{v.setUint32(0x3000,0xcafebabe,true);args.forEach((x,i)=>v.setUint32(0x3004+i*4,x>>>0,true));return e.encode(op,0x3000);};
  const f=x=>{const b=Buffer.alloc(4);b.writeFloatLE(x);return b.readUInt32LE();};
  const expectedReplay=[];
  for(const [p,a] of cases) {
    if(h.components===3)call(25,[.75,.5,.25,.125].map(f));
    write(p,a);v.setUint32(272,0x402800,true);v.setUint32(256,0xdeadbeef,true);
    v.setUint32(t(0x402800),0xcafebabe,true);v.setUint32(t(0x402804),p,true);
    const before=Buffer.from(new Uint8Array(e.memory.buffer,t(0x402800),24));
    e.mode(-1);e.invoke(p);assert.strictEqual(e.available(),1);
    assert.strictEqual(v.getUint32(272,true),0x402808,'stdcall return + pointer');
    assert.strictEqual(v.getUint32(256,true),0);
    assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,t(0x402800),24)),before,'stack preserved');
    assert.deepStrictEqual(color(),a.map(Math.fround),'RGBA current state remains unclamped until rasterization');
    e.invoke(p);assert.deepStrictEqual(color(),a.map(Math.fround),'legal inside Begin');
    e.mode(-1);call(21,[0]);e.vertex();call(22);
    expectedReplay.push(a.map(Math.fround));
  }
  // Existing forms retain component order, alpha and lack of early clamping.
  call(25,[-2,.5,3,.125].map(f));assert.deepStrictEqual(color(),[-2,.5,3,.125]);
  [.25,-.5,2,.625].forEach((x,i)=>v.setFloat32(0x3800+i*4,x,true));
  call(26,[0x3800+4190208]);assert.deepStrictEqual(color(),[.25,-.5,2,.625]);
  call(23,[.125,.25,.5].map(f));assert.deepStrictEqual(color(),[.125,.25,.5,1]);
  // Compilation captures values at definition time and replays through the
  // same encoder. Changing the pointed-to doubles cannot alter the list.
  e.mode(-1);e.context();const list=call(124,[1]);assert(list>0);
  const [p,a]=cases[0];write(p,a);call(25,[1,1,1,1].map(f));
  call(125,[list,0x1300]);e.invoke(p);call(126);
  assert.deepStrictEqual(color(),[1,1,1,1],'GL_COMPILE defers state');
  write(p,[9,8,7,6]);e.mode(-1);call(127,[list]);
  assert.deepStrictEqual(color(),a.map(Math.fround),'captured scalar replay');
  e.mode(-1);write(p,a);call(125,[list,0x1301]);e.invoke(p);call(126);
  assert.deepStrictEqual(color(),a.map(Math.fround),'COMPILE_AND_EXECUTE updates immediately');
  e.mode(-1);call(25,[1,1,1,1].map(f));call(127,[list]);
  assert.deepStrictEqual(color(),a.map(Math.fround),'COMPILE_AND_EXECUTE also captures');
  const stream=require('../lib/gl-command-stream'), replayed=[];
  for(const b of h.batches())stream.replay(b,(op,mode,capture)=>{
    assert.strictEqual(op,stream.PACKED_DRAW_OPCODE);assert.strictEqual(mode,0);
    assert.strictEqual(capture.pointerLength,76);
    replayed.push(Array.from(new Float32Array(capture.buffer,capture.pointerOffset+12,4)));
    return 0;
  });
  assert.deepStrictEqual(replayed,expectedReplay,'production packed records replay in setter/vertex order');
  assert(h.frees()>0,'temporary canonical stack released');
}
const h=boot();
if(process.argv.includes('--expect-vertex-unimplemented')) {
  acceptance(h);
  assert.strictEqual(api[vertexId].handler,'gl_unimplemented');
  assert.strictEqual(h.e.vertexAvailable(),0);
  assert.throws(()=>h.e.invokeVertex(0x404003),WebAssembly.RuntimeError);
  console.log(JSON.stringify({PASS:true,baseline:'color passes; pinned production vertex dispatch traps',moduleSHA:h.moduleSHA}));
  process.exit(0);
}
if(process.argv.includes('--expect-unimplemented')) {
  assert.strictEqual(api[id].handler,'gl_unimplemented');
  assert.throws(()=>acceptance(h),WebAssembly.RuntimeError);
  console.log(JSON.stringify({PASS:true,baseline:'pinned production dispatch traps',moduleSHA:h.moduleSHA}));
  process.exit(0);
}
acceptance(h);
function combined(h) {
  const {e,t,v}=h;
  assert.strictEqual(e.vertexAvailable(),1);
  const rgba=[-.25,.375,1.25,h.components===3?1:.625];
  const cp=0x50006003;
  function doubles(p,a) {
    const b=Buffer.alloc(a.length*8);a.forEach((x,i)=>b.writeDoubleLE(x,i*8));
    for(let i=0;i<b.length;i++)v.setUint8(t(p+i),b[i]);
  }
  doubles(cp,rgba);e.mode(-1);e.invoke(cp);e.mode(4);
  const cases=[[0x404003,-1.25,2.75],[0x50000ffc,Math.PI,-123.125],
    [0x50001ff8,1.0000000000000002,-0],[0x50003007,1e30,-1e-30]];
  for(const [p,x,y] of cases) {
    doubles(p,[x,y]);v.setUint32(256,0xdeadbeef,true);v.setUint32(272,0x402800,true);
    v.setUint32(t(0x402800),0xcafebabe,true);v.setUint32(t(0x402804),p,true);
    const before=Buffer.from(new Uint8Array(e.memory.buffer,t(0x402800),24));
    const n=e.count();e.invokeVertex(p);
    // Immediate vertices stage 28 floats since bd1a15a25; the first 19 keep their layout.
    assert.strictEqual(e.count(),n+28);assert.strictEqual(v.getUint32(272,true),0x402808);
    assert.strictEqual(v.getUint32(256,true),0);
    assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,t(0x402800),24)),before);
    const a=new Float32Array(e.memory.buffer,e.vertices()+n*4,19);
    assert(Object.is(a[0],Math.fround(x)));assert(Object.is(a[1],Math.fround(y)));
    assert.strictEqual(a[2],0);assert.strictEqual(a[14],1);
    assert.deepStrictEqual(Array.from(a.slice(3,7)),rgba,'production color setter feeds production vertex route');
  }
  const n=e.count();e.mode(-1);e.invokeVertex(cases[0][0]);assert.strictEqual(e.count(),n);
  // glMap1d is real since 4ec8732ba (evaluators); glLockArraysEXT is still unimplemented.
  for(const name of ['glLockArraysEXT']) {
    const row=api.find(a=>a.name===name);assert.strictEqual(row.handler,'gl_unimplemented');
    assert.throws(()=>e.other(row.id),WebAssembly.RuntimeError,name+' stays fail-fast');
  }
}
combined(h);
assert.throws(()=>combined(boot('vertex-route')),WebAssembly.RuntimeError,'lost vertex route rejected');
for(const m of ['r','g','b','a','stride','opcode'])assert.throws(()=>acceptance(boot(m)),assert.AssertionError,m+' rejected');
for(const args of [['',true],['',false,0x50001]]) {
  const b=boot(...args);b.v.setUint32(272,0x402800,true);
  assert.throws(()=>b.e.invoke(0x50000ff5),WebAssembly.RuntimeError);
  assert.strictEqual(b.v.getUint32(272,true),0x402800,'failure preserves ESP');
}
for(const p of [0xffffffe1,0xffffffff])assert.throws(()=>h.e.invoke(p),WebAssembly.RuntimeError,'guest vector cannot wrap');
const rgb=boot('',false,-1,rgbId);acceptance(rgb);combined(rgb);
for(const m of ['r','g','b','rgb-alpha','rgb-stride','opcode','cleanup','rgb-route'])
  assert.throws(()=>acceptance(boot(m,false,-1,rgbId)),m==='rgb-route'?WebAssembly.RuntimeError:assert.AssertionError,m+' RGB mutation rejected');
// RGB ends at the page boundary: there is no alpha read or fourth-component
// mapping requirement. The shared cases also place unrelated bytes after RGB.
const edge=boot('',false,0x50001,rgbId),ep=0x50000fe8;
for(let i=0;i<3;i++)edge.v.setFloat64(edge.t(ep+i*8),[.25,-.5,2][i],true);
edge.v.setUint32(272,0x402800,true);edge.e.invoke(ep);edge.e.mode(4);edge.e.vertex();
assert.deepStrictEqual(Array.from(new Float32Array(edge.e.memory.buffer,edge.e.vertices()+12,4)),[.25,-.5,2,1]);
for(const args of [['',true,-1,rgbId],['',false,0x50001,rgbId],['',false,0x50000,rgbId]]) {
  const b=boot('',false,args[2],rgbId);
  [.125,.25,.5,.75].forEach((x,i)=>b.v.setFloat32(0x3004+i*4,x,true));
  b.e.encode(25,0x3000);if(args[1])b.failAlloc();
  b.v.setUint32(272,0x402800,true);b.v.setUint32(256,0xdeadbeef,true);
  b.e.mode(4);b.e.vertex();const before=Buffer.from(new Uint8Array(b.e.memory.buffer,b.e.vertices(),76));
  assert.throws(()=>b.e.invoke(0x50000ff5),WebAssembly.RuntimeError);
  assert.strictEqual(b.v.getUint32(272,true),0x402800);assert.strictEqual(b.v.getUint32(256,true),0xdeadbeef);
  // The second staged vertex starts 28 floats in (bd1a15a25); compare its first 19.
  b.e.vertex();assert.deepStrictEqual(Buffer.from(new Uint8Array(b.e.memory.buffer,b.e.vertices()+28*4,76)),before,'failure preserves current color');
}
for(const p of [0xffffffe9,0xffffffff])assert.throws(()=>rgb.e.invoke(p),WebAssembly.RuntimeError,'RGB vector cannot wrap');
// Stable command ABI: canonicalization adds no new opcode or argument layout.
const stream=require('../lib/gl-command-stream'),compat=stream;
assert.strictEqual(compat.CALL_INDEX.glColor4f,25);assert.strictEqual(compat.CALL_INDEX.glColor4fv,26);
assert.strictEqual(compat.CALL_INDEX.gluScaleImage,141);assert.strictEqual(compat.CALLS.length,stream.ARG_WORDS.length);

assert.strictEqual(compat.CALL_INDEX.glAccum,143);assert.strictEqual(compat.CALL_INDEX.glClearAccum,144);
assert.strictEqual(stream.ARG_WORDS[25],4);
console.log(JSON.stringify({PASS:true,cases:8,vertexCases:8,rgbImplicitAlpha:true,rgbNoFourthRead:true,rgbFailurePreservesColor:true,combinedColorVertex:true,vertexRouteMutationRejected:true,mutations:['r','g','b','a','stride','opcode','rgb-alpha','rgb-stride','cleanup','rgb-route'],displayListReplay:true,packedCommandReplay:true,fixtureSHA:hash(fs.readFileSync(__filename)),
  moduleSHA:h.moduleSHA,transformSHA:h.transformSHA,sourceSHA:files.map((p,i)=>[p,hash(read(p))])}));

assert.strictEqual(compat.CALL_INDEX.glRasterPos4f,146);
