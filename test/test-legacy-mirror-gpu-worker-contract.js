#!/usr/bin/env node
'use strict';

// Actual browser WebGL and GuestWorkerLink -> RenderWorker pixels. Prebuilt
// modules only; --plan does not launch a browser or qualify a backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {plan, oracle, fixtureSource: softwareSource} = require('./test-legacy-mirror-uv-contract');
const ROOT = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const scripts = ['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc',
  'guest-thread-host','render-worker','gpu-backend','d3d9-shader','d3d-shader-ir',
  'd3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'].map(n=>'lib/'+n+'.js');

function fixtureSource() {
  let source = softwareSource();
  const replace = (from,to) => {
    assert.equal(source.split(from).length,2,'unique browser fixture adaptation seam');
    source=source.replace(from,to);
  };
  replace("    if(mode==='webgl')gpu=new D3DIMGpu.D3DIMGpu({getExports:()=>e,getMemory:()=>memory.buffer,",
    "    if(mode==='webgl')gpu=new D3DIMGpu.D3DIMGpu({webglVersion:config.webglVersion,getExports:()=>e,getMemory:()=>memory.buffer,");
  replace('port=manager.createEndpoint(options);',
    'port=manager.createEndpoint({...options,webglVersion:config.webglVersion});');
  const begin=source.indexOf('      const transitions=config.cubeBorder?');
  const end=source.indexOf('      for(const [old,next] of transitions)',begin);
  assert(begin>0&&end>begin,'held queue transition seam');
  // Every requested state is captured before the live device changes. Include
  // both filter changes and restoration, plus all one-axis address changes.
  replace(source.slice(begin,end),`      const transitions=config.states.map((old,i)=>
        [old,config.states[(i+1)%config.states.length]]);
`);
  replace("      eq(actual,expected,'PIXEL ORACLE '+label);",`      if(mode==='worker'){
        await until(()=>lastStats?.stats.drawCalls===drawCount,'observed worker draw stats');
        row.workerStats=lastStats.stats;
        eq(row.workerStats.requestedBackend,'webgl','observed worker WebGL');
        checkVersion(row.workerStats.glVersion,'actual worker context VERSION');
        eq(row.workerStats.fallbacks,0,'observed worker no fallback');
        eq(row.workerStats.errors,0,'observed worker no errors');
        eq(row.workerStats.d3dimSoftwareDrawCallsCompleted,0,'observed worker no native rasterization');
        eq(row.workerStats.d3dimFallbackSoftwareDrawCallsCompleted,0,'observed worker no fallback rasterization');
        check(row.workerStats.glRenderer&&row.workerStats.renderEndpointId,'observed actual worker identity');
      }
      if(gpu)checkVersion(evidence.glRenderer.version,'actual direct context VERSION');
      eq(actual,expected,'PIXEL ORACLE '+label);`);
  replace("await until(()=>lastStats?.stats.drawCalls===drawCount,'all production GPU stats');evidence.stats=lastStats.stats;",
    `await until(()=>lastStats?.stats.drawCalls===drawCount,'all production GPU stats');evidence.stats=lastStats.stats;
      evidence.workerIdentity={guestUrl:'/lib/guest-worker.js',renderUrl:'/lib/d3d-render-worker.js',
        endpointId:lastStats.stats.renderEndpointId,api:lastStats.stats.renderApi,
        backend:lastStats.stats.requestedBackend,renderer:lastStats.stats.glRenderer,
        version:lastStats.stats.glVersion,requestedVersion:config.webglVersion};
      eq(evidence.workerIdentity.api,'legacy','actual render worker API');
      eq(evidence.workerIdentity.backend,'webgl','actual render worker backend');
      check(evidence.workerIdentity.endpointId&&evidence.workerIdentity.renderer,'actual worker endpoint and renderer');
      eq(evidence.stats.d3dimSoftwareDrawCallsCompleted,0,'no native worker rasterization');
      eq(evidence.stats.d3dimFallbackSoftwareDrawCallsCompleted,0,'no worker fallback rasterization');
      eq(evidence.queued.length,config.states.length*config.samples.length,'all held transitions executed');
      for(const q of evidence.queued){check(q.liveChangedBeforeDrain,'live state changed before drain');
        check(q.messages.includes('batch'),'held production draw batch');}`);
  replace("  const held=[];",`  const held=[];
  const checkVersion=(version,label)=>{
    check(typeof version==='string',label+' present');
    if(config.webglVersion!=='auto')
      check(new RegExp('^WebGL '+config.webglVersion+'[.]0').test(version),label+' '+version);
  };`);
  // Cleanup belongs to the ordinary fixture; no resource-lifetime contract.
  return source;
}

