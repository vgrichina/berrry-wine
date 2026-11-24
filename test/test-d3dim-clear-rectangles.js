#!/usr/bin/env node
'use strict';
// Full shipped modules, x86 public COM calls, guarded public Lock and the
// actual GPU stream software executor. No extra WAT exports or clear mocks.
// Microsoft DX6 SDK (archived Microsoft-authored reference):
// https://library.thedatadungeon.com/directx6/devdoc/live/directx/imref_9qg5.content.htm
// https://library.thedatadungeon.com/directx6/devdoc/live/directx/imref_7fl1.content.htm
// Both specify screen rectangles clipped to the viewport. Neither specifies
// count-zero or invalid-pointer behavior. Zero-count cases below preserve our
// existing full-viewport behavior; they are NOT a Windows compatibility claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixture=require('./test-legacy-texture-rendered-contract'),depth=require('./test-d3dim-viewport-depth-clear'),base=require('./test-legacy-projected-webgl');
// Frozen literal masks authored independently of the implementation. Each
// row describes x=0..7; the rest of the 32x32 target is untouched. Half-open
// edges, viewport [2,1,4,5]. No production clipping helper supplies expectations.
const EMPTY=['........','........','........','........','........','........','........','........'];
const FULL=['........','..####..','..####..','..####..','..####..','..####..','........','........'];
const CASES=[
  {name:'disjoint',rects:[[0,0,3,3],[5,4,9,8]],mask:['........','..#.....','..#.....','........','.....#..','.....#..','........','........']},
  {name:'overlap',rects:[[1,0,5,4],[3,2,7,7]],mask:['........','..###...','..####..','..####..','...###..','...###..','........','........']},
  {name:'outside',rects:[[-8,-9,1,6],[7,1,10,6],[2,7,6,9]],mask:EMPTY},
  {name:'negative clipped',rects:[[-3,-2,4,3]],mask:['........','..##....','..##....','........','........','........','........','........']},
  {name:'viewport clipped',rects:[[0,0,32,32]],mask:FULL},
  {name:'empty and reversed',rects:[[4,4,4,6],[5,5,3,6],[2,4,4,2]],mask:EMPTY},
  {name:'signed extremes',rects:[[-2147483648,-2147483648,2147483647,2147483647]],mask:FULL},
  {name:'count bounds array',rects:[[2,1,3,2],[0,0,32,32]],count:1,mask:['........','..#.....','........','........','........','........','........','........']},
  {name:'zero count nonnull preservation',rects:[[0,0,1,1]],count:0,mask:FULL},
  {name:'zero count null preservation',rects:[],count:0,mask:FULL},
];
function plan(){return ['clear','clear2'].flatMap(method=>[false,true].flatMap(owned=>[16,32].flatMap(format=>[1,2,3].map(flags=>({method,owned,format,flags})))));}
function source(){
  let s=depth.source();
  const first=s.indexOf('    await setViewport([0,0,32,32]);'),last=s.indexOf('  }finally{',first);assert(first>0&&last>first);
  s=s.slice(0,first)+`
    for(const item of config.cases){
      await setViewport([0,0,32,32]);
      await ok(com('Clear7 reset',device,10,0,0,3,C,bits(.25),0));
      if(config.scene.owned){await draw(C,.25);await ok(com('Clear7 owned reset',device,10,0,0,3,C,bits(.25),0));}
      evidence.phase=item.name+' initial';await observe(evidence.phase);
      await setViewport([2,1,4,5]);
      const rect=await guard(Math.max(16,item.rects.length*16));
      if(item.rects.length)await words(rect.p,item.rects.flat());
      const before=[];for(let i=0;i<item.rects.length*4;i++)before.push(await read(rect.p+i*4));
      const count=item.count===undefined?item.rects.length:item.count,pointer=item.rects.length?rect.p:0;
      evidence.phase=item.name+' clear';
      if(config.scene.method==='clear2')await ok(com('Clear2 rectangles',vp,20,count,pointer,config.scene.flags,K,bits(.75),0));
      else await ok(com('Clear rectangles',vp,12,count,pointer,config.scene.flags));
      await rect.check();for(let i=0;i<before.length;i++)eq(await read(rect.p+i*4),before[i],'rectangle input unchanged');
      evidence.queued.push({label:evidence.phase,executed:(evidence.executed||[]).length});
      // Z-only work may be queued while color is clean. A degenerate public
      // draw makes Lock fence it without changing any target pixel.
      if(config.scene.owned)await draw(C,.5,true);
      await observe(item.name+' result');
    }
    evidence.stats={fallbacks:await raw('d3dim_gps_stat',1),declined:await raw('d3dim_gps_stat',14)};
    await com('DeleteViewport3',dev3,6,vp);
    for(const obj of [vp,dev3,d3d3,device,depth,texture,rt,padding,d3d,dd])await com('Release',obj,2);
    evidence.status='PASS';return evidence;
`+s.slice(last);
  s=s.replace('[84,32],\n        [88,0xff0000],[92,0xff00],[96,0xff]',
    '[84,config.scene.format===16&&caps===0x2840?16:32],\n        [88,config.scene.format===16&&caps===0x2840?0xf800:0xff0000],[92,config.scene.format===16&&caps===0x2840?0x7e0:0xff00],[96,config.scene.format===16&&caps===0x2840?0x1f:0xff]');
  s=s.replace('[[84,32],[88,0xff0000],[92,0xff00],[96,0xff]]',
    'config.scene.format===16?[[84,16],[88,0xf800],[92,0x7e0],[96,0x1f]]:[[84,32],[88,0xff0000],[92,0xff00],[96,0xff]]');
  s=s.replace('pixels.push(await read(l.pointer+y*l.pitch+x*4))',
    'pixels.push(config.scene.format===16?new DataView(memory.buffer).getUint16(await wa(l.pointer+y*l.pitch+x*2),true):await read(l.pointer+y*l.pitch+x*4))');
  assert(s.includes('[84,config.scene.format===16'),'surface format seam');
  return s;
}
async function run(wasm,scene){
  const raw=fs.readFileSync(wasm),bytes=wasm.endsWith('.gz')?zlib.gunzipSync(raw):raw,context=fixture.offlineContext(bytes);
  const GS=require('../lib/gpu-stream'),Base=require('../lib/gpu-stream-software').Executor,records=[],depthRecords=[];
  context.GpuStreamSoftware={Executor:class extends Base{execute(rec){
    const result=super.execute(rec),label=context.legacyTextureEvidence.phase;
    records.push({label,name:rec.name,fields:{...rec.fields}});context.legacyTextureEvidence.executed=records;
    if(rec.op===GS.OP.READBACK&&this.res.get(rec.fields.rt)?.kind===GS.KIND.RT){this.native.idle();const ds=[...this.native.depthSurfaces.values()];assert(ds.length<=1);
      depthRecords.push({label,words:ds[0]?Array.from(new Float32Array(this.native.memory(),ds[0].wa,1024),v=>Math.round(v*65535)):null});}
    return result;
  }}};
  let error=null;try{await vm.runInContext('('+source()+')',context)('gps',{...base.config(),scene,cases:CASES},'()=>null');}catch(e){error=e.stack;}
  return {scene,wasmSHA256:sha(bytes),fixtureSHA256:sha(source()),oracleSHA256:sha(JSON.stringify(CASES)),error,records,depthRecords,...JSON.parse(JSON.stringify(context.legacyTextureEvidence))};
}
function inspect(r){
  const failures=[];if(r.error)return {scene:r.scene,failures:[{error:r.error}]};
  assert.equal(r.status,'PASS');assert.equal(r.stats.fallbacks,0);assert.equal(r.stats.declined,0);
  assert.equal(r.calls.filter(c=>c.label===(r.scene.method==='clear'?'Clear rectangles':'Clear2 rectangles')).length,CASES.length);
  const {method,owned,format,flags}=r.scene,C=format===16?0x08a4:0xff0b1621,K=format===16?(method==='clear'?0xffff:0x42ac):(method==='clear'?0xffffffff:0xff445566);
  for(const item of CASES)for(const initial of [true,false]){
    const label=item.name+(initial?' initial':' result'),o=r.observations.find(o=>o.label===label),d=r.depthRecords.find(d=>d.label===label);
    assert(o,'public observation '+label);if(owned)assert(d?.words,'actual backend depth '+label);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const i=y*32+x,inside=!initial&&item.mask[y]?.[x]==='#',color=inside&&(flags&1)?K:C,z=inside&&(flags&2)?method==='clear'?65535:49151:owned?16384:16383;
      if(o.pixels[i]!==color)failures.push({label,kind:'color',x,y,want:color,got:o.pixels[i]});
      const got=owned?d.words[i]:o.depthWords[i];if(got!==z)failures.push({label,kind:owned?'executor depth':'public D16',x,y,want:z,got});
    }
  }
  if(owned){assert(r.records.some(r=>r.name==='CLEAR'),'actual executor CLEAR');assert(r.records.some(r=>r.name==='READBACK'),'actual executor READBACK');}
  return {scene:r.scene,cases:CASES.length,colorGuards:20480,depthGuards:20480,failures};
}
async function main(){
  const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
  if(process.argv.includes('--plan')){console.log(JSON.stringify({scenes:plan(),cases:CASES,oracleSHA256:sha(JSON.stringify(CASES))},null,2));return;}
  if(out)fs.mkdirSync(out,{recursive:true});const results=[];
  for(const f of wasm?[wasm]:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'])for(const scene of plan()){
    const r=await run(f,scene),v={wasmSHA256:r.wasmSHA256,...inspect(r)};results.push(v);
    if(out)fs.writeFileSync(path.join(out,path.basename(f)+'-'+scene.method+'-'+scene.owned+'-'+scene.format+'-'+scene.flags+'.json.gz'),zlib.gzipSync(JSON.stringify(r)));
    console.log(JSON.stringify({...v,failures:v.failures.length,examples:v.failures.slice(0,3)}));
  }
  if(out)fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(results,null,2));if(results.some(r=>r.failures.length))process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={plan,source,run,inspect,CASES};
