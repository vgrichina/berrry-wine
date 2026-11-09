'use strict';
// Exercise host.js itself, its real browser GuestThreadHost and owning Worker.
// No guest instructions, original game, injected observation replies or box.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main() {
  const requests=[],results=[],targets=new Set(),destroyed=[];
  let corrupt=null,browser,browserExit,watchdog,watchExit,report;
  const server=http.createServer((req,res)=>{
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/'){res.end('<!doctype html><title>Quake II startup failure boundary</title>');return;}
    const file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.wasm')?'application/wasm':'application/octet-stream');
    const b=fs.readFileSync(file);
    const changed=corrupt===url.pathname;if(changed)b[b.length-1]^=1;
    requests.push({path:url.pathname,size:b.length,sha256:sha(b),changed});res.end(b);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port,uuid=crypto.randomUUID(),deadline=Date.now()+180000;
  report={watchdogPlan:{id:uuid,deadline},port,results,requests};
  try {
    // Separate observable process, armed before Chromium, with a frozen UUID
    // and deadline. Closing stdin joins it after the browser's actual exit.
    watchdog=cp.spawn(process.execPath,['-e',
      'const [id,d]=process.argv.slice(1);let p;const t=setTimeout(()=>{if(p)try{process.kill(p,"SIGKILL")}catch{};process.exitCode=1;process.stdin.destroy()},+d-Date.now());console.log(JSON.stringify({id,deadline:+d,pid:process.pid}));process.stdin.on("data",b=>p=+b.toString());process.stdin.on("end",()=>{clearTimeout(t);process.exit(0)})',uuid,String(deadline)],
      {stdio:['pipe','pipe','inherit']});
    watchExit=new Promise(resolve=>watchdog.once('exit',(code,signal)=>resolve({code,signal})));
    const armed=await new Promise((resolve,reject)=>{
      watchdog.stdout.once('data',b=>resolve(JSON.parse(b)));
      watchdog.once('exit',code=>reject(Error('watchdog exited before readiness: '+code)));
      watchdog.once('error',reject);
    });
    assert.equal(armed.id,uuid);assert.equal(armed.deadline,deadline);
    report.watchdog={...armed,prearmed:true};
    browser=await require('puppeteer').launch({headless:true,executablePath:'/opt/google/chrome/chrome',
      args:['--no-sandbox','--disable-dev-shm-usage'],protocolTimeout:30000});
    browserExit=new Promise(resolve=>browser.process().once('exit',(code,signal)=>resolve({code,signal})));
    report.chromePid=browser.process().pid;
    report.chromeStart=fs.readFileSync('/proc/'+report.chromePid+'/stat','utf8');
    report.profile=browser.process().spawnargs.find(s=>s.startsWith('--user-data-dir=')).split('=').slice(1).join('=');
    watchdog.stdin.write(String(browser.process().pid));
    browser.on('targetcreated',t=>{if(t.type()==='other')targets.add(t);});
    browser.on('targetdestroyed',t=>{if(targets.delete(t))destroyed.push(t.url());});
    const base='http://127.0.0.1:'+port;
    async function runCase(options) {
      const p=await browser.newPage();
      try {
        await p.goto(base);
        for(const script of ['lib/region-map.generated.js','lib/gl-command-stream.js','lib/guest-rpc.js',
          'lib/thread-send-waits.js','lib/process-boot.js','lib/guest-thread-host.js','host.js'])
          await p.addScriptTag({url:base+'/'+script});
        // Compile unchanged bytes before the canonical owning fetch is altered.
        const cpu=fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'));
        assert.equal(sha(cpu),'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295');
        corrupt=options.corrupt==='cpu'?'/build/wine-assembly.wasm':options.corrupt==='exe'?
          '/test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/quake2.exe':null;
        const value=await p.evaluate(async({options,cpu})=>{
          const logs=[],w=Object.create(WineAssembly.prototype);
          const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
          const module=await WebAssembly.compile(new Uint8Array(cpu));
          const host=new Proxy({memory},{get:(t,k)=>k in t?t[k]:()=>0});
          const instance=await WebAssembly.instantiate(module,{host});
          Object.assign(w,{memory,instance,_wasmModule:module,_mainImports:{host},renderer:{},
            logToUI:msg=>logs.push(msg),_guestTickMs:()=>0});
          window.WINE_THREADS=options.threads??true;
          window.WINE_QUAKE2_LOAD_OBSERVATION=options.load;
          window.WINE_QUAKE2_NATIVE_WRITE_OBSERVATION=options.native;
          if(options.appOptOut)w.threads=false;
          if(options.watApp)w._watAppRequested=true;
          if(options.missingHost)globalThis.GuestThreadHost=undefined;
          if(options.nonisolated)Object.defineProperty(globalThis,'crossOriginIsolated',{value:false});
          // Change the global during real async startup to test request capture.
          if(options.dropFlag){const start=GuestThreadHost.prototype.start;
            GuestThreadHost.prototype.start=function(){window.WINE_QUAKE2_LOAD_OBSERVATION=false;return start.call(this);};}
          let error=null,observation=null,workerLink;
          const selected=options.badImport?await WebAssembly.compile(new Uint8Array(
            [0,97,115,109,1,0,0,0,1,4,1,96,0,0,2,9,1,1,120,3,98,97,100,0,0])):module;
          try {await w._maybeStartGuestWorker(selected);
            if(w.guestWorker){workerLink=w.guestWorker.link;observation=await w.guestWorker.readQuake2LoadObservation();}}
          catch(e){error={message:e.message,cause:e.cause?.message};}
          finally {const retirement=w._stopGuestRuntime();if(retirement){const r=await retirement;if(!r.ok)throw r.error;}}
          return {error,observation,logs,hasWorker:!!w.guestWorker,starting:!!w._guestWorkerStarting,
            retired:!!w._guestRuntimeStopPromise,linkStopped:workerLink?workerLink._stopped:null,
            lockAtomic:instance.exports.get_lock_atomic_mode?.()??null};
        },{options,cpu:[...cpu]});
        results.push({options,...value});return value;
      } finally {corrupt=null;await p.close();}
    }
    const first=await runCase({load:true,native:true,corrupt:'cpu'});
    assert(first.error,'production host silently accepted failed owning observation: '+JSON.stringify(first));
    assert.match(first.error.message,/PATHHASH/);assert(first.retired);assert(!first.starting&&!first.hasWorker);
    assert(!first.logs.some(x=>x.includes('running single-threaded')),'failed required observation must not fall back');
    if(!process.argv.includes('--reproduce')) {
      for(const options of [{load:true,native:true,corrupt:'exe'},
        {load:true,native:false,corrupt:'cpu'},{load:true,native:true,corrupt:'cpu',dropFlag:true}]) {
        const r=await runCase(options);assert.match(r.error?.message||'',/PATHHASH/);
        assert(r.retired&&!r.starting&&!r.hasWorker);assert(!r.logs.some(x=>x.includes('running single-threaded')));
      }
      for(const extra of [{threads:false},{appOptOut:true},{missingHost:true},{nonisolated:true},{watApp:true}]) {
        const r=await runCase({load:true,native:true,...extra});
        assert.match(r.error?.message||'',/Quake II owning observation/);assert(!r.hasWorker&&!r.starting);
      }
      for(const options of [{},{load:'true',native:true},{native:true},{load:true,native:false},{load:true,native:true}]) {
        const r=await runCase(options);assert.equal(r.error,null);assert(r.hasWorker&&r.linkStopped);
        const o=r.observation.observation;
        if(options.load===true){assert(o);assert.equal(!!o.nativeStores,options.native===true);
          assert.equal(o.binding.sha256,'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295');}
        else assert.equal(o,null);
      }
      const fallback=await runCase({badImport:true});
      assert.equal(fallback.error,null);assert(fallback.retired&&!fallback.hasWorker&&!fallback.starting);
      assert(fallback.logs.some(x=>x.includes('worker start failed')&&x.includes('running single-threaded')));
      for(const extra of [{threads:false},{appOptOut:true},{missingHost:true},{nonisolated:true},{watApp:true}]) {
        const r=await runCase(extra);assert.equal(r.error,null);assert(!r.hasWorker&&!r.starting);
      }
    }
    report.pass=true;
  } finally {
    if(browser){await browser.close();report.browserExit=await browserExit;report.targetsRemaining=targets.size;report.destroyed=destroyed;
      report.chromeAbsent=!fs.existsSync('/proc/'+report.chromePid);report.profileAbsent=!fs.existsSync(report.profile);}
    if(watchdog){watchdog.stdin.end();report.watchdogExit=await watchExit;}
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    if(report){report.serverClosed=true;report.completedAt=new Date().toISOString();console.log(JSON.stringify(report));}
  }
  assert.equal(report.browserExit.code,0);assert.equal(report.watchdogExit.code,0);
  assert.equal(report.targetsRemaining,0);assert(report.chromeAbsent&&report.profileAbsent);
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
