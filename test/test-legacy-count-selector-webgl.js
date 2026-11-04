#!/usr/bin/env node
'use strict';

// Expanded public COM fixture on actual direct and owning Worker WebGL.
// Reuses the independent rational oracle and the established browser runner.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const contract=require('./test-legacy-projected-coordinate-contract');
const previous=require('./test-legacy-projected-webgl');
const ROOT=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceCommit='5fa5519eb55e6b2fc83fae4ef12a218e7efc9a7e';
// Published source-seal.json from the worker that built and tested the repair.
// Keep these exact: matching a different locally available module is not proof.
const modulePins={
  'wine-assembly.wasm':'129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52',
  'wine-assembly.compat.wasm':'3fde0fc42ecd0d9d5096d0b9eb83cd3086cb74aab8ac3f7b9f3fd15f5783fe6a',
};

function controls(){
  const p=contract.plan();
  assert.equal(p.tolerance,2);
  assert.equal(p.states.length,155);
  new vm.Script('('+contract.fixtureSource()+')');
  new vm.Script('('+fixtureSource()+')');
  new vm.Script('('+previous.fixtureSource()+')');
  const counts={};
  for(const count of [2,3,4]){
    const states=p.states.filter(s=>s.label.startsWith('COUNT'+count+'/'));
    assert.equal(states.length,48);
    assert.deepEqual([...new Set(states.map(s=>s.selector))],[0,1,2,7]);
    const levels=[...new Set(states.filter(s=>s.mip===2).flatMap(s=>s.samples.map(t=>
      contract.oracle(p.colors,s,t,true).level)))].sort();
    assert([1,2,3,4].every(level=>levels.includes(level)),'nonzero mips for every count');
    const clip=p.states.find(s=>s.clip&&s.flags===0x100+count);
    assert.deepEqual(contract.oracle(p.colors,clip,{x:1,y:1}),[11,22,33]);
    for(const state of states)for(const sample of state.samples){
      for(const flags of [state.flags,0]){
        const control={...state,flags};
        const expected=contract.oracle(p.colors,control,sample);
        for(const dx of [-.0625,0,.0625])for(const dy of [-.0625,0,.0625])
          assert.deepEqual(contract.oracle(p.colors,control,{x:sample.x+dx,y:sample.y+dy}),expected);
      }
    }
    counts[count]={states:states.length,selectors:[0,1,2,7],levels};
  }
  const source=contract.fixtureSource();
  for(const fault of ['ignored','selector','component','early','lod'])
    assert(source.includes("negative==='"+fault+"'"),'public fault seam '+fault);
  assert(source.includes('liveChangedBeforeDrain=true'),'held Worker mutation retained');
  assert(source.includes('d3dimSoftwareDrawCallsCompleted'),'owning Worker software exclusion retained');
  return {status:'PLAN ONLY; no GL pixels',sourceCommit,tolerance:p.tolerance,states:p.states.length,
    repair:repairControls(),fixtureSHA256:hash(source),oracleSHA256:hash(contract.oracle.toString()),counts,
    faults:['ignored','selector','component','early','lod','captured-matrix'],
    capturedMatrixFault:'held owned matrix replaced before actual owning Worker GL delivery'};
}

function prerequisites(root=ROOT){
  const modules=Object.entries(modulePins).map(([name,expected])=>{
    const file=path.join(root,'build',name),exists=fs.existsSync(file);
    const actual=exists?hash(fs.readFileSync(file)):null;
    return {path:file,expectedSHA256:expected,actualSHA256:actual,match:actual===expected};
  });
  const rebuild=['src/main.watx','tools/build-compile-wat.js','tools/watx-closure.js','tools/watx.js',
    'tools/watx-src/compiler-parser.js','tools/watx-src/compiler-stages.js',
    'tools/watx-src/compiler-codegen.js','tools/watx-src/compiler.js'];
  const missingRebuildInputs=rebuild.filter(name=>!fs.existsSync(path.join(root,name)));
  const ready=modules.every(m=>m.match);
  return {status:ready?'MODULE PREREQUISITES PASS; no browser or pixels':'BLOCKED BEFORE CHROME: expanded-contract modules unavailable',
    sourceCommit,modules,missingRebuildInputs,browserLaunched:false,
    next:ready?'Run the expanded fixture using the real browser harness and six adapted rendered faults.':
      'Provide exact retained repaired modules or a reproducible remote build with its required inputs; do not render the stale COUNT3 modules.'};
}

