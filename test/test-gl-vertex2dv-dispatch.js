#!/usr/bin/env node
'use strict';
// Bounded production-fragment test: compile the unchanged generated dispatch
// page, native handler, guest scalar loads and packed vertex functions. Heap
// allocation and address translation are explicit fixture seams; unrelated
// dispatch targets trap, so a wrong route cannot silently pass.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compile } = require('../tools/watx');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function form(text, head) {
  const start = text.indexOf(head);
  assert(start >= 0, head);
  let depth = 0, quoted = false, comment = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (!quoted && c === ';' && text[i+1] === ';') { comment = true; continue; }
    if (c === '"' && text[i-1] !== '\\') quoted = !quoted;
    if (quoted) continue;
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) return text.slice(start, i+1);
  }
  throw Error('unterminated '+head);
}
const table = read('src/09b2-dispatch-table.generated.wat');
const handlers = read('src/09a8b-handlers-opengl.wat');
const encoder = read('src/09a8c-gl-encoder.wat');
const registers = read('src/03-registers.wat');
const api = JSON.parse(read('src/api_table.json'));
const id = api.findIndex(a => a.name === 'glVertex2dv');
assert.strictEqual(id, 4448);
const pageName = '$dispatch_api_table_page_'+Math.floor(id/256);
const originals = [form(table, '(func '+pageName+' '),
  form(handlers, '(func $handle_glVertex2dv '),
  ...['gl_wat_init','gl_alloc_affine','gl_append_vertex','gl_append_vertex4']
    .map(n => form(encoder, '(func $'+n+' ')),
  ...['gl64','gl32'].map(n => form(registers, '(func $'+n+' ')),
  form(table, '(func $wgl_api_available '),
  form(table, '(func $dispatch_api_table ')];
