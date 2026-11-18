#!/usr/bin/env node
'use strict';
// SDK-derived ABI tests. The host only records GPU stream v2 records
// (test/glide-gps-recorder.js): neither rendering backend participates in the
// expected values. All guest outputs/vertices can be sparse.
const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const regions = require('../lib/region-map.generated');
const { createGpsRecorder, primitives, ringWord, GS } = require('./glide-gps-recorder');
const KICK = GS.CONST, KIND = GS.KIND;
const arities = {
  grGlideInit: 0, glide3_grGlideInit: 0, grGlideShutdown: 0,
  grSstWinOpen: 7, glide3_grSstWinClose: 1, grSelectContext: 1,
  grGet: 3, grGetString: 1, grQueryResolutions: 2,
  grVertexLayout: 3, grCoordinateSpace: 1, grViewport: 4, grDepthRange: 2,
  grDrawVertexArray: 3, grDrawVertexArrayContiguous: 4, grDrawTriangle: 3,
  grFinish: 0, grFlush: 0, grTexSource: 4, grTexDownloadMipMap: 4,
  grTexMaxAddress: 1, grTexCalcMemRequired: 4, grTexTextureMemRequired: 2,
  grChromakeyMode: 1, grColorCombine: 5, grAlphaCombine: 5, grTexCombine: 7, grTexClampMode: 3, grTexFilterMode: 3, grDrawPoint: 1, grDrawLine: 2,
  glide3_grTexDownloadTable: 2, grTexDownloadTable: 3,
  grTexDownloadTablePartial: 4, grLoadGammaTable: 4, guGammaCorrectionRGB: 3,
  grGammaCorrectionValue: 1, glide3_grLfbWriteRegion: 9,
  grLfbLock: 6, grLfbUnlock: 2, grLfbReadRegion: 7, grLfbWriteRegion: 8,
  guFogGenerateExp2: 2, guFogGenerateLinear: 3, guFogTableIndexToW: 1,
  grGlideGetState: 1, grGlideSetState: 1,
  grGlideGetVertexLayout: 1, grGlideSetVertexLayout: 1,
};
const bytes = compileSrcWasm((file, source) => file === '09a8h-glide.wat'
  ? source + Object.keys(arities).map(name =>
    `\n(export "test_${name}" (func $handle_${name}))`).join('') + '\n(export "test_fpu_get" (func $fpu_get))\n(export "test_glide3_vertex" (func $glide3_vertex))' : source);
const module_ = new WebAssembly.Module(bytes);
const memory = new WebAssembly.Memory({initial: 8192, maximum: 8192, shared: true});
const imports = {host: {memory}};
for (const imp of WebAssembly.Module.imports(module_))
  if (imp.kind === 'function') (imports[imp.module] ||= {})[imp.name] = () => 0;
