#!/usr/bin/env node
'use strict';
// Actual production guest and render Workers; no synthetic Release or decoder.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const os=require('os'),assert=require('node:assert/strict');
const {compileSrcWasm}=require('./compile-src');
const {startStaticServer,closeServer}=require('./static-server');
const extraWat=require('./helpers/palette-worker-wat');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Delay only the endpoint's supported schedule callback. The production
// Worker still owns dispatch, native execution, completion and retirement.
const renderBootstrap=String.raw`
importScripts('d3d-render-worker.js');
const paletteSchedule=scheduleExclusive, paletteReceive=self.onmessage;
let paletteHeld=false, paletteCallbacks=[];
scheduleExclusive=fn=>{
  if(!paletteHeld)return paletteSchedule(fn);
  paletteCallbacks.push(fn);
  self.postMessage({t:'palette-scheduled',count:paletteCallbacks.length});
};
self.onmessage=event=>{
  const m=event.data;
  if(m.t!=='palette-control')return paletteReceive(event);
  if(m.action==='hold')paletteHeld=true;
  if(m.action==='flush'){
    paletteHeld=false;
    for(const fn of paletteCallbacks.splice(0))paletteSchedule(fn);
  }
  messageChain.then(()=>self.postMessage({t:'palette-control',id:m.id,
    endpoints:endpoints.size,held:paletteCallbacks.length,queuedMessages,queuedBytes,stopping}));
};
`;
(async()=>{
  const root=path.resolve(__dirname,'..');
  const temporary=!process.env.PALETTE_WORKER_EVIDENCE;
  const out=temporary?fs.mkdtempSync(path.join(os.tmpdir(),'palette-workers-')):path.dirname(path.resolve(process.env.PALETTE_WORKER_EVIDENCE));
  fs.mkdirSync(out,{recursive:true});
  const source=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const pool=new Map(),inputs=[];
  // Other agents own live lib WIP. Serve exactly the committed production
  // transport and every transitive Worker dependency, never that foreign WIP.
  for(const file of cp.execFileSync('git',['ls-tree','-r','--name-only',source,'lib'],{encoding:'utf8'}).trim().split('\n')){
    if(!/\.(js|json)$/.test(file))continue;
    const bytes=cp.execFileSync('git',['show',`${source}:${file}`],{maxBuffer:16*1024*1024});
    pool.set('/'+file,bytes);inputs.push({path:file,sha256:sha(bytes),source});
  }
  const fixture='test/helpers/palette-worker-browser.js';
  pool.set('/'+fixture,fs.readFileSync(path.join(root,fixture)));
  pool.set('/lib/palette-render-worker.js',Buffer.from(renderBootstrap));
  const compiledInputs=[];
  const {sourceTextFromBytes}=require('../tools/watx');
  const wasm=compileSrcWasm((file,workspaceSource)=>{
    const bytes=cp.execFileSync('git',['show',`${source}:src/${file}`],{maxBuffer:16*1024*1024});
    // The canonical byte decoder normalizes comment bytes in place.
    const sourceSha256=sha(bytes);
    const text=sourceTextFromBytes(bytes);
    // compile-src's root source is read separately from its VFS. Refuse a
    // changed root; replace every included fragment with committed input.
    if(file==='main.watx')assert.equal(workspaceSource,text,'committed compiler root');
    compiledInputs.push({path:'src/'+file,sha256:sourceSha256,compilerTextSha256:sha(text),source});
    return file==='13-exports.wat'?text+'\n'+extraWat:text;
  });
  fs.writeFileSync(path.join(out,'tested.wasm'),wasm);
  const scripts=['lib/region-map.generated.js','lib/gpu-stream.generated.js','lib/gpu-stream.js','lib/gpu-stream-doorbell.js',
    'lib/gpu-stream-host.js','lib/gl-command-stream.js','lib/d3d-command-stream.js','lib/guest-rpc.js',
    'lib/guest-thread-host.js','lib/render-worker.js','test/helpers/palette-worker-browser.js'];
  const vmStages=fs.readdirSync(path.join(root,'tools/watx-src')).filter(file=>/^compiler.*\.js$/.test(file))
    .map(file=>path.join(root,'tools/watx-src',file));
  const compilerInputs=[...Object.keys(require.cache),...vmStages].filter(file=>file.startsWith(root+path.sep)&&!file.includes('/node_modules/'))
    .map(file=>({path:path.relative(root,file),sha256:sha(fs.readFileSync(file))}));
  fs.writeFileSync(path.join(out,'inputs.patch'),cp.execFileSync('git',['diff','--binary',source,'--',
    ...compilerInputs.map(row=>row.path),fixture],{maxBuffer:16*1024*1024}));
  const evidence={source,inputs,compiledInputs,compilerInputs,patchSha256:sha(fs.readFileSync(path.join(out,'inputs.patch'))),
    wasmSha256:sha(wasm),extraWatSha256:sha(extraWat),
    scripts:Object.fromEntries(scripts.map(p=>[p,sha(pool.get('/'+p))])),
    schedulerSha256:sha(renderBootstrap),retainedBeforeExecution:true,hardwareClaim:false,browserProcesses:[],workers:[],results:[]};
  fs.writeFileSync(path.join(out,'before-browser.json'),JSON.stringify(evidence,null,2)+'\n');
  pool.set('/palette-worker.wasm',wasm);
  const server=await startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    const name=new URL(req.url,'http://localhost').pathname,bytes=pool.get(name);
    if(bytes){res.writeHead(200,{'Content-Type':name.endsWith('.wasm')?'application/wasm':name.endsWith('.json')?'application/json':'text/javascript'});res.end(bytes);return true;}
    if(name.startsWith('/lib/')){res.writeHead(404);res.end('unpinned dependency');return true;}
    if(name!=='/palette-worker-fixture')return false;
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end(scripts.map(p=>`<script src="/${p}"></script>`).join('\n'));return true;
  }});
  let browser,page;
  const spawn=cp.spawn,closes=[];
  cp.spawn=function(command){
    const child=spawn.apply(this,arguments);
    if(/chrom(?:e|ium)/i.test(String(command))){
      const r={pid:child.pid,exit:false,close:false,stdoutEOF:!child.stdout,stderrEOF:!child.stderr};evidence.browserProcesses.push(r);
      child.once('exit',(code,signal)=>Object.assign(r,{exit:true,code,signal}));
      closes.push(new Promise(resolve=>child.once('close',()=>{r.close=true;resolve();})));
      child.stdout?.once('end',()=>r.stdoutEOF=true);child.stderr?.once('end',()=>r.stderrEOF=true);
    }return child;
  };
  require('module').syncBuiltinESMExports();
  try{
    const puppeteer=require('puppeteer');
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/opt/google/chrome/chrome',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.results=[];
    const targets=await browser.target().createCDPSession();
    targets.on('Target.targetCreated',({targetInfo:t})=>{
      if(t.type==='worker')evidence.workers.push({id:t.targetId,url:t.url,destroyed:false});
    });
    targets.on('Target.targetDestroyed',({targetId})=>{
      const worker=evidence.workers.find(r=>r.id===targetId);if(worker)worker.destroyed=true;
    });
    targets.on('Target.targetInfoChanged',({targetInfo:t})=>{
      const worker=evidence.workers.find(r=>r.id===t.targetId);if(worker)worker.url=t.url;
    });
    await targets.send('Target.setDiscoverTargets',{discover:true});
    for(const backend of ['software','webgl']){
      page=await browser.newPage();
      page.on('pageerror',error=>console.error('pageerror:',error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/palette-worker-fixture`);
      const result=await page.evaluate(backend=>runPaletteWorker(backend),backend);
      assert.equal(result.moduleSha256,evidence.wasmSha256,'browser received exact retained module');
      evidence.results.push(result);
      console.log(`PASS production guest/render Worker palette lifetime, queued generations, keyed/alpha/depth pixels and retirement; backend=${backend}`);
      await page.close();page=null;
    }
    assert.equal(evidence.workers.length,4,'two real Workers per backend');
    assert(evidence.workers.every(r=>r.destroyed),'all actual Worker targets destroyed');
  }catch(error){
    evidence.error=error.stack||String(error);
    if(page)evidence.partial=await page.evaluate(()=>globalThis.paletteWorkerEvidence||null).catch(()=>null);
    throw error;
  }finally{
    try{
      if(browser){await browser.close();await Promise.all(closes);}
      await closeServer(server);
      evidence.ownedBrowserScopesEmpty=evidence.browserProcesses.length>0&&evidence.browserProcesses.every(r=>r.exit&&r.close&&r.code===0&&r.stdoutEOF&&r.stderrEOF);
      fs.writeFileSync(process.env.PALETTE_WORKER_EVIDENCE||path.join(out,'result.json'),JSON.stringify(evidence,null,2)+'\n');
      assert(evidence.ownedBrowserScopesEmpty,'Chrome actual exit/close and both EOFs');
    }finally{cp.spawn=spawn;require('module').syncBuiltinESMExports();if(temporary)fs.rmSync(out,{recursive:true,force:true});}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
