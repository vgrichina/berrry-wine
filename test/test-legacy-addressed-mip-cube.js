#!/usr/bin/env node
'use strict';

// Public emitted-x86 COM regression, prebuilt shipped modules only.
// --plan checks independent numeric controls without Wasm/browser execution.
// Runtime requires LEGACY_ADDRESSED_MIP_{EVIDENCE,MODULE_DIR,SOURCE}; SOURCE
// is the full Git SHA corresponding to the supplied modules. Both shipped
// modules run through software, direct WebGL1/2 and owning Worker WebGL1/2.
// Addressing extends the continuous tap-center oracle from the public MIRROR
// fixture; the existing public mip oracle stays unchanged and is cross-checked
// for WRAP. No production sampler/descriptor/shader helper supplies expectations.
// See docs/re-notes/legacy-current-cube-20261106.md for contract and evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),vm=require('node:vm');
const mip=require('./test-legacy-public-mip-webgl');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function addressedOracle(colors,state,sample) {
  const {x,y}=sample,q=state.q||[1,1,1],n=state.n,offset=state.offset||[0,0];
  const Q=q[0]+(q[1]-q[0])*x/32+(q[2]-q[0])*y/32;
  const U=n*q[1]*x/32,V=n*q[2]*y/32;
  const Qx=(q[1]-q[0])/32,Qy=(q[2]-q[0])/32;
  const ux=(n*q[1]/32*Q-U*Qx)/(Q*Q),uy=-U*Qy/(Q*Q);
  const vx=-V*Qx/(Q*Q),vy=(n*q[2]/32*Q-V*Qy)/(Q*Q);
  const rho=16*Math.sqrt(Math.max(ux*ux+vx*vx,uy*uy+vy*vy));
  const lod=Math.max(0,Math.min(4,Math.log2(rho)));
  const at=level=>{
    const grid=colors[level],d=grid.length;
    const index=(tap,mode)=>{
      const center=(tap+.5)/d;
      let unit;
      if(mode===1)unit=center-Math.floor(center);
      else if(mode===2){const phase=center-2*Math.floor(center/2);unit=1-Math.abs(1-phase);}
      else if(mode===3)unit=Math.max(0,Math.min(1,center));
      else throw Error('unsupported independent address mode');
      return Math.min(d-1,Math.floor(unit*d));
    };
    const tap=(a,b)=>grid[index(b,state.v)][index(a,state.u)];
    const u=offset[0]+U/Q,v=offset[1]+V/Q;
    if((rho<=1?state.mag:state.min)===1)return tap(Math.floor(u*d),Math.floor(v*d)).slice();
    const sx=u*d-.5,sy=v*d-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
    const a=tap(ix,iy),b=tap(ix+1,iy),c=tap(ix,iy+1),e=tap(ix+1,iy+1);
    return a.map((z,i)=>(z*(1-fx)+b[i]*fx)*(1-fy)+(c[i]*(1-fx)+e[i]*fx)*fy);
  };
  if(state.mip===1)return at(0);
  if(state.mip===2)return at(Math.floor(lod+.5));
  const lo=Math.floor(lod),hi=Math.min(4,lo+1),w=lod-lo,a=at(lo),b=at(hi);
  return a.map((z,i)=>z*(1-w)+b[i]*w);
}

function addressedPlan() {
  const colors=Array.from({length:5},(_,level)=>Array.from({length:16>>level},(_,y)=>
    Array.from({length:16>>level},(_,x)=>[24+level*23+(x%2)*112,
      20+level*17+(y%2)*120,28+level*19+((x+y)%2)*96])));
  const states=[];
  for(const [phase,parameters] of [
    {n:.5,min:1,mag:1,mip:1},
    {n:4,min:2,mag:1,mip:2},
    {n:2*Math.sqrt(8),min:2,mag:1,mip:3},
    {n:-4,min:2,mag:1,mip:3,q:[1,.5,.75]},
  ].entries())for(const [index,[u,v]] of [[1,1],[2,1],[2,3],[3,2],[1,3],[2,2],[1,1]].entries()){
    states.push({...parameters,u,v,spatial:true,offset:[-1.137,1.193],
      label:'address-mip-'+phase+'-'+index+'-u'+u+'v'+v,
      samples:[{x:2,y:3},{x:5,y:2},{x:8,y:1}],rejectCube:phase===1&&index===2});
  }
  return {colors,states,tolerance:2,captureHeldPackets:true,queuedPairs:[[1,2],[2,3],[9,10]]};
}