// The fragment's small direct window is a fixture placement, mechanically
// replacing only the compiler region query. No production instructions change.
const fragments = originals.map(s => s.replaceAll('(region.end $DIRECT_WINDOW)', '(i32.const 65536)'));
const globals = [...encoder.matchAll(/\(global \$\w+ \(mut (?:i32|i64|f32)\) \((?:i32|i64|f32)\.const [^)]+\)\)/g)].map(m => m[0]);
const defined = new Set(fragments.map(s => s.match(/^\(func (\$\w+)/)[1]));
const traps = new Map();
traps.set('$handle_fallback', 2);
for(const m of fragments.at(-1).matchAll(/\(call (\$dispatch_api_table_page_\d+)/g)) {
  if(m[1]!==pageName) traps.set(m[1],7);
}
for (const m of fragments[0].matchAll(/\(call (\$\w+)((?: \((?:local\.get|i32\.const) [^)]+\))*)\)/g)) {
  if (!defined.has(m[1])) traps.set(m[1], (m[2].match(/\(/g)||[]).length);
}
const stubs = [...traps].map(([n,c]) => `(func ${n} ${Array.from({length:c},()=>'(param i32)').join(' ')} (unreachable))`).join('\n');
function boot(mutate=false, allocationFails=false) {
  const selected = fragments.slice();
  if (mutate) {
    assert(selected[0].includes('(call $handle_glVertex2dv '));
    selected[0] = selected[0].replace('(call $handle_glVertex2dv ', '(call $handle_gl_unimplemented ');
  }
  const src = `
    (import "fixture" "g2w" (func $g2w (param i32) (result i32)))
    (import "fixture" "alloc" (func $heap_alloc (param i32) (result i32)))
    (func $heap_free (param i32))
    (memory 64)
    (export "memory" (memory 0))
    (global $reg_base i32 (i32.const 256))
    (global $image_base i32 (i32.const 4194304))
    (global $GUEST_BASE i32 (i32.const 4096))
    (global $fault_sync_epoch (mut i32) (i32.const 0))
    (defmacro (g2w-fast $ga) (call $g2w $ga))
    ${globals.join('\n')}
    ${stubs}
    ${selected.join('\n')}
    (func (export "invoke") (param $p i32)
      (call $dispatch_api_table (i32.const ${id}) (local.get $p)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "available") (param $id i32) (result i32) (call $wgl_api_available (local.get $id)))
    (func (export "other") (param $id i32)
      (call $dispatch_api_table (local.get $id) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "mode") (param $m i32) (global.set $gl_immediate_mode (local.get $m)))
    (func (export "count") (result i32) (global.get $gl_immediate_floats))
    (func (export "vertices") (result i32) (global.get $gl_immediate_wa))
    (func (export "attributes")
      (global.set $gl_color_r (f32.const 0.25))
      (global.set $gl_color_g (f32.const 0.5))
      (global.set $gl_color_b (f32.const 0.75))
      (global.set $gl_color_a (f32.const 0.125))
      (global.set $gl_normal_x (f32.const -0.5))
      (global.set $gl_tex_s (f32.const 0.375))
      (global.set $gl_tex1_t (f32.const -0.625)))
    (func (export "adjacent3") (param $x f32) (param $y f32) (param $z f32)
      (call $gl_append_vertex (local.get $x) (local.get $y) (local.get $z)))
    (func (export "adjacent4") (param $x f32) (param $y f32) (param $z f32) (param $w f32)
      (call $gl_append_vertex4 (local.get $x) (local.get $y) (local.get $z) (local.get $w)))`;
  const result = compile(src, new Map(), {mode:'production'});
  let next = 0x10000;
  const translate = p => p >= 0x50000000 ?
    0x8000 + (((p-0x50000000)>>>12)*0x2000) + (p&4095) : p-0x400000+4096;
  const e = new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary), {fixture:{
    g2w: translate, alloc: n => {if(allocationFails)return 0;const p=next;next+=n;return p+0x400000-4096;}
  }}).exports;
  return {e, translate, view:new DataView(e.memory.buffer), moduleSHA:hash(result.wasmBinary)};
}
function acceptance(h) {
  const {e,view:v,translate:t}=h;
  assert.strictEqual(e.available(id),1);
  e.attributes();
  e.mode(4);
  const cases = [
    [0x402003, -1.25, 2.75],
    [0x50000ffc, Math.PI, -123.125], // first double crosses non-affine pages
    [0x50001ff8, 1.0000000000000002, -0], // second double on next page
    [0x50003007, 1e30, -1e-30],
  ];
  for(const [p,x,y] of cases) {
    const b=Buffer.alloc(16);b.writeDoubleLE(x);b.writeDoubleLE(y,8);
    for(let i=0;i<16;i++)v.setUint8(t(p+i),b[i]);
    v.setUint32(256,0xdeadbeef,true);v.setUint32(272,0x402800,true);
    v.setUint32(t(0x402800),0xcafebabe,true);v.setUint32(t(0x402804),p,true);
    const before=Buffer.from(new Uint8Array(e.memory.buffer,t(0x402800),16));
    const n=e.count();e.invoke(p);
    assert.strictEqual(e.count(),n+19);
    assert.strictEqual(v.getUint32(272,true),0x402808,'stdcall pops return + one pointer');
    assert.strictEqual(v.getUint32(256,true),0,'bridge EAX convention');
    assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,t(0x402800),16)),before,'guest stack bytes preserved');
    const a=new Float32Array(e.memory.buffer,e.vertices()+n*4,19);
    assert(Object.is(a[0],Math.fround(x)));assert(Object.is(a[1],Math.fround(y)));
    assert.strictEqual(a[2],0);assert.strictEqual(a[14],1);
    assert.deepStrictEqual(Array.from(a.slice(3,7)),[0.25,0.5,0.75,0.125],'current colour');
    assert.strictEqual(a[7],0.375);assert.strictEqual(a[9],-0.5);assert.strictEqual(a[13],-0.625);
    assert.strictEqual(a[16],1);assert.strictEqual(a[18],1);
  }
  const n=e.count();e.mode(-1);e.invoke(cases[0][0]);assert.strictEqual(e.count(),n,'existing outside-Begin behavior');
  e.mode(4);e.adjacent3(2.5,-3.25,4.125);e.adjacent4(5,6,7,2);
  const a=new Float32Array(e.memory.buffer,e.vertices()+n*4,38);
  assert.deepStrictEqual([a[0],a[1],a[2],a[14]],[2.5,-3.25,4.125,1]);
  assert.deepStrictEqual([a[19],a[20],a[21],a[33]],[5,6,7,2]);
}
const h=boot();acceptance(h);
const unsupported=['glTexCoord2dv','glTexCoord2d','glColor3dv','glMultMatrixd','glGetBooleanv','glRectf','glColor4dv'];
for(const name of unsupported) {
  const row=api.find(a=>a.name===name);assert.strictEqual(row.handler,'gl_unimplemented');
  assert.strictEqual(h.e.available(row.id),0,name+' remains unavailable');
  assert.throws(()=>h.e.other(row.id),WebAssembly.RuntimeError,name+' remains fail-fast');
}
const broken=boot(true);assert.throws(()=>acceptance(broken),WebAssembly.RuntimeError,'old unimplemented dispatch must reject');
const failed=boot(false,true);failed.view.setUint32(272,0x402800,true);
assert.throws(()=>failed.e.invoke(0x402000),WebAssembly.RuntimeError,'allocation failure remains fail-fast');
assert.strictEqual(failed.view.getUint32(272,true),0x402800,'failed call does not consume stack');
console.log(JSON.stringify({PASS:true,cases:4,nonAffinePageCrossings:true,stackCleanup:8,mutationRejected:true,allocationFailureTraps:true,adjacentVertexPipeline:true,unsupported,moduleSHA:h.moduleSHA,sourceSHA:originals.map(hash),transformSHA:fragments.map(hash)}));
