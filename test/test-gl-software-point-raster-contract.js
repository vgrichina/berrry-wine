#!/usr/bin/env node
'use strict';
const {ownedAnswer,ownedWindow}=require('./helpers/gl-owned-host');

// Independent full-frame GL 2.1 §3.3.1 oracle. No production/reference imports.
// Surface coordinates here are TOP DOWN; the specification is bottom up.
// https://registry.khronos.org/OpenGL/specs/gl/glspec21.pdf
const assert = require('node:assert/strict');
const fs = require('node:fs');
const W = 8, H = 8;
const cases = [
  {name:'reported-half-pixel', point:[-.875,-.875,0,1], pixels:[[0,7]]},
  {name:'opposite-half-pixel', point:[.875,.875,0,1], pixels:[[7,0]]},
  {name:'below-half', point:[-.90625,-.90625,0,1], pixels:[[0,7]]},
  {name:'above-half', point:[-.84375,-.84375,0,1], pixels:[[0,7]]},
  {name:'integer-window', point:[-.75,-.75,0,1], pixels:[[1,6]]},
  {name:'integer-window-user-clip-point', point:[.5,0,0,1], pixels:[[6,3]]},
  {name:'left-bottom-clip-boundary', point:[-1,-1,0,1], pixels:[[0,7]]},
  {name:'right-clip-boundary', point:[1,0,0,1], pixels:[]},
  {name:'top-clip-boundary', point:[0,1,0,1], pixels:[]},
  {name:'outside-left-large', point:[-1.03125,0,0,1], size:4, pixels:[]},
  {name:'outside-right-large', point:[1.03125,0,0,1], size:4, pixels:[]},
  {name:'outside-bottom-large', point:[0,-1.03125,0,1], size:4, pixels:[]},
  {name:'outside-top-large', point:[0,1.03125,0,1], size:4, pixels:[]},
  {name:'outside-near', point:[0,0,-1.03125,1], pixels:[]},
  {name:'outside-far', point:[0,0,1.03125,1], pixels:[]},
  {name:'negative-w', point:[0,0,0,-1], pixels:[]},
  {name:'zero-w', point:[0,0,0,0], pixels:[]},
  {name:'near-boundary', point:[-.875,-.875,-1,1], pixels:[[0,7]]},
  {name:'far-boundary', point:[-.875,-.875,1,1], pixels:[[0,7]]},
  {name:'positive-projective-w', point:[-1.75,-1.75,0,2], pixels:[[0,7]]},
  {name:'small-positive-projective-w', point:[-0.00005340576171875,-0.00005340576171875,0,0.00006103515625], pixels:[[0,7]]},
  {name:'viewport-offset', point:[-.75,-.75,0,1], viewport:[2,1,4,4], pixels:[[2,6]]},
  {name:'negative-window-off-target', point:[-.875,-.875,0,1], viewport:[-1,-1,8,8], pixels:[]},
  {name:'negative-viewport-visible', point:[-.625,-.625,0,1], viewport:[-1,-1,8,8], pixels:[[0,7]]},
  {name:'negative-viewport-width-rejected', point:[-.875,-.875,0,1], viewport:[1,1,4,4],
    invalidViewport:[2,3,-4,4], pixels:[[1,6]]},
  {name:'negative-viewport-height-rejected', point:[-.875,-.875,0,1], viewport:[1,1,4,4],
    invalidViewport:[2,3,4,-4], pixels:[[1,6]]},
  {name:'zero-viewport-width', point:[0,0,0,1], viewport:[2,1,0,4], pixels:[[2,4]]},
  {name:'zero-viewport-height', point:[0,0,0,1], viewport:[2,1,4,0], pixels:[[4,6]]},
  {name:'size-two-below-half', point:[-.90625,-.90625,0,1], size:2, pixels:[[0,7]]},
  {name:'size-two-at-half', point:[-.875,-.875,0,1], size:2, pixels:[[0,6],[1,6],[0,7],[1,7]]},
  {name:'size-three-corner', point:[-.875,-.875,0,1], size:3, pixels:[[0,6],[1,6],[0,7],[1,7]]},
  {name:'size-four-at-top-right-clip-boundary', point:[1,1,0,1], size:4,
    pixels:[[6,0],[7,0],[6,1],[7,1]]},
  {name:'size-four-at-bottom-left-clip-boundary', point:[-1,-1,0,1], size:4,
    pixels:[[0,6],[1,6],[0,7],[1,7]]},
  {name:'size-four-integer', point:[0,0,0,1], size:4,
    pixels:[[2,2],[3,2],[4,2],[5,2],[2,3],[3,3],[4,3],[5,3],[2,4],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5],[5,5]]},
  {name:'size-rounds-to-one', point:[-.875,-.875,0,1], size:.25, pixels:[[0,7]]},
  {name:'size-rounds-to-two', point:[-.875,-.875,0,1], size:1.75, pixels:[[0,6],[1,6],[0,7],[1,7]]},
  {name:'point-extends-outside-viewport', point:[-1,-1,0,1], viewport:[3,3,2,2], size:3,
    pixels:[[2,3],[3,3],[4,3],[2,4],[3,4],[4,4],[2,5],[3,5],[4,5]]},
  {name:'large-point-scissored', point:[0,0,0,1], size:4, scissor:[3,3,2,2],
    pixels:[[3,3],[4,3],[3,4],[4,4]]},
  {name:'empty-scissor', point:[0,0,0,1], size:4, scissor:[3,3,0,2], pixels:[]},
  {name:'zero-size-rejected', point:[0,0,0,1], size:2, invalidSize:0,
    pixels:[[3,3],[4,3],[3,4],[4,4]]},
  {name:'negative-size-rejected', point:[0,0,0,1], size:2, invalidSize:-2,
    pixels:[[3,3],[4,3],[3,4],[4,4]]},
];

