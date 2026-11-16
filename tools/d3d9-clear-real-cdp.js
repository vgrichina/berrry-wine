#!/usr/bin/env node
'use strict';
// Run only through test-d3d9-clear-real-browser.py (admission/tree cleanup).
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=s=>fs.readFileSync(path.join(root,s),'utf8');
function assemble(){
const currentGpu=read('lib/gpu-backend.js'),currentDevice=read('lib/d3d9-backend.js');
const old=(revision,file)=>execFileSync('git',['show',`${revision}:${file}`],{
  cwd:root,env:{...process.env,GIT_NO_LAZY_FETCH:'1'},stdio:['ignore','pipe','ignore'],maxBuffer:131072}).toString();
const producer='ffe822a9d50ad79439330609915eb84475acd2bc';
const intermediate='77180c76b312efe465ad91e60286d40330d77d0d';
const needle='for(const [left,top,right,bottom]of regions)';
assert.equal(currentDevice.split(needle).length,2,'control mutation anchor');
const variants=[
  {name:'candidate',gpu:currentGpu,device:currentDevice,expected:'pass'},
  {name:'producer',gpu:currentGpu,device:old(producer,'lib/d3d9-backend.js'),expected:'fail',revision:producer},
  {name:'intermediate',gpu:old(intermediate,'lib/gpu-backend.js'),device:currentDevice,expected:'fail',revision:intermediate},
  {name:'reject-rectangles',gpu:currentGpu,device:currentDevice.replace(needle,
    'for(const [left,top,right,bottom]of [[0,0,g.canvas.width,g.canvas.height]])'),expected:'fail'}
];
return {variants,dependencies:['lib/render-clear.js','lib/d3d9-shader.js']
  .map(file=>({file,source:read(file)})),fixture:read('test/fixtures/d3d9-clear-real-pixels.js')};
}
function classify(results){
  const targets=[null,['wrapper-default-one-after-quarter','adapter-quarter-after-half-rejects'],
    ['named-80-fresh-quarter-rejects-half','named-75-fresh-stencil-52'],
    ['clipped-top-left-red-channel','depth-rectangle-and-stencil-retention']];
  if(!Array.isArray(results)||results.length!==4)return false;
  const valid=r=>r&&Array.isArray(r.checks)&&r.checks.length>=50&&
    new Set(r.checks.map(c=>c.name)).size===r.checks.length&&
    Array.isArray(r.errors)&&r.errors.length===0&&Array.isArray(r.identities)&&r.identities.length===1&&
    r.checks.every(c=>typeof c.name==='string'&&typeof c.pass==='boolean'&&
      (c.kind==='pixels'?c.pixels===64&&Number.isInteger(c.mismatch)&&c.mismatch>=0&&c.mismatch<=64&&
        c.pass===(c.mismatch===0):c.kind==='capability'||c.kind==='validation'));
  if(!results.every(valid))return false;
  const names=results[0].checks.map(c=>c.name+'|'+c.kind).sort().join('\n');
  if(results.some(r=>r.checks.map(c=>c.name+'|'+c.kind).sort().join('\n')!==names))return false;
  return results[0].checks.every(c=>c.pass)&&results.slice(1).every((r,i)=>
    r.checks.every(c=>c.pass||c.kind==='pixels')&&
    r.checks.some(c=>!c.pass&&c.kind==='pixels'&&targets[i+1].includes(c.name)));
}
module.exports={assemble,classify};
if(require.main===module){
const output=path.resolve(process.argv[2]);
const {variants,dependencies,fixture}=assemble();
const profile=path.join(output,'p');fs.mkdirSync(profile);
const log=fs.openSync(path.join(output,'chrome.log'),'w');
const chromeArgs=['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',
  `--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--bw-timezone=Etc/UTC',
  '--disable-background-networking','--disable-component-update','--disable-sync',
  '--disk-cache-size=1048576','--media-cache-size=1048576','--js-flags=--max-old-space-size=256','about:blank'];
const chrome=spawn('/opt/google/chrome/chrome',chromeArgs,{stdio:['ignore',log,log],
  env:{...process.env,TMPDIR:output,XDG_CONFIG_HOME:path.join(output,'config')}});
let spawnError;chrome.on('error',e=>{spawnError=e;});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let cdp;
async function connect(url){
  const ws=new WebSocket(url),pending=new Map();let id=0;
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);
    if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
  ws.addEventListener('close',()=>{for(const p of pending.values())p.reject(Error('CDP disconnected'));pending.clear();});
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  return {close:()=>ws.close(),send(method,params={}){const n=++id;return new Promise((resolve,reject)=>{
    pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}};
}
async function main(){
  const portFile=path.join(profile,'DevToolsActivePort'),start=Date.now();
  while(!fs.existsSync(portFile)){
    if(spawnError)throw spawnError;
    if(chrome.exitCode!==null||chrome.signalCode)throw Error('Chrome exited before CDP; see chrome.log');
    if(Date.now()-start>20000)throw Error('CDP startup timed out');await delay(50);
  }
  const port=Number(fs.readFileSync(portFile,'utf8').split('\n')[0]);assert(port>0&&port<=65535);
  const response=await fetch(`http://127.0.0.1:${port}/json/list`);assert(response.ok);
  const page=(await response.json()).find(p=>p.type==='page'&&p.url==='about:blank');assert(page);
  const url=new URL(page.webSocketDebuggerUrl);assert(['127.0.0.1','localhost'].includes(url.hostname));
  cdp=await connect(url.href);
  async function evaluate(expression){const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
  const browser=await cdp.send('Browser.getVersion');
  const results=[];
  for(const v of variants){
    // Every variant receives its complete immutable source snapshot. No require
    // cache or network module cache participates in these browser evaluations.
    for(const d of dependencies)await evaluate(d.source);
    await evaluate(v.gpu);await evaluate(v.device);
    const result=await evaluate(fixture);assert(result&&Array.isArray(result.checks));
    for(const img of result.images){
      assert(/^[a-z0-9-]+$/.test(img.name));const png=Buffer.from(img.png,'base64');assert(png.length<65536);
      fs.writeFileSync(path.join(output,`${v.name}-${img.name}.png`),png);
    }
    delete result.images;
    Object.assign(result,{variant:v.name,expected:v.expected,revision:v.revision??null,
      sources:{gpu:hash(v.gpu),device:hash(v.device),fixture:hash(fixture),
        dependencies:Object.fromEntries(dependencies.map(d=>[d.file,hash(d.source)]))},browser,node:process.version});
    fs.writeFileSync(path.join(output,`${v.name}.json`),JSON.stringify(result,null,2)+'\n');
    results.push(result);
  }
  const failedNames=r=>r.checks.filter(c=>!c.pass).map(c=>c.name);
  const accepted=classify(results);
  const summary={accepted,browser,chromeArgs,results:results.map(r=>({variant:r.variant,passed:r.passed,
    failed:r.failed,errors:r.errors,failedNames:failedNames(r)}))};
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary));process.exitCode=accepted?0:1;
}
main().catch(e=>{console.error(e.stack);process.exitCode=2;}).finally(async()=>{
  cdp?.close();chrome.kill('SIGTERM');
  await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(1000)]);fs.closeSync(log);
  // Supervisor TERM/KILLs process group + adopted descendants and reaps them.
});
}