function adapt(source, assert) {
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'unique addressed mip seam '+a.slice(0,65));source=source.replace(a,b);};
  replace('[[16,mag],[17,min],[18,mip],[13,1],[14,1]]',
    `[[16,mag],[17,min],[18,mip],[13,negative==='wrap-for-mirror'&&state.u===2?1:state.u],
      [14,negative==='coupled-v'?state.u:negative==='wrap-for-mirror'&&state.v===2?1:state.v]]`);
  replace('const expectedAddress=[1,1];','const expectedAddress=[state.u,state.v];');
  replace("    for(const state of config.states){await setState(state);await geometry(state);await draw();",`
    const iidDD4=await guid([0x9c59509a,0x11d139bd,0xc0004a8c,0xc530d94f]);
    const dd4=await acquire(out=>com('QI IDirectDraw4',dd,0,iidDD4,out));
    evidence.cubeRejections=[];
    const rejectCube=async state=>{
      const binding=await guard(4);await ok(com('GetTexture7 before rejection',device,34,0,binding.p));
      await binding.check();const beforeTexture=await read(binding.p);
      eq(beforeTexture,texture,'public live texture before rejection');
      await com('Release GetTexture before reference',beforeTexture,2);
      for(const [version,object] of [[4,dd4],[7,dd]])for(const caps2 of [0x600,0xfe00]){
        const desc=await guard(124),out=await guard(4);
        await words(desc.p,Array(31).fill(0));
        for(const [off,v] of [[0,124],[4,0x1007],[8,2],[12,2],[72,32],[76,0x40],[84,32],
          [88,0xff0000],[92,0xff00],[96,0xff],[104,0x1808],[108,caps2]])await write(desc.p+off,v);
        const before=Array.from(new Uint8Array(memory.buffer,await wa(desc.p),124));
        const hr=await com('CreateSurface'+version+' reject bound cube',object,6,desc.p,out.p,0);
        const output=await read(out.p);await desc.check();await out.check();
        const after=Array.from(new Uint8Array(memory.buffer,await wa(desc.p),124));
        const guards=[await read(desc.p-4),await read(desc.p+124),await read(out.p-4),await read(out.p+4)];
        const row={label:state.label,version,caps2,hr,output,guardsIntact:true,guards,before,after};
        evidence.cubeRejections.push(row);
        eq(hr,0x80004001,'bound cube E_NOTIMPL');eq(output,0,'bound cube null output');
        eq(after,before,'bound cube input unchanged');
      }
      await ok(com('GetTexture7 after rejection',device,34,0,binding.p));await binding.check();
      const afterTexture=await read(binding.p);eq(afterTexture,texture,'public live texture survives rejection');
      await com('Release GetTexture after reference',afterTexture,2);
    };
    for(const state of config.states){await setState(state);await geometry(state);
      if(state.rejectCube)await rejectCube(state);
      await draw();`);
  replace("    for(const obj of levels.slice(1))await com('Release acquired mip',obj,2);",
    "    await com('Release DD4',dd4,2);\n    for(const obj of levels.slice(1))await com('Release acquired mip',obj,2);");
  return source;
}
function rejectionContract(row) {
  assert.equal(row.hr,0x80004001,'cube E_NOTIMPL');
  assert.equal(row.output,0,'cube output null');
  assert.equal(row.guardsIntact,true,'neighboring guards');
  assert.deepEqual(row.guards,Array(4).fill(0xa5a5a5a5),'actual neighboring guard words');
  assert.deepEqual(row.after,row.before,'input descriptor intact');
}