imports.host.math_pow2 = x => 2 ** x;
imports.host.math_pow = Math.pow;
const rec = createGpsRecorder(memory);
imports.host.gpu_stream_kick = rec.kick;
const a = new WebAssembly.Instance(module_, imports).exports;
const b = new WebAssembly.Instance(module_, imports).exports;
a.init_thread(0, 0x400000, 0, 0, 0, 0, 0);
b.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
a.heap_init(0x420000);
const view = new DataView(memory.buffer);
const stack = regions.BASE.GUEST_STACK + 0x1000;
const stackGuest = stack - regions.BASE.GUEST_BASE + 0x400000;
const wa = p => a.guest_to_wasm(p) >>> 0;
const put = (p, data) => { for (let i = 0; i < data.length; ++i) a.guest_write8(p + i, data[i]); };
const get = (p, n) => Buffer.from(Array.from({length:n}, (_,i) => a.guest_read8(p+i)));
const words = values => { const p = Buffer.alloc(values.length*4); values.forEach((v,i) => p.writeUInt32LE(v>>>0,i*4)); return p; };
const fbits = v => { const p = Buffer.alloc(4); p.writeFloatLE(v); return p.readUInt32LE(); };
function call(name, args = [], instance = a) {
  instance.set_esp(stackGuest);
  args.forEach((v,i) => view.setUint32(stack+4+i*4,v>>>0,true));
  instance['test_'+name](...Array.from({length:5},(_,i) => args[i] || 0),0);
  assert.strictEqual(instance.get_esp()>>>0, stackGuest+4+4*arities[name], name+' stdcall cleanup');
  return instance.get_eax()>>>0;
}
// The 64-byte GPS vertex (16 floats) is the canonical 60-byte SDK GrVertex
// (x y z r g b ooz a oow sow0 tow0 oow0 sow1 tow1 oow1, offsets 0..56)
// converted with the current Glide state: colour / 255, ST / texture size,
// ooz -> clamp((ooz + bias) / 65535) depth (only when depth is consumed),
// q0 = oow0 under the GR_STWHINT_W_DIFF_TMU0 hint else oow, q1 = oow1. The
// canonical clip-space z (offset 8) is not carried. Glide 3 draws are dual.
const S = regions.BASE.GLIDE_STATE + 256;
const sw = o => view.getUint32(S + o, true);
const ext = () => wa(view.getUint32(regions.BASE.GLIDE_STATE + 116, true));
const dimW = (lod, aspect) => { let n = 256 >> lod; if (aspect > 3) n >>= aspect - 3; return n || 1; };
const dimH = (lod, aspect) => { let n = 256 >> lod; if (aspect < 3) n >>= 3 - aspect; return n || 1; };
function vertexContext() {
  const a0 = sw(140), a1 = view.getUint32(ext() + 2368 + 12, true);
  return {
    s0: dimW(0, a0), t0: dimH(0, a0), s1: dimW(0, a1), t1: dimH(0, a1),
    hintQ0: (sw(216) & 2) !== 0,
    needsZ: sw(44) !== 2 || (sw(88) & 255) === 3 || sw(8) === 2 || sw(28) === 2,
    bias: (sw(176) << 16) >> 16,
  };
}
// GPS vertex -> canonical offsets (bytes) it still carries.
function canonical(g, c) {
  const out = new Map([[0, g[0] + 0.5], [4, g[1] + 0.5], [12, g[4] * 255], [16, g[5] * 255], [20, g[6] * 255], [28, g[7] * 255],
    [32, g[10]], [36, g[8] * c.s0], [40, g[9] * c.t0], [44, g[11]], [48, g[12] * c.s1], [52, g[13] * c.t1], [56, g[15]]]);
  if (c.needsZ) out.set(24, g[2] * 65535 - c.bias);
  return out;
}
// Canonical -> exact GPS vertex (f32 arithmetic as the WAT does it).
function toGps(v, c) {
  const f = Math.fround, d = (x, n) => f(f(x) / n);
  const z = c.needsZ ? f(Math.min(1, Math.max(0, (f(v[6]) + c.bias) / 65535))) : 0;
  // Integer pixel centres: x and y move by -0.5; POSITIONT w is oow.
  return [f(f(v[0]) - 0.5), f(f(v[1]) - 0.5), z, f(v[8]), d(v[3], 255), d(v[4], 255), d(v[5], 255), d(v[7], 255),
    d(v[9], c.s0), d(v[10], c.t0), f(v[8]), f(c.hintQ0 ? v[11] : v[8]), d(v[12], c.s1), d(v[13], c.t1), 0, f(v[14])];
}
// grFlush, then every primitive executed since the last call. Each carries
// its GPS vertices (`gps`) and their canonical view (`v[i].get(offset)`).
let streamMark = null;
function stream() {
  call('grFlush');
  const out = rec.recordsSince(streamMark || { records: 0 }); streamMark = rec.mark(); return out;
}
function records() {
  const c = vertexContext();
  return primitives(stream()).map(p => ({ ...p, gps: p.verts, v: p.verts.map(g => canonical(g, c)) }));
}
// The texture a textured draw samples from TMU `slot` (BIND state) with
// its decoded RGBA levels.
const bound = (p, slot) => {
  const e = p.state.bind.find(x => x.slot === slot);
  return e && Object.assign({ sampler: e.samplerFields }, rec.textures.get(e.texture));
};
const ring = name => ringWord(memory, rec.ringAddr, name);
const sparse=0x38000000, neighbor=sparse+0x10000;
for (const p of [sparse,neighbor,sparse+4096]) a.test_virtual_map_commit(p,4096);
assert.notStrictEqual(wa(sparse+4096),wa(sparse)+4096,'physically noncontiguous fixture');
put(neighbor,Buffer.alloc(4096,0xa7));
// Enabling diagnostics before initialization neither locks nor allocates.
a.glide_lfb_metrics_enable(1);
assert.strictEqual(view.getUint32(regions.BASE.GLIDE_STATE+116,true),0);
assert.strictEqual(a.glide_lfb_metrics_get(0,0),0);
a.glide_lfb_metrics_enable(0);
call('grGlideInit'); assert.strictEqual(a.glide_api_version(),2);
call('glide3_grGlideInit'); assert.strictEqual(b.glide_api_version(),3,'mode is process-shared');
const output=sparse+4094;
put(output-4,Buffer.alloc(24,0xcc));
assert.strictEqual(call('grGet',[2,16,output]),16);
assert.deepStrictEqual(get(output,16),words([5,6,5,0]));
assert.deepStrictEqual(get(output-4,4),Buffer.alloc(4,0xcc));
assert.deepStrictEqual(get(output+16,4),Buffer.alloc(4,0xcc));
for (const [key,n,expected] of [[15,4,[1]],[19,4,[2]],[10,4,[256]],[13,4,[4194304]],
  [39,8,[0,65535]],[40,8,[65535,0]],[9,4,[0]]]) {
  assert.strictEqual(call('grGet',[key,n,output]),n);
  assert.deepStrictEqual(get(output,n),words(expected));
}
put(output,Buffer.alloc(16,0xab));
assert.strictEqual(call('grGet',[2,4,output]),0,'wrong length');
assert.strictEqual(call('grGet',[0x1234,16,output]),0,'unknown query');
assert.deepStrictEqual(get(output,16),Buffer.alloc(16,0xab),'failed query does not write');
const string = p => { let s=''; for(let i=0;i<256;++i) { const c=a.guest_read8(p+i); if(!c)return s; s+=String.fromCharCode(c); } throw Error('unterminated'); };
assert.strictEqual(string(call('grGetString',[0xa0])), '', 'no unsupported extensions advertised');
assert.match(string(call('grGetString',[0xa4])),/^3\./);
assert.strictEqual(call('grGetString',[0xffff]),0);
assert.strictEqual(call('grSelectContext',[1]),0,'no open context');
assert.strictEqual(call('grSstWinOpen',[0,7,0,0,0,2,1]),1);
assert.strictEqual(call('grSelectContext',[1]),1);
assert.strictEqual(call('grSelectContext',[2]),0,'no fabricated second context');
// FIFO_FULLNESS is free PCI entries plus status, after actual ordered drain.
stream();
// The gamma ramp is WAT state; it reaches the stream at the next present as
// an UPLOAD of the 256-entry LUT (then MARK + PRESENT naming it).
const gammaFrame = recs => recs.filter(r => ['UPLOAD', 'MARK', 'PRESENT'].includes(r.name)).map(r => r.name);
let m = rec.mark();
call('guGammaCorrectionRGB',[fbits(1),fbits(1),fbits(1)]);
assert.strictEqual(rec.kicksSince(m).length, 0, 'the gamma call stays queued in WAT');
put(output,Buffer.alloc(12,0xa6));
assert.strictEqual(call('grGet',[3,4,output]),0);
assert.strictEqual(rec.kicksSince(m).length,0,'wrong length does not submit');
assert.deepStrictEqual(get(output,12),Buffer.alloc(12,0xa6));
assert.strictEqual(call('grGet',[3,8,output]),8);
const fifoStatus=get(output+4,4).readUInt32LE();
assert.strictEqual(get(output,4).readUInt32LE(),31,'PCI entry count, not queue bytes');
assert.strictEqual(fifoStatus&31,31);
assert.strictEqual(fifoStatus&~64,31,'only retrace may vary after completion');
assert.strictEqual(ring('read_pos'),ring('write_pos'),'everything published has executed');
{
  const kicks = rec.kicksSince(m);
  assert.deepStrictEqual(kicks.map(k=>k.mode),[KICK.KICK_ASYNC,KICK.KICK_SYNC],
    'pending commands reach backend before completion barrier');
  assert.deepStrictEqual(gammaFrame(kicks[0].records),['UPLOAD','MARK','PRESENT'],'queued gamma precedes fence');
  const present = kicks[0].records.find(r => r.name === 'PRESENT');
  assert.strictEqual(present.fields.gamma, kicks[0].records.find(r => r.name === 'UPLOAD').fields.id, 'the present applies the uploaded LUT');
  assert.strictEqual(kicks[1].records.length, 0, 'the barrier itself adds no records');
}
assert.deepStrictEqual(get(output+8,4),Buffer.alloc(4,0xa6),'query writes exactly eight bytes');

