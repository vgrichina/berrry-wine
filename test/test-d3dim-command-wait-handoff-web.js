'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),puppeteer=require(root+'/node_modules/puppeteer');
const {startStaticServer,closeServer}=require(root+'/test/static-server');
const report={startedAt:new Date().toISOString(),events:[],errors:[]};
let browser,server,page;
const save=()=>{if(process.env.HANDOFF_RESULT)fs.writeFileSync(process.env.HANDOFF_RESULT,JSON.stringify(report,null,2));};
(async()=>{
 report.baseline=process.env.HANDOFF_BASELINE||null;
 const baselineFiles=['lib/render-worker.js','lib/guest-thread-host.js','lib/guest-worker.js','lib/d3d-command-stream.js'];
 const baseline=process.env.HANDOFF_BASELINE?Object.fromEntries(baselineFiles.map(f=>[f,cp.execFileSync('git',['show',process.env.HANDOFF_BASELINE+':'+f])])):{};
 const wasm=require('./helpers/d3dim-command-wait-fixture')();report.moduleSHA256=require('crypto').createHash('sha256').update(wasm).digest('hex');
 server=await startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){const f=req.url.split('?')[0].slice(1);if(baseline[f]){res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/javascript');res.end(baseline[f]);return true;}if(req.url==='/qualify-fixture.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}return false;}});
 browser=await puppeteer.launch({headless:true,executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:60000});
 report.chromePid=browser.process().pid;report.version=await browser.version();
 browser.process().once('exit',(code,signal)=>{report.chromeExit={at:new Date().toISOString(),code,signal};save();});
 browser.on('targetdestroyed',t=>report.events.push({event:'targetdestroyed',at:new Date().toISOString(),type:t.type(),url:t.url()}));
 browser.on('disconnected',()=>report.events.push({event:'disconnected',at:new Date().toISOString()}));
 page=await browser.newPage();page.on('error',e=>report.errors.push({event:'page-error',error:String(e)}));page.on('pageerror',e=>report.errors.push({event:'pageerror',error:String(e)}));
 page.on('console',m=>report.events.push({event:'console',type:m.type(),text:m.text()}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?debug&threads');
 await page.waitForFunction(()=>typeof WineAssembly!=='undefined'&&typeof GuestWorkerLink!=='undefined'&&typeof Win98Renderer!=='undefined',{timeout:30000});
 report.loadedSource={};for(const f of ['lib/render-worker.js','lib/guest-worker.js','lib/guest-thread-host.js','lib/d3d-command-stream.js','host.js']){
  const b=Buffer.from(await(await page.goto('http://127.0.0.1:'+server.address().port+'/'+f)).buffer());
  report.loadedSource[f]={bytes:b.length,sha256:require('crypto').createHash('sha256').update(b).digest('hex')};
  require('assert/strict').equal(report.loadedSource[f].sha256,require('crypto').createHash('sha256').update(baseline[f]||fs.readFileSync(root+'/'+f)).digest('hex'));
 }
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?debug&threads');
 await page.waitForFunction(()=>typeof WineAssembly!=='undefined'&&typeof RenderWorker!=='undefined',{timeout:30000});
 await page.addScriptTag({content:fs.readFileSync(__dirname+'/helpers/'+(process.env.HANDOFF_LIFECYCLE?'d3dim-publication-lifecycle-browser.js':'d3dim-command-wait-browser.js'),'utf8')});
 report.fixture=await page.evaluate(()=>qualifyActualJoin());
 report.workerScopes=[];for(const worker of page.workers())report.workerScopes.push({url:worker.url()});
})().catch(async e=>{report.error=e.stack;if(page)report.partial=await page.evaluate(()=>globalThis.fixtureEvidence||null).catch(()=>null);process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();if(server)await closeServer(server);
 report.finishedAt=new Date().toISOString();report.pidAbsent=report.chromePid?!fs.existsSync('/proc/'+report.chromePid):null;save();console.log(JSON.stringify({error:report.error,installedArm:report.fixture?.installedArm,final:report.fixture?.final,retirement:report.fixture?.retirement,chromeExit:report.chromeExit}));
});