function expectedPixels(c) {
  const [x,y,z,w] = c.point;
  if (!(w>0) || [x,y,z].some(v=>v < -w || v > w)) return [];
  const [vx,vy,vw,vh] = c.viewport || [0,0,W,H];
  const wx = vx+(x/w+1)*vw/2, wy = vy+(y/w+1)*vh/2;
  const size = Math.max(1,Math.floor((c.size || 1)+.5));
  // Odd widths use floor(window), even widths use floor(window+.5).
  const left = Math.floor(wx+(size%2 ? 0 : .5))-Math.floor(size/2);
  const bottom = Math.floor(wy+(size%2 ? 0 : .5))-Math.floor(size/2);
  const out=[];
  for(let row=0;row<H;row++) for(let col=0;col<W;col++) {
    const gy=H-1-row;
    const s=c.scissor;
    if(s && !(col>=s[0] && col<s[0]+s[2] && gy>=s[1] && gy<s[1]+s[3])) continue;
    if(col>=left && col<left+size && gy>=bottom && gy<bottom+size) out.push([col,row]);
  }
  return out;
}
function checkOracle() {
  for(const c of cases) assert.deepEqual(expectedPixels(c),c.pixels,c.name+' independent literal full-pixel contract');
  // The complete frame includes every clear pixel, not only lit samples.
  const broken = Array(W*H).fill(0); broken[7*W+1]=1;
  assert.throws(()=>checkFrame(cases[0],broken),'a shifted point must fail');
  const extra = Array(W*H).fill(0); extra[7*W]=extra[7*W+1]=1;
  assert.throws(()=>checkFrame(cases[0],extra),'extra fragments must fail');
  return {oracleCases:cases.length,negativeControls:2};
}
function checkFrame(c,pixels) {
  assert.equal(pixels.length,W*H,c.name+' complete drawable');
  const literal = new Set(c.pixels.map(([x,y])=>y*W+x));
  assert.deepEqual(pixels,Array.from({length:W*H},(_,i)=>Number(literal.has(i))),c.name+' all 64 exact pixels');
}