function controls() {
  const p=addressedPlan();
  for(const state of p.states)for(const sample of state.samples){
    const actual=addressedOracle(p.colors,{...state,u:1,v:1},sample);
    const original=mip.oracle(p.colors,state,sample);
    actual.forEach((n,i)=>assert(Math.abs(n-original[i])<1e-9,'unchanged WRAP oracle'));
  }
  assert.deepEqual(addressedOracle(p.colors,{n:0,min:1,mag:1,mip:1,u:2,v:3,offset:[-1/32,2]}, {x:0,y:0}),[24,140,124]);
  assert.deepEqual(addressedOracle(p.colors,{n:0,min:1,mag:1,mip:1,u:1,v:3,offset:[-1/32,2]}, {x:0,y:0}),[136,140,28]);
  const mutants={
    'wrap-for-mirror':s=>({...s,u:s.u===2?1:s.u,v:s.v===2?1:s.v}),
    'coupled-v':s=>({...s,v:s.u}),
    'level-zero-only':s=>({...s,mip:1}),
  };
  const sensitivity={};
  for(const [name,mutate] of Object.entries(mutants)){
    sensitivity[name]=p.states.flatMap(s=>s.samples.map(t=>
      addressedOracle(p.colors,s,t).some((c,i)=>Math.abs(c-addressedOracle(p.colors,mutate(s),t)[i])>2*p.tolerance)))
      .filter(Boolean).length;
    assert(sensitivity[name]>0,'independent addressed mip mutant '+name);
  }
  const r={hr:0x80004001,output:0,guardsIntact:true,guards:Array(4).fill(0xa5a5a5a5),before:[124,0x1007],after:[124,0x1007]};
  rejectionContract(r);
  for(const change of [{hr:0},{output:0xa5a5a5a5},{guards:[0,0xa5a5a5a5,0xa5a5a5a5,0xa5a5a5a5]},{after:[124,0]}])
    assert.throws(()=>rejectionContract({...r,...change}));
  const source=adapt(mip.fixtureSource(),assert);new vm.Script('('+source+')');
  for(const label of ['QI IDirectDraw4','GetTexture7 before rejection','GetTexture7 after rejection','bound cube E_NOTIMPL'])
    assert(source.includes(label),'public rejection seam '+label);
  return {status:'PLANNER PASS; no runtime pixels',states:p.states.length,
    pixels:p.states.reduce((n,s)=>n+s.samples.length,0),tolerance:p.tolerance,sensitivity,
    rejectionMutants:4,fixtureSha256:sha(source)};
}