// Completion is distinct from queue submission, including an empty queue.
m = rec.mark();
call('guGammaCorrectionRGB',[fbits(1),fbits(1),fbits(1)]);
call('grFlush');
assert.deepStrictEqual(rec.kicksSince(m).map(k=>k.mode),[KICK.KICK_ASYNC],'Flush submits without waiting for GPU completion');
assert.deepStrictEqual(gammaFrame(rec.kicksSince(m)[0].records),['UPLOAD','MARK','PRESENT']);
m = rec.mark();
call('grFlush');
assert.strictEqual(rec.kicksSince(m).length,0,'empty Flush has no completion fence');
call('grFinish');
assert.deepStrictEqual(rec.kicksSince(m).map(k=>k.mode),[KICK.KICK_SYNC],'empty Finish still waits for previously issued GPU work');
assert.strictEqual(rec.kicksSince(m)[0].records.length,0);
m = rec.mark();
call('guGammaCorrectionRGB',[fbits(1),fbits(1),fbits(1)]);
call('grFinish');
assert.deepStrictEqual(rec.kicksSince(m).map(k=>k.mode),[KICK.KICK_ASYNC,KICK.KICK_SYNC],'Finish submits pending commands before waiting');
assert.deepStrictEqual(gammaFrame(rec.kicksSince(m)[0].records),['UPLOAD','MARK','PRESENT']);
assert.strictEqual(ring('read_pos'),ring('write_pos'));
streamMark = rec.mark();

call('grViewport',[3,5,320,200]);
assert.strictEqual(call('grGet',[38,16,output]),16);
assert.deepStrictEqual(get(output,16),words([3,5,320,200]));
// A compact D2-style layout; bytes not enabled by the layout never get read.
call('grVertexLayout',[1,0,1]);
call('grVertexLayout',[0x30,8,1]);
call('grVertexLayout',[4,12,1]);
call('grVertexLayout',[0x40,16,1]);
call('grVertexLayout',[0x50,24,1]);
function vertex(x,y,color,q,s,t,q0) {
  const p=Buffer.alloc(28);
  p.writeFloatLE(x,0);p.writeFloatLE(y,4);p.writeUInt32LE(color>>>0,8);
  [q,s,t,q0].forEach((v,i)=>p.writeFloatLE(v,12+i*4)); return p;
}
const vptr=sparse+4082;
put(vptr,vertex(17,19,0x80402010,0.5,64,32,0.25));
const pointers=0x410000;
put(pointers,words([vptr]));
call('grDrawVertexArray',[0,1,pointers],b);
let r=records(); assert.strictEqual(r.length,1); assert.strictEqual(r[0].op,12);
let ctx=vertexContext();
assert.strictEqual(ctx.hintQ0,true,'independent TMU Q is consumed');
// Canonical SDK GrVertex x y z r g b ooz a oow sow0 tow0 oow0, then TMU1's
// disabled sow1 tow1 (0) and oow1 (defaults to oow, as checked below).
assert.deepStrictEqual(r[0].gps[0],toGps([17,19,0,64,32,16,0,128,0.5,64,32,0.25,0,0,0.5],ctx),
  'Glide3 to SDK GrVertex fields');
