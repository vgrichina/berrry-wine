#!/usr/bin/env node
'use strict';
// Reuse the public x86 producer and independent equations, with the actual
// WineAssembly process methods, RenderWorker.Manager and endpoint factory.
const {producer,scenario}=require('./test-opengl-fragment-composition-web');

async function installRoute() {
  globalThis.createFactoryCompositionRoute=async({module,memory,e,contexts,versions,fail})=>{
    const process=Object.create(WineAssembly.prototype);
    Object.assign(process,{memory,_wasmModule:module,instance:{exports:e}});
    const manager=await process._getRenderWorkerManager();
    await manager.ready;
    const info={workerUrl:manager.worker.url||'lib/d3d-render-worker.js',options:[],
      physicalTerminated:false,heapAdopted:null,closed:false};
    let held=false,pending=[],port,stopped=false;
    const post=manager.worker.postMessage.bind(manager.worker);
    const terminate=manager.worker.terminate.bind(manager.worker);
    manager.worker.terminate=()=>{info.physicalTerminated=true;return terminate();};
    manager.worker.postMessage=message=>{
      if(held&&message.t==='render-message')pending.push(message);else post(message);
    };
    manager.worker.addEventListener('error',event=>fail(Error(event.message)));
    manager.worker.addEventListener('message',({data:m})=>{
      if(m.t==='composition-context')contexts.push(m);
      if(m.t==='error')fail(Error(m.error));
      if(m.t==='render-event'&&m.message.t==='render-response'){
        const result=m.message.value;
        if(result?.webglVersion)versions.push(result.webglVersion);
        if(result?.producerConfig?.[0]===1)info.nativeSoftware=true;
      }
    });
    return {info,
      async createEndpoint(options){
        info.options.push({...options});
        port=await process._createRenderWorkerEndpoint(options);
        return port;
      },
      hold(){held=true;},
      pendingRequests(){return port.requests.size;},
      release(){held=false;for(const message of pending)post(message);pending=[];},
      async close(){
        if(stopped)return;stopped=true;
        // On a failing assertion, release only existing valid publications.
        held=false;for(const message of pending)post(message);pending=[];
        if(port&&!port.closed)await port.terminate();
        const retired=await manager.stop();
        info.heapHead=retired.heapHead;info.heapAdopted=retired.heapAdopted??0;
        info.closed=manager.ports.size===0&&manager.pending.size===0&&manager.queuedBytes===0;
        if(!info.closed||!info.physicalTerminated)throw Error('physical process retirement incomplete');
      }};
  };
}

// Observation only: context creation still belongs to the unchanged production
// worker script and factory. No endpoint, packet, or raster operation is replaced.
function contextProbe() {
  const get=OffscreenCanvas.prototype.getContext;
  OffscreenCanvas.prototype.getContext=function(type,...args){
    const gl=Reflect.apply(get,this,[type,...args]);
    if(gl&&/^webgl/.test(type)){
      const ext=gl.getExtension('WEBGL_debug_renderer_info');
      postMessage({t:'composition-context',type,version:gl.getParameter(gl.VERSION),
        actualVersion:typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext?2:1,
        renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)});
    }return gl;
  };
}

