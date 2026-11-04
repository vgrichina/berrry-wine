#!/usr/bin/env node
'use strict';

// Actual browser WebGL and GuestWorkerLink -> RenderWorker pixels. Prebuilt
// modules only; --plan does not launch a browser or qualify a backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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
        eq(row.workerStats.fallbacks,0,'observed worker no fallback');
        eq(row.workerStats.errors,0,'observed worker no errors');
        eq(row.workerStats.d3dimSoftwareDrawCallsCompleted,0,'observed worker no native rasterization');
        eq(row.workerStats.d3dimFallbackSoftwareDrawCallsCompleted,0,'observed worker no fallback rasterization');
        check(row.workerStats.glRenderer&&row.workerStats.renderEndpointId,'observed actual worker identity');
      }
      eq(actual,expected,'PIXEL ORACLE '+label);`);
  replace("await until(()=>lastStats?.stats.drawCalls===drawCount,'all production GPU stats');evidence.stats=lastStats.stats;",
    `await until(()=>lastStats?.stats.drawCalls===drawCount,'all production GPU stats');evidence.stats=lastStats.stats;
      evidence.workerIdentity={guestUrl:'/lib/guest-worker.js',renderUrl:'/lib/d3d-render-worker.js',
        endpointId:lastStats.stats.renderEndpointId,api:lastStats.stats.renderApi,
        backend:lastStats.stats.requestedBackend,renderer:lastStats.stats.glRenderer};
      eq(evidence.workerIdentity.api,'legacy','actual render worker API');
      eq(evidence.workerIdentity.backend,'webgl','actual render worker backend');
      check(evidence.workerIdentity.endpointId&&evidence.workerIdentity.renderer,'actual worker endpoint and renderer');
      eq(evidence.stats.d3dimSoftwareDrawCallsCompleted,0,'no native worker rasterization');
      eq(evidence.stats.d3dimFallbackSoftwareDrawCallsCompleted,0,'no worker fallback rasterization');
      eq(evidence.queued.length,config.states.length*config.samples.length,'all held transitions executed');
      for(const q of evidence.queued){check(q.liveChangedBeforeDrain,'live state changed before drain');
        check(q.messages.includes('batch'),'held production draw batch');}`);
  // Cleanup belongs to the ordinary fixture; no resource-lifetime contract.
  return source;
}

async function runtime() {
  const dir=process.env.LEGACY_MIRROR_GPU_EVIDENCE;
  const moduleDir=process.env.LEGACY_MIRROR_GPU_MODULE_DIR;
  assert(dir&&moduleDir,'explicit evidence and prebuilt module directories required');
  const source=process.env.LEGACY_MIRROR_GPU_SOURCE;
  assert.match(source||'',/^[0-9a-f]{40}$/,'full Git source identity required');
  fs.mkdirSync(dir,{recursive:true});
  const p=plan(),pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const config={...p,thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
  const evidence={source,status:'RUNNING',node:process.version,
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
  if(process.argv.includes('--plan')){fixtureSource();console.log(JSON.stringify(plan(),null,2));}
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={fixtureSource};
