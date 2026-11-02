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
const id=4415;assert.strictEqual(api[id].name,'glTexCoord2dv');
const scalarId=4414;assert.strictEqual(api[scalarId].name,'glTexCoord2d');
const integerId=api.find(a=>a.name==='glTexCoord2i').id;
const vertexDoubleId=api.find(a=>a.name==='glVertex3d').id;
const vertex2DoubleId=api.find(a=>a.name==='glVertex2d').id;
const colorDoubleId=api.find(a=>a.name==='glColor3d').id;
const page='$dispatch_api_table_page_'+Math.floor(id/256);
const roots=['$dispatch_api_table',page,'$wgl_api_available','$handle_glTexCoord2dv','$handle_glTexCoord2d','$handle_glTexCoord2i','$handle_glVertex3d',
  '$dispatch_api_table_page_'+Math.floor(colorDoubleId/256),'$handle_glColor3d','$handle_glVertex2d',
  '$gl_wat_encode_call','$gl_append_vertex','$gl_append_vertex4'];
// No matrix/raster/backend work is needed for a texture or list setter. These
// observers are inert fixture endpoints. All other excluded paths trap.
const seams=new Map([
  // General state queries have a separate full-source resolved-ABI fixture.
  ['$gl_native_query','(param i32 i32) (result i32) (i32.const 0)'],
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
function boot(mutation='',failAlloc=false,failPage=-1) {
  const parts=[...selected.values()];
  if(mutation) {
    const scalar=['cleanup','source'].includes(mutation);
    const name=scalar?'$handle_glTexCoord2d':'$handle_glTexCoord2dv';
    const i=parts.findIndex(s=>s.startsWith('(func '+name+' '));
    const before=parts[i];
    if(mutation==='cleanup')parts[i]=before.replace('(i32.const 20)', '(i32.const 8)');
    else if(mutation==='source')parts[i]=before.replace('(i32.add (local.get $esp) (i32.const 4))','(local.get $arg0)');
    else if(mutation==='stride')parts[i]=before.replace('(i32.const 8)', '(i32.const 4)');
    else if(mutation==='opcode')parts[i]=before.replace('(i32.const 28)', '(i32.const 29)');
    else if(mutation==='route') {
      const p=parts.findIndex(s=>s.startsWith('(func '+page+' '));
      parts[p]=parts[p].replace('(call $handle_glTexCoord2d ', '(call $handle_gl_unimplemented ');
      assert.notStrictEqual(parts[p],selected.get(page));
      parts[i]=before;
    }
    if(mutation!=='route')assert.notStrictEqual(parts[i],before,'mutation changes production');
  }
  const needed=new Set([...parts.join('\n').matchAll(/\(global\.(?:get|set) (\$\w+)/g)].map(m=>m[1]));
  const definedGlobals=new Map([...globals].filter(([n])=>needed.has(n)));
  for(const n of ['$reg_base','$image_base','$GUEST_BASE','$NULL_SENTINEL','$fault_sync_epoch'])definedGlobals.delete(n);
  const src=`(memory 64) (export "memory" (memory 0))
    (region.declare-fixed $GL_SW_SCRATCH (base 0x003ff000) (size 0x800) (align 0x1000))
    (region.declare-fixed $GL_SW_STATE (base 0x003fe000) (size 0x800) (align 0x1000))
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
    (func (export "invoke") (param $p i32)
      (call $dispatch_api_table (i32.const ${id}) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "scalar")
      (call $dispatch_api_table (i32.const ${scalarId}) (i32.const 123) (i32.const 456)
        (i32.const 789) (i32.const 101112) (i32.const 0) (i32.const 0)))
    (func (export "integer") (param $s i32) (param $t i32)
      (call $dispatch_api_table (i32.const ${integerId}) (local.get $s) (local.get $t)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "vertexDouble")
      (call $dispatch_api_table (i32.const ${vertexDoubleId}) (i32.const 123) (i32.const 456)
        (i32.const 789) (i32.const 101112) (i32.const 0) (i32.const 0)))
    (func (export "colorDouble")
      (call $dispatch_api_table (i32.const ${colorDoubleId}) (i32.const 123) (i32.const 456)
        (i32.const 789) (i32.const 101112) (i32.const 0) (i32.const 0)))
    (func (export "vertex2Double")
      (call $dispatch_api_table (i32.const ${vertex2DoubleId}) (i32.const 123) (i32.const 456)
        (i32.const 789) (i32.const 101112) (i32.const 0) (i32.const 0)))
    (func (export "current")
      (f32.store (i32.const 1024) (global.get $gl_tex_s))
      (f32.store (i32.const 1028) (global.get $gl_tex_r))
      (f32.store (i32.const 1032) (global.get $gl_tex_q)))
    (func (export "attributes")
      (global.set $gl_color_r (f32.const 0.25)) (global.set $gl_color_g (f32.const 0.5))
      (global.set $gl_color_b (f32.const 0.75)) (global.set $gl_color_a (f32.const 0.125))
      (global.set $gl_normal_x (f32.const -0.5))
      (global.set $gl_tex_s (f32.const 0.375)) (global.set $gl_tex_r (f32.const 7))
      (global.set $gl_tex_q (f32.const 9))
      (global.set $gl_tex1_t (f32.const -0.625))
      (global.set $gl_tex1_r (f32.const -2)) (global.set $gl_tex1_q (f32.const 3)))
    (func (export "other") (param $id i32)
      (call $dispatch_api_table (local.get $id) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "available") (param $id i32) (result i32) (call $wgl_api_available (local.get $id)))
    (func (export "encode") (param $op i32) (param $stack i32) (result i32)
      (call $gl_wat_encode_call (local.get $op) (local.get $stack) (i32.const 0)))
    (func (export "context") (global.set $gl_current_context (i32.const 1)))
    (func (export "mode") (param $m i32) (global.set $gl_immediate_mode (local.get $m)))
    (func (export "vertex") (call $gl_append_vertex (f32.const 2) (f32.const -3) (f32.const 4)))
    (func (export "vertices") (result i32) (global.get $gl_immediate_wa))
    (func (export "stream") (result i32) (global.get $gl_stream_wa))
    (func (export "bytes") (result i32) (global.get $gl_stream_used_bytes))
    (func (export "count") (result i32) (global.get $gl_immediate_floats))`;
  const transformed=src.replaceAll('(region.end $DIRECT_WINDOW)','(i32.const 65536)');
  const result=compile(transformed,new Map(),{mode:'production'});
  let next=0x10000, frees=0;
  const t=p=>(p>>>12)===failPage?240:p>=0x50000000?
    0x8000+(((p-0x50000000)>>>12)*0x2000)+(p&4095):p-0x400000+4096;
  const e=new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary),{fixture:{g2w:t,
    alloc:n=>{if(failAlloc)return 0;const p=next;next=(next+n+7)&~7;return p+4190208;},free:()=>frees++}}).exports;
  return {e,t,v:new DataView(e.memory.buffer),frees:()=>frees,moduleSHA:hash(result.wasmBinary),transformSHA:hash(transformed)};
}
function doubles(h,p,a) {
  const b=Buffer.alloc(a.length*8);a.forEach((x,i)=>b.writeDoubleLE(x,i*8));
  for(let i=0;i<b.length;i++)h.v.setUint8(h.t(p+i),b[i]);
}
function acceptance(h) {
  const {e,t,v}=h;
  const call=(op,args=[])=>{v.setUint32(0x3000,0xcafebabe,true);args.forEach((x,i)=>v.setUint32(0x3004+i*4,x>>>0,true));return e.encode(op,0x3000);};
  const f=x=>{const b=Buffer.alloc(4);b.writeFloatLE(x);return b.readUInt32LE();};
  function attributes() {
    e.mode(4);const n=e.count();e.vertex();
    return Array.from(new Float32Array(e.memory.buffer,e.vertices()+n*4,19));
  }
  for(const stack of [0x402800,0x50000ff4]) {
    e.mode(-1);v.setUint32(272,stack,true);
    doubles(h,stack+4,[1.25,-.5,Math.PI]);e.colorDouble();
    assert.strictEqual(v.getUint32(272,true),stack+28,'color double stdcall cleanup');
    assert.strictEqual(e.available(colorDoubleId),1);
    assert.deepStrictEqual(attributes().slice(3,7),[1.25,-.5,Math.fround(Math.PI),1],
      'ordered double color and implicit alpha');
    e.mode(4);v.setUint32(272,stack,true);
    doubles(h,stack+4,[-1.25,Math.PI,7.75]);
    const n=e.count();e.vertexDouble();
    assert.strictEqual(e.available(vertexDoubleId),1);
    assert.strictEqual(v.getUint32(272,true),stack+28,'three doubles stdcall cleanup');
    assert.deepStrictEqual(Array.from(new Float32Array(e.memory.buffer,e.vertices()+n*4,3)),
      [-1.25,Math.fround(Math.PI),7.75],'three ordered doubles including non-affine stack');
    v.setUint32(272,stack,true);
    const n2=e.count();e.vertex2Double();
    assert.strictEqual(v.getUint32(272,true),stack+20,'two doubles stdcall cleanup');
    assert.strictEqual(e.available(vertex2DoubleId),1);
    assert.deepStrictEqual(Array.from(new Float32Array(e.memory.buffer,e.vertices()+n2*4,3)),
      [-1.25,Math.fround(Math.PI),0],'two ordered doubles with implicit z=0');
  }
  for(const a of [[-3,7],[0,1],[-2147483648,2147483647]]) {
    e.attributes();e.mode(-1);v.setUint32(272,0x402800,true);
    e.integer(...a);
    assert.strictEqual(v.getUint32(272,true),0x40280c,'integer stdcall cleanup');
    assert.strictEqual(e.available(integerId),1,'integer setter exposed');
    const out=attributes();
    assert.deepStrictEqual(out.slice(7,9),a.map(Math.fround),'signed numeric conversion');
    assert.deepStrictEqual(out.slice(15),[0,1,-2,3],'integer setter resets r/q, preserves unit one');
  }
  e.mode(-1);e.context();
  const integerList=call(124,[1]);
  call(125,[integerList,0x1300]);e.integer(-4,9);call(126);
  call(28,[1,1].map(f));call(127,[integerList]);
  assert.deepStrictEqual(attributes().slice(7,9),[-4,9],'integer coordinates captured in display list');
  const cases=[[0x402803,[-1.25,2.75]],[0x50000ff8,[Math.PI,-123.125]],
    [0x50002ff4,[1.0000000000000002,-0]],[0x50004ffb,[1e30,-1e-30]],
    [0x50006ff1,[-Math.PI,1.0000000596046448]],
    [0x50008011,[-0,1.000000059604645]],
    [0x5000aff7,[0.10000000000000002,-0.33333333333333337]],
    [0x5000e013,[NaN,Infinity]],[0x50010ff9,[-Infinity,-0]]];
  for(const scalar of [false,true])for(const inside of [false,true])for(const [stack,a] of cases) {
    e.attributes();e.mode(inside?4:-1);
    const p=scalar?stack+4:0x5000cfff;
    doubles(h,p,a);v.setUint32(272,stack,true);v.setUint32(256,0xdeadbeef,true);
    for(const offset of [4,8,12,20,24,28])v.setUint32(256+offset,0xaabb0000+offset,true);
    for(let i=0;i<4;i++)v.setUint8(t(stack+i),[0xbe,0xba,0xfe,0xca][i]);
    if(!scalar)for(let i=0;i<4;i++)v.setUint8(t(stack+4+i),(p>>>(i*8))&255);
    const bytes=Array.from({length:28},(_,i)=>v.getUint8(t(stack+i)));
    const n=e.count();scalar?e.scalar():e.invoke(p);
    assert.strictEqual(e.available(scalar?scalarId:id),1);
    assert.strictEqual(e.count(),n,'setter emits no vertex');
    assert.strictEqual(v.getUint32(272,true),stack+(scalar?20:8),'stdcall cleanup');
    assert.strictEqual(v.getUint32(256,true),0);
    for(const offset of [4,8,12,20,24,28])assert.strictEqual(v.getUint32(256+offset,true),0xaabb0000+offset,'other GPRs preserved');
    assert.deepStrictEqual(Array.from({length:28},(_,i)=>v.getUint8(t(stack+i))),bytes,'stack bytes preserved');
    const out=attributes();
    assert.deepStrictEqual(out.slice(7,9),a.map(Math.fround),'ordered doubles, one f32 demotion');
    assert.deepStrictEqual(out.slice(3,7),[.25,.5,.75,.125]);
    assert.strictEqual(out[9],-.5);assert.strictEqual(out[13],-.625);
    assert.deepStrictEqual(out.slice(15),[0,1,-2,3],'r/q reset, unit one preserved');
  }
  // Both forms snapshot values at definition time; list compilation defers
  // current state, and COMPILE_AND_EXECUTE both captures and applies it.
  e.mode(-1);e.context();const list=call(124,[1]);assert(list>0);
  for(const scalar of [false,true])for(const mode of [0x1300,0x1301]) {
    e.mode(-1);call(28,[.125,.25].map(f));const stack=0x402800,p=scalar?stack+4:0x5000cfff;
    const a=[-2.75,Math.PI];doubles(h,p,a);v.setUint32(272,stack,true);
    call(125,[list,mode]);scalar?e.scalar():e.invoke(p);call(126);
    assert.deepStrictEqual(attributes().slice(7,9),mode===0x1300?[.125,.25]:a.map(Math.fround));
    doubles(h,p,[9,8]);e.mode(-1);call(28,[1,1].map(f));call(127,[list]);
    assert.deepStrictEqual(attributes().slice(7,9),a.map(Math.fround),'list captures values');
  }
  assert(h.frees()>0,'temporary canonical stack freed');
}
const h=boot();if(process.env.TRACE_GL_TEST)console.error('acceptance');acceptance(h);
for(const m of ['cleanup','source','stride','opcode','route']) {
  if(process.env.TRACE_GL_TEST)console.error('mutation',m);
  assert.throws(()=>acceptance(boot(m)),e=>e instanceof assert.AssertionError||e instanceof WebAssembly.RuntimeError,m+' rejected');
}
for(const scalar of [false,true])for(const args of [['',true],['',false,0x50000],['',false,0x50001]]) {
  const b=boot(...args);b.e.attributes();b.v.setUint32(272,scalar?0x50000ff8:0x402800,true);
  const esp=b.v.getUint32(272,true);
  assert.throws(()=>scalar?b.e.scalar():b.e.invoke(0x50000ffc),WebAssembly.RuntimeError);
  assert.strictEqual(b.v.getUint32(272,true),esp,'failure preserves ESP');
  b.e.current();assert.deepStrictEqual(Array.from(new Float32Array(b.e.memory.buffer,1024,3)),[.375,7,9],'failure preserves current state');
}
for(const esp of [0xffffffec,0xfffffffc,0xffffffff]) {
  h.v.setUint32(272,esp,true);assert.throws(()=>h.e.scalar(),WebAssembly.RuntimeError);
  assert.strictEqual(h.v.getUint32(272,true),esp,'wrapping scalar stack rejected');
}
for(const p of [0xfffffff1,0xffffffff])assert.throws(()=>h.e.invoke(p),WebAssembly.RuntimeError,'vector wrap rejected');
for(const name of ['glNormal3b','glGetBooleanv']) {
  const row=api.find(a=>a.name===name);assert.strictEqual(row.handler,'gl_unimplemented');
  assert.strictEqual(h.e.available(row.id),0);assert.throws(()=>h.e.other(row.id),WebAssembly.RuntimeError);
}
assert.strictEqual(api[scalarId].nargs,4);assert.strictEqual(api[scalarId].convention,'stdcall');
const compat=require('../lib/gl-compat'),stream=require('../lib/gl-command-stream');
assert.strictEqual(compat.CALL_INDEX.glTexCoord2f,28);assert.strictEqual(stream.ARG_WORDS[28],2);
assert.strictEqual(compat.CALLS.length,146);
assert.strictEqual(compat.CALL_INDEX.glAccum,143);assert.strictEqual(compat.CALL_INDEX.glClearAccum,144);
console.log(JSON.stringify({PASS:true,cases:36,scalarAndVector:true,nonAffineStack:true,displayLists:true,
  mutations:['cleanup','source','stride','opcode','route'],failureStatePreserved:true,
  moduleSHA:h.moduleSHA,sourceSHA:files.map((p,i)=>[p,hash(sources[i])])}));
