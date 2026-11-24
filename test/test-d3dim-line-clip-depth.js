#!/usr/bin/env node
// Production x86 COM DrawPrimitive/DrawIndexedPrimitive -> WAT GPU stream ->
// actual compiled backend -> public Lock pixels. Offline; no app execution.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixture=require(path.join(root,'test/test-legacy-clipped-depth-fog'));
const base=require(path.join(root,'test/test-legacy-projected-webgl'));
const C=0xff0b1621,R=0xffe02030,G=0xff20c050,B=0xff3050e0;
// D16 round-to-nearest literals: .25 -> 16384, .75 -> 49151, 1 -> 65535.
const depthLiterals={'wholly near rejected':65535,'wholly far rejected':65535,
  'depth ownership order false':16384,'depth ownership order true':16384,
  'disabled depth':16384,'disabled zwrite':49151,'greater comparison':49151,
  'rejected segments leave depth clear':49151,'strip three vertices':16384};
function plan(){
  const segment=(a,b,color=R,extra={})=>({h:[a,b],color,zen:1,zwrite:1,zfunc:2,...extra});
  const near=segment([-.75,0,-.5,.75],[1.25,0,.5,1.25]);
  const far=segment([-1.25,0,.5,1.25],[2.25,0,2.5,2.25]);
  const both=segment([-.75,0,-.5,.75],[2.25,0,2.5,2.25]);
  const rejectNear=segment([-.75,0,-.5,.75],[.875,0,-.25,.875]);
  const rejectFar=segment([-2.5,0,3,2.5],[3,0,4,3]);
  const constant=(z,color,extra={})=>segment([-1,0,z,1],[1,0,z,1],color,{unitW:true,...extra});
  const occ=segment([-10/9,0,2/9,10/9],[10/9,0,2/9,10/9],G);
  const guards=(red,green=[],clear=[])=>[...red.map(x=>[x,16,R]),...green.map(x=>[x,16,G]),...clear.map(x=>[x,16,C])];
  const states=[
    {label:'near unequal W',layers:[near],clip:[[[19,16,0,1],[28,16,.4,.8]]],pixels:guards([21,24,26],[],[6,10,16])},
    {label:'far unequal W',layers:[far],clip:[[[4,16,.4,.8],[24.25,16,1,.5]]],pixels:guards([6,12,20],[],[26])},
    {label:'both planes unequal W',layers:[both],clip:[[[13,16,0,1],[26.5,16,1,.5]]],pixels:guards([15,19,24],[],[6,10])},
    {label:'wholly near rejected',layers:[rejectNear],clip:[[]],pixels:guards([],[],[6,12,20,26]),allClear:true},
    {label:'wholly far rejected',layers:[rejectFar],clip:[[]],pixels:guards([],[],[6,12,20,26]),allClear:true},
    ...[false,true].map(reverse=>({label:'near crossing depth order '+reverse,layers:reverse?[occ,near]:[near,occ],pixels:guards([21,22],[6,12,16,26])})),
    ...[false,true].map(reverse=>({label:'depth ownership order '+reverse,layers:reverse?[constant(.75,G),constant(.25,R)]:[constant(.25,R),constant(.75,G)],pixels:guards([6,12,20,26])})),
    {label:'disabled depth',layers:[constant(.25,R),constant(.75,G,{zen:0,zwrite:0})],pixels:guards([],[6,12,20,26])},
    {label:'disabled zwrite',layers:[constant(.25,R,{zwrite:0}),constant(.75,G)],pixels:guards([],[6,12,20,26])},
    {label:'greater comparison',layers:[constant(.25,R),constant(.75,G,{zfunc:5})],pixels:guards([],[6,12,20,26])},
    {label:'rejected segments leave depth clear',layers:[rejectNear,rejectFar,constant(.75,R)],pixels:guards([6,12,20,26])},
    {label:'strip three vertices',layers:[{...constant(.25,R),h:[[-1,0,.25,1],[0,0,.25,1],[1,0,.25,1]]}],pixels:guards([6,12,20,26])},
  ];
  return {viewport:[4,4,24,24],clear:C,states};
}
function source(){
  let s=fixture.fixtureSource();
  const block=(a,b,c)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,a);s=s.slice(0,i)+c+s.slice(j);};
  block('    const geometry=async state=>{','    const describe=async()=>{',`    const geometry=async state=>{
      const projection=identity.slice();if(!state.unitW)projection[11]=.5;
      await words(matrix,projection.map(bits));await ok(com('SetTransform7 projection',device,11,3,matrix));
      const order=config.indexed?state.h.map((_,i)=>state.h.length-1-i):state.h.map((_,i)=>i);
      for(let i=0;i<order.length;i++){
        const h=state.h[order[i]];
        await words(vertices+i*32,[bits(h[0]),bits(h[1]),bits(h[2]),0,state.color,0,0,0]);
      }
      const index=order.map((_,i)=>order.length-1-i);if(index.length%2)index.push(0);
      await words(indices,Array.from({length:index.length/2},(_,i)=>index[2*i]|(index[2*i+1]<<16)));
    };
    const setState=async state=>{
      for(const [id,v] of [[7,state.zen],[14,state.zwrite],[23,state.zfunc],[28,0],[22,1],[137,0]]){
        await ok(com('SetRenderState7 line',device,20,id,v));
        const g=await guard(4);await ok(com('GetRenderState7 line',device,21,id,g.p));await g.check();eq(await read(g.p),v,'state round trip');
      }
      await ok(com('unbind texture for lines',device,35,0,0));
    };
`);
  block('    const draw=async()=>{','    const preview=',`    const draw=async()=>{
      await words(viewport,[0,0,32,32,0,bits(1)]);await ok(com('full clear viewport',device,13,viewport));
      await ok(com('Clear7 color and depth',device,10,0,0,3,config.clear,bits(1),0));
      await words(viewport,[...config.viewport,0,bits(1)]);await ok(com('offset viewport',device,13,viewport));
      await ok(com('BeginScene7',device,5));
      for(const layer of evidence.currentState.layers){
        await setState(layer);await geometry(layer);
        await ok(config.indexed?com('DrawIndexedPrimitive7',device,26,config.primitive,0x1e2,vertices,layer.h.length,indices,layer.h.length,0)
          :com('DrawPrimitive7',device,25,config.primitive,0x1e2,vertices,layer.h.length,0));drawCount++;
      }
      await ok(com('EndScene7',device,6));
    };
`);
  block('    const observe=async(','    if(config.immediate){',`    const observe=async state=>{
      const l=await lock(rt),pixels=[];
      for(let y=0;y<32;y++)for(let x=0;x<32;x++)pixels.push(await read(l.pointer+y*l.pitch+x*4));
      await unlock(rt);
      const guards=state.pixels.slice();
      // Exact raw color words on a complete unchanged two-pixel perimeter,
      // and both rows adjacent to the authored horizontal line.
      for(let y=0;y<32;y++)for(let x=0;x<32;x++)
        if(state.allClear||x<2||x>29||y<2||y>29||y===14||y===18)guards.push([x,y,config.clear]);
      const failures=guards.filter(([x,y,want])=>pixels[y*32+x]!==want).map(([x,y,want])=>({x,y,want,got:pixels[y*32+x]}));
      const row={label:state.label,pixels,guards:guards.length,failures};
      evidence.observations.push(row);

    };
`);
  block('    for(const state of config.states){\n      evidence.currentState=state;','    await com(\'Release depth Surface7\'',`    for(const state of config.states){evidence.currentState=state;await draw();await observe(state);}
`);
  // Wholly rejected draws are valid successful public calls without records.
  s=s.replace("eq(evidence.stats.drawCalls,drawCount-declined-pointDraws-(config.generatedOmitted||0),'every draw reached the WAT GPU producer');", "check(evidence.stats.drawCalls<=drawCount,'bounded producer draws');");
  return s;
}
async function run(wasm,indexed,primitive){
  const bytes=fs.readFileSync(wasm),context=require(path.join(root,'test/test-legacy-texture-rendered-contract')).offlineContext(bytes);
  const GS=require(path.join(root,'lib/gpu-stream')),Base=require(path.join(root,'lib/gpu-stream-software')).Executor,records=[],depthRecords=[];
  context.GpuStreamSoftware={Executor:class extends Base{execute(rec){
    if(rec.op===GS.OP.DRAW_UP){
      const f=rec.fields,b=GS.drawBytes(rec,f,id=>this.res.get(id).bytes,m=>{throw Error(m);}),d=new DataView(b.vertices.buffer,b.vertices.byteOffset,b.vertices.byteLength);
      records.push({label:context.legacyTextureEvidence.currentState.label,raster:{...this.raster},fields:{...f},
        vertices:Array.from({length:f.vcount},(_,i)=>Array.from({length:5},(_,c)=>c===4?d.getUint32(i*f.stride+16,true):d.getFloat32(i*f.stride+c*4,true)))});
    }
    const result=super.execute(rec);
    if(rec.op===GS.OP.READBACK&&this.res.get(rec.fields.rt)?.kind===GS.KIND.RT){
      // The legacy producer has a private render-target depth attachment.
      // Observe its actual compiled backend storage after the color fence;
      // a public Lock of the separately attached DDraw D16 DIB is not it.
      const surfaces=[...this.native.depthSurfaces.values()];assert(surfaces.length<=1);
      const d=surfaces[0];this.native.idle();
      depthRecords.push({label:context.legacyTextureEvidence.currentState.label,
        words:d?Array.from(new Float32Array(this.native.memory(),d.wa,32*32),v=>Math.round(v*65535)):null});
    }
    return result;
  }}};
  const cfg={...base.config(),...plan(),indexed,primitive,noPreview:true,queued:false,immediate:false};
  // The explicitly named three-vertex strip case applies only to LINESTRIP.
  // LINELIST correctly consumes only its first pair, leaving the odd tail.
  if(primitive===2)cfg.states=cfg.states.filter(s=>s.label!=='strip three vertices');
  let error=null;try{await vm.runInContext('('+source()+')',context)('gps',cfg,'()=>null');}catch(e){error=e.stack;}
  const evidence=JSON.parse(JSON.stringify(context.legacyTextureEvidence));
  return {wasmSHA256:sha(bytes),fixtureSHA256:sha(source()),indexed,primitive,error,records,depthRecords,...evidence};
}

