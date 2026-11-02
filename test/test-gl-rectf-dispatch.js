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
function form(s, start) {
  let d=0, quote=false, comment=false;
  for(let i=start;i<s.length;i++) {
    const c=s[i];
    if(comment){if(c==='\n')comment=false;continue;}
    if(!quote&&c===';'&&s[i+1]===';'){comment=true;continue;}
    if(c==='"'&&s[i-1]!=='\\')quote=!quote;
    if(quote)continue;
    if(c==='(')d++;
    if(c===')'&&--d===0)return s.slice(start,i+1);
  }
  throw Error('unterminated form');
}
const files=['src/09b2-dispatch-table.generated.wat','src/09a8b-handlers-opengl.wat',
  'src/09a8c-gl-encoder.wat','src/09a8d-gl-abi.generated.wat',
  'src/09a8e-gl-state.wat','src/09a8ca-gl-lists.wat','src/03-registers.wat'];
const sources=files.map(read), funcs=new Map(), globals=new Map();
for(const s of sources) {
  for(const m of s.matchAll(/\(func (\$[\w?]+)/g))funcs.set(m[1],form(s,m.index));
  for(const m of s.matchAll(/\(global (\$\w+) /g))globals.set(m[1],form(s,m.index));
}
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
  '$gl_wat_stream_flush','$gl_state_set_context','$gl_state_context_deleted','$gl_state_context_changed','$gs32','$gs64','$gs8','$gs16','$gl_copy_from_guest']);