async function runtime() {
  const dir=process.env.LEGACY_ADDRESSED_MIP_EVIDENCE,moduleDir=process.env.LEGACY_ADDRESSED_MIP_MODULE_DIR;
  assert(dir&&moduleDir,'set evidence and existing module directory');
  const source=process.env.LEGACY_ADDRESSED_MIP_SOURCE;assert.match(source||'',/^[0-9a-f]{40}$/);
  fs.mkdirSync(dir,{recursive:true});
  const evidence={status:'RUNNING',startedAt:new Date().toISOString(),source,node:process.version,
    controls:controls(),plan:addressedPlan(),modules:[],results:[],negativeControls:[],requests:[],
    fixtureSha256:sha(fs.readFileSync(__filename)),adaptedFixtureSha256:sha(adapt(mip.fixtureSource(),assert)),
    upstreamFixtureSha256:sha(fs.readFileSync(path.join(__dirname,'test-legacy-public-mip-webgl.js'))),
    calcSha256:sha(fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe')))};
  let wasm,server,browser,page,timer;
  const save=()=>fs.writeFileSync(path.join(dir,'runtime.json'),JSON.stringify(evidence,null,2)+'\n');
  try {
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      const b=fs.readFileSync(path.join(moduleDir,name));
      evidence.modules.push({name,bytes:b.length,sha256:sha(b)});
      fs.writeFileSync(path.join(dir,name),b);
    }
    server=await mip.createServer(()=>wasm,()=>null,()=>{throw Error('no backend injection authorized');},r=>evidence.requests.push(r));
    evidence.serverAddress=server.address();save();
    browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.browserPid=browser.process().pid;
    evidence.browserProfile=browser.process().spawnargs.find(a=>a.startsWith('--user-data-dir='))?.slice(16);
    evidence.browserArgs=browser.process().spawnargs;
    browser.process().once('exit',(code,signal)=>{evidence.browserExit={code,signal};});
    timer=setTimeout(()=>{evidence.deadlineExceeded=true;browser.close().catch(()=>{});},600000);
    const cdp=await browser.target().createCDPSession();evidence.systemInfo=await cdp.send('SystemInfo.getInfo');await cdp.detach();
    const fixture=Function('return ('+adapt(mip.fixtureSource(),assert)+')')();
    const open=async()=>{page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/legacy-render-fixture');};
    for(const module of evidence.modules){
      wasm=fs.readFileSync(path.join(moduleDir,module.name));assert.equal(sha(wasm),module.sha256);
      for(const mode of ['software','webgl','worker'])for(const webglVersion of mode==='software'?[null]:[1,2]){
        const cfg={...mip.config('spatial'),...addressedPlan(),webglVersion};
        await open();
        const result=await page.evaluate(fixture,mode,cfg,addressedOracle.toString());
        assert.equal(result.status,'PASS');assert.equal(result.cubeRejections.length,4);
        result.cubeRejections.forEach(rejectionContract);
        assert.deepEqual([...new Set(result.cubeRejections.map(r=>r.version))],[4,7]);
        assert.equal(result.observations.length,evidence.controls.pixels+(mode==='worker'?6:0));
        if(mode==='worker'){
          assert.equal(result.queued.length,3);assert(result.queued.every(q=>q.immutable&&q.afterDrain.completed>=q.sequence));
          assert.equal(result.retirement?.t,'render-stopped');
        }
        evidence.results.push({module:module.name,webglVersion,...result});save();
        const stem=module.name+'-'+mode+'-'+webglVersion;
        await page.screenshot({path:path.join(dir,stem+'.png')});await page.close();page=null;
        console.log('PASS '+stem+' pixels='+result.observations.length+' rejections=4');
        for(const negative of ['wrap-for-mirror','coupled-v','level-zero-only']){
          await open();let failure;
          try {await page.evaluate(fixture,mode,cfg,addressedOracle.toString(),negative);}catch(error){failure=String(error);}
          const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
          evidence.negativeControls.push({module:module.name,mode,webglVersion,negative,failure,partial});save();
          assert(failure?.includes('PIXEL ORACLE'),'rendered mutant must fail pixels: '+failure);
          assert(partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
          assert(partial.observations.some(o=>o.actual.some((c,i)=>Math.abs(c-o.expected[i])>cfg.tolerance)));
          if(mode==='worker')assert(partial.observations.some(o=>o.workerStats?.drawCalls>0));
          if(mode==='webgl')assert(partial.observations.some(o=>o.webglRGBA&&o.glError===0));
          await page.close();page=null;console.log('PASS rejected '+negative+' '+stem);
        }
      }
    }
    evidence.status='PASS';
  } catch(error) {
    evidence.status='FAIL; remaining routes unexecuted';evidence.error=error.stack;
    if(page){evidence.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null);
      await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});}
    throw error;
  } finally {
    if(timer)clearTimeout(timer);
    try {
      if(browser)await browser.close();evidence.browserClosedAt=new Date().toISOString();
      if(browser)assert.deepEqual(evidence.browserExit,{code:0,signal:null},'normal browser exit');
    } finally {
      try {if(server)await require('./static-server').closeServer(server);}
      finally {evidence.closedAt=new Date().toISOString();save();}
    }
  }
}

if(require.main===module){
  if(process.argv.includes('--plan'))console.log(JSON.stringify(controls(),null,2));
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={addressedOracle,addressedPlan,adapt,controls,rejectionContract};