assert.strictEqual(r[0].gps[0][11],0.25,'q0 is the independent TMU0 Q, not 1/W');
// Independent second-stage coordinates retain their declared Q.
call('grVertexLayout',[0x41,28,1]); call('grVertexLayout',[0x51,36,1]);
put(vptr+28,words([fbits(96),fbits(48),fbits(0.125)]));
call('grDrawVertexArray',[0,1,pointers]); r=records(); ctx=vertexContext();
assert.deepStrictEqual(r[0].gps[0].slice(12),toGps([17,19,0,64,32,16,0,128,0.5,64,32,0.25,96,48,0.125],ctx).slice(12));
assert.deepStrictEqual([48,52,56].map(o=>r[0].v[0].get(o)),[96,48,0.125]);
let v;
call('grGet',[19,4,0x410100]);assert.strictEqual(get(0x410100,4).readUInt32LE(),2);
call('grVertexLayout',[0x41,0,0]);call('grVertexLayout',[0x51,0,0]);
call('grFinish'); // Finish retains exactly one stdcall cleanup.
const verts=0x411000;
for(let i=0;i<7;++i)put(verts+i*28,vertex(i,10+i,0xff112233,1,0,0,1));
const triangleXs = recs => recs.filter(r=>r.op===5).map(r=>r.gps.map(g=>g[0]+0.5));
call('grDrawVertexArrayContiguous',[4,4,verts,28]);
assert.deepStrictEqual(triangleXs(records()),[[0,1,2],[2,1,3]],'strip winding alternates');
call('grDrawVertexArrayContiguous',[7,2,verts+4*28,28]);
assert.deepStrictEqual(triangleXs(records()),[[2,3,4],[4,3,5]],'strip continuation retains vertices/parity');
call('grDrawVertexArrayContiguous',[5,4,verts,28]);
call('grDrawVertexArrayContiguous',[8,1,verts+4*28,28]);
assert.deepStrictEqual(triangleXs(records()),[[0,1,2],[0,2,3],[0,3,4]],'fan continuation retains anchor');
call('grDrawVertexArrayContiguous',[6,6,verts,28]);
assert.deepStrictEqual(triangleXs(records()),[[0,1,2],[3,4,5]],'triangle list');
call('grDrawVertexArrayContiguous',[2,4,verts,28]);
r=records();assert.deepStrictEqual(r.map(x=>[x.op,x.gps[0][0]+0.5,x.gps[1][0]+0.5]),[[11,0,1],[11,2,3]],'line pairs');
call('grDrawVertexArrayContiguous',[1,3,verts,28]);assert.strictEqual(records().length,2,'line strip');
// Float color mode replaces packed color selection; disabled Q defaults1.
call('grVertexLayout',[0x20,8,1]);call('grVertexLayout',[0x10,20,1]);
call('grVertexLayout',[4,0,0]);call('grVertexLayout',[0x40,0,0]);call('grVertexLayout',[0x50,0,0]);
put(vptr,words([fbits(1),fbits(2),fbits(7),fbits(11),fbits(13),fbits(17)]));
call('grDrawVertexArray',[0,1,pointers]);r=records();ctx=vertexContext();
// r g b a at canonical 12 16 20 28 are 7 11 13 17; oow and oow0 default to 1.
assert.deepStrictEqual([4,5,6,7,10,11].map(i=>r[0].gps[0][i]),[7,11,13,17,1,1].map((x,i)=>i<4?Math.fround(x/255):x));
// GrTexInfo G3 log2/ signed aspect canonicalizes independently of guest layout.
const info=sparse+4090, data=0x412000;
put(info,words([4,5,-1,0,data])); // 32x? aspect1:2 =>16x32 base +8x16 =640B.
assert.strictEqual(call('grTexTextureMemRequired',[3,info]),640);
assert.strictEqual(call('grTexCalcMemRequired',[4,5,-1,0]),640);
put(data,Buffer.alloc(640,0x5c));
// Downloads fill TMU RAM in WAT; a draw that samples the chain makes the
// stream CREATE and UPLOAD it, decoded. Sample with a texture-only combine,
// restoring every Glide state word afterwards.
const sampleState=0x415000;
function sample(tmu,start,infoPtr) {
  call('grGlideGetState',[sampleState]);
  stream();
  call('grColorCombine',[3,8,0,1,0]);                       // other = texture
  if (tmu===0) call('grTexCombine',[0,1,0,1,0,0,0]);         // TMU0 local
  else { call('grTexCombine',[0,3,8,3,8,0,0]); call('grTexCombine',[1,1,0,1,0,0,0]); } // TMU0 passes TMU1
  call('grTexSource',[tmu,start,3,infoPtr]);
  call('grDrawPoint',[vptr]);
  const recs=stream(), p=primitives(recs).at(-1);
  call('grGlideSetState',[sampleState]);
  assert(p,'the sampling point is drawn');
  const t=bound(p,tmu);
  assert(t,'the point binds TMU'+tmu);
  return Object.assign(t,{records:recs});
}
const level=(t,l)=>Array.from(t.data[l]);
const fill=(n,x)=>Array(n).fill(x>>>0);
call('grTexDownloadMipMap',[0,0,3,info]);call('grTexSource',[0,0,3,info]);
assert.strictEqual(stream().length,0,'download and source alone emit nothing');
let tex=sample(0,0,info);
assert.deepStrictEqual([tex.kind,tex.width,tex.height,tex.levels],[KIND.TEX2D,16,32,2],'G3 log2 16x32 aspect 1:2 chain of two levels');
// RGB332 0x5c: r 2 -> 73, g 7 -> 255, b 0.
assert.deepStrictEqual(level(tex,0),fill(16*32,0xff00ff49),'every downloaded byte reaches level 0');
assert.deepStrictEqual(level(tex,1),fill(8*16,0xff00ff49),'and the 8x16 level packed after it');
// The maximum is an aligned start address, not the final texture RAM byte.
const maxTexture=call('grTexMaxAddress',[0]);assert.strictEqual(maxTexture,4194304-8);
assert.strictEqual(call('grTexMaxAddress',[1]),maxTexture);
assert.strictEqual(call('grTexCalcMemRequired',[0,0,0,0]),8);
const boundaryInfo=0x419000;put(boundaryInfo,words([0,0,0,0,data]));
for(const tmu of [0,1]) call('grTexDownloadMipMap',[tmu,maxTexture,3,boundaryInfo]);
for(const tmu of [0,1]) {
  // The one 1x1 texel at the last aligned address of each TMU's own RAM.
  tex=sample(tmu,maxTexture,boundaryInfo);
  assert.deepStrictEqual([tex.width,tex.height,tex.levels,level(tex,0)],[1,1,1,[0xff00ff49]],
    'boundary download on TMU'+tmu);
}
const palette=0x413000;put(palette,words(Array.from({length:256},(_,i)=>0xff000000+i)));
// A 2x2 P8 texture indexing entries 3 and 4 samples the palette as it was
// when the draw executed: a decoded texture does not outlive a table change.
const p8Info=0x419100, p8Data=0x419200;
put(p8Data,Buffer.from([3,4,3,4]));put(p8Info,words([1,1,0,5,p8Data]));
call('grTexDownloadMipMap',[0,0x1000,3,p8Info]);
call('glide3_grTexDownloadTable',[2,palette]);
tex=sample(0,0x1000,p8Info);
assert.deepStrictEqual(level(tex,0),[0xff030000,0xff040000,0xff030000,0xff040000],'full table entries 3 and 4');
put(palette+12,words([0xffabcdef]));call('grTexDownloadTablePartial',[2,palette,3,3]);
const palAt=i=>view.getUint32(ext()+128+i*4,true)&0xffffff;
assert.deepStrictEqual([palAt(2),palAt(3),palAt(4)],[2,0xabcdef,4],'partial download replaces exactly entry 3');
tex=sample(0,0x1000,p8Info);
assert.deepStrictEqual(level(tex,0),[0xffefcdab,0xff040000,0xffefcdab,0xff040000],'partial palette preserves other entries');
call('guGammaCorrectionRGB',[fbits(1),fbits(2),fbits(3)]);
put(data,words([0,0x123]));put(data+16,words([7,8]));put(data+32,words([255,254]));
call('grLoadGammaTable',[2,data,data+16,data+32]);
{
  // One present-time LUT: the RGB ramps (exponents 1, 1/2, 1/3) applied
  // first, then the two-entry table on top with byte-mask semantics (0x123 -> 0x23).
  const recs=stream(), ups=recs.filter(x=>x.name==='UPLOAD');
  assert.deepStrictEqual(gammaFrame(recs),['UPLOAD','MARK','PRESENT'],'both gamma calls reach one present');
  const present=recs.find(x=>x.name==='PRESENT');
  assert.strictEqual(present.fields.gamma,ups[0].fields.id);
  assert.deepStrictEqual([ups[0].fields.w,ups[0].fields.h],[256,1]);
  const ramp=(i,g)=>Math.floor(255*Math.pow(i/255,1/g)+0.5);
  const lut=Array.from({length:256},(_,i)=>i<2?[0xffff0700,0xfffe0823][i]
    :(ramp(i,1)|ramp(i,2)<<8|ramp(i,3)<<16|0xff<<24)>>>0);
  assert.deepStrictEqual(level(rec.textures.get(ups[0].fields.id),0),lut,'partial gamma byte-mask semantics over the RGB ramp');
}
// SDK gu.c exact float intermediates; float-return ABI uses x87 ST(0).
const f=Math.fround, fogW=i=>f(2**(3+(i>>2))/(8-(i&3)));
for (const i of [0,3,31,63]) { call('guFogTableIndexToW',[i]); assert.strictEqual(a.test_fpu_get(0),fogW(i)); }
const density=f(0.001), expValue=i=>{const d=f(density*fogW(i));return f(1-f(Math.exp(-f(d*d))));};
call('guFogGenerateExp2',[sparse+4080,fbits(density)]);
assert.deepStrictEqual(get(sparse+4080,64),Buffer.from(Array.from({length:64},(_,i)=>
  Math.trunc(f(255*f(Math.max(0,Math.min(1,f(expValue(i)*f(1/expValue(63)))))))))));
