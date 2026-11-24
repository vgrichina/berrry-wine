#!/usr/bin/env node
// Full production x86 COM direct/indexed POINTLIST -> actual compiled backend
// and public Lock. Literal clipping, complete color and backend depth guards.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const line=require(path.join(root,'test/test-d3dim-line-clip-depth'));
const base=require(path.join(root,'test/test-legacy-projected-webgl'));
const C=0xff0b1621,R=0xffe02030,G=0xff20c050,B=0xff3050e0,Y=0xffd0c030,M=0xffa030c0;
function plan(){
  const states=[],layer=(h,colors,extra={})=>({h,colors,unitW:true,zen:1,zwrite:1,zfunc:4,projected:true,...extra});
  // Literal authored homogeneous positions. For varying W, projection is
  // w=1+.5*z; x/y were chosen independently for screen centres 8..24, y=12.
  const groups=[
    {name:'unit W',h:[[-2/3,1/3,-.25,1],[-1/3,1/3,0,1],[0,1/3,.25,1],[1/3,1/3,1,1],[2/3,1/3,1.25,1]],xs:[8,12,16,20,24],zs:[0,0,16384,65535,65535],inside:[1,2,3],colors:[R,G,B,Y,M],unitW:true},
    {name:'unequal W',h:[[-.5,.25,-.5,.75],[-1/3,1/3,0,1],[0,5/12,.5,1.25],[2/3,2/3,2,2],[1.5,.75,2.5,2.25]],xs:[8,12,16,20,24],zs:[0,0,26214,65535,65535],inside:[1,2,3],colors:[R,G,B,Y,M],unitW:false},
    {name:'finite boundaries',h:[[-5/6,1/3,-1/1024,1],[-.5,1/3,0,1],[-1/6,1/3,1/1024,1],[1/6,1/3,1023/1024,1],[.5,1/3,1,1],[5/6,1/3,1025/1024,1]],xs:[6,10,14,18,22,26],zs:[0,0,64,65471,65535,65535],inside:[1,2,3,4],colors:[R,G,B,Y,M,R],unitW:true},
  ];
  for(const g of groups)for(const projected of [false,true])for(const zen of [0,1]){
    const indices=zen||projected?g.inside:g.xs.map((_,i)=>i);
    states.push({label:`${g.name}/projected${projected}/depth${zen}`,layers:[layer(g.h,g.colors,{unitW:g.unitW,projected,zen})],
      expected:indices.map(i=>[g.xs[i],12,2,2,g.colors[i],zen?g.zs[i]:65535])});
  }
  const p=(z,color,extra={})=>layer([[0,0,z,1]],[color],extra);
  for(const reverse of [false,true])states.push({label:'depth order '+reverse,layers:reverse?[p(.75,G),p(.25,R)]:[p(.25,R),p(.75,G)],expected:[[16,16,2,2,R,16384]]});
  states.push({label:'disabled depth overwrite',layers:[p(.25,R),p(.75,G,{zen:0})],expected:[[16,16,2,2,G,16384]]});
  states.push({label:'disabled zwrite',layers:[p(.25,R,{zwrite:0}),p(.75,G)],expected:[[16,16,2,2,G,49151]]});
  states.push({label:'greater comparison',layers:[p(.25,R),p(.75,G,{zfunc:5})],expected:[[16,16,2,2,G,49151]]});
  for(const projected of [false,true])for(const zen of [0,1])states.push({label:`wholly rejected/projected${projected}/depth${zen}`,
    layers:[layer([[-.5,0,-.25,1],[.5,0,1.25,1]],[R,G],{projected,zen})],
    expected:zen||projected?[]:[[10,16,2,2,R,65535],[22,16,2,2,G,65535]]});
  // Existing 2x2 viewport footprint: clip its rectangle at x/y=28.
  states.push({label:'viewport edges',layers:[layer([[-1,1,.25,1],[11/12,-11/12,.25,1],[1,-1,.25,1]],[R,G,B])],
    expected:[[4,4,2,2,R,16384],[27,27,1,1,G,16384]]});
  return {viewport:[4,4,24,24],clear:C,states};
}
function source(){
  let s=line.source().replace('const guards=state.pixels.slice();','const guards=[];');
  s=s.replace('0,state.color,0,0,0','0,state.colors[order[i]],0,0,0');
  s=s.replace("await ok(com('unbind texture for lines',device,35,0,0));", "await ok(com('unbind texture for points',device,35,0,0));await tss(11,0);await tss(24,state.projected?0x103:0);");
  // Allocate the producer's private depth attachment through a public draw,
  // so even the first disabled-depth scene can inspect actual storage.
  s=s.replace('    for(const state of config.states){evidence.currentState=state;await draw();await observe(state);}',
    "    evidence.currentState={label:'depth allocation warmup',layers:[config.states.find(s=>s.label==='depth order false').layers[0]]};await draw();\n    for(const state of config.states){evidence.currentState=state;await draw();await observe(state);}");
  return s;
}
async function run(wasm,indexed){
  const input=fs.readFileSync(wasm),bytes=wasm.endsWith('.gz')?zlib.gunzipSync(input):input,context=require(path.join(root,'test/test-legacy-texture-rendered-contract')).offlineContext(bytes);
  const GS=require(path.join(root,'lib/gpu-stream')),Base=require(path.join(root,'lib/gpu-stream-software')).Executor,records=[],depthRecords=[];
  context.GpuStreamSoftware={Executor:class extends Base{execute(rec){
    if(rec.op===GS.OP.DRAW_UP){const f=rec.fields,b=GS.drawBytes(rec,f,id=>this.res.get(id).bytes,m=>{throw Error(m);}),d=new DataView(b.vertices.buffer,b.vertices.byteOffset,b.vertices.byteLength);
      records.push({label:context.legacyTextureEvidence.currentState.label,raster:{...this.raster},fields:{...f},vertices:Array.from({length:f.vcount},(_,i)=>[d.getFloat32(i*f.stride,true),d.getFloat32(i*f.stride+4,true),d.getFloat32(i*f.stride+8,true),d.getUint32(i*f.stride+16,true)])});}
    const result=super.execute(rec);
    if(rec.op===GS.OP.READBACK&&this.res.get(rec.fields.rt)?.kind===GS.KIND.RT){const surfaces=[...this.native.depthSurfaces.values()];assert(surfaces.length<=1);const d=surfaces[0];this.native.idle();
      depthRecords.push({label:context.legacyTextureEvidence.currentState.label,words:d?Array.from(new Float32Array(this.native.memory(),d.wa,1024),v=>Math.round(v*65535)):null});}
    return result;
  }}};
  const cfg={...base.config(),...plan(),indexed,primitive:1,noPreview:true,queued:false,immediate:false};
  let error=null;try{await vm.runInContext('('+source()+')',context)('gps',cfg,'()=>null');}catch(e){error=e.stack;}
  const evidence=JSON.parse(JSON.stringify(context.legacyTextureEvidence));
  return {wasmSHA256:sha(bytes),fixtureSHA256:sha(source()),indexed,error,records,depthRecords,...evidence};
}
function inspect(r){
  const failures=[];if(r.error)failures.push({error:r.error});
  assert.equal(r.status,'PASS');assert.equal(r.stats.fallbacks,0);assert.equal(r.stats.declined,0);
  assert(r.calls.filter(c=>c.label===(r.indexed?'DrawIndexedPrimitive7':'DrawPrimitive7')).length>22,'actual x86 public COM draws');
  for(const s of plan().states){
    const o=r.observations.find(o=>o.label===s.label),d=r.depthRecords.find(o=>o.label===s.label);
    if(!o||!d){failures.push({label:s.label,missing:true});continue;}
    assert.equal(d.words?.length,1024,'actual backend depth attachment '+s.label);
    const colors=Array(1024).fill(C),depth=Array(1024).fill(65535);
    for(const [x,y,w,h,c,z] of s.expected)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){colors[j*32+i]=c;depth[j*32+i]=z;}
    for(let i=0;i<1024;i++){
      if(o.pixels[i]!==colors[i])failures.push({label:s.label,kind:'color',x:i%32,y:i>>5,want:colors[i],got:o.pixels[i]});
      if(d.words[i]!==depth[i])failures.push({label:s.label,kind:'depth',x:i%32,y:i>>5,want:depth[i],got:d.words[i]});
    }
  }
  return {indexed:r.indexed,scenes:plan().states.length,colorGuards:plan().states.length*1024,depthGuards:plan().states.length*1024,failures};
}
async function main(){
  const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
  if(out)fs.mkdirSync(out,{recursive:true});const summaries=[];
  for(const file of wasm?[wasm]:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'])for(const indexed of [false,true]){
    const r=await run(file,indexed),v={wasmSHA256:r.wasmSHA256,...inspect(r)};
    if(out)fs.writeFileSync(path.join(out,path.basename(file)+'-raw-'+indexed+'.json.gz'),zlib.gzipSync(JSON.stringify(r)));
    summaries.push(v);console.log(JSON.stringify({...v,failures:v.failures.length,examples:v.failures.slice(0,8)}));}
  if(out)fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summaries,null,2));if(summaries.some(v=>v.failures.length))process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,source,run,inspect};