async function main(){
  const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
  const {execFileSync}=require('child_process');
  const {startStaticServer,closeServer}=require('./static-server');
  const root=path.resolve(__dirname,'..'),run=process.env.GL_PROCESS_FACTORY_EVIDENCE;
  const browserMs=Number(process.env.GL_PROCESS_FACTORY_MS||180000);
  assert(Number.isInteger(browserMs)&&browserMs>0&&browserMs<=180000,'bounded browser budget');
  if(process.env.GL_PROCESS_FACTORY_CUTOFF){
    const cutoff=Date.parse(process.env.GL_PROCESS_FACTORY_CUTOFF);
    assert(Date.now()+180000+180000<cutoff,'full browser and cleanup reserves before cutoff');
  }
  const report={startedAt:new Date().toISOString(),results:[],box:{id:'NA',state:'NA',expiry:'NA'},
    git:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()};
  if(run)fs.mkdirSync(run,{recursive:true});
  const save=()=>{if(run){const target=path.join(run,'result.json');
    fs.writeFileSync(target+'.tmp',JSON.stringify(report,null,2));fs.renameSync(target+'.tmp',target);}};
  report.inputs=['build/wine-assembly.wasm','build/wine-assembly.compat.wasm','test/binaries/calc.exe'].map(name=>{
    const bytes=fs.readFileSync(path.join(root,name));return {path:name,bytes:bytes.length,
      sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
  const production=fs.readFileSync(path.join(root,'lib/d3d-render-worker.js'),'utf8');
  const server=await startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/'){res.end('<!doctype html><title>Production GL process factory composition</title>');return true;}
    if(pathname==='/test/fragment-producer.js'){
      res.setHeader('Content-Type','text/javascript');res.end('('+producer.toString()+')()');return true;}
    if(pathname==='/lib/d3d-render-worker.js'){
      res.setHeader('Content-Type','text/javascript');res.end("'use strict';\n("+contextProbe.toString()+')();\n'+production);return true;}
    return false;
  }});
  let browser,timer;
  const start=Date.now();
  try{
    timer=setTimeout(()=>browser?.process().kill('SIGKILL'),browserMs);
    browser=await require('puppeteer').launch({headless:true,executablePath:'/opt/google/chrome/chrome',
      args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:45000});
    report.chromePid=browser.process().pid;report.browser=await browser.version();
    const cdp=await browser.target().createCDPSession();report.gpu=(await cdp.send('SystemInfo.getInfo')).gpu;await cdp.detach();
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm'])for(const selection of ['default','webgl','software']){
      const page=await browser.newPage();
      try{
        await page.goto('http://127.0.0.1:'+server.address().port+'/');
        for(const script of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat','render-worker','gl-render-host','guest-rpc'])
          await page.addScriptTag({path:path.join(root,'lib',script+'.js')});
        await page.addScriptTag({path:path.join(root,'host.js')});
        await page.evaluate(installRoute);
        const result=await Promise.race([page.evaluate(scenario,{name,apiVersion:1,
          backend:selection==='default'?null:selection,processFactory:true}),
          new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('scenario 35s cutoff')),35000);t.unref();})]);
        result.selection=selection;
        assert.deepEqual(result.processFactory.options,[{api:'gl',backend:selection==='software'?'software':'webgl'}]);
        assert.equal(result.processFactory.closed,true);assert.equal(result.processFactory.physicalTerminated,true);
        if(selection==='software')assert.equal(result.processFactory.nativeSoftware,true);
        assert.equal(result.packetStats.copiedBatches,0);
        report.results.push(result);save();console.log('PASS',name,selection,JSON.stringify(result.observations));
        if(run)await page.screenshot({path:path.join(run,name+'.'+selection+'.png')});
      }catch(error){
        report.failedScenario={name,selection,error:String(error.stack||error)};
        report.progress=await page.evaluate(()=>globalThis.fragmentProgress).catch(()=>null);
        if(run)await page.screenshot({path:path.join(run,'failure.png'),timeout:5000}).catch(()=>{});
        throw error;
      }finally{await page.close();}
    }
    assert.equal(report.results.length,6);report.passed=true;
  }catch(error){report.passed=false;report.error=String(error.stack||error);throw error;}
  finally{
    clearTimeout(timer);
    if(browser){await browser.close();report.chromeClosed=browser.process().exitCode!==null||browser.process().signalCode!==null;}
    await closeServer(server);report.serverClosed=!server.listening;
    report.browserWallMs=Date.now()-start;report.endedAt=new Date().toISOString();save();
  }
}
module.exports={installRoute,contextProbe};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
