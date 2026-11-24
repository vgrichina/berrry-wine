#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto');
const previous=require('./test-legacy-variable-q-fog');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');

// Independent homogeneous near/far clipping, followed by screen barycentrics.
// Texture U,V,Q use rational interpolation; device Z and fog are affine.
function oracle(colors,scene,p,details=false){
  let winner=null,depth=1;
  for(const state of scene.layers){
    let poly=state.zs.map((z,i)=>{
      const w=state.geomW?1+.5*z:1,[x,y]=[[0,0],[32,0],[0,32]][i];
      const [u,v]=state.sets[0][i],[qu,qv,q0]=state.qCoefficients;
      return {h:[(x/16-1)*w,(1-y/16)*w,z,w],
        a:[.5*u+.25*v+.09375,.125*u+.5*v+.15625,qu*u+qv*v+q0,state.factors[i]]};
    });
    for(const plane of [v=>v.h[2],v=>v.h[3]-v.h[2]]){
      const out=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[(i+poly.length-1)%poly.length],b=poly[i],da=plane(a),db=plane(b);
        if((da<0)!==(db<0)){
          const t=da/(da-db),mix=(a,b)=>a.map((v,j)=>v+t*(b[j]-v));
          out.push({h:mix(a.h,b.h),a:mix(a.a,b.a)});
        }
        if(db>=0)out.push(b);
      }
      poly=out;
    }
    const screen=v=>[16*(v.h[0]/v.h[3]+1),16*(1-v.h[1]/v.h[3])];
    for(let i=1;i+1<poly.length;i++){
      const tri=[poly[0],poly[i],poly[i+1]],s=tri.map(screen);
      const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      const area=cross(s[0],s[1],s[2]),point=[p.x,p.y];
      const b=[cross(s[1],s[2],point)/area,cross(s[2],s[0],point)/area,cross(s[0],s[1],point)/area];
      if(b.some(v=>v< -1e-9))continue;
      const z=b.reduce((sum,v,j)=>sum+v*tri[j].h[2]/tri[j].h[3],0);
      if(z>=depth)continue;
      const sum=c=>b.reduce((sum,v,j)=>sum+v*tri[j].a[c]/tri[j].h[3],0);
      const uv=[sum(0)/sum(2),sum(1)/sum(2)],wrap=v=>((Math.floor(v*16)%16)+16)%16;
      const tex=colors[0][wrap(uv[1])][wrap(uv[0])];
      const f=state.fog?b.reduce((sum,v,j)=>sum+v*tri[j].a[3]/255,0):1;
      depth=z;winner={layer:state.name,depth:z,uv,f,rgb:tex.map((v,c)=>Math.floor(v*f+state.fogColor[c]*(1-f)))};
    }
  }
  return details?winner:winner?.rgb||[11,22,33];
}
function plan(){
  const inherited=previous.plan(),base=inherited.states.find(s=>s.fog&&s.geomW&&s.factors[0]===32),states=[];
  for(const qState of inherited.states.filter(s=>s.fog&&s.geomW&&s.factors[0]===32))
    for(const geomW of [false,true])for(const varyingFog of [false,true])for(const reverse of [false,true]){
    // Near intersections are exactly (16,0)/(0,8) at unit w and
    // (20,0)/(0,14) at varying w: isolate composition from coordinate rounding.
    const front={...qState,filter:1,name:'clipped',geomW,zs:[-.5,.5,1.5],factors:varyingFog?[32,128,224]:[96,96,96]};
    const back={...base,filter:1,name:'occluder',geomW,zs:[.35,.35,.35],factors:[224,80,160],
      sets:base.sets.map(set=>set.map(([u,v])=>[u+.31,v+.17]))};
    const behind={...back,qCoefficients:qState.qCoefficients,matrix:qState.matrix};
    states.push({...front,label:`q${qState.qCoefficients}/w${geomW}/varyFog${varyingFog}/reverse${reverse}`,reverse,
      layers:reverse?[behind,front]:[front,behind],samples:[{x:1,y:1},{x:16,y:4},{x:8,y:12},{x:4,y:22},{x:28,y:28}]});
  }
  return {...inherited,states};
}
function literalPlan(){
  const p=plan(),states=[];
  // Uniform texture isolates clipping, depth ownership and fog from sampling.
  // C=(30,100,150), F=(200,32,82). Constant alpha85 gives (143,54,104);
  // alpha170 gives (86,77,127). At (8,12), the varying-w clipped fan has
  // weights (3/7,3/14,5/14) and generated alphas (60,120,108): alpha90,
  // hence F+(C-F)*90/255 = (140,56,106), before any byte rounding.
  for(const geomW of [false,true])for(const reverse of [false,true]){
    const original=p.states.find(s=>s.geomW===geomW&&s.reverse===reverse);
    const layers=original.layers.map(l=>({...l,fogColor:[200,32,82],
      factors:l.name==='occluder'?[170,170,170]:geomW?[0,120,240]:[85,85,85]}));
    states.push({...original,layers,label:`literal/w${geomW}/reverse${reverse}`,
      samples:[{x:1,y:1},geomW?{x:8,y:12}:{x:16,y:4},{x:28,y:28}],
      literal:[[86,77,127],geomW?[140,56,106]:[143,54,104],[11,22,33]]});
  }
  const colors=p.colors.map(grid=>grid.map(row=>row.map(()=>[30,100,150])));
  return {...p,colors,states};
}
function fixtureSource(){
  // Start at the maintained public COM/GPS fixture. The fog composition
  // adapter above previous targets the retired D3D command-stream queue.
  let s=require('./test-legacy-projected-coordinate-contract').fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'boundary seam '+a.slice(0,90));s=s.replace(a,b);};
  replace('const middle=config.withNormals?[bits(.3),bits(.6),bits(.7)]:[0,0xffffffff,0];',
    'const middle=[0,0xffffffff,(state.factors[i]<<24)>>>0];');
  replace('const geometry=async state=>{','const geometry=async state=>{await words(indices,[0x10000,2]);');
  replace('const device=await acquire',`const zd=await alloc(124);await words(zd,Array(31).fill(0));
    for(const [off,v] of [[0,124],[4,0x1007],[8,32],[12,32],[72,32],[76,0x400],[84,16],[104,0x20000]])await write(zd+off,v);
    const depthSurface=await acquire(out=>com('Create depth Surface7',dd,6,zd,out,0));
    await ok(com('AddAttachedSurface7 depth',rt,3,depthSurface));
    evidence.depthSurface=depthSurface;
    const device=await acquire`);
  replace("const z=state.clip&&negative!=='unclipped'&&i===0?-.5:state.geomW?[.2,.8,.6][i]:.5;",
    "const z=negative==='unclipped'&&state.name==='clipped'&&i===0?.2:state.zs[i];");
  replace('const setState=async state=>{',`const setState=async state=>{
    for(const [id,value] of [[28,negative==='fog-off'&&state.name==='clipped'?0:state.fog?1:0],
      [34,(state.fogColor[0]<<16)|(state.fogColor[1]<<8)|state.fogColor[2]],[35,0],[140,0]]){
      await ok(com('SetRenderState7 composition',device,20,id,value));
      const out=await guard(4);await ok(com('GetRenderState7 composition',device,21,id,out.p));
      await out.check();eq(await read(out.p),value,'fog state round trip');
    }
    for(const [id,value] of [[7,state.mutated||negative==='depth-off'?0:1],[14,state.mutated?0:1],[23,state.mutated?8:2]])
      await ok(com('SetRenderState7 depth',device,20,id,value));`);
  s=s.replaceAll("negative!=='early'", "(negative!=='early'||state.name!=='clipped')");
  s=s.replaceAll("if(negative==='early'){", "if(negative==='early'&&state.name==='clipped'){");
  const start=s.indexOf('    const draw=async()=>{'),end=s.indexOf('    const preview=',start);
  assert(start>0&&end>start);
  s=s.slice(0,start)+`    const draw=async()=>{
      await ok(com('Clear7 color and depth',device,10,0,0,3,0xff0b1621,bits(1),0));
      holding=config.queued;
      await ok(com('BeginScene7',device,5));
      for(const layer of evidence.currentState.layers){
        await setState(layer);await geometry(layer);
        if(negative==='ignored'&&layer.name==='clipped')await tss(24,0);
        await ok(config.indexed
          ?com('DrawIndexedPrimitive7',device,26,4,0x8e2,vertices,3,indices,3,0)
          :com('DrawPrimitive7',device,25,4,0x8e2,vertices,3,0));drawCount++;
      }
      await ok(com('EndScene7',device,6));
    };
`+s.slice(end);
  replace('  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord;',
    '  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord,drainHeld,streamRing;');
  replace('        GS.drain([ring],gpu);',`        streamRing=ring;drainHeld=()=>GS.drain([ring],gpu);
        if(holding){eq(kick,GS.CONST.KICK_ASYNC,'only async kicks may be held');return 1;}
        drainHeld();`);
  const loopStart=s.indexOf('    for(const state of config.states){evidence.currentState=state;');
  const loopEnd=s.indexOf('    evidence.drawCount=drawCount;',loopStart);
  assert(loopStart>0&&loopEnd>loopStart);
  s=s.slice(0,loopStart)+`    for(const state of config.states){
      evidence.currentState=state;await draw();
      if(config.queued){
        check(streamRing&&drainHeld,'real production stream held');
        const before=captureHashes(streamRing);
        const done=streamRing.word('done_seq');
        check(streamRing.readPos!==streamRing.writePos,'production records remain unconsumed');
        await setState({...state,flags:0,selector:0,matrix:identity,mutated:true,
          fog:!state.fog,fogColor:[5,222,17]});
        await words(vertices,Array(66).fill(0));await words(indices,[0xffffffff,0xffffffff]);
        const after=captureHashes(streamRing);
        eq(after,before,'complete held commands immutable after public state/source mutation');
        eq(streamRing.word('done_seq'),done,'no consumption during live mutation');
        (evidence.immutable||=[]).push({label:state.label,before,after});
        holding=false;drainHeld();
        eq(streamRing.readPos,streamRing.writePos,'actual production records drained');
      }
      for(const sample of state.samples)await observe(state.label+'/'+sample.x+','+sample.y,sample,state);
    }
    await com('Release depth Surface7',depthSurface,2);
`+s.slice(loopEnd);
  return s;
}
// Hash both production record storage and its referenced arena. Header cursors
// are checked separately; live COM mutations must not alter either payload.
function captureHashes(ring){return [
  sha(ring.u8.subarray(ring.ringData,ring.ringData+ring.ringBytes)),
  sha(ring.u8.subarray(ring.arenaData,ring.arenaData+ring.arenaBytes))];}
