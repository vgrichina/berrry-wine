#!/usr/bin/env node
'use strict';
const {ownedAnswer,ownedWindow}=require('./helpers/gl-owned-host');

// Literal complete 8x8 frames frozen before implementation changes. GL 2.1
// sections 2.6, 2.14.7, 3.4.1 and 3.5.1; independent system OpenGL witnesses
// retained in the point-raster predecessor run. No encoder defines this oracle.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const W=8,H=8;
const palette={'.':[0,0,0,255],R:[255,0,0,255],W:[255,255,255,255]};
const fanRows=['RRRR....','RRRW....','RRRW....','RRWW....',
  'RRWW....','RWWW....','RWWW....','WWWW....'];
const edgeRows=['........','WWWWW...','W.......','W.......',
  'W.......','W.......','W.......','WWWW....'];
const fanVertices=[[-1,-1,0,1],[0,-1,0,1],[0,1,0,1],[-1,1,0,1]];
const edgeVertices=[[-.875,-.875,0,1],[.125,-.875,0,1],
  [.125,.625,0,1],[-.875,.625,0,1]];
const red=[1,0,0,1],white=[1,1,1,1];
// Continuous CCW area .18; rounded integer vertices collapse to area zero.
// The sole covered center (.5,.5) is strictly inside all three edges.
const subpixelVertices=[[.10,.25],[.20,.10],[.90,.85]].map(([x,y])=>[x/4-1,y/4-1,0,1]);
const subpixelRows=['........','........','........','........','........','........','........','W.......'];
const clearRows=Array(8).fill('........');
// Frozen separately before production edits, then independently matched by
// system EGL/libGL. R/G are planar across both triangles; W is exactly one.
const gradientRGBA=[
  [16,239,0,255],[48,239,0,255],[80,239,0,255],[112,239,0,255],[143,239,0,255],[175,239,0,255],[207,239,0,255],[239,239,0,255],
  [16,207,0,255],[48,207,0,255],[80,207,0,255],[112,207,0,255],[143,207,0,255],[175,207,0,255],[207,207,0,255],[239,207,0,255],
  [16,175,0,255],[48,175,0,255],[80,175,0,255],[112,175,0,255],[143,175,0,255],[175,175,0,255],[207,175,0,255],[239,175,0,255],
  [16,143,0,255],[48,143,0,255],[80,143,0,255],[112,143,0,255],[143,143,0,255],[175,143,0,255],[207,143,0,255],[239,143,0,255],
  [16,112,0,255],[48,112,0,255],[80,112,0,255],[112,112,0,255],[143,112,0,255],[175,112,0,255],[207,112,0,255],[239,112,0,255],
  [16,80,0,255],[48,80,0,255],[80,80,0,255],[112,80,0,255],[143,80,0,255],[175,80,0,255],[207,80,0,255],[239,80,0,255],
  [16,48,0,255],[48,48,0,255],[80,48,0,255],[112,48,0,255],[143,48,0,255],[175,48,0,255],[207,48,0,255],[239,48,0,255],
  [16,16,0,255],[48,16,0,255],[80,16,0,255],[112,16,0,255],[143,16,0,255],[175,16,0,255],[207,16,0,255],[239,16,0,255],
];
const cases=[
  {name:'fan-flat',mode:6,flat:true,vertices:fanVertices,
    colors:[red,red,white,red],rows:fanRows},
  {name:'fan-flat-projective',mode:6,flat:true,
    vertices:fanVertices.map(v=>v.map(x=>x*2)),colors:[red,red,white,red],rows:fanRows},
  {name:'fan-flat-varying-w',mode:6,flat:true,
    vertices:fanVertices.map((v,i)=>v.map(x=>x*(2**i))),
    colors:[red,red,white,red],rows:fanRows},
  {name:'edge-smooth',mode:7,flat:false,vertices:edgeVertices,
    colors:[white,white,white,white],edgeFlags:[1,0,1,1],polygonMode:0x1b01,rows:edgeRows},
  {name:'edge-flat',mode:7,flat:true,vertices:edgeVertices,
    colors:[red,red,red,white],edgeFlags:[1,0,1,1],polygonMode:0x1b01,rows:edgeRows},
  {name:'edge-smooth-varying-w',mode:7,flat:false,
    vertices:edgeVertices.map((v,i)=>v.map(x=>x*(2**i))),
    colors:[white,white,white,white],edgeFlags:[1,0,1,1],polygonMode:0x1b01,rows:edgeRows},
  {name:'edge-smooth-translated',mode:7,flat:false,
    vertices:edgeVertices.map(v=>[v[0]+.25,v[1],v[2],v[3]]),
    colors:[white,white,white,white],edgeFlags:[1,0,1,1],polygonMode:0x1b01,
    rows:edgeRows.map(row=>'.'+row.slice(0,7))},
  {name:'fan-smooth-planar-gradient',mode:6,flat:false,
    vertices:[[-1,-1,0,1],[1,-1,0,1],[1,1,0,1],[-1,1,0,1]],
    colors:[[0,0,0,1],[1,0,0,1],[1,1,0,1],[0,1,0,1]],rgba:gradientRGBA},
];
for(const [name,vertices,frontFace,rows] of [
  ['ccw-back',subpixelVertices,0x901,subpixelRows],
  ['cw-back',subpixelVertices.slice().reverse(),0x901,clearRows],
  ['ccw-back-cw-front',subpixelVertices,0x900,clearRows],
  ['cw-back-cw-front',subpixelVertices.slice().reverse(),0x900,subpixelRows],
]) cases.push({name:'subpixel-'+name,mode:4,flat:false,vertices,
  colors:[white,white,white],cullFace:0x405,frontFace,rows});
