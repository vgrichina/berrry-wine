'use strict';
// One original registered Jazz observation. Runtime and helper imports come
// from one Git revision; original media is read in place and never replaced.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),crypto=require('node:crypto'),vm=require('node:vm'),Module=require('node:module');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function appendObservation(out,name,row){fs.appendFileSync(path.join(out,name+'.jsonl'),JSON.stringify(row)+'\n');}
async function run(out,commit,backend,action='original',fixtureFile){
  if(!['software','webgl'].includes(backend))throw Error('invalid declared backend');
  fs.mkdirSync(out,{recursive:true});
  const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n');
  // Verify the bootstrap before executing it, then inherit pinned JS/JSON
  // helpers through Node's ordinary module loader, without a source checkout.
  const helper='tools/boids-current-runtime.cjs',published=cp.execFileSync('git',['show',commit+':'+helper]);
  if(!published.equals(fs.readFileSync(path.join(ROOT,helper))))throw Error('runtime bootstrap differs from selected Git');
  const {gitFiles}=require('./boids-current-runtime.cjs'),files=gitFiles(commit);
  if(action==='fixture')files.set('test/test-revolt-software-capture-latency-cause.cjs',cp.execFileSync('git',['show',commit+':test/test-revolt-software-capture-latency-cause.cjs']));
  const read=fs.readFileSync,extensions={...Module._extensions};
  fs.readFileSync=function(file,options){const b=typeof file==='string'&&files.get(path.relative(ROOT,path.resolve(file)));if(!b)return read.apply(this,arguments);const enc=typeof options==='string'?options:options?.encoding;return enc?b.toString(enc):Buffer.from(b);};
  for(const ext of ['.js','.cjs','.json'])Module._extensions[ext]=(m,file)=>{const b=files.get(path.relative(ROOT,file));if(!b)return (extensions[ext]||extensions['.js'])(m,file);if(ext==='.json')m.exports=JSON.parse(b);else m._compile(b.toString(),file);};
  if(action==='fixture'){
    const fixture=path.join(out,'authored-input');
    require('./boids-current-fixture.cjs').prepare(fixture,false,false,backend==='webgl'?'blue':false);
    if(backend==='webgl')process.env.BOIDS_DEVICE2='blue';
    await require('./boids-current-run.cjs').run(out,commit,backend,'worker',path.join(fixture,'fixture.exe'));
    return;
  }
  const authored=action==='closure-fixture',appId=authored?'jazz_native_authored':'scr_jazz';
  if(action!=='original'&&!authored)throw Error('invalid action');
  const {compile}=require('./boids-current-runtime.cjs'),{installDriver}=require('./boids-current-driver.cjs'),{PNG}=require('pngjs');
  const context={module:{exports:{}},console,URL,require:n=>{if(n!=='./app-file-sizes.generated.js')throw Error('registry dependency');return JSON.parse('{}');}};
  // Registry uses its generated sizes as a JS module, not JSON.
  const sizes={module:{exports:{}}};vm.runInNewContext(files.get('lib/app-file-sizes.generated.js').toString(),sizes);context.require=()=>sizes.module.exports;
  vm.runInNewContext(files.get('lib/apps.js').toString(),context);
  const app=context.module.exports.APPS.scr_jazz;
  if(app.exe!=='binaries/screensavers/JAZZ.SCR'||app.args!=='/s'||app.presentCap!==60||app.cliTickMsPerBatch!==2||app.files.length!==3)throw Error('unexpected registered Jazz');
  const sourcePins=[...files].map(([path,b])=>({path,size:b.length,sha256:sha(b)})),media=[];
  const addMedia=n=>{const b=read(path.join(ROOT,n));files.set(n,b);media.push({path:n,size:b.length,sha256:sha(b)});};
  for(const n of [app.exe,...app.files.map(f=>f.url)])addMedia(n);
  // The complete existing shared DLL/font closures remain available to the
  // original loader. Hash each file, including guest d3drm.dll, before clock.
  for(const dir of ['binaries/dlls','test/binaries/tlbs','fonts','icons','images']){
    if(!fs.existsSync(path.join(ROOT,dir)))continue;
    const walk=d=>{for(const e of fs.readdirSync(path.join(ROOT,d),{withFileTypes:true})){const n=d+'/'+e.name;if(e.isDirectory())walk(n);else if(e.isFile()||(e.isSymbolicLink()&&fs.statSync(path.join(ROOT,n)).isFile()))addMedia(n);}};walk(dir);
  }
  if(authored){
    if(!fixtureFile)throw Error('authored fixture PE required');
    const bytes=read(fixtureFile),suffix='\nwindow.wineApps.APPS.jazz_native_authored={exe:"authored/fixture.exe",args:"",presentCap:60,cliTickMsPerBatch:2};\n';
    const registry=files.get('lib/apps.js');files.set('authored/fixture.exe',bytes);files.set('lib/apps.js',Buffer.concat([registry,Buffer.from(suffix)]));
    save('authored-fixture.json',{path:fixtureFile,sha256:sha(bytes),original:false,appId,registryBaseSHA256:sha(registry),registrySuffix:suffix});
  }
  const module=compile(files);files.set('build/wine-assembly.wasm',module);
  fs.writeFileSync(path.join(out,'native.wasm'),module);
  save('pins-before.json',{commit,app,sourcePins,media,foreignWIPAdopted:false,observerRuntimePatches:[]});
  save('module.json',{commit,size:module.length,sha256:sha(module)});
  save('prepared.json',{at:Date.now(),commit,moduleSHA256:sha(module),original:!authored});
  while(!fs.existsSync(path.join(out,'runtime-start.json')))await sleep(20);
  const {deadline}=JSON.parse(read(path.join(out,'runtime-start.json')));
  if(!(deadline>Date.now()&&deadline<=Date.now()+300000))throw Error('invalid fixed deadline');
  let browser,server;const requests=[],logs=[],errors=[],modules=[],tasks=[],targets=[],captures=[];
  // A supervisor deadline can terminate Node before async finally executes.
  // Persist each unique observation when received rather than buffering the
  // only crash/network/module evidence until browser cleanup.
  const append=(name,row)=>appendObservation(out,name,row);
  const terminal={app:appId,original:!authored,backend,mode:'worker',commit,clock:'registered default',nativeSeconds:300,watchdogSeconds:320,inputEvents:[],nativeQuit:false,hostShutdown:true,outcome:'unknown'};
  try{
    server=http.createServer((req,res)=>{const n=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',b=files.get(n),row={at:Date.now(),path:n,status:b?200:404,sha256:b?sha(b):null};requests.push(row);append('requests',row);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.wasm')?'application/wasm':n.endsWith('.html')?'text/html':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'not found');});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));save('server.json',{port:server.address().port});
    browser=await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',headless:true,defaultViewport:{width:1280,height:960},protocolTimeout:Math.max(1,deadline-Date.now()),timeout:Math.max(1,deadline-Date.now()),args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1280,960']});
    const proc=browser.process();const browserWait=new Promise(resolve=>proc.once('close',(code,signal)=>{terminal.browserWait={pid:proc.pid,code,signal,actualWait:true,at:Date.now()};resolve();}));
    save('browser.json',{version:await browser.version(),pid:proc.pid,args:proc.spawnargs});
    const system=await browser.target().createCDPSession();
    save('browser-system-info.json',await system.send('SystemInfo.getInfo'));
    await system.detach();
    async function observe(t){if(!['page','other'].includes(t.type()))return;const s=await t.createCDPSession();s.on('Debugger.scriptParsed',e=>{if(e.scriptLanguage!=='WebAssembly'&&!e.url.startsWith('wasm:'))return;const p=s.send('Debugger.getScriptSource',{scriptId:e.scriptId}).then(r=>modules.push({target:t.url(),sha256:r.bytecode?sha(Buffer.from(r.bytecode,'base64')):null,bytecodeAvailable:!!r.bytecode}));tasks.push(p);p.catch(e=>errors.push(String(e)));});await s.send('Debugger.enable');}
    browser.on('targetcreated',t=>{const p=observe(t);tasks.push(p);p.catch(e=>errors.push(String(e)));});browser.on('targetdestroyed',t=>targets.push({url:t.url(),type:t.type(),at:Date.now(),actualTargetDestroyed:true}));
    const page=(await browser.pages())[0];await observe(page.target());
    await page.evaluateOnNewDocument('('+installDriver.toString()+')(globalThis,'+JSON.stringify({app:appId,mode:'worker',deadline,trace:true})+');');
    await page.evaluateOnNewDocument(()=>{globalThis.__jazzInputs=[];for(const type of ['keydown','keyup','pointerdown','pointerup','mousedown','mouseup'])document.addEventListener(type,e=>__jazzInputs.push({type,trusted:e.isTrusted,at:Date.now()}),true);});
    page.on('console',m=>{const row={at:Date.now(),type:m.type(),text:m.text()};logs.push(row);append('console',row);});page.on('pageerror',e=>{errors.push(String(e));append('errors',{at:Date.now(),error:String(e)});});
    terminal.url=`http://127.0.0.1:${server.address().port}/index.html?app=${appId}&threads&d3d-renderer=${backend}`;
    terminal.launchedAt=Date.now();await page.goto(terminal.url,{waitUntil:'domcontentloaded',timeout:Math.max(1,deadline-Date.now())});
    const fatal=page.waitForFunction(()=>document.querySelector('#wine-crash-report .wine-crash-text')?.value||false,{polling:100,timeout:Math.max(1,deadline-Date.now())}).then(async h=>{const report=await h.jsonValue();save('startup-fatal.json',{at:Date.now(),report});throw Error('Original Jazz reported a fatal startup error; see startup-fatal.json');});
    fatal.catch(()=>{});
    save('readiness.json',await Promise.race([page.evaluate(()=>__boidsDriver.ready()),fatal]));
    for(const delay of authored?[15000]:[60000,30000,30000]){
      await sleep(delay);const started=Date.now(),index=captures.length;save('capture-start.json',{index,at:started,boundMs:3000});let timer;
      const snapshot=await Promise.race([page.evaluate(()=>__boidsDriver.capture()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DISPLAY_UNKNOWN outer 3000ms deadline')),3000);})]).finally(()=>clearTimeout(timer));
      if(Date.now()>=Math.min(deadline,started+3000))throw Error('DISPLAY_UNKNOWN late outer delivery');
      if(authored)save('literal-reference.json',require('./boids-current-fixture.cjs').qualify(snapshot,'worker'));
      for(const kind of ['source','output']){const d=snapshot.metadata[kind],png=new PNG({width:d.width,height:d.height});png.data=Buffer.from(snapshot[kind],'base64');if(png.data.length!==d.width*d.height*4)throw Error('incomplete frame');fs.writeFileSync(path.join(out,`selected-${index}-${kind}.png`),PNG.sync.write(png));}
      const row={index,startedAt:started,completedAt:Date.now(),elapsedMs:Date.now()-started,metadata:snapshot.metadata,identity:snapshot.identity};captures.push(row);save(`selected-${index}.json`,row);
    }
    terminal.inputEvents=await page.evaluate(()=>__jazzInputs);terminal.outcome='observed';
    save('host-shutdown.json',await page.evaluate(async id=>{
      const w=runningApps.find(a=>a.name===id).wine;
      w.stop({repaint:false});
      const guest=await w._guestRuntimeStopPromise;
      await w._renderWorkerRetirement;
      return {kind:'explicit host shutdown',nativeQuit:false,guestResult:guest,
        renderRetired:w._renderWorkerRetired,renderError:String(w._renderWorkerRetirementError||''),at:Date.now()};
    },appId));
    // Target destruction is recorded independently of host retirement promises.
    const retirementEnd=Math.min(deadline,Date.now()+2000);
    while(Date.now()<retirementEnd&&!targets.some(t=>t.url.includes('d3d-render-worker.js')))await sleep(10);
    await browser.close();await browserWait;browser=null;
  }catch(e){terminal.outcome='blocked';terminal.error=String(e);terminal.endpointPermanentlyClosed=true;}
  finally{
    if(browser){const p=browser.process(),wait=new Promise(r=>p.exitCode!==null?r():p.once('close',(code,signal)=>{terminal.browserWait={pid:p.pid,code,signal,actualWait:true};r();}));await browser.close().catch(e=>errors.push(String(e)));await wait;}
    if(server)await new Promise(r=>server.close(r));await Promise.allSettled(tasks);
    save('requests.json',requests);save('console.json',logs);save('errors.json',errors);save('modules.json',modules);save('target-closures.json',targets);
    save('pins-after.json',{media:media.map(p=>({...p,sha256After:sha(read(path.join(ROOT,p.path)))}))});
    terminal.captures=captures;terminal.endedAt=Date.now();save('terminal.json',terminal);
  }
  if(terminal.outcome!=='observed')throw Error(terminal.error);
}
module.exports={run,appendObservation};
if(require.main===module)run(...process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