function apiVersion(value='auto') {
  assert(['auto','1','2'].includes(value),'--webgl must be 1, 2 or auto');
  return value==='auto'?value:Number(value);
}

// Exercise real legacy constructors with only the GPU device replaced. No
// browser or sampler proxy can qualify runtime pixels through these controls.
function versionControls() {
  for(const version of [1,2,'auto',undefined]) {
    let seen;
    const context={D3D9Backend:{Device:class {constructor(canvas,options){seen=options?.webglVersion;}}}};
    vm.runInNewContext(fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8'),context);
    const gpu=new context.D3DIMGpu.D3DIMGpu({webglVersion:version,createCanvas:()=>({})});
    assert(gpu._target({rt:1,dib:1,width:2,height:2,bpp:32}));
    assert.equal(seen,version,'legacy device forwards explicit WebGL version');
    let workerOptions;
    const gl={VERSION:1,RENDERER:2,getExtension:()=>null,getParameter:k=>k===1?'WebGL 1.0 control':'control renderer'};
    const worker={D3DIMGpu:{D3DIMGpu:class {
      constructor(options){workerOptions=options;this.targets=new Map([[1,{device:{gpu:{gl}}}]]);}
      call(){return 1;} snapshot(){return {drawCalls:1};}
    }}};
    vm.runInNewContext(fs.readFileSync(path.join(ROOT,'lib/d3dim-render-worker.js'),'utf8'),worker);
    const adapter=worker.D3DIMRenderWorker.create({instance:{exports:{}},memory:{buffer:new ArrayBuffer(8)},
      backend:'webgl',options:{webglVersion:version}});
    assert.equal(workerOptions.webglVersion,version,'worker forwards explicit WebGL version');
    assert.equal(adapter.execute({opcode:0x20001,wa:0}).glVersion,'WebGL 1.0 control',
      'worker reports context VERSION, independently of request');
  }
  assert.equal(apiVersion('1'),1);assert.equal(apiVersion('2'),2);assert.equal(apiVersion(), 'auto');
  for(const bad of ['0','3','webgl1',''])assert.throws(()=>apiVersion(bad));
  for(const version of [1,2]) {
    const requested=[];
    assert.throws(()=>new (require('../lib/d3d9-backend').Device)({getContext:name=>{
      requested.push(name);return null;
    }},{webglVersion:version}),/WebGL is unavailable/);
    assert.deepEqual(requested,version===1?['webgl','experimental-webgl']:['webgl2'],
      'unavailable explicit version must not silently switch APIs');
  }
  fixtureSource();
}

async function runtime() {
  const dir=process.env.LEGACY_MIRROR_GPU_EVIDENCE;
  const moduleDir=process.env.LEGACY_MIRROR_GPU_MODULE_DIR;
  assert(dir&&moduleDir,'explicit evidence and prebuilt module directories required');
  const source=process.env.LEGACY_MIRROR_GPU_SOURCE;
  assert.match(source||'',/^[0-9a-f]{40}$/,'full Git source identity required');
  fs.mkdirSync(dir,{recursive:true});
  const webglVersion=apiVersion(process.argv.find(a=>a.startsWith('--webgl='))?.slice(8));
  const p=plan(),pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const config={...p,webglVersion,thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
  const evidence={source,webglVersion,status:'RUNNING',node:process.version,
    fixtureSha256:sha(fs.readFileSync(__filename)),adaptedFixtureSha256:sha(fixtureSource()),
    oracleFixtureSha256:sha(fs.readFileSync(path.join(__dirname,'test-legacy-mirror-uv-contract.js'))),
    publicFixtureSha256:sha(fs.readFileSync(path.join(__dirname,'test-legacy-texture-rendered-contract.js'))),
    calc:{path:'test/binaries/calc.exe',sha256:sha(pe)},plan:p,modules:[],results:[],negativeControls:[],requests:[],
    unexecuted:['software (covered by predecessor)','physical hardware GPU','original games / full27']};
  const {startStaticServer,closeServer}=require('./static-server');
  let wasm,browser,server,page;
  const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(evidence,null,2)+'\n');
  try {
    server=await startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){
        evidence.requests.push({url:req.url,sha256:sha(wasm),bytes:wasm.length});
        res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;
      }
      if(req.url!=='/legacy-render-fixture')return false;
      res.writeHead(200,{'Content-Type':'text/html'});
      res.end(scripts.map(p=>`<script src="/${p}"></script>`).join('\n'));return true;
    }});
    evidence.browserOpenedAt=new Date().toISOString();
    browser=await require('puppeteer').launch({headless:true,
      executablePath:process.env.CHROME||'/usr/bin/google-chrome',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.browserPid=browser.process().pid;
    const cdp=await browser.target().createCDPSession();
    evidence.systemInfo=await cdp.send('SystemInfo.getInfo');await cdp.detach();
    const fixture=Function('return ('+fixtureSource()+')')();
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(path.join(moduleDir,name));
      const module={name,sha256:sha(wasm),bytes:wasm.length};evidence.modules.push(module);
      fs.writeFileSync(path.join(dir,name),wasm);
      for(const mode of ['webgl','worker']){
        page=await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/legacy-render-fixture`);
        const result=await page.evaluate(fixture,mode,config,oracle.toString(),null);
        assert.equal(result.status,'PASS');
        assert.equal(result.observations.length,mode==='worker'?1440:480);
        evidence.results.push({module,...result});
        await page.screenshot({path:path.join(dir,name+'-'+mode+'.png')});
        await page.close();page=null;save();
        console.log('PASS '+name+' '+mode+' exact pixels '+result.observations.length);
        for(const filter of [1,2])for(const negative of ['wrap-for-mirror','stale-u','stale-v','coupled-u','coupled-v']){
          page=await browser.newPage();
          await page.goto(`http://127.0.0.1:${server.address().port}/legacy-render-fixture`);
          let failure;
          try {await page.evaluate(fixture,mode,{...config,states:config.states.filter(s=>s.filter===filter)},oracle.toString(),negative);}
          catch(error){failure=String(error);}
          const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
          evidence.negativeControls.push({module,mode,filter,negative,failure,partial});save();
          assert(failure?.includes('PIXEL ORACLE'),'negative must reach rendered pixel failure: '+failure);
          assert(partial.observations.some(o=>JSON.stringify(o.actual)!==JSON.stringify(o.expected)),
            'negative must observe a wrong actual rendered pixel');
          assert(partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0),'successful public draw');
          if(mode==='webgl')assert(partial.observations.some(o=>o.webglRGBA&&o.glError===0),'actual WebGL readPixels');
          if(mode==='worker')assert(partial.observations.some(o=>o.workerStats?.drawCalls>0&&
            o.workerStats.requestedBackend==='webgl'&&o.workerStats.fallbacks===0), 'actual queued WebGL draw');
          await page.close();page=null;
          console.log('PASS rendered negative '+name+' '+mode+' '+filter+' '+negative);
        }
      }
    }
    evidence.status='PASS';
  }catch(error){
    evidence.status='FAIL / remaining combinations unexecuted';evidence.error=error.stack||String(error);
    if(page)evidence.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence||null).catch(()=>null);
    throw error;
  }finally{
    if(browser)await browser.close();evidence.browserClosedAt=new Date().toISOString();
    if(server)await closeServer(server);evidence.helpersClosedAt=new Date().toISOString();save();
  }
}

if(require.main===module){
  if(process.argv.includes('--plan')){versionControls();console.log(JSON.stringify({webglVersion:apiVersion(process.argv.find(a=>a.startsWith('--webgl='))?.slice(8)),...plan()},null,2));}
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={fixtureSource,apiVersion,versionControls};