call('guFogGenerateLinear',[sparse+4080,fbits(10),fbits(5000)]);
assert.deepStrictEqual(get(sparse+4080,64),Buffer.from(Array.from({length:64},(_,i)=>
  Math.trunc(f(255*Math.max(0,Math.min(1,f(f(Math.min(65535,fogW(i))-10)/f(5000-10)))))))));
const state=0x414000;call('grGlideGetState',[state]);call('grViewport',[0,0,1,1]);call('grGlideSetState',[state]);
call('grGet',[38,16,output]);assert.deepStrictEqual(get(output,16),words([3,5,320,200]));
// Two independent texture RAM namespaces and immutable queued TMU snapshots.
put(info,words([4,5,1,0,data]));put(data,Buffer.alloc(640,0xa3));
call('grTexDownloadMipMap',[1,0,3,info]);call('grTexSource',[1,0,3,info]);
// The draws sample TMU1 through TMU0 (TMU0 passes OTHER), so the stream
// shows TMU1's own texture and sampler on BIND slot 1 per draw.
call('grColorCombine',[3,8,0,1,0]);call('grTexCombine',[0,3,8,3,8,0,0]);
call('grTexCombine',[1,1,0,1,0,0,0]);call('grTexClampMode',[1,1,0]);
call('grDrawPoint',[vptr]);call('grTexClampMode',[1,0,1]);call('grDrawPoint',[vptr]);
assert.strictEqual(sw(140),4,'TMU0 keeps its 1:2 aspect');
assert.strictEqual(view.getUint32(ext()+2368+12,true),2,'independent aspect');
r=records();assert.strictEqual(r.length,2);
{
  const t1=bound(r[0],1), clampAddr=x=>[x.address_u,x.address_v];
  assert(t1,'TMU1 is bound to slot 1');
  assert.strictEqual(bound(r[0],0),undefined,'TMU0 samples nothing of its own');
  assert.deepStrictEqual([t1.width,t1.height,t1.levels],[32,16,2],'TMU1 texture has its own 2:1 aspect');
  // RGB332 0xa3: r 5 -> 182, g 0, b 3 -> 255; TMU1 RAM is its own namespace.
  assert.deepStrictEqual(level(t1,0),fill(32*16,0xffff00b6));
  assert.deepStrictEqual(level(t1,1),fill(16*8,0xffff00b6));
  assert.deepStrictEqual(clampAddr(t1.sampler),[3,1],'first draw: S clamp, T wrap');
  assert.deepStrictEqual(clampAddr(bound(r[1],1).sampler),[1,3],'second draw keeps its own (immutable) clamp snapshot');
  const ctxNow=vertexContext();
  assert.deepStrictEqual([ctxNow.s0,ctxNow.t0,ctxNow.s1,ctxNow.t1],[128,256,256,128],
    'per-TMU ST normalisation: SDK ST spans 256 on the long side of each TMU\'s own aspect');
}
call('grGet',[6,4,output]);assert.strictEqual(get(output,4).readUInt32LE(),464);
call('grGlideGetState',[state]);call('grTexClampMode',[1,1,1]);call('grGlideSetState',[state]);
call('grDrawPoint',[vptr]);r=records();
assert.deepStrictEqual([bound(r[0],1).sampler.address_u,bound(r[0],1).sampler.address_v],[1,3],'SetState restores TMU1 clamp');
// CLIP_COORDS uses homogeneous clipping before division, then SDK viewport,
// depth, normalized float color, and independent texture-aspect conversion.
for(const [param,offset] of [[1,0],[2,8],[3,12],[4,16],[0x20,20],[0x10,32],
  [0x40,36],[0x50,44],[0x41,48],[0x51,56]]) call('grVertexLayout',[param,offset,1]);