const all=fs.readdirSync(path.join(__dirname,'../src')).filter(n=>/\.wat$/.test(n)).map(n=>read('src/'+n)).join('\n');
for(const n of ['$host_gdi_surface_create','$present_frame_end','$thunk_reserve','$update_thunk_end','$lookup_api_id','$guest_strlen','$memcpy','$gdi_dc_get_field','$gdi_dc_bitmap_record','$gdi_bitmap_record_valid']) {
  const m=all.match(new RegExp('\\(func '+n.replace('$','\\$')+'(?= |\\n)'));
  assert(m,'missing '+n); const body=form(all,m.index);const sig=body.slice(n.length+6).replace(/^\s*\(export "[^"]*"\)/, '').match(/^(\s*\((?:param|result)[^)]*\))*/)[0];
  seams.set(n,sig+' (unreachable)');
  for(const m of all.matchAll(/\(global (\$\w+) /g))if(!globals.has(m[1]))globals.set(m[1],form(all,m.index));
}
const selected=new Map(), traps=new Map();
function visit(n) {
  if(selected.has(n)||traps.has(n)||seams.has(n)||['$g2w','$w2g','$heap_alloc','$heap_free'].includes(n))return;
  const s=funcs.get(n);
  if(!s && (n.startsWith('$handle_') || n.startsWith('$dispatch_api_table_page_'))) {
    const count=n==='$handle_fallback'?2:n.startsWith('$dispatch_api_table_page_')?7:6;
    traps.set(n,`(func ${n} (param ${Array(count).fill('i32').join(' ')}) (unreachable))`);return;
  }
  assert(s,'missing production signature '+n);
  if(excluded.has(n)||n.startsWith('$handle_')&&!roots.includes(n)||
      n.startsWith('$dispatch_api_table_page_')&&!roots.includes(n)) {
    const signature=s.slice(n.length+6).replace(/^\s*\(export "[^"]*"\)/, '').match(/^(\s*\((?:param|result)[^)]*\))*/)[0];
    traps.set(n,`(func ${n} ${signature} (unreachable))`);return;
  }
  selected.set(n,s);
  for(const m of s.matchAll(/\(call (\$\w+)/g)){try {visit(m[1]);} catch(e) {throw Error(e.message+' <- '+n);}};
}
// Supply exact signatures for external paths referenced by selected functions.
for(const p of ['src/09a8cb-gl-bitmap.wat','src/09a8cc-gl-stencil.wat','src/09a8cd-gl-color-mask.wat','src/09a8f-gl-matrix.wat','src/09a8g-gl-raster.wat']) {
  const s=read(p);
  for(const m of s.matchAll(/\(func (\$\w+)/g)) {
    if(!funcs.has(m[1])) {funcs.set(m[1],form(s,m.index));excluded.add(m[1]);}
  }
  for(const m of s.matchAll(/\(global (\$\w+) /g))if(!globals.has(m[1]))globals.set(m[1],form(s,m.index));
}
roots.forEach(n=>{if(funcs.has(n))visit(n);});
function boot(mutation='',failAlloc=false,failPage=-1,colorId=id) {
  const parts=[...selected.values()];
  if(mutation) {
    const i=parts.findIndex(s=>s.startsWith('(func $gl_rectf '));
    const before=parts[i];
    if(mutation==='corner')parts[i]=before.replace('(local.get $x2) (local.get $y1)', '(local.get $x1) (local.get $y1)');
    if(mutation==='bits')parts[i]=before.replace('(f32.load offset=4 (local.get $stack))', '(f32.convert_i32_s (i32.load offset=4 (local.get $stack)))');
    assert.notStrictEqual(parts[i],before);
  }
  const needed=new Set([...parts.join('\n').matchAll(/\(global\.(?:get|set) (\$\w+)/g)].map(m=>m[1]));
  const definedGlobals=new Map([...globals].filter(([n])=>needed.has(n)));
  for(const n of ['$reg_base','$image_base','$GUEST_BASE','$NULL_SENTINEL','$fault_sync_epoch'])definedGlobals.delete(n);
  const src=`(memory 64) (export "memory" (memory 0))
    (import "fixture" "g2w" (func $g2w (param i32) (result i32)))
    (import "fixture" "alloc" (func $heap_alloc (param i32) (result i32)))
    (import "fixture" "free" (func $heap_free (param i32)))
    (func $w2g (param $p i32) (result i32) (i32.add (local.get $p) (i32.const 4190208)))
    (global $reg_base i32 (i32.const 256))
    (global $image_base i32 (i32.const 4194304)) (global $GUEST_BASE i32 (i32.const 4096))
    (global $NULL_SENTINEL i32 (i32.const 240)) (global $fault_sync_epoch (mut i32) (i32.const 0))
    (defmacro (g2w-fast $ga) (call $g2w $ga))
    ${[...definedGlobals.values()].join('\n')}
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
  const transformed=src.replaceAll('(region.end $DIRECT_WINDOW)','(i32.const 65536)').replace(/\(region\.addr \$\w+(?: (?:0x[0-9A-Fa-f]+|[0-9]+))?\)/g,'(i32.const 0)');
  const result=compile(transformed,new Map(),{mode:'production'});
  let next=0x10000, frees=0;
  const t=p=>(p>>>12)===failPage?240:p>=0x50000000?
    0x8000+(((p-0x50000000)>>>12)*0x2000)+(p&4095):p-0x400000+4096;
  const e=new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary),{fixture:{g2w:t,
    alloc:n=>{if(failAlloc)return 0;const p=next;next=(next+n+7)&~7;return p+4190208;},free:()=>frees++}}).exports;
  return {e,t,v:new DataView(e.memory.buffer),components:colorId===rgbId?3:4,failAlloc:()=>{failAlloc=true;},frees:()=>frees,moduleSHA:hash(result.wasmBinary),transformSHA:hash(transformed)};
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
  const records=()=>{const out=[];stream.replay(stream.memoryBatch(e.memory,e.stream(),e.bytes()),(op,mode,c)=>{
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
  call(21,[4]);e.vertex();const count=e.count(),bytes=e.bytes();
  const pending=Buffer.from(new Uint8Array(e.memory.buffer,e.vertices(),count*4));
  invoke(a);assert.strictEqual(e.active(),4);assert.strictEqual(e.count(),count);assert.strictEqual(e.bytes(),bytes);
  assert.strictEqual(e.error(),0x502);
  call(127,[list]);assert.strictEqual(e.error(),0x502);assert.strictEqual(e.active(),4);assert.strictEqual(e.count(),count);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,e.vertices(),count*4)),pending);
  call(22);assert.strictEqual(call(12),0x502);assert.strictEqual(e.error(),0);
  // Compilation's shadow Begin state also rejects rect without recording it.
  const empty=call(124,[1]);call(125,[empty,0x1300]);call(21,[7]);invoke(a);
  assert.strictEqual(call(12),0x502);call(22);call(126);
  const saved=e.bytes();call(127,[empty]);assert.strictEqual(e.bytes(),saved);
  return {cases:cases.length,displayLists:true,invalidBeginPreserved:true,stdcall:true};
}
const h=boot();const result=acceptance(h);
const failed=boot('',true);failed.v.setUint32(272,0x402800,true);failed.v.setUint32(256,0xdeadbeef,true);
assert.throws(()=>failed.e.invoke(0,0,0,0),WebAssembly.RuntimeError,'allocation failure cannot silently draw');
assert.strictEqual(failed.v.getUint32(272,true),0x402800);assert.strictEqual(failed.v.getUint32(256,true),0xdeadbeef);
for(const m of ['corner','bits'])assert.throws(()=>acceptance(boot(m)),assert.AssertionError,m+' mutation rejected');
const compat=require('../lib/gl-compat'),stream=require('../lib/gl-command-stream');
assert.strictEqual(compat.CALL_INDEX.glRectf,142);assert.strictEqual(stream.ARG_WORDS[142],4);
assert.strictEqual(compat.CALL_INDEX.gluScaleImage,141);
console.log(JSON.stringify({PASS:true,...result,moduleSHA:h.moduleSHA,sourceSHA:files.map((p,i)=>[p,hash(sources[i])])}));
