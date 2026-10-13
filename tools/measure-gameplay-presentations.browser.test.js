'use strict';
// Real Chromium lifecycle tests with explicitly synthetic telemetry. No guest
// runs here, and these rates are not emulator performance measurements.
const assert=require('assert'),fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process');
const puppeteer=require('puppeteer');
const out=path.resolve(process.argv[2]);
assert(!fs.existsSync(out),'fresh output directory required');fs.mkdirSync(out,{recursive:true});
const fixture=`<!doctype html><title>Synthetic sampler lifecycle fixture</title><p>Synthetic telemetry only; no guest.</p><script>
window.wine={instance:{},guestWorker:null};window.WINE_WASM_IDENTITY={sha256:'synthetic-test-only',bytes:0,source:'fixture'};
window.n=100;window.timer=setInterval(()=>window.n++,10);
window.WinePerf={enabled:true,paceLog:null,start(){this.enabled=true},stop(){this.enabled=false},recordPacing(on){this.paceLog=on?{present:[],raf:[]}:null},snapshot(){return{presentsTotal:window.n,uploadsTotal:window.n,blocksTotal:window.n,logicalFps:null}}};
</script>`;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){let browser,server;const results=[];
try{
 server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(fixture);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await puppeteer.launch({headless:false,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox'],defaultViewport:{width:500,height:300}});
 for(const kind of ['positive','hidden-returned','runtime-replaced','module-replaced','counter-decreased','navigation','no-progress']){
  const page=await browser.newPage(),url='http://127.0.0.1:'+server.address().port+'/'+kind;await page.goto(url);await page.bringToFront();
  if(kind==='no-progress')await page.evaluate(()=>clearInterval(window.timer));
  const dir=path.join(out,kind),args=['tools/measure-gameplay-presentations.js','--cdp='+browser.wsEndpoint().replace(/^ws:/,'http:').split('/devtools/')[0],'--url='+url,'--scene=synthetic browser lifecycle test '+kind,'--seconds=1','--windows=1','--out='+dir];
  let log='';const child=cp.spawn(process.execPath,args,{cwd:path.resolve(__dirname,'..'),env:process.env});child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const terminal=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));});
  const bound=setTimeout(()=>child.kill('SIGKILL'),15000);
  try{
   await page.waitForFunction(()=>!!window.__winePresentationCapture,{timeout:10000});
   await pause(100);
   if(kind==='hidden-returned'){const other=await browser.newPage();await other.bringToFront();await pause(150);await page.bringToFront();await other.close();}
   if(kind==='runtime-replaced')await page.evaluate(()=>window.wine={instance:{},guestWorker:null});
   if(kind==='module-replaced')await page.evaluate(()=>window.WINE_WASM_IDENTITY={...window.WINE_WASM_IDENTITY,sha256:'changed'});
   if(kind==='counter-decreased')await page.evaluate(()=>{clearInterval(window.timer);window.n=1;});
   if(kind==='navigation')await page.reload();
   const exit=await terminal;fs.writeFileSync(path.join(out,kind+'.log'),log);
   const report=JSON.parse(fs.readFileSync(path.join(dir,'presentation-samples.json')));
   if(kind==='positive'){assert.equal(exit.code,0,log);assert.equal(report.outcome,'sampled-needs-scene-and-counter-review');}
   else{assert.equal(exit.code,1,log);assert.equal(report.outcome,'failed');const expected={'hidden-returned':/hidden/,'runtime-replaced':/Wine instance changed/,'module-replaced':/Wasm identity changed/,'counter-decreased':/decreased/,'navigation':/Capture lost|navigat/,'no-progress':/No presentation progress/}[kind];assert.match(report.error,expected);}
   assert.equal(await page.evaluate(()=>innerWidth),500,"attachment must preserve existing viewport");
   assert.equal(await page.evaluate(()=>!!window.__winePresentationCapture),false,'owned capture cleaned');
   results.push({kind,exit,outcome:report.outcome,error:report.error||null});
  }finally{clearTimeout(bound);child.kill('SIGKILL');await page.close();}
 }
 console.log('PASS real-browser sampler lifecycle: '+results.map(r=>r.kind).join(', '));
}finally{await browser?.close();server?.closeAllConnections();await new Promise(r=>server?server.close(r):r());fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({synthetic:true,results},null,2)+'\n');}}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