call('grColorCombine',[3,8,0,1,0]);call('grAlphaCombine',[1,0,0,2,0]);
call('grTexCombine',[0,4,8,4,8,0,0]);call('grTexCombine',[1,1,0,1,0,0,0]);
call('grCoordinateSpace',[1]);call('grViewport',[10,20,100,80]);call('grDepthRange',[fbits(.25),fbits(.75)]);
put(info,words([4,5,0,0,data]));call('grTexSource',[0,0,3,info]);
const clip=0x417000;
const clipVertex=(x,y,z,w=1,color=[.25,.5,.75])=>words([x,y,z,w,.75,...color,.5,.5,.25,.5,.2,.4,.25].map(fbits));
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.002,`${label}: ${actual} != ${expected}`);
// Canonical field `offset` of vertex i of primitive p (see canonical()).
const at=(p,i=0)=>offset=>{
  const x=p.v[i].get(offset);
  assert.notStrictEqual(x,undefined,'canonical offset '+offset+' is carried');
  return x;
};
// ooz reaches the stream normalised to f32 depth (ooz / 65535), whose ulp
// at 0.5 is 65535 * 2^-24 ~ 0.0039 ooz: compare it within one depth ulp.
const nearOoz=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=65535*2**-24+1e-9,`${label}: ${actual} != ${expected}`);
const finite=p=>p.gps.every(g=>g.every(Number.isFinite));
put(clip,clipVertex(-.5,.5,0,2));call('grDrawPoint',[clip]);r=records();v=at(r[0]);
for(const [offset,expected] of [[0,47.5],[4,70],[24,32767.5],[12,63.75],[16,127.5],
  [20,191.25],[28,127.5],[32,.375],[36,64],[40,32],[44,.25],[48,25.6],[52,25.6],[56,.125]])
  (offset===24?nearOoz:near)(v(offset),expected,'projected '+offset);
call('grVertexLayout',[0x51,0,0]);call('grDrawPoint',[clip]);
near(at(records()[0])(56),.5,'disabled Q1 uses reciprocal W');
call('grVertexLayout',[0x51,56,1]);
for(const xyz of [[-2,0,0],[2,0,0],[0,-2,0],[0,2,0],[0,0,-2],[0,0,2]]) {
  put(clip,clipVertex(...xyz));call('grDrawPoint',[clip]);assert.strictEqual(records().length,0,'clip plane rejects '+xyz);
}
put(clip,clipVertex(0,0,0,-1));call('grDrawPoint',[clip]);assert.strictEqual(records().length,0,'negative W point rejected');
put(clip,clipVertex(-2,0,0,1,[0,0,0]));put(clip+60,clipVertex(0,0,0,1,[1,1,1]));
call('grDrawLine',[clip,clip+60]);r=records();v=at(r[0]);
near(v(0),10,'line clipped left');near(at(r[0],1)(0),60,'line endpoint');
near(v(12),127.5,'line intersection color');
put(clip,clipVertex(-.5,-.5,-2));put(clip+60,clipVertex(.5,-.5,0));put(clip+120,clipVertex(0,.5,0));
call('grDrawTriangle',[clip,clip+60,clip+120]);r=records();assert.strictEqual(r.length,2,'near-clipped quad triangulates');
const oozTol=65535*2**-24+1e-9;
const projected=r.flatMap(p=>[0,1,2].map(i=>[0,4,24].map(at(p,i))));
for(const point of projected) {
  assert.ok(point.every(Number.isFinite));assert.ok(point[0]>=10&&point[0]<=110&&point[1]>=20&&point[1]<=100);
  assert.ok(point[2]>=16383.75-oozTol&&point[2]<=49151.25+oozTol);
}
assert.ok(projected.some(p=>Math.abs(p[0]-47.5)<.002&&Math.abs(p[1]-60)<.002&&Math.abs(p[2]-16383.75)<=oozTol),'CA near intersection');
assert.ok(projected.some(p=>Math.abs(p[0]-60)<.002&&Math.abs(p[1]-40)<.002&&Math.abs(p[2]-16383.75)<=oozTol),'AB near intersection');
// Crossing the eye clips to a finite visible polygon; no divide-by-zero
// reaches the packet, including interpolated Q and both texture coordinates.
put(clip,clipVertex(0,0,0,-1));put(clip+60,clipVertex(.5,-.5,0));put(clip+120,clipVertex(-.5,-.5,0));
call('grDrawTriangle',[clip,clip+60,clip+120]);r=records();assert.ok(r.length>0);
for(const p of r) assert.ok(finite(p),'eye crossing output finite');
// The smallest accepted W keeps zero/tiny enabled ST finite, even though
// reciprocalW*256 alone would overflow f32. Exercise both independent units.
const minimumW=2**-126, tiny=clipVertex(0,0,0,minimumW);
for(const offset of [36,40,48,52]) tiny.writeFloatLE(offset===40||offset===52?minimumW:0,offset);
put(clip,tiny);call('grDrawPoint',[clip]);r=records();
assert.strictEqual(r.length,1);
assert.ok(finite(r[0]),'minimum-W output finite');
for(const [offset,value] of [[36,0],[40,256],[48,0],[52,128]])
  near(at(r[0])(offset),value,'minimum-W texture '+offset);