async function run(wasm,options={},negative=null){
  const bytes=fs.readFileSync(wasm),pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const context=require('./test-legacy-texture-rendered-contract').offlineContext(bytes);
  context.captureHashes=captureHashes;
  const GS=require('../lib/gpu-stream'),Base=require('../lib/gpu-stream-software').Executor;
  const records=[];
  context.GpuStreamSoftware={Executor:class extends Base{
    execute(rec){
      if(rec.op===GS.OP.DRAW||rec.op===GS.OP.DRAW_UP){
        const L=this.layouts.get(rec.fields.layout);
        const payload=GS.drawBytes(rec,rec.fields,(id)=>this.res.get(id).bytes,m=>{throw Error(m);});
        // TEXTURE0 is lowered into captured coordinates by the current WAT
        // producer. Corrupt that captured transform result, never live state.
        if(negative==='captured-matrix'){
          const uv=L.slots.find(v=>v.usage===GS.CONST.USAGE_TEXCOORD&&v.index===0);
          assert(uv,'captured projected coordinates');
          const d=new DataView(payload.vertices.buffer,payload.vertices.byteOffset,payload.vertices.byteLength);
          for(let at=uv.offset;at<payload.vertices.byteLength;at+=rec.fields.stride){
            d.setFloat32(at,0,true);d.setFloat32(at+4,0,true);
          }
        }
        records.push({label:context.legacyTextureEvidence.currentState.label,
          fields:{...rec.fields},raster:{...this.raster},
          vertices:Array.from({length:rec.fields.vcount},(_,i)=>{
            const d=new DataView(payload.vertices.buffer,payload.vertices.byteOffset+i*rec.fields.stride,rec.fields.stride);
            return Array.from({length:rec.fields.stride/4},(_,c)=>c===4||c===5?d.getUint32(c*4,true):d.getFloat32(c*4,true));
          }),
          verticesSHA256:sha(payload.vertices)});
      }
      return super.execute(rec);
    }
  }};
  let failure=null;
  try{await vm.runInContext('('+fixtureSource()+')',context)('gps',{...plan(),...options},oracle.toString(),negative);}
  catch(e){failure=e.stack;}
  return {wasm,wasmSHA256:sha(bytes),calcSHA256:sha(pe),fixtureSHA256:sha(fixtureSource()),failure,
    ...JSON.parse(JSON.stringify(context.legacyTextureEvidence)),records};
}
function writeEvidence(out,name,r){
  // Keep pixel assertions and full-target parity in memory; persist named
  // observations and target identities rather than repeated target images.
  const observations=r.observations?.map(({dibRGBA,...o})=>({...o,targetSHA256:sha(Uint8Array.from(dibRGBA))}));
  fs.writeFileSync(path.join(out,name),JSON.stringify({...r,observations}));
}
async function main(){
  const p=plan();new vm.Script('('+fixtureSource()+')');
  for(const s of p.states){
    const owners=s.samples.map(t=>oracle(p.colors,s,t,true)?.layer);
    assert(owners.includes('clipped')&&owners.includes('occluder')&&owners.includes(undefined));
    for(const t of s.samples)assert.deepEqual(oracle(p.colors,s,t),oracle(p.colors,{...s,layers:s.layers.slice().reverse()},t));
  }
  const literal=literalPlan();
  for(const s of literal.states)for(const [i,t] of s.samples.entries())
    assert.deepEqual(oracle(literal.colors,s,t),s.literal[i],'independent literal depth/fog expectation');
  const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7);
  if(!wasm){console.log('PASS independent clipped/depth rational plan ONLY');return;}
  const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);assert(out);fs.mkdirSync(out,{recursive:true});
  const summary=[];let images;
  for(const queued of [false,true])for(const indexed of [false,true]){
    const r=await run(wasm,{queued,indexed});writeEvidence(out,`positive-${queued}-${indexed}.json`,r);
    assert.equal(r.failure,null);assert.equal(r.status,'PASS');assert.equal(r.observations.length,p.states.length*5);
    const next=r.observations.filter((_,i)=>i%5===0).map(o=>o.dibRGBA);
    if(images)assert.deepEqual(next,images,'full target immediate/indexed/held production stream parity');else images=next;
    for(let i=0;i<next.length;i+=2)assert.deepEqual(next[i],next[i+1],'complete reverse-order depth equality');
    assert.equal(r.records.length,p.states.length*2,'both production draws per scene inspected');
    assert.equal(r.stats.fallbacks,0);assert.equal(r.stats.declined,0);
    assert.equal(r.stats.drawCalls,p.states.length*2);assert(r.stats.readbacks>=p.states.length);
    for(const record of r.records){
      assert.equal(record.raster.depth_mode,1);assert.equal(record.raster.zwrite,1);assert.equal(record.raster.zfunc,2);
      assert.equal(record.raster.linear,1,'affine vertex fog with homogeneous texture coordinates');
      assert(record.vertices.every(v=>v[2]>=0&&v[2]<=1),'retained vertices lie inside near/far planes');
    }
    if(queued){assert.equal(r.immutable.length,p.states.length);assert(r.immutable.every(v=>v.before.length===2));}
    summary.push({queued,indexed,draws:r.drawCount,pixels:r.observations.length,records:r.records?.length||0});console.log('PASS',summary.at(-1));
  }
  for(const negative of ['depth-off','unclipped','ignored','early','fog-off','captured-matrix']){
    const r=await run(wasm,{states:p.states,queued:negative==='captured-matrix'},negative);
    writeEvidence(out,`negative-${negative}.json`,r);
    assert(r.failure?.includes('PIXEL ORACLE'),'pixel rejection '+negative+': '+r.failure);
    assert(r.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));assert(r.calls.some(c=>c.label==='Lock Surface7'&&c.result===0));
    console.log('PASS rendered rejection',negative);
  }
  for(const queued of [false,true])for(const indexed of [false,true]){
    const r=await run(wasm,{...literal,queued,indexed});
    writeEvidence(out,`literal-${queued}-${indexed}.json`,r);
    assert.equal(r.failure,null);assert.equal(r.status,'PASS');assert.equal(r.observations.length,12);
    for(const [i,o] of r.observations.entries()){
      const expected=literal.states[Math.floor(i/3)].literal[i%3];
      assert.deepEqual(o.expected,expected);assert(o.actual.every((v,c)=>Math.abs(v-expected[c])<=literal.tolerance));
    }
    assert.equal(r.stats.drawCalls,8);assert.equal(r.stats.fallbacks,0);assert.equal(r.stats.declined,0);
    if(queued)assert.equal(r.immutable.length,4);
    console.log('PASS independent literal production depth/fog',{queued,indexed,pixels:12});
  }
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',wasm,summary}));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={plan,literalPlan,oracle,fixtureSource,run};