async function softwareFrames() {
  const {bootRenderHarness}=require('./render-helper');
  const {CALL_INDEX}=require('../lib/gl-command-stream');
  const Stream=require('../lib/gl-command-stream');
  const crypto=require('node:crypto');
  const bytes=fs.readFileSync(process.env.WINE_TEST_WASM || 'build/wine-assembly.wasm');
  const module=new WebAssembly.Module(bytes);
  let memory;
  const h=await bootRenderHarness({prebuiltModule:module,fonts:'none',width:W,height:H,
    extraHostOverrides:{gpu_gl_call(op,at,bytes){
      // Decline off-thread software submission: exercise the real synchronous
      // WAT fallback. This does not supply pixels or replace a draw result.
      if(op===0x20005)return 0;
      assert.equal(op,Stream.WAT_STREAM_FLUSH_OPCODE,'native stream transport only');
      return ownedAnswer(memory,at,bytes);
    }}});
  memory=h.memory;const e=h.exports;
  e.init_thread(1,0x400000,0,0,0,0,0,0);e.heap_init(0x800000);
  
  const stack=e.guest_to_wasm(e.guest_alloc(64));
  const vertex=e.guest_to_wasm(e.guest_alloc(60));
  function call(name,values,floats=false,aux=0) {
    new Uint32Array(memory.buffer,stack,16).fill(0);
    const args=floats?new Float32Array(memory.buffer,stack,16):new Int32Array(memory.buffer,stack,16);
    args.set(values,1);
    return e.gl_wat_encoder_call(CALL_INDEX[name],stack,aux);
  }
  ownedWindow(e,42,W,H);
  const context=call('wglCreateContext',[],false,42);assert(context,'real software context');
  assert.equal(call('wglMakeCurrent',[0,context],false,42),1);
  e.gl_sw_set_enabled(1); e.gl_sw_set_default_size(W,H);
  e.gl_mtx_set_mode(0x1700); e.gl_mtx_load_identity();
  e.gl_mtx_set_mode(0x1701); e.gl_mtx_load_identity();
  const frames=[];
  for(const c of cases) {
    const errors=[];
    call('glViewport',c.viewport || [0,0,W,H]);
    if(c.invalidViewport) {
      call('glViewport',c.invalidViewport);
      errors.push({operation:'invalid viewport',expected:0x501,actual:call('glGetError',[])});
    }
    call('glDisable',[0x0c11]);
    call('glClearColor',[0,0,0,1],true); call('glClear',[0x4000]);
    if(c.scissor) {call('glScissor',c.scissor);call('glEnable',[0x0c11]);}
    call('glPointSize',[c.size || 1],true);
    if(c.invalidSize!==undefined) {
      call('glPointSize',[c.invalidSize],true);
      errors.push({operation:'invalid point size',expected:0x501,actual:call('glGetError',[])});
    }
    const f=new Float32Array(memory.buffer,vertex,15); f.fill(0);
    f.set(c.point.slice(0,3)); f.set([1,1,1,1],3); f[14]=c.point[3];
    e.gl_sw_emit_packed(vertex,1,0);
    const entry=e.gl_sw_entry()>>>0, dv=new DataView(memory.buffer);
    assert(entry,'real software target');
    assert.equal(dv.getUint16(entry+12,true),W); assert.equal(dv.getUint16(entry+14,true),H);
    assert.equal(dv.getUint16(entry+16,true),32);
    const pitch=dv.getUint16(entry+18,true),dib=dv.getUint32(entry+20,true);
    const rgba=[];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
      const word=dv.getUint32(dib+y*pitch+x*4,true);
      rgba.push([(word>>>16)&255,(word>>>8)&255,word&255,word>>>24]);
    }
    // Retain exact values so a nonbinary raster result cannot masquerade as clear.
    const invalid=rgba.filter(p=>p[3]!==255 || !([0,0,0].every((v,i)=>p[i]===v)||[255,255,255].every((v,i)=>p[i]===v)));
    errors.push({operation:'remaining GL error',expected:0,actual:call('glGetError',[])});
    frames.push({name:c.name,pixels:rgba.map(p=>Number(p[0]===255)),rgba,invalidColours:invalid,errors});
  }
  // The shared positive-width validator also preserves the line contract.
  const query=e.guest_alloc(16)>>>0,queryWa=e.guest_to_wasm(query)>>>0;
  call('glLineWidth',[2],true);
  for(const invalid of [0,-2]) {
    call('glLineWidth',[invalid],true);
    assert.equal(call('glGetError',[]),0x501,'invalid line width reports GL_INVALID_VALUE');
    call('glGetFloatv',[0xb21,query]);
    assert.equal(new DataView(memory.buffer).getFloat32(queryWa,true),2,'invalid line width preserves retained width');
  }
  call('glLineWidth',[1],true);
  assert.equal(call('wglMakeCurrent',[0,0]),1);
  assert.equal(call('wglDeleteContext',[context]),1);
  return {frames,moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex'),backend:'native WAT software'};
}

async function main() {
  const result=checkOracle();
  if(!process.argv.includes('--oracle-only') && !process.argv.includes('--compare-json')) {
    const actual=await softwareFrames();
    if(process.env.GL_POINT_OUTPUT)fs.writeFileSync(process.env.GL_POINT_OUTPUT,JSON.stringify(actual,null,2)+'\n');
    // A diagnostic execution retains all actual frames, then fails on its first mismatch.
    actual.frames.forEach((frame,i)=>{
      checkFrame(cases[i],frame.pixels);
      assert.deepEqual(frame.invalidColours,[],frame.name+' exact black/white software pixels');
      for(const error of frame.errors)assert.equal(error.actual,error.expected,frame.name+' '+error.operation);
    });
    console.log(JSON.stringify({status:'PASS_SOFTWARE_FULL_PIXEL',...result,moduleSha256:actual.moduleSha256}));
    return;
  }
  if(process.argv.includes('--compare-json')) {
    const file=process.argv[process.argv.indexOf('--compare-json')+1];
    const actual=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(actual.frames.length,cases.length,'every independently specified case executed');
    actual.frames.forEach((frame,i)=>{assert.equal(frame.name,cases[i].name);checkFrame(cases[i],frame.pixels);});
    result.comparedFrames=actual.frames.length;
  }
  console.log(JSON.stringify({status:'PASS_AUTHORED_ORACLE_ONLY',...result,runtimeQualified:false}));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={W,H,cases,expectedPixels,checkOracle,checkFrame};