function repairControls(){
  const Fixed=require('../lib/d3d9-fixed'),Shader=require('../lib/d3d9-shader');
  const {Device,solidSources}=require('../lib/d3d9-backend');
  const viewport={x:0,y:0,width:32,height:32,minZ:0,maxZ:1};
  for(const count of [3,4])for(const mixed of [false,true]){
    const draw={primitive:4,primitiveCount:1,stride:40,vertices:new Uint8Array(120),viewport,state:{cull:1},
      textures:[{width:16,height:16,sampler:{min:1,mag:1,mip:1}}],
      attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0},{register:1,usage:5,usageIndex:0,type:3,offset:24}],
      fixedFunction:{lighting:false,fog:false,specular:false,stages:[{colorOp:2,colorArg1:2,
        alphaOp:2,alphaArg1:2,transformFlags:0x100+count,texCoordIndex:0},{colorOp:1}]}};
    const ps=mixed?new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]):null;
    const linked=ps?Shader.compile(ps,{projectedStages:[count]}):null;
    const compiled=Fixed.compile({...draw,pixelShader:ps},viewport,linked);
    const shader=Shader.withMipSampling(linked||compiled.pixel,[0]);
    assert.match(shader.source,/vec4 d3d_sample0\(vec2 uv,vec3 homogeneous\)/);
    assert.match(shader.source,/dFdx\(homogeneous.xy\)-uv\*dFdx\(homogeneous.z\)/);
    assert.match(shader.source,/vec3\(\w+\.xy,\w+\.[zw]\)\*gl_FragCoord.w/);
    const solid=solidSources(compiled.vertex,shader);
    assert.match(solid.fragment,/vec3\(\w+\.xy,\w+\.[zw]\)\*solid_q/);
    if(mixed)continue;
    // Exercise Device.draw selection too: equal min/mag and a complete chain
    // must still request the analytic atlas for projected mip filtering.
    for(const version of [1,2]){
      const constants=new Map(),programs=[],uploads=[];
      const gl=new Proxy({colorMask(){},getExtension(){return {};},getParameter(){return 0;}},
        {get(t,n){if(n in t)return t[n];if(!constants.has(n))constants.set(n,constants.size+1);return constants.get(n);}});
      const gpu={version,gl,canvas:{width:32,height:32},renderHeight:32,
        createProgram(v,p){programs.push(p);return {};},updateBuffer(){},draw(){},setUniform(){},
        setCapability(){},setDepthFunc(){},setDepthMask(){},setBlendFunc(){},setFrontFace(){},setCullFace(){},setViewport(){},setDepthRange(){},bindTexture(){}};
      const metadata=Object.fromEntries(['mips0[0]','lod0','filter0','extent0','address0','border0'].map(n=>['d3d_'+n,new Float32Array(48)]));
      const device=Object.create(Device.prototype);
      Object.assign(device,{gpu,vertices:{},indices:{},fixedPlans:new Fixed.TLCache(),programs:new Map(),
        textures:new Map(),textureTargets:new Map(),mipUniforms:new Map([[0,metadata]]),bindDepth(){},touchColor(){},
        uploadTexture(stage,image,atlas){uploads.push(atlas);}});
      device.draw(draw);
      assert(programs.length>0);assert.match(programs[0],/vec3 homogeneous/);
      assert.deepEqual(uploads,[true]);
    }
  }
  const p=contract.plan(),state=p.states.find(s=>s.label==='COUNT3/TEX7/scale16/wfalse');
  const answer=contract.oracle(p.colors,state,{x:9,y:11},true);
  assert.equal(answer.level,2);assert(Math.abs(answer.rho-5.560719202925077)<1e-12);
  return {status:'OFFLINE repair compiler/Device checks PASS; repaired GL pixels untested',failedSample:answer};
}
function config(){return {...previous.config(),...contract.plan()};}
const oracle=contract.oracle;
function fixtureSource(){
  let source=contract.fixtureSource();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'browser seam '+a);source=source.replace(a,b);};
  replace('const held=[];let nativeEncoder,nativeWorker;', 'const held=[];let nativeEncoder,nativeWorker,endpointBuffers;');
  replace("if(holding&&(message.t==='batch'||held.length))held.push(()=>post(message));else post(message);",`if(message.t==='init')endpointBuffers=message.buffers;
          if(holding&&(message.t==='batch'||held.length))held.push(()=>{
            if(negative==='captured-matrix'&&message.t==='batch'){
              check(endpointBuffers,'captured endpoint buffers');
              const buffer=endpointBuffers[message.index],d=new DataView(buffer);
              for(let offset=0;offset<message.bytes;){
                const size=d.getUint32(offset,true);check(size>0,'record size');
                if(d.getUint32(offset+12,true)===4){
                  new Uint8Array(buffer,offset+32+3136,64).set(new Uint8Array(new Float32Array(identity).buffer));
                  evidence.corruptedCapturedMatrices=(evidence.corruptedCapturedMatrices||0)+1;
                }offset+=size;
              }
            }post(message);
          });else post(message);`);
  replace('await setState(next);heldRecord.liveChangedBeforeDrain=true;',
    'await setState({...next,selector:(old.selector+1)%8});heldRecord.liveChangedBeforeDrain=true;');
  replace("await draw();for(const sample of next.samples)await observe('next '+next.label,sample,next);",
    "await setState(next);await draw();for(const sample of next.samples)await observe('next '+next.label,sample,next);");
  return source;
}
// Faults change public fixture inputs or a held record, never the oracle.
function mutateAdapter(source){return source;}
const transportPreflight=previous.transportPreflight;
async function runtime(){
  const dir=process.env.LEGACY_PROJECTED_EVIDENCE;assert(dir);fs.mkdirSync(dir,{recursive:true});
  const hardClose=Date.parse(process.env.LEGACY_PROJECTED_HARD_CLOSE||'2026-11-04T07:45:00Z');
  assert(Number.isFinite(hardClose),'explicit finite browser close time');
  const seal=JSON.parse(fs.readFileSync(path.join(dir,'source-seal.json')));
  const state={status:'PREPARING',seal,preflight:controls(),results:[],negatives:[],injections:[]};
  const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(state)+'\n');
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host','render-worker',
    'gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  let wasm,negative=null,server,browser,page,timer;
  try{
    const puppeteer=require('puppeteer');
    const esmPath=path.join(path.dirname(require.resolve('puppeteer/package.json')),'lib/esm/puppeteer/puppeteer.js');
    await import(require('node:url').pathToFileURL(esmPath).href);
    state.puppeteer={require:require.resolve('puppeteer'),import:esmPath};
    assert.equal(require('puppeteer/package.json').version,'24.31.0');
    for(const [name,pin] of Object.entries(seal.files))assert.equal(hash(fs.readFileSync(path.join(ROOT,name))),pin.sha256,name);
    assert.equal(hash(fs.readFileSync('/home/user/legacy-solid-browser/package-lock.json')),seal.puppeteerLockSha256);
    server=await require('./static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      const name=new URL(req.url,'http://localhost').pathname;
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      res.setHeader('Cache-Control','no-store');
      if(name==='/legacy-render-fixture'){
        res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;
      }
      if(name==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(name==='/lib/d3dim-gpu.js'&&negative&&negative!=='unclipped'){
        const body=mutateAdapter(fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8'),negative);
        state.injections.push({negative,url:req.url,sha256:hash(body)});
        res.writeHead(200,{'Content-Type':'application/javascript'});res.end(body);return true;
      }
      return false;
    }});
    state.serverPort=server.address().port;
    state.bootstrap=[];
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(path.join(ROOT,'build',name));assert(WebAssembly.validate(wasm));
      const transport=await transportPreflight(wasm);
      // Instantiate the exact served module and acquire actual public COM
      // surfaces/device/mip chain before Chrome. Bootstrap exits before draws.
      const routes=new Map([['/legacy-render.wasm',wasm],
        ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))],
        ['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))]]);
      const context=vm.createContext({WebAssembly,performance,setTimeout,fetch:async url=>{
        assert(routes.has(url));const bytes=routes.get(url);
        return {arrayBuffer:async()=>Uint8Array.from(bytes).buffer,json:async()=>JSON.parse(bytes)};
      }});
      const bootstrap=await vm.runInContext('('+fixtureSource()+')',context)('software',{...config(),bootstrap:true},oracle.toString());
      assert.equal(bootstrap.status,'BOOTSTRAP PASS; no draws');
      assert(!bootstrap.calls.some(c=>/Draw(Indexed)?Primitive7/.test(c.label)));
      state.bootstrap.push({module:name,sha256:hash(wasm),result:bootstrap,transport});
      for(const route of ['/legacy-render-fixture','/legacy-render.wasm','/lib/guest-worker.js']){
        const response=await fetch('http://127.0.0.1:'+state.serverPort+route);assert.equal(response.status,200);
        assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin');
        assert.equal(response.headers.get('cross-origin-embedder-policy'),'require-corp');
        if(route.endsWith('.wasm'))assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(wasm));else await response.text();
      }
    }
    for(const [name,pin] of Object.entries(seal.files))if(name.startsWith('lib/')||name.startsWith('test/')){
      const response=await fetch('http://127.0.0.1:'+state.serverPort+'/'+name);assert.equal(response.status,200);
      assert.equal(hash(Buffer.from(await response.arrayBuffer())),pin.sha256,'HTTP '+name);
    }
    state.preBrowser='PASS actual imports, dependency/source/module pins, HTTP/isolation';save();
    if(process.argv.includes('--preflight')){state.status='PREFLIGHT PASS; no browser';return;}
    assert(Date.now()<hardClose-300000,'launch deadline');
    timer=setTimeout(()=>{state.timedOut=true;save();if(browser)browser.close().catch(()=>{});},Math.min(840000,hardClose-Date.now()));
    state.browserOpenedAt=new Date().toISOString();
    browser=await puppeteer.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    state.browser=await browser.version();state.browserPid=browser.process().pid;
    const cdp=await browser.target().createCDPSession();state.systemInfo=await cdp.send('SystemInfo.getInfo');await cdp.detach();
    let implementation={fixtureSource,config,oracle},revision=0;
    const run=async(name,mode,version,indexed,fault=null,count=null)=>{
      negative=fault;wasm=fs.readFileSync(path.join(ROOT,'build',name));
      page=await browser.newPage();await page.goto('http://127.0.0.1:'+state.serverPort+'/legacy-render-fixture');
      const cfg={...implementation.config(),webglVersion:version,indexed};
      if(fault)cfg.states=cfg.states.filter(s=>s.flags===0x100+count&&s.selector===7&&s.geomW&&!s.clip);
      let result,error;
      const fixture=Function('return ('+implementation.fixtureSource()+')')();
      try{result=await page.evaluate(fixture,mode,cfg,implementation.oracle.toString(),fault);}catch(e){error=String(e);}
      const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
      const row={module:name,mode,version,indexed,fault,count,revision,result,error,partial:error?partial:undefined};
      (fault?state.negatives:state.results).push(row);save();
      if(fault){assert.match(error||'',/PIXEL ORACLE/,'rendered semantic rejection');
        assert(partial.calls.some(c=>/Draw(Indexed)?Primitive7/.test(c.label)&&c.result===0));
        assert(partial.observations.at(-1).actual.some((c,i)=>Math.abs(c-partial.observations.at(-1).expected[i])>cfg.tolerance));
      }else{assert.equal(error,undefined);assert.equal(result.status,'PASS');}
      await page.close();page=null;console.log('PASS '+JSON.stringify({name,mode,version,indexed,fault}));
    };
    // Canonical direct and queued first, then bounded compatibility coverage.
    const cells=['wine-assembly.wasm','wine-assembly.compat.wasm'].flatMap(name=>['webgl','worker'].flatMap(mode=>
      [1,2].flatMap(version=>[false,true].map(indexed=>[name,mode,version,indexed]))));
    for(let i=0;i<cells.length;i++)if(await run(...cells[i]))i=-1;
    for(const version of [1,2])for(const count of [2,3,4])for(const fault of ['ignored','selector','component','early','lod','captured-matrix'])
      await run('wine-assembly.wasm',fault==='captured-matrix'?'worker':'webgl',version,false,fault,count);
    state.status='PASS';
  }catch(error){state.status='FAIL; later paths unexecuted';state.error=error.stack;
    if(page)state.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null);throw error;
  }finally{
    if(timer)clearTimeout(timer);if(browser)await browser.close();state.browserClosedAt=new Date().toISOString();
    if(server)await require('./static-server').closeServer(server);
    state.closedAt=new Date().toISOString();save();
  }
}
if(require.main===module){
  if(process.argv.includes('--plan'))console.log(JSON.stringify(controls(),null,2));
  else if(process.argv.includes('--modules')){const p=prerequisites();console.log(JSON.stringify(p,null,2));if(!p.modules.every(m=>m.match))process.exitCode=2;}
  else runtime().catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports={controls,prerequisites,modulePins,sourceCommit,fixtureSource,config,oracle,runtime};
