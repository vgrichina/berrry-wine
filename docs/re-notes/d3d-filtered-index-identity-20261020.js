// Focused compiled production span/sampler regression. Run from repository root.
// Metadata adapters replace the surface side tables; unrelated disabled paths trap.
// Mixed footprints are differential characterization, NOT native conformance.
'use strict';
const fs = require('fs');
const cp = require('child_process');
const assert = require('assert/strict');
const crypto = require('crypto');
const {compile} = require('../../tools/watx');
const path = require('path');
const evidenceDir = process.argv[2];
const base = '63d22caf879ca77d891d284f7926416a210136c2';
const corePath = 'src/09ab-handlers-d3dim-core.wat';
const glPath = 'src/09a8g-gl-raster.wat';
const core = fs.readFileSync(corePath, 'utf8');
const gl = fs.readFileSync(glPath, 'utf8');
const baseline = cp.execFileSync('git', ['show', `${base}:${corePath}`], {encoding:'utf8'});
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function expr(s, p) {
  assert(p >= 0);
  let d = 0;
  for (let i=p; i<s.length; ++i) {
    if (s[i] === '(') ++d;
    if (s[i] === ')' && --d === 0) return s.slice(p,i+1);
  }
  throw Error('unterminated expression');
}
function functions(s) {
  s = s.replace(/;;[^\n]*/g, '');
  return new Map([...s.matchAll(/\(func (\$[\w]+)/g)].map(m => [m[1],expr(s,m.index)]));
}
const retained = new Set([
  '$viewport_draw_textured_span', '$gl_sw_sample_prepared',
  '$d3dim_texture_sample_prepared', '$d3dim_texture_sample_keyed',
  '$d3dim_texture_fetch_keyed', '$d3dim_texture_fetch_prepared',
  '$d3dim_point_index', '$d3dim_filter_has_key_index', '$d3dim_address_texel',
  '$d3dim_bilerp', '$d3dim_decode_surface_pixel', '$d3dim_decode_surface_pixel_fmt',
  '$d3dim_expand5', '$d3dim_expand6', '$d3dim_color_lerp',
  '$d3dim_texture_stage_combine', '$d3dim_modulate_rgb', '$d3dim_div255',
  '$d3dim_alpha_pass', '$d3dim_depth_compare_f32', '$d3dim_depth_compare_u',
]);
const adapters = new Map([
  ['$dx_surf_fmt_get', '(func $dx_surf_fmt_get (param $e i32) (result i32) (i32.load offset=32 (local.get $e)))'],
  ['$dx_surf_pal_get', '(func $dx_surf_pal_get (param $e i32) (result i32) (i32.load offset=36 (local.get $e)))'],
  ['$dx_surf_pal_alpha', '(func $dx_surf_pal_alpha (param $e i32) (result i32) (i32.load offset=40 (local.get $e)))'],
  ['$g2w', '(func $g2w (param $p i32) (result i32) (local.get $p))'],
  ['$gl_color_merge', '(func $gl_color_merge (param i32 i32 i32) (result i32) (unreachable))'],
  ['$gl_stencil_test', '(func $gl_stencil_test (param i32 i32) (result i32) (unreachable))'],
  ['$gl_stencil_address', '(func $gl_stencil_address (param i32 i32) (result i32) (unreachable))'],
  ['$gl_stencil_apply', '(func $gl_stencil_apply (param i32 i32) (unreachable))'],
]);
function build(source, label, forceGeneral=false) {
  const defs = functions(source+'\n'+gl);
  if (forceGeneral) defs.set('$viewport_draw_textured_span',
    defs.get('$viewport_draw_textured_span')
      .replace('(if (local.get $fast16)', '(if (i32.const 0)'));
  const used = new Map();
  function visit(n) {
    if (used.has(n)) return;
    if (adapters.has(n)) {used.set(n,adapters.get(n)); return;}
    const f = defs.get(n);
    assert(f, `missing ${n}`);
    if (!retained.has(n)) {
      const sig = f.match(/^\(func \$\w+(?:\s*\((?:param|result)[^)]*\))*/)[0];
      used.set(n, sig+(n === '$d3dim_exec_extent_draw' ? ')' : ' (unreachable))'));
      return;
    }
    used.set(n,f);
    for (const m of f.matchAll(/\(call (\$\w+)/g)) visit(m[1]);
  }
  visit('$viewport_draw_textured_span');
  visit('$d3dim_texture_sample_prepared');
  const body = [...used.values()].join('\n');
  const globals = [...new Set([...body.matchAll(/\(global.get (\$\w+)/g)].map(m=>m[1]))];
  const wat = `(memory 1) (export "memory" (memory 0))
    ${globals.map(n=>`(global ${n} ${/\$rast_t0_q[abc]$/.test(n)?'f32':'i32'}
      (${/\$rast_t0_q[abc]$/.test(n)?'f32':'i32'}.const ${n==='$rast_color_mask'?-1:0}))`).join('\n')}
    ${body}
    (export "span" (func $viewport_draw_textured_span))
    ${used.has('$d3dim_filter_has_key_index')?'(export "membership" (func $d3dim_filter_has_key_index))':''}
    (export "sample" (func $d3dim_texture_sample_prepared))`;
  const r = compile(wat, new Map(), {mode:'production'});
  assert(r.success, `${label}: ${r.error}`);
  if(evidenceDir) {
    fs.writeFileSync(path.join(evidenceDir,label+'.wat'),wat);
    fs.writeFileSync(path.join(evidenceDir,label+'.wasm'),r.wasmBinary);
  }
  const e = new WebAssembly.Instance(new WebAssembly.Module(r.wasmBinary)).exports;
  return {e, identity:{label, watSHA256:sha(wat), wasmSHA256:sha(r.wasmBinary),
    wasmBytes:r.wasmBinary.length, retained:[...used.keys()].filter(n=>retained.has(n)),
    adapters:[...used.keys()].filter(n=>!retained.has(n))}};
}
const fixed=build(core,'fixed'), old=build(baseline,'baseline');
const general=build(core,'forced-general',true);
const sentinel=0x12345678;
function run(module, c) {
  const {e}=module, v=new DataView(e.memory.buffer), bytes=new Uint8Array(e.memory.buffer);
  bytes.fill(0);
  const rt=64, tex=128, dib=1024, pal=2048, dest=4096, depth=8192;
  const bpp=c.bpp||8, fmt=c.fmt||1, w=c.w||2, h=c.h||2;
  const pitch=w*(bpp/8)+4;
  const set=(p,x)=>v.setUint32(p,x>>>0,true);
  for(const [entry,bits,p,data] of [[rt,32,4,dest],[tex,bpp,pitch,dib]]) {
    set(entry+12,(entry===rt?1:w)|((entry===rt?1:h)<<16));
    set(entry+16,bits|(p<<16)); set(entry+20,data); set(entry+32,fmt);
  }
  set(tex+24,c.key??0); set(tex+28,c.surfaceKey===false?0:0x100);
  set(tex+36,pal); set(tex+40,c.palAlpha||0);
  const colors=c.colors||[0,0,0x00ff00,0xff0000];
  colors.forEach((rgb,i)=>set(pal+i*4,0xff000000|((rgb&255)<<16)|(rgb&0xff00)|(rgb>>>16)));
  const taps=c.taps||[1,1,1,1];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const at=dib+y*pitch+x*(bpp/8), n=taps[(y*w+x)%taps.length];
    if(bpp===8) bytes[at]=n; else v.setUint16(at,n,true);
  }
  set(dest,sentinel); v.setFloat32(depth,1,true);
  const u=c.u??0.5,vv=c.v??0.5, linear=c.linear??1, au=c.au||1,av=c.av||1;
  const sample=e.sample(w,h,bpp,pitch,dib,fmt,pal,c.palAlpha||0,u,vv,au,av,linear)>>>0;
  e.span(rt,tex,0,1,1,au,av,linear,2,2,c.enable??1,0,0,0,0,
    0,u,vv,1,-1,.25,0,u,vv,1,-1,.25,depth,8,1);
  return {pixel:v.getUint32(dest,true),depth:v.getFloat32(depth,true),sample};
}
const observations=[];
function check(c,expected) {
  const a=run(fixed,c), b=run(old,c);
  if(expected!==null) {
    assert.equal(a.pixel,expected==='draw'?a.sample:sentinel,c.name+' pixel');
    assert.equal(a.depth,expected==='draw'?.25:1,c.name+' depth');
  } else assert.deepEqual(a,b,c.name+' preservation');
  observations.push({case:c,expected:expected??'baseline characterization only',fixed:a,baseline:b});
  return {a,b};
}
const bug=check({name:'duplicate black nonkey indices',taps:[1,1,1,1]},'draw');
assert.equal(bug.b.pixel,sentinel,'baseline must expose original defect');
assert.equal(bug.b.depth,1);
for (const linear of [0,1]) {
  for (const taps of [[0,0,0,0],[2,2,2,2],[1,2,3,1]]) {
    check({name:`point/filter ${linear} ${taps}`,linear,taps},taps[0]===0?'reject':'draw');
  }
  check({name:`duplicate nonkey ${linear}`,linear},'draw');
}
for(const enable of [0,2]) for(const taps of [[0,0,0,0],[1,1,1,1]]) {
  const c={name:`bypass ${enable} ${taps}`,enable,taps};
  const a=run(fixed,c),b=run(old,c);
  assert.deepEqual(a,b,c.name); assert.notEqual(a.pixel,sentinel);
  assert.equal(a.depth,.25); observations.push({case:c,fixed:a,baseline:b});
}
check({name:'no surface key',surfaceKey:false},'draw');
check({name:'nonzero key duplicate RGB',key:1,colors:[0,1,1,0xff0000],taps:[2,2,2,2]},'draw');
check({name:'different nonkey RGB filter to key value',key:1,colors:[0,1,0,2],taps:[2,3,2,3]},'draw');
// The old key decoder treats raw P8 key as RGB. Preserve this separate existing
// all-key/nonblack defect in this narrowly scoped all-nonkey repair.
check({name:'known separate all-key red decoder defect',colors:[0xff0000,0xff0000],taps:[0,0,0,0]},null);
check({name:'alpha palette exclusion unchanged',palAlpha:1},null);
for(let mask=0;mask<16;mask++) {
  const taps=Array.from({length:4},(_,i)=>(mask>>i)&1?0:1);
  for(const u of [.25,.5,.75]) {
    const c={name:`all native masks ${mask}/${u}`,taps,u,v:.25};
    check(c,mask===0?'draw':null);
    // At u=.25/.5, v=.25 this fetches all four taps even when weights vanish.
    if(u!==.75) assert.equal(fixed.e.membership(2,2,6,1024,u,.25,1,1,0),+(mask!==0));
  }
}
for(const taps of [[0,1,1,1],[0,2,2,2],[0,0,2,2],[0,0,0,2],[1,0,0,0]]) {
  for(const u of [.25,.251,.5,.75]) check({name:`mixed/zero weight ${taps}/${u}`,taps,u,v:.25},null);
}
for(const au of [1,2,3]) for(const uv of [-.5,0,.25,.5,1.5,NaN,Infinity]) {
  check({name:`address ${au}/${uv}`,au,av:au,u:uv,v:uv,taps:[1,1,1,1]},'draw');
}
for(const fmt of [1,2,3]) for(const taps of [[0,0,0,0],[0xffff,0xffff,0xffff,0xffff],[0,0xffff,0xffff,0]]) {
  for(const enable of [0,1,2]) {
    const c={name:`16bit fmt${fmt}/enable${enable}/${taps}`,bpp:16,fmt,taps,enable};
    const a=run(fixed,c),b=run(old,c),g=run(general,c);
    assert.deepEqual(a,b,c.name+' unchanged'); assert.deepEqual(a,g,c.name+' fast/general');
    observations.push({case:c,fixed:a,baseline:b,general:g});
  }
}
// Mutation control: omit the new membership guard without reverting point routing.
const marker=core.indexOf(';; Preserve the existing mixed/zero-weight policy');
assert(marker>0);
const start=core.indexOf('(if ',marker), guard=expr(core,start);
const mutant=build(core.slice(0,start)+core.slice(start+guard.length),'guard-removed');
assert.equal(run(mutant,{taps:[1,1,1,1]}).pixel,sentinel);
const compilerPaths=['tools/watx.js',...['compiler.js','compiler-parser.js','compiler-stages.js','compiler-codegen.js'].map(p=>'tools/watx-src/'+p)];
console.log(JSON.stringify({base,node:process.version,sources:{[corePath]:sha(core),[glPath]:sha(gl)},
  baselineCoreSHA256:sha(baseline),compilerSources:Object.fromEntries(compilerPaths.map(p=>[p,sha(fs.readFileSync(p))])),
  compiled:[fixed,old,general,mutant].map(m=>m.identity),
  checks:observations.length,negativeControls:'baseline and guard-removed both reject nonkey black; fixed draws and writes depth',
  observations},null,2));