// Original Hitman Pack.SPK contains NaN UVs. Preserve the textured triangle
// and finite components; undefined NaN S/T selects deterministic coordinate 0.
for (const mode of [1,0]) {
  call('grCoordinateSpace',[mode]);
  for (let i=0;i<3;i++) {
    const raw=clipVertex(...[[-.5,-.5,0],[.5,-.5,0],[0,.5,0]][i],2);
    raw.writeFloatLE(NaN,36);raw.writeFloatLE(.25,40);
    raw.writeFloatLE(.2,48);raw.writeFloatLE(NaN,52);
    put(clip+i*60,raw);
  }
  call('grDrawTriangle',[clip,clip+60,clip+120]);r=records();
  assert.strictEqual(r.length,1,'NaN UV triangle retained');
  assert.strictEqual(r[0].op,5,'a triangle');
  assert.deepStrictEqual(r[0].state.bind.map(e=>e.slot),[0,1],'both texture units retained');
  assert.strictEqual(r[0].gps.length,3,'all three vertices retained');
  assert.ok(finite(r[0]),'finite components');
  for(let i=0;i<3;i++) {
    const out=at(r[0],i);
    for(const [offset,value] of [[36,0],[40,mode?32:.25],[48,mode?25.6:.2],[52,0],
      [44,mode?.25:.5],[56,mode?.125:.25]]) near(out(offset),value,'NaN policy '+mode+'/'+offset);
    near(out(0),mode?[47.5,72.5,60][i]:[-.5,.5,0][i],'preserved geometry X');
    near(out(12),mode?63.75:.25,'preserved color');
  }
}
call('grCoordinateSpace',[1]);
// Hitman keeps ST/Q layouts enabled for an untextured quad but leaves
// their storage undefined. Both finite overflow and NaNs must remain unread.
call('grGlideGetState',[state]);
call('grColorCombine',[1,0,0,2,0]);call('grAlphaCombine',[1,0,0,2,0]);
const inactive=clipVertex(0,0,0,1);
[36,40,44,48,52,56].forEach((offset,i)=>inactive.writeFloatLE(i%2?NaN:3e38,offset));
put(clip,inactive);call('grDrawPoint',[clip]);r=records();
assert.deepStrictEqual([36,40,44,48,52,56].map(at(r[0])),[0,0,1,0,0,1]);
assert.deepStrictEqual(r[0].state.bind,[],'an untextured draw binds nothing');
// A texture 'other' selector is still dead when the function is LOCAL.
call('grColorCombine',[1,4,0,1,0]);call('grDrawPoint',[clip]);
assert.strictEqual(at(records()[0])(36),0);
// TMU0 can consume its local texture while unused TMU1 remains unread.
call('grColorCombine',[3,8,0,1,0]);call('grTexCombine',[0,1,0,1,0,0,0]);
[36,40,44].forEach((offset,i)=>inactive.writeFloatLE([.25,.5,1][i],offset));
put(clip,inactive);call('grDrawPoint',[clip]);r=records();
near(at(r[0])(36),64,'live TMU0 ST preserved');
assert.deepStrictEqual([48,52,56].map(at(r[0])),[0,0,1]);
assert.deepStrictEqual(r[0].state.bind.map(e=>e.slot),[0],'only TMU0 is sampled');
// Chroma consumes RGB OTHER before LOCAL replaces framebuffer color.
call('grColorCombine',[1,0,0,1,0]);call('grChromakeyMode',[1]);
call('grDrawPoint',[clip]);r=records();
near(at(r[0])(36),64,'texture OTHER remains live for chroma');
// Changing chroma OTHER to iterated/constant makes texture fields dead again.
for(const other of [0,2]) {
  call('grColorCombine',[1,0,0,other,0]);
  inactive.writeFloatLE(NaN,36);put(clip,inactive);call('grDrawPoint',[clip]);
  assert.strictEqual(at(records()[0])(36),0,'nontexture chroma ignores ST');
}
call('grGlideSetState',[state]);call('grCoordinateSpace',[0]);

