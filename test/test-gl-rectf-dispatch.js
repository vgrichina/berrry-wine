#!/usr/bin/env node
'use strict';
// Real generated dispatch and stdcall bridge -> atomic rectangle/list command
// -> production quad triangulation and packed draw replay. Unrelated platform
// paths trap; transform/raster observers are inert fixture endpoints.
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
const id=4394;assert.strictEqual(api[id].name,'glRectf');
const rgbId=4222;assert.strictEqual(api[rgbId].name,'glColor3dv');
const vertexId=4448;assert.strictEqual(api[vertexId].name,'glVertex2dv');
const page='$dispatch_api_table_page_'+Math.floor(id/256);
const vertexPage='$dispatch_api_table_page_'+Math.floor(vertexId/256);
const roots=['$handle_gpu_api','$dispatch_api_table',page,vertexPage,'$wgl_api_available','$handle_glColor3dv','$handle_glColor4dv','$handle_glVertex2dv',
  '$gl_wat_encode_call','$gl_append_vertex','$gl_append_vertex4'];
// No matrix/raster/backend work is needed for a color or list setter. These
// observers are inert fixture endpoints. All other excluded paths trap.
const seams=new Map([
  // WGL ownership is a host stream round trip (09a8cw). Answer what production
  // sets for an untagged host reply: WGL not WAT-owned, GPU stream off.
  ['$gl_wgl_query_mode','(global.set $gl_owned (i32.const 0))'],
  ['$gl_sw_consume','(param i32 i32)'],['$gl_mtx_observe','(param i32 i32)'],['$gl_sw_observe','(param i32 i32)'],
  ['$gl_bitmap_context_init','(param i32)'],['$gl_stencil_init','(param i32)'],
  // Drawable selection is covered by the full-source pixel fixtures. These
  // isolated color/rectangle tests exercise no draw/read-buffer commands.
  ['$gl_color_buffer_validate','(param i32 i32 i32) (result i32) (i32.const 0)'],
  ['$gl_color_selection_intercept','(param i32 i32) (result i32) (i32.const 0)'],
  ...['$gl_stencil_intercept','$gl_color_mask_intercept','$gl_bitmap_intercept',
    '$gl_stencil_validate'].map(n=>[n,'(param i32 i32'+(n==='$gl_stencil_validate'?' i32':'')+') (result i32) (i32.const 0)'])
]);
const excluded=new Set(['$gl_emit_record','$gl_pointer_length',
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
  if(mutation) {
    const i=parts.findIndex(s=>s.startsWith('(func $gl_rectf '));
    const before=parts[i];
    if(mutation==='corner')parts[i]=before.replace('(local.get $x2) (local.get $y1)', '(local.get $x1) (local.get $y1)');
    if(mutation==='bits')parts[i]=before.replace('(f32.load offset=4 (local.get $stack))', '(f32.convert_i32_s (i32.load offset=4 (local.get $stack)))');
    assert.notStrictEqual(parts[i],before);
  }
  const src=`(memory 64) (export "memory" (memory 0))
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
    (func (export "invoke") (param $a i32) (param $b i32) (param $c i32) (param $d i32)
      (call $dispatch_api_table (i32.const ${id}) (local.get $a) (local.get $b) (local.get $c) (local.get $d) (i32.const 0) (i32.const 0)))
    (func (export "error") (result i32) (i32.load offset=32 (call $gl_list_context)))
    (func (export "active") (result i32) (global.get $gl_immediate_mode))
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
  const {e,t,v}=h, stream=require('../lib/gl-command-stream');
  e.context();
  const bits=x=>{const b=Buffer.alloc(4);b.writeFloatLE(x);return b.readUInt32LE();};
  const call=(op,args=[])=>{v.setUint32(0x3000,0xcafebabe,true);args.forEach((x,i)=>v.setUint32(0x3004+i*4,x>>>0,true));return e.encode(op,0x3000);};
  const invoke=a=>{
    const esp=0x402800;
    v.setUint32(272,esp,true);
    for(let i=0;i<8;i++)if(i!==4)v.setUint32(256+i*4,0x77770000+i,true);
    v.setUint32(t(esp),0xcafebabe,true);a.forEach((x,i)=>v.setUint32(t(esp+4+i*4),bits(x),true));
    const before=Buffer.from(new Uint8Array(e.memory.buffer,t(esp),24));
    // Deliberately unrelated dispatcher words: the ABI owns argument bits on ESP.
    e.invoke(1,2,3,4);
    assert.strictEqual(v.getUint32(272,true),esp+20,'four float args + return');
    for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(v.getUint32(256+i*4,true),0x77770000+i,'GPR preserved');
    assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,t(esp),24)),before,'argument stack preserved');
  };
  const records=()=>{const out=[];for(const b of h.batches())stream.replay(b,(op,mode,c)=>{
    assert.strictEqual(op,stream.PACKED_DRAW_OPCODE);assert.strictEqual(mode,4,'quad triangulated through canonical path');
    assert.strictEqual(c.pointerLength,6*76);out.push(Array.from(new Float32Array(c.buffer,c.pointerOffset,c.pointerLength/4)));return 0;
  });return out;};
  call(25,[.25,.5,.75,.125].map(bits));call(28,[-.5,.625].map(bits));call(63,[0,0,1].map(bits));
  const cases=[[90,263,514,307],[4,3,-2,-7],[-0,-1.25,Math.PI,Math.E],[1,2,1,2]];
  function expect(a) {
    const r=records().at(-1), [x1,y1,x2,y2]=a.map(Math.fround);
    // Canonical GL_QUADS uses the same winding/diagonal for all four corners.
    const pts=[[x1,y1],[x2,y1],[x2,y2],[x1,y1],[x2,y2],[x1,y2]];
    for(let i=0;i<6;i++) {
      const p=r.slice(i*19,(i+1)*19);
      assert.deepStrictEqual(p.slice(0,3),[...pts[i],0]);
      assert.deepStrictEqual(p.slice(3,7),[.25,.5,.75,.125]);
      assert.deepStrictEqual(p.slice(7,12),[-.5,.625,0,0,1]);
      assert.strictEqual(p[14],1);assert.deepStrictEqual(p.slice(15),[0,1,0,1]);
    }
    assert.strictEqual(e.active(),-1);assert.strictEqual(e.count(),0);
  }
  for(const a of cases){invoke(a);expect(a);}
  assert.strictEqual(e.available(),1,'WGL resolves implemented rectangle');
  assert.strictEqual(api[id].nargs,4);assert.strictEqual(api[id].convention,'stdcall');
  // GL_COMPILE owns the four argument values, not a temporary pointer or a
  // sequence of Begin/End commands that could disrupt the replay caller.
  const list=call(124,[1]),a=cases[0];const n=records().length;
  call(125,[list,0x1300]);invoke(a);call(126);
  assert.strictEqual(records().length,n,'compile defers draw');
  v.setUint32(t(0x402804),bits(999),true);call(127,[list]);expect(a);
  call(125,[list,0x1301]);invoke(cases[1]);call(126);expect(cases[1]);
  call(127,[list]);expect(cases[1]);
  // Direct rect and a list containing rect must leave the enclosing primitive
  // intact and report INVALID_OPERATION. End still draws only our own vertices.
  call(21,[4]);e.vertex();const count=e.count(),bytes=h.emitted();
  const pending=Buffer.from(new Uint8Array(e.memory.buffer,e.vertices(),count*4));
  invoke(a);assert.strictEqual(e.active(),4);assert.strictEqual(e.count(),count);assert.strictEqual(h.emitted(),bytes);
  assert.strictEqual(e.error(),0x502);
  call(127,[list]);assert.strictEqual(e.error(),0x502);assert.strictEqual(e.active(),4);assert.strictEqual(e.count(),count);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,e.vertices(),count*4)),pending);
  call(22);assert.strictEqual(call(12),0x502);assert.strictEqual(e.error(),0);
  // Compilation's shadow Begin state also rejects rect without recording it.
  const empty=call(124,[1]);call(125,[empty,0x1300]);call(21,[7]);invoke(a);
  assert.strictEqual(call(12),0x502);call(22);call(126);
  const saved=h.emitted();call(127,[empty]);assert.strictEqual(h.emitted(),saved);
  return {cases:cases.length,displayLists:true,invalidBeginPreserved:true,stdcall:true};
}
const h=boot();const result=acceptance(h);
const failed=boot('',true);failed.v.setUint32(272,0x402800,true);failed.v.setUint32(256,0xdeadbeef,true);
assert.throws(()=>failed.e.invoke(0,0,0,0),WebAssembly.RuntimeError,'allocation failure cannot silently draw');
assert.strictEqual(failed.v.getUint32(272,true),0x402800);assert.strictEqual(failed.v.getUint32(256,true),0xdeadbeef);
for(const m of ['corner','bits'])assert.throws(()=>acceptance(boot(m)),assert.AssertionError,m+' mutation rejected');
const stream=require('../lib/gl-command-stream'),compat=stream;
assert.strictEqual(compat.CALL_INDEX.glRectf,142);assert.strictEqual(stream.ARG_WORDS[142],4);
assert.strictEqual(compat.CALL_INDEX.gluScaleImage,141);
console.log(JSON.stringify({PASS:true,...result,moduleSHA:h.moduleSHA,sourceSHA:files.map((p,i)=>[p,hash(read(p))])}));