// Independent interval clipping in authored homogeneous coordinates. These
// calculations validate the preselected literal intersections, never pixels
// from a renderer or a production helper.
function clipExpected(h){
  let lo=0,hi=1;const [a,b]=h;
  for(const f of [v=>v[2],v=>v[3]-v[2]]){
    const da=f(a),db=f(b);
    if(da<0&&db<0)return [];
    if((da<0)!==(db<0)){const t=da/(da-db);if(da<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}
  }
  if(lo>hi)return [];
  return [lo,hi].map(t=>{const v=a.map((x,i)=>x+t*(b[i]-x));return [16+12*v[0]/v[3],16-12*v[1]/v[3],v[2]/v[3],1/v[3]];});
}
function near(a,b,label){assert.equal(a.length,b.length,label);for(let i=0;i<a.length;i++)assert(Math.abs(a[i]-b[i])<1e-5,label+' '+a+' != '+b);}
function verify(r){
  assert.equal(r.error,null);assert.equal(r.status,'PASS');
  const states=plan().states.filter(s=>r.primitive===3||s.label!=='strip three vertices');
  assert.equal(r.observations.length,states.length);
  for(const o of r.observations){
    assert.deepEqual(o.failures,[],'raw color guards '+o.label);
    const depth=r.depthRecords.filter(d=>d.label===o.label);assert.equal(depth.length,1);
    assert(depth[0].words,'actual render-target depth storage exists');
    o.depthGuards=0;
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const edge=x<2||x>29||y<2||y>29,literal=depthLiterals[o.label];
      if(edge||(y===16&&[6,12,20,26].includes(x)&&literal!==undefined)){
        o.depthGuards++;assert.equal(depth[0].words[y*32+x],edge?65535:literal,'actual backend D16 '+o.label+' '+x+','+y);
      }
    }
  }
  assert.equal(r.stats.drawCalls,r.primitive===2?18:19);
  assert.equal(r.stats.readbacks,states.length);assert.equal(r.stats.fallbacks,0);assert.equal(r.stats.declined,0);
  for(const state of states.filter(s=>s.clip)){
    const records=r.records.filter(v=>v.label===state.label),want=state.clip[0];
    if(!want.length){assert.equal(records.length,0,'rejected segment emits no draw '+state.label);continue;}
    assert.equal(records.length,1);const rec=records[0];assert.equal(rec.vertices.length,2);
    for(let i=0;i<2;i++){near(rec.vertices[i].slice(0,4),want[i],'captured clip '+state.label);assert.equal(rec.vertices[i][4],state.layers[0].color);}
    assert.equal(rec.raster.depth_mode,1);assert.equal(rec.raster.zwrite,1);assert.equal(rec.raster.zfunc,2);
  }
  for(const rec of r.records){
    assert(rec.vertices.every(v=>v[2]>=0&&v[2]<=1),'no out-of-range device depth');
    if(rec.label==='disabled depth'&&rec===r.records.filter(v=>v.label===rec.label).at(-1))assert.equal(rec.raster.depth_mode,0);
  }
  return {indexed:r.indexed,primitive:r.primitive,pixelGuards:r.observations.reduce((n,o)=>n+o.guards,0),depthGuards:r.observations.reduce((n,o)=>n+o.depthGuards,0),scenes:states.length,wasmSHA256:r.wasmSHA256};
}
async function main(){
  for(const s of plan().states.filter(s=>s.clip)){
    const calculated=clipExpected(s.layers[0].h),literal=s.clip[0];assert.equal(calculated.length,literal.length);
    for(let i=0;i<literal.length;i++)near(calculated[i],literal[i],'independent homogeneous literal '+s.label);
  }
  const pinned=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7)||process.env.WINE_ASSEMBLY_WASM;
  const files=pinned?[pinned]:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'];
  const output=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
  if(output)fs.mkdirSync(output,{recursive:true});
  const summary=[];
  for(const wasm of files)for(const indexed of [false,true])for(const primitive of [2,3]){
    const r=await run(wasm,indexed,primitive);
    if(output)fs.writeFileSync(path.join(output,path.basename(wasm)+'-'+indexed+'-'+primitive+'.json'),JSON.stringify(r));
    summary.push(verify(r));console.log('PASS '+JSON.stringify(summary.at(-1)));
  }
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,source,run,verify,clipExpected};