// Diagnostic reasons observe actual staging, preserving the same readbacks.
const metrics = reason => Array.from({length:7},(_,field)=>b.glide_lfb_metrics_get(reason,field));
for(let reason=0;reason<5;++reason) assert.deepStrictEqual(metrics(reason),Array(7).fill(0));
a.glide_lfb_metrics_enable(1);
const lfbInfo=0x416000, returnAddress=0x12345678;
view.setUint32(stack,returnAddress,true);
put(lfbInfo,words([20,0,0,0,0]));
const readbacks=from=>rec.recordsSince(from).filter(x=>x.name==='READBACK');
const readsBefore=rec.mark();
assert.strictEqual(call('grLfbLock',[0,1,0,0,0,lfbInfo]),1);
assert.strictEqual(call('grLfbUnlock',[0,1]),1);
assert.strictEqual(call('grLfbLock',[1,1,0,0,0,lfbInfo]),1);
assert.strictEqual(call('grLfbUnlock',[1,1]),1);
assert.strictEqual(call('grLfbReadRegion',[1,0,0,2,3,4,data]),1);
assert.strictEqual(call('grLfbWriteRegion',[1,0,0,0,3,2,6,data]),1);
assert.strictEqual(call('glide3_grLfbWriteRegion',[1,0,0,0,4,2,0,8,data]),1);
const fullPixels=640*480;
assert.deepStrictEqual(metrics(0),[1,fullPixels,fullPixels,1,640,480,returnAddress]);
assert.deepStrictEqual(metrics(1),[1,fullPixels,fullPixels,1,640,480,returnAddress]);
assert.deepStrictEqual(metrics(2),[1,6,fullPixels,0,2,3,returnAddress]);
assert.deepStrictEqual(metrics(3),[1,6,fullPixels,0,3,2,returnAddress]);
assert.deepStrictEqual(metrics(4),[1,8,fullPixels,0,4,2,returnAddress]);
{
  const rb=readbacks(readsBefore);
  // Five stagings, one READBACK: nothing touches the back buffer in between,
  // so the stage (re-tagged by each LFB write's publish) serves the other four.
  assert.strictEqual(rb.length,1,'one full staging READBACK');
  assert.ok(rb.every(x=>x.fields.w===640&&x.fields.h===480),'it stages the whole 640x480 buffer');
}
let beforeInvalid=rec.mark();
assert.strictEqual(call('grLfbReadRegion',[1,0,0,0,3,4,data]),0);
assert.strictEqual(metrics(2)[0],1,'invalid API call never reached staging');
assert.strictEqual(readbacks(beforeInvalid).length,0,'and issued no READBACK');
// A READBACK has no graceful failure in the stream (a failed drain traps),
// so the second staging is an ordinary successful 1x1 read -- of the front
// buffer, which the stage does not hold, so it does read back.
assert.strictEqual(call('grLfbReadRegion',[0,0,0,1,1,2,data]),1);
assert.strictEqual(get(data,2).readUInt16LE(),0x5acb,'the drained readback (0x5a A8B8G8R8 fill, WAT-converted to RGB565) is what the guest reads');
assert.deepStrictEqual(metrics(2),[2,7,fullPixels*2,0,1,1,returnAddress],'every staging is an attempted full readback');
a.glide_lfb_metrics_enable(0);
const stopped=metrics(2);
assert.strictEqual(call('grLfbReadRegion',[1,0,0,1,1,2,data]),1);
assert.deepStrictEqual(metrics(2),stopped,'disabled diagnostics stop counting without disabling rendering');
assert.strictEqual(a.glide_lfb_metrics_get(5,0),0);
assert.strictEqual(a.glide_lfb_metrics_get(0,7),0);
// Extra LFB pixelPipeline argument must not become stride or a data pointer.
assert.strictEqual(call('glide3_grLfbWriteRegion',[1,0,0,0,1,1,1,2,data]),0);
assert.strictEqual(call('glide3_grLfbWriteRegion',[1,0,0,0,1,1,0,2,data]),1);
put(data,words([-1,0,2,1]));assert.strictEqual(call('grQueryResolutions',[data,0]),13*16);
assert.strictEqual(call('grQueryResolutions',[data,data+32]),13*16);
assert.deepStrictEqual(get(data+32,16),words([0,0,2,1]));
assert.strictEqual(call('glide3_grSstWinClose',[2]),0);
assert.strictEqual(call('glide3_grSstWinClose',[1]),1);
call('grGlideShutdown');assert.strictEqual(a.glide_api_version(),0);
assert.strictEqual(a.glide_lfb_metrics_get(0,0),0,'shutdown releases diagnostics with extension');
assert.strictEqual(view.getUint32(regions.BASE.GLIDE_STATE+116,true),0,'extension allocation released');
call('grGlideInit');assert.strictEqual(a.glide_api_version(),2);
assert.strictEqual(call('grTexCalcMemRequired',[4,3,4,0]),640,'Glide2 enum meanings preserved');
assert.strictEqual(call('grTexMaxAddress',[0]),4194304-8,'Glide2 SDK aligned maximum preserved');
call('grGlideShutdown');
assert.deepStrictEqual(get(neighbor,4096),Buffer.alloc(4096,0xa7),'unrelated physical page unchanged');
assert.strictEqual(a.guest_span_cursor_bytes(),0,'all sparse spans released');
// A genuinely overflowing projected coordinate is an explicit fatal API
// failure. Keep it last: production terminates the guest on this trap.
call('glide3_grGlideInit');call('grSstWinOpen',[0,7,0,0,0,2,1]);
for(const [param,offset] of [[1,0],[2,8],[3,12],[0x40,36]]) call('grVertexLayout',[param,offset,1]);
call('grCoordinateSpace',[1]);
call('grColorCombine',[3,8,0,1,0]);call('grTexCombine',[0,1,0,1,0,0,0]);
const invalidLive=clipVertex(0,0,0,1);invalidLive.writeFloatLE(Infinity,36);put(clip,invalidLive);
assert.throws(()=>a.test_glide3_vertex(wa(0x418000),clip),WebAssembly.RuntimeError,'consumed infinite ST remains fatal');
// The UV policy must not absorb NaN position, W, or live texture Q.
call('grVertexLayout',[0x50,44,1]);
call('grVertexLayout',[0x20,20,1]);
for(const offset of [0,4,8,12,20,44]) {
  const invalid=clipVertex(0,0,0,1);invalid.writeFloatLE(NaN,offset);put(clip,invalid);
  assert.throws(()=>a.test_glide3_vertex(wa(0x418000),clip),WebAssembly.RuntimeError,'non-UV NaN remains fatal '+offset);
}
const extreme=clipVertex(0,0,0,minimumW);extreme.writeFloatLE(1,36);put(clip,extreme);
const pendingBefore=rec.mark(), writeBefore=ring('write_pos');
assert.throws(()=>call('grDrawPoint',[clip]),WebAssembly.RuntimeError,'unrepresentable ST fails explicitly');
assert.strictEqual(ring('write_pos'),writeBefore,'invalid projection publishes no command');
assert.strictEqual(rec.kicksSince(pendingBefore).length,0,'and kicks nothing');
console.log('PASS Glide3 native ABI, layouts, topology, sparse memory, textures, gamma and context');
