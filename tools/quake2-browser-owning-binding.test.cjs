'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),Module=require('node:module');
const {hash}=require('./quake2-owning-load-witness.cjs');
const ROOT=path.resolve(__dirname,'..');
function fixtures() {
  const file=path.join(__dirname,'quake2-native-write-epoch.test.cjs');
  let script=fs.readFileSync(file,'utf8');
  assert.equal(hash(script),'d061ab49150a52f9af603ae20763d2fb53ef9fa18f14c55475a59a344004d4cf');
  script=script.slice(0,script.lastIndexOf('(async()=>{'))+'\nmodule.exports=m.exports;';
  const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(script,file);
  const driver=path.join(ROOT,'scratch/runs/20261108-quake2-native-cmodel-binding-2205/native-load-use.cjs');
  const originalSource=fs.readFileSync(driver,'utf8');
  assert.equal(hash(originalSource),'e6fde32e696e4b544eb188fef2380372f5884a3f68a07754a7e6fe7e0446c186');
  return {fixtureSource:m.exports.fixture.toString(),originalSource};
}
async function main() {
  const inputs=fixtures(),requests=[],results=[],targets=new Set(),destroyed=[];
  let corrupt=null,browser,deadline,report;
  const server=http.createServer((req,res)=>{
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    const url=new URL(req.url,'http://localhost');
    requests.push(url.pathname);
    if(url.pathname==='/'){res.end('<!doctype html><title>Quake II bounded owning Worker test</title>');return;}
    const filename=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
    if(!filename.startsWith(ROOT+path.sep)||!fs.existsSync(filename)){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.wasm')?'application/wasm':'application/octet-stream');
    if(corrupt===url.pathname){const b=fs.readFileSync(filename);b[b.length-1]^=1;res.end(b);return;}
    fs.createReadStream(filename).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    // Independent watchdog process as well as Puppeteer's protocol deadline.
    const watchdog=require('node:child_process').spawn(process.execPath,['-e',
      'let p;setTimeout(()=>{console.error("independent browser deadline",p);if(p)try{process.kill(p,"SIGKILL")}catch{}},600000);process.stdin.on("data",b=>p=+b.toString());process.stdin.on("end",()=>process.exit(0));'],
      {stdio:['pipe','ignore','inherit']});
    const watchExit=new Promise(resolve=>watchdog.once('exit',resolve));
    deadline={watchdog,watchExit};
    browser=await require('puppeteer').launch({headless:true,executablePath:'/opt/google/chrome/chrome',
      args:['--no-sandbox','--disable-dev-shm-usage'],protocolTimeout:60000});
    watchdog.stdin.write(String(browser.process().pid));
    const browserExit=new Promise(resolve=>browser.process().once('exit',(code,signal)=>resolve({code,signal})));
    deadline.browserExit=browserExit;
    browser.on('targetcreated',t=>{if(t.type()==='other')targets.add(t);});
    browser.on('targetdestroyed',t=>{if(targets.delete(t))destroyed.push(t.url());});
    const url='http://127.0.0.1:'+server.address().port;
    async function page() {
      const p=await browser.newPage();await p.goto(url);
      for(const script of ['region-map.generated.js','gl-command-stream.js','guest-rpc.js','thread-send-waits.js',
        'process-boot.js','guest-thread-host.js','pe.js','quake2-owning-load-core.js','quake2-browser-load-observer.js'])
        await p.addScriptTag({url:url+'/lib/'+script});
      return p;
    }
    // Actual browser Host -> WorkerLink -> owning Worker, including strict
    // separate defaults. Failed source identity never reaches attachment.
    for(const options of [{},{quake2LoadObservation:'true',quake2NativeWriteObservation:true},
      {quake2NativeWriteObservation:true},{quake2LoadObservation:true},
      {quake2LoadObservation:true,quake2NativeWriteObservation:true}]) {
      const p=await page(),before=requests.length;
      const observation=await p.evaluate(async options=>{
        const host=new GuestThreadHost({module:await WebAssembly.compile(await (await fetch('/build/wine-assembly.wasm')).arrayBuffer()),
          memory:new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),
          sigs:(await (await fetch('/lib/host-import-sigs.generated.json')).json()).sigs,
          hostImports:new Proxy({}, {get:()=>()=>0}),workerUrl:'/lib/guest-worker.js?v=browser-owning-0031',
          clockIntervalMs:0,tickMs:()=>0,...options});
        try{await host.start();return (await host.readQuake2LoadObservation()).observation;}
        finally{await host.stop();}
      },options);
      if(options.quake2LoadObservation!==true) {
        assert.equal(observation,null);
        assert(!requests.slice(before).includes('/lib/quake2-owning-load-core.js'),'default-off Worker loads no observer');
      } else {
        assert(observation);assert.equal(!!observation.nativeStores,options.quake2NativeWriteObservation===true);
        assert.equal(observation.binding.sha256,'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295');
      }
      results.push({startup:options,observation});await p.close();
    }
    for(const control of ['exe-corrupt','cpu-corrupt','secondary-slot','unrelated-module']) {
      const p=await page();
      corrupt=control==='exe-corrupt'?'/test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/quake2.exe':
        control==='cpu-corrupt'?'/build/wine-assembly.wasm':null;
      try {
        const receipt=await p.evaluate(async control=>{
          const worker=new Worker('/lib/guest-worker.js?v=browser-owning-0031');
          let seq=0;
          function ask(message) {
            return new Promise((resolve,reject)=>{
              const id=++seq,t=setTimeout(()=>reject(Error('identity control deadline')),20000);
              worker.onmessage=e=>{if(e.data.seq===id||e.data.t==='ready'){clearTimeout(t);resolve(e.data);}};
              worker.onerror=e=>{clearTimeout(t);reject(Error(e.message));};
              worker.postMessage({...message,seq:id});
            });
          }
          try {
            const init=await ask({t:'init',module:await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])),
              memory:new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),
              sigs:(await (await fetch('/lib/host-import-sigs.generated.json')).json()).sigs,
              slot:control==='secondary-slot'?1:0,endpointIdentity:31,
              quake2LoadObservation:true,quake2NativeWriteObservation:true});
            const observation=await ask({t:'quake2LoadObservation'});
            const exports=init.t==='ready'?await ask({t:'readExports',names:['get_image_base','native_store_get']}):null;
            return {init,observation,exports};
          } finally{worker.terminate();}
        },control);
        if(control==='unrelated-module') {
          assert.equal(receipt.init.t,'ready','compiled canonical bytes replace unrelated caller module');
          assert(receipt.observation.observation.binding);
          assert(receipt.exports.values.get_image_base!==undefined,'actual CPU exports, not empty caller module');
        } else {
          assert.equal(receipt.init.t,'error');
          assert.match(receipt.init.message,control==='secondary-slot'?/slot zero/:/PATHHASH/);
          assert.equal(receipt.observation.observation,null,'identity failure precedes observer attachment');
        }
        results.push({control,receipt});
      } finally {corrupt=null;await p.close();}
    }
    for(const scenario of (process.argv.slice(2).length?process.argv.slice(2):
      ['free','nativeSameModel','nativeRestoreModel','nativeSameTable','nativeRestoreTable','hiddenSameBytes','reload','traceGap','resetGap','ownerReplacement'])) {
      const pair={scenario};
      for(const enabled of [false,true]) {
        const p=await page();
        try {
          await p.evaluate(require('./quake2-browser-worker-harness.cjs').install,inputs);
          pair[enabled?'on':'off']=await p.evaluate((enabled,scenario)=>runOwningFixture(enabled,scenario),enabled,scenario);
        } finally {await p.close();}
      }
      assert.deepEqual(pair.on.state,pair.off.state,scenario+' architecture/lazy flags');
      assert.equal(pair.on.guestHash,pair.off.guestHash,scenario+' declared direct memory');
      assert.equal(pair.on.sourceMemoryHash,pair.off.sourceMemoryHash,scenario+' sparse source');
      assert(pair.on.lifecycle.terminationAwaited&&pair.off.lifecycle.terminationAwaited);
      results.push(pair);
    }
    // Target destruction is the observable browser exit signal. terminate()
    // itself has no exit-code/event API in the web platform.
    const until=Date.now()+5000;
    while(targets.size&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(targets.size,0,'all actual browser Worker targets destroyed');
    assert.equal(destroyed.length,9+2*(results.filter(r=>r.scenario).length));
    report={pass:true,browser:await browser.version(),cpuSHA:hash(fs.readFileSync('build/wine-assembly.wasm')),
      testSHA:hash(fs.readFileSync(__filename)),results,requests,workerTargetsDestroyed:destroyed,
      independentWatchdog:{pid:watchdog.pid,prearmed:true,browserPID:browser.process().pid}};
  } finally {
    if(browser)await browser.close();
    if(deadline){
      if(deadline.browserExit){const exit=await deadline.browserExit;if(report)report.browserExit=exit;}
      deadline.watchdog.stdin.end();const code=await deadline.watchExit;assert.equal(code,0);
      if(report)report.independentWatchdog.wait=code;
    }
    await new Promise(resolve=>server.close(resolve));
  }
  console.log(JSON.stringify({...report,serverClosed:true}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixtures};
