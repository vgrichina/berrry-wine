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
const base = '3613e8afe93525fbf37cbeb2ebd4eae261a82c12';
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
  '$gl_sw_border_sample', '$gl_sw_border_tap', '$gl_sw_address_enum',
  '$d3dim_filter_key_mask',
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
    ${used.has('$d3dim_filter_key_mask')?'(export "keyMask" (func $d3dim_filter_key_mask))':''}
    (export "sample" (func $d3dim_texture_sample_prepared))`;
  const r = compile(wat, new Map(), {mode:'production'});
  assert(r.success, `${label}: ${r.error}`);
  if(evidenceDir) {
    fs.writeFileSync(path.join(evidenceDir,label+'.wat'),wat);
    fs.writeFileSync(path.join(evidenceDir,label+'.wasm'),r.wasmBinary);
  }
  const e = new WebAssembly.Instance(new WebAssembly.Module(r.wasmBinary)).exports;
  return {e, wat, identity:{label, watSHA256:sha(wat), wasmSHA256:sha(r.wasmBinary),
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
  colors.forEach((rgb,i)=>set(pal+i*4,((c.paletteAlpha??255)<<24)|((rgb&255)<<16)|(rgb&0xff00)|(rgb>>>16)));
  const taps=c.taps||[1,1,1,1];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const at=dib+y*pitch+x*(bpp/8), n=taps[(y*w+x)%taps.length];
    if(bpp===8) bytes[at]=n; else v.setUint16(at,n,true);
  }
  set(dest,sentinel); v.setFloat32(depth,1,true);
  const u=c.u??0.5,vv=c.v??0.5, linear=c.linear??1, au=c.au??1,av=c.av??1;
  const sample=e.sample(w,h,bpp,pitch,dib,fmt,pal,c.palAlpha||0,u,vv,au,av,linear)>>>0;
  e.span(rt,tex,0,1,1,au,av,linear,2,2,c.enable??1,c.alphaTest??0,0,0,0,
    0,u,vv,1,-1,.25,0,u,vv,1,-1,.25,depth,8,1);
  return {pixel:v.getUint32(dest,true),depth:v.getFloat32(depth,true),sample};
}
const observations=[];
const cases=[];
function check(c,expected) {
  cases.push(c);
  const a=run(fixed,c), b=run(old,c);
  if(expected!==null) {
    assert.equal(a.pixel,expected==='draw'?a.sample:sentinel,c.name+' pixel');
    assert.equal(a.depth,expected==='draw'?.25:1,c.name+' depth');
  } else assert.deepEqual(a,b,c.name+' preservation');
  const compact={...c};
  if(c.colors?.length>16) compact.colors=Object.fromEntries(
    [...new Set([c.key??0,...(c.taps||[1])])].map(i=>[i,c.colors[i]]));
  observations.push({case:compact,expected:expected??'baseline characterization only',fixed:a,baseline:b});
  return {a,b};
}
const bug=check({name:'duplicate black nonkey indices',taps:[1,1,1,1]},'draw');
assert.deepEqual(bug.a,bug.b,'reviewed nonkey identity fix preserved');
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
const repro={name:'all-key red decoder defect',colors:[0xff0000,0xff0000],taps:[0,0,0,0]};
const repaired=check(repro,'reject');
assert.equal(repaired.b.pixel,0xffff0000);
assert.equal(repaired.b.depth,.25);
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
// Remove only the all-key rejection, retaining the mask helper/nonkey repair.
const allStart=core.indexOf('(if ',core.indexOf(';; All four fetched opaque P8 indices keyed:'));
assert(allStart>0);
const allGuard=expr(core,allStart);
const removed=build(core.slice(0,allStart)+core.slice(allStart+allGuard.length),'allkey-removed');
assert.deepEqual(run(removed,repro),repaired.b);
// Every nonblack key color, duplicate color and nonzero native index.
for(const key of [0,1,7,255]) for(const rgb of [0xff0000,0x12ab34,0x0000ff]) {
  const colors=Array(256).fill(rgb), other=(key+1)&255;
  for(const linear of [0,1]) {
    const all={name:`uniform key${key}/rgb${rgb}/linear${linear}`,key,colors,linear,taps:[key,key,key,key]};
    const r=check(all,'reject');
    if(linear) {
      assert.equal(r.b.pixel,rgb===key?sentinel:r.b.sample);
      assert.equal(r.b.depth,rgb===key?1:.25);
      assert.deepEqual(run(removed,all),r.b);
    } else assert.deepEqual(r.a,r.b);
    check({...all,name:all.name+' duplicate nonkey',taps:[other,other,other,other]},'draw');
  }
  // All 14 fetched mixed masks, including only-zero-weight nonkey/key taps.
  for(let mask=1;mask<15;mask++) for(const u of [.25,.251,.5]) for(const v of [.25,.5]) {
    const taps=Array.from({length:4},(_,i)=>(mask>>i)&1?key:other);
    check({name:`mixed key${key}/rgb${rgb}/mask${mask}/${u}/${v}`,key,colors,taps,u,v},null);
  }
}
for(const au of [0,1,2,3]) for(const av of [0,1,2,3])
  for(const uv of [-1.5,-.5,0,.25,.5,1,1.5,NaN,Infinity,-Infinity]) {
    check({...repro,name:`allkey address ${au}/${av}/${uv}`,au,av,u:uv,v:uv},'reject');
  }
for(const enable of [0,2]) for(const taps of [[0,0,0,0],[0,1,1,1],[1,1,1,1]])
  check({...repro,name:`red bypass ${enable}/${taps}`,enable,taps},null);
for(let mask=1;mask<15;mask++) for(const u of [.25,.251,.5]) for(const v of [.25,.5]) {
  const taps=Array.from({length:4},(_,i)=>(mask>>i)&1?7:(i+1));
  check({name:`distinct mixed ${mask}/${u}/${v}`,key:7,
    colors:[0,0x001100,0xff0000,0x0000ff,0xabcdef,0,0,0x12ab34],taps,u,v},null);
}
check({...repro,name:'red no effective key',surfaceKey:false},'draw');
for(const paletteAlpha of [0,1,64,127,255]) for(const taps of [[0,0,0,0],[0,1,1,1],[1,1,1,1]])
  check({...repro,name:`alpha palette ${paletteAlpha}/${taps}`,palAlpha:1,paletteAlpha,taps},null);
for(const e of [fixed,old,removed]) {
  assert.throws(()=>run(e,{...repro,enable:2,palAlpha:1}),WebAssembly.RuntimeError);
  const a=run(e,{...repro,taps:[1,1,1,1],alphaTest:1});
  assert.equal(a.pixel,sentinel); assert.equal(a.depth,1);
}
// Real GL border sampler executes, but this task's identity guard is excluded.
for(const au of [1,0x2900]) for(const av of [1,0x2900]) {
  if(au!==0x2900 && av!==0x2900) continue;
  for(const linear of [0,1]) for(const uv of [-.5,0,.25,.5,1,1.5])
    for(const taps of [[0,0,0,0],[0,1,1,1],[1,1,1,1]])
      check({...repro,name:`GL border ${au}/${av}/${linear}/${uv}/${taps}`,au,av,linear,u:uv,v:uv,taps},null);
}
// Removing only the added rejection must recover the reviewed source's
// framebuffer/depth/sample outputs throughout the entire check() matrix.
for(const c of cases) assert.deepEqual(run(removed,c),run(old,c),c.name+' removed-fix equivalence');
const beforeFunctions=functions(baseline), afterFunctions=functions(core);
for(const [name,body] of beforeFunctions)
  if(!['$viewport_draw_textured_span','$d3dim_filter_has_key_index'].includes(name))
    assert.equal(afterFunctions.get(name),body,name+' unchanged production function');

// Trace the actual sampler's four fetch addresses. This independent boundary
// observation catches footprint/addressing mistakes in the key-mask helper.
const fetchStart=fixed.wat.indexOf('(func $d3dim_texture_fetch_keyed\n');
assert(fetchStart>=0);
const fetch=expr(fixed.wat,fetchStart);
const signature=fetch.slice(0,fetch.indexOf('(local $c'));
const logged=signature+`
 (i32.store (global.get $trace)
   (i32.add (local.get $dib) (i32.add
     (i32.mul (local.get $y) (local.get $pitch)) (local.get $x))))
 (global.set $trace (i32.add (global.get $trace) (i32.const 4)))
 (i32.const 0))`;
const traceWAT='(global $trace (mut i32) (i32.const 0))\n'+
  fixed.wat.replace(fetch,logged)+'\n(func (export "reset") (global.set $trace (i32.const 0)))';
const trace=compile(traceWAT,new Map(),{mode:'production'});
assert(trace.success,trace.error);
if(evidenceDir) {
  fs.writeFileSync(path.join(evidenceDir,'footprint.wat'),traceWAT);
  fs.writeFileSync(path.join(evidenceDir,'footprint.wasm'),trace.wasmBinary);
}
const te=new WebAssembly.Instance(new WebAssembly.Module(trace.wasmBinary)).exports;
const tb=new Uint8Array(te.memory.buffer), tv=new DataView(te.memory.buffer);
const coords=[-Infinity,-3.4028234663852886e38,-1.5,-.5,-0,0,
  1/6-2**-26,1/6,1/6+2**-26,.25,.5,.75,1,1.5,
  2147483648,3.4028234663852886e38,Infinity,NaN];
let footprints=0, maskChecks=0;
for(const [w,h] of [[3,5],[4,2],[1,1]]) {
  const pitch=w+7,dib=1024;
  for(const au of [0,1,2,3]) for(const av of [0,1,2,3])
    for(const u of coords) for(const v of coords) {
      te.reset(); te.sample(w,h,8,pitch,dib,1,0,0,u,v,au,av,1);
      const actual=Array.from({length:4},(_,i)=>tv.getUint32(i*4,true));
      for(const at of actual) assert(at>=dib && at<dib+h*pitch && (at-dib)%pitch<w);
      // Single key AND single nonkey placements distinguish any versus all;
      // repeated addresses at clamp edges and 1x1 textures remain meaningful.
      for(const key of [0,7,255]) for(const inverse of [false,true])
        for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
          const other=(key+1)&255;
          tb.fill(inverse?key:other,dib,dib+h*pitch);
          tb[dib+y*pitch+x]=inverse?other:key;
          const mask=actual.reduce((m,at,i)=>m|((tb[at]===key?1:0)<<i),0);
          assert.equal(te.keyMask(w,h,pitch,dib,u,v,au,av,key),mask);
          assert.equal(te.membership(w,h,pitch,dib,u,v,au,av,key),+(mask!==0));
          maskChecks++;
        }
      footprints++;
    }
}
const compilerPaths=['tools/watx.js',...['compiler.js','compiler-parser.js','compiler-stages.js','compiler-codegen.js'].map(p=>'tools/watx-src/'+p)];
console.log(JSON.stringify({base,node:process.version,sources:{[corePath]:sha(core),[glPath]:sha(gl)},
  baselineCoreSHA256:sha(baseline),compilerSources:Object.fromEntries(compilerPaths.map(p=>[p,sha(fs.readFileSync(p))])),
  compiled:[fixed,old,general,mutant,removed].map(m=>m.identity),
  footprintMatrix:{footprints,maskChecks,traceWAT:sha(traceWAT),traceWasm:sha(trace.wasmBinary)},
  checks:observations.length,removedFixDifferentialCases:cases.length,
  negativeControls:'reviewed baseline and allkey-removed write red/depth; fixed rejects. Previous nonkey guard-removal still rejects nonkey black.',
  observations},null,2));