function expected(c){
  if(c.rgba){
    assert.equal(c.rgba.length,W*H);
    assert(c.rgba.every(p=>p.length===4&&p.every(v=>Number.isInteger(v)&&v>=0&&v<=255)));
    return c.rgba.map(p=>p.slice());
  }
  assert.equal(c.rows.length,H);assert(c.rows.every(row=>row.length===W));
  return c.rows.join('').split('').map(p=>{assert(palette[p]);return palette[p].slice();});
}
function checkFrame(c,rgba){assert.deepEqual(rgba,expected(c),c.name+' all 64 exact RGBA pixels');}
function checkOracle(){
  for(const c of cases)expected(c);
  // Independently classify exact fragment centers on the two fan triangles.
  // The common edge is x=windowY/2; none of these centers lies on that edge.
  const geometric=[];
  for(let row=0;row<H;row++)for(let col=0;col<W;col++){
    const centerX=col+.5,centerY=H-row-.5;
    geometric.push(centerX>=4?palette['.']:centerX>=centerY/2?palette.W:palette.R);
  }
  assert.deepEqual(expected(cases[0]),geometric,'fan literals classify actual fragment centers');
  const fan=expected(cases[0]);fan[7*W]=palette.R;
  assert.throws(()=>checkFrame(cases[0],fan),'reported red fan fragment must fail');
  const edgeCase=cases.find(c=>c.name==='edge-smooth');
  const edge=expected(edgeCase);edge[7*W]=palette['.'];
  assert.throws(()=>checkFrame(edgeCase,edge),'reported missing left edge must fail');
  const extra=expected(edgeCase);extra[4*W+4]=palette.W;
  assert.throws(()=>checkFrame(edgeCase,extra),'suppressed right boundary must stay clear');
  const diagonal=expected(edgeCase);diagonal[4*W+2]=palette.W;
  assert.throws(()=>checkFrame(edgeCase,diagonal),'triangulation diagonal must stay clear');
  const gradientCase=cases.find(c=>c.name==='fan-smooth-planar-gradient');
  const gradient=expected(gradientCase);gradient[7][0]=255;
  assert.throws(()=>checkFrame(gradientCase,gradient),'clamped span endpoint must not distort a covered color');
  return {literalCases:cases.length,pixelsPerFrame:64,negativeControls:5};
}
async function softwareFrames(){
  const {bootRenderHarness}=require('./render-helper');
  const {CALL_INDEX}=require('../lib/gl-command-stream');
  const Stream=require('../lib/gl-command-stream');
  const bytes=fs.readFileSync(process.env.WINE_TEST_WASM||'build/wine-assembly.wasm');
  let memory;
  const h=await bootRenderHarness({prebuiltModule:new WebAssembly.Module(bytes),fonts:'none',width:W,height:H,
    extraHostOverrides:{gpu_gl_call(op,at,bytes){
      if(op===0x20005)return 0; // Exercise actual synchronous WAT software fallback.
      assert.equal(op,Stream.WAT_STREAM_FLUSH_OPCODE);
      return ownedAnswer(memory,at,bytes);
    }}});
  memory=h.memory;const e=h.exports;
  e.init_thread(1,0x400000,0,0,0,0,0,0);e.heap_init(0x800000);
  
  const stack=e.guest_to_wasm(e.guest_alloc(128));
  function call(name,values=[],floats=false,aux=0){
    new Uint32Array(memory.buffer,stack,32).fill(0);
    (floats?new Float32Array(memory.buffer,stack,32):new Int32Array(memory.buffer,stack,32)).set(values,1);
    return e.gl_wat_encoder_call(CALL_INDEX[name],stack,aux);
  }
  ownedWindow(e,42,W,H);
  const context=call('wglCreateContext',[],false,42);assert(context);
  assert.equal(call('wglMakeCurrent',[0,context],false,42),1);
  e.gl_sw_set_enabled(1);e.gl_sw_set_default_size(W,H);
  for(const mode of [0x1700,0x1701]){call('glMatrixMode',[mode]);call('glLoadIdentity');}
  const frames=[];
  try{
    for(const c of cases){
      call('glViewport',[0,0,W,H]);call('glPolygonMode',[0x408,c.polygonMode||0x1b02]);
      call('glDisable',[0xb44]);
      if(c.cullFace){call('glEnable',[0xb44]);call('glCullFace',[c.cullFace]);call('glFrontFace',[c.frontFace]);}
      call('glShadeModel',[c.flat?0x1d00:0x1d01]);call('glClearColor',[0,0,0,1],true);call('glClear',[0x4000]);
      call('glBegin',[c.mode]);
      c.vertices.forEach((v,i)=>{
        call('glColor4f',c.colors[i],true);call('glEdgeFlag',[c.edgeFlags?.[i]??1]);call('glVertex4f',v,true);
      });call('glEnd');call('glFinish');
      const entry=e.gl_sw_entry()>>>0,dv=new DataView(memory.buffer);assert(entry);
      assert.equal(dv.getUint16(entry+12,true),W);assert.equal(dv.getUint16(entry+14,true),H);
      assert.equal(dv.getUint16(entry+16,true),32);
      const pitch=dv.getUint16(entry+18,true),dib=dv.getUint32(entry+20,true),rgba=[];
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const p=dv.getUint32(dib+y*pitch+x*4,true);rgba.push([(p>>>16)&255,(p>>>8)&255,p&255,p>>>24]);
      }
      frames.push({name:c.name,rgba,error:call('glGetError')});
    }
  }finally{
    assert.equal(call('wglMakeCurrent',[0,0]),1);assert.equal(call('wglDeleteContext',[context]),1);
  }
  return {frames,moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex'),backend:'native WAT software'};
}
async function main(){
  const oracle=checkOracle();
  if(process.argv.includes('--oracle-only')){console.log(JSON.stringify({status:'PASS_AUTHORED_ORACLE_ONLY',...oracle,runtimeQualified:false}));return;}
  if(process.argv.includes('--inputs-only')){
    console.log(JSON.stringify(cases.map(({rows,rgba,...c})=>c)));return;
  }
  let actual;
  if(process.argv.includes('--compare-json'))actual=JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--compare-json')+1],'utf8'));
  else actual=await softwareFrames();
  if(process.env.GL_FAN_EDGE_OUTPUT)fs.writeFileSync(process.env.GL_FAN_EDGE_OUTPUT,JSON.stringify(actual,null,2)+'\n');
  assert.equal(actual.frames.length,cases.length);
  actual.frames.forEach((frame,i)=>{assert.equal(frame.name,cases[i].name);checkFrame(cases[i],frame.rgba);if(frame.error!==undefined)assert.equal(frame.error,0);});
  console.log(JSON.stringify({status:'PASS_FULL_PIXEL',...oracle,moduleSha256:actual.moduleSha256}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={W,H,cases,expected,checkFrame,checkOracle};
