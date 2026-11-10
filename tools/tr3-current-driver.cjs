'use strict';
// Keep the proven original TR3 route and its owner/freshness/module guards.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const prior='scratch/runs/20261108-tr3-webgl-terrain-translation';
// Fire-and-forget filesystem observations only: startup and cancellation never
// await diagnostics. Fixed read/process/entry caps also cover hostile proc data.
function launcherDiagnostics(fs,path,crypto,out,pid,isTerminal){
 const io=fs.promises,errors=[];let busy=false;
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 async function attempt(f){try{return await f();}catch(e){errors.push({code:e.code||e.name});return null;}}
 async function read(p){return attempt(async()=>{const f=await io.open(p,'r');try{const b=Buffer.alloc(65536);const {bytesRead}=await f.read(b,0,b.length,0);return b.subarray(0,bytesRead);}finally{await f.close();}});}
 async function identity(p){return attempt(async()=>{const real=await io.realpath(p),s=await io.stat(real);const row={path:p,real,size:s.size,dev:s.dev,ino:s.ino};if(s.isFile()&&s.size<=65536){const b=await read(real);if(b&&b.length===s.size)row.sha256=sha(b);}return row;});}
 async function write(n,v){if(!isTerminal())await attempt(()=>io.writeFile(out+'/'+n,JSON.stringify(v)));}
 const launcher=(async()=>{
  const links=[];let p='/usr/bin/google-chrome';for(let n=0;n<8;n++){const s=await attempt(()=>io.lstat(p));if(!s)break;const target=s.isSymbolicLink()?await attempt(()=>io.readlink(p)):null;links.push({path:p,target});if(!target)break;p=path.resolve(path.dirname(p),target);}
  const main=await identity('/usr/bin/google-chrome'),helpers=[];
  if(main){for(const p of [path.join(path.dirname(main.real),'betterchromium-timezone.sh'),path.join(path.dirname(main.real),'chrome'),'/bin/bash','/usr/bin/readlink','/usr/bin/dirname','/usr/bin/curl','/usr/bin/jq','/usr/bin/sha256sum','/usr/bin/cut'])helpers.push(await identity(p));}
  await write('launcher-identity.json',{at:new Date().toISOString(),links,launcher:main,helpers,errors,readCap:65536,readOnly:true});
 })().catch(()=>{});
 return function observe(iteration){
  if(isTerminal()||busy||![0,25,75].includes(iteration))return;busy=true;
  (async()=>{const rows=[],queue=[pid],seen=new Set();while(queue.length&&rows.length<16&&!isTerminal()){
   const p=queue.shift();if(!Number.isSafeInteger(p)||p<=0||seen.has(p))continue;seen.add(p);
   const proc='/proc/'+p,stat=await read(proc+'/stat'),exe=await attempt(()=>io.readlink(proc+'/exe')),cmd=await read(proc+'/cmdline'),wchan=await read(proc+'/wchan'),children=await read(proc+'/task/'+p+'/children');
   rows.push({pid:p,stat:stat?.toString(),exe,cmdline:cmd?.toString().split('\0').slice(0,32),wchan:wchan?.toString()});
   if(children)queue.push(...children.toString().trim().split(/\s+/).slice(0,16).map(Number));
  }
  const profile=await attempt(()=>io.readdir(out+'/chrome-profile'));
  await write('launcher-process-'+iteration+'.json',{at:new Date().toISOString(),iteration,rows,profile:profile?.slice(0,32),errors,readOnly:true});
  })().catch(()=>{}).finally(()=>{busy=false;});
 };
}
function exact(s,a,b){assert.equal(s.split(a).length,2,'unique TR3 seam: '+a);return s.replace(a,b);}
// Only the current child's stderr stream supplies lines. Never read an old log
// or query another debugging endpoint. Arrival uses a monotonic launch clock.
function ownedStderrReadiness(browser,fs,out,save,isTerminal,started){
 const fd=fs.openSync(out+'/chrome.stderr','w');let buffer='',discard=false,closed=false,endpoint=null,count=0;
 function data(bytes){
  const arrived=performance.now(),at=new Date().toISOString();
  fs.writeSync(fd,bytes);
  if(closed||isTerminal())return;
  for(const part of bytes.toString('utf8').split(/(?<=\n)/)){
   if(!discard)buffer+=part;
   if(buffer.length>4096){buffer='';discard=true;}
   if(!part.endsWith('\n'))continue;
   const line=buffer.replace(/\r?\n$/,'');buffer='';const overflow=discard;discard=false;
   if(overflow||!line.startsWith('DevTools listening on '))continue;
   const match=/^DevTools listening on (ws:\/\/(127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})(\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))$/.exec(line);
   const valid=!!match&&Number(match[3])<=65535,elapsedMs=arrived-started(),timely=elapsedMs>=0&&elapsedMs<10000;
   const row={at,elapsedMs,pid:browser.pid,source:'owned-chrome-stderr',valid,timely,line:line.slice(0,4096)};
   if(count<32)save('stderr-readiness-'+(count++)+'.json',row);
   if(valid&&timely&&!endpoint)endpoint={debugPort:Number(match[3]),browserPath:match[4],websocketUrl:match[1],...row};
  }
 }
 browser.stderr.on('data',data);
 browser.stderr.once('end',()=>fs.closeSync(fd));
 return {get endpoint(){return endpoint;},close(){closed=true;buffer='';}};
}
function compose(root){
 let s=fs.readFileSync(path.join(root,prior,'browser-run.cjs'),'utf8');
 s=exact(s,'let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;',`let terminalError=null;
function fail(error){if(!terminalError){terminalError=error instanceof Error?error:Error(String(error));closing=true;process.exitCode=1;clearTimeout(timer);save('terminal-error.json',{at:new Date().toISOString(),error:String(error),noLaterProtocol:true});for(const p of pending.values()){clearTimeout(p.timer);p.reject(terminalError);}pending.clear();process.kill(process.ppid,'SIGTERM');}return terminalError;}
let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;`);
 s=exact(s," browser=cp.spawn(",' '+launcherDiagnostics.toString()+"\n browser=cp.spawn(");
 s=exact(s,"fs.openSync(out+'/chrome.stderr','w')","'pipe'");
 s=exact(s,' browser=cp.spawn(', ' '+ownedStderrReadiness.toString()+'\n let readinessStarted;\n browser=cp.spawn(');
 s=exact(s," browser.once('exit'", " const stderrReady=ownedStderrReadiness(browser,fs,out,save,()=>!!terminalError,()=>readinessStarted);\n browser.once('exit'");
 s=exact(s," const active=out+'/chrome-profile/DevToolsActivePort';for(let i=0;i<100&&!fs.existsSync(active);i++)await wait(100);const [debugPort,debugPath]=fs.readFileSync(active,'utf8').trim().split('\\n');save('endpoint.json',{debugPort:Number(debugPort),browserPath:debugPath});", ` const observeLauncher=launcherDiagnostics(fs,path,crypto,out,browser.pid,()=>!!terminalError);
 const active=out+'/chrome-profile/DevToolsActivePort';let endpoint;readinessStarted=performance.now();
 try{
  for(let i=0;i<100&&!terminalError&&!stderrReady.endpoint&&!fs.existsSync(active);i++){observeLauncher(i);await wait(100);}
  if(terminalError)throw terminalError;
  endpoint=stderrReady.endpoint;
  if(!endpoint){const [port,p]=fs.readFileSync(active,'utf8').trim().split('\\n');assert(/^[1-9][0-9]{0,4}$/.test(port)&&Number(port)<=65535&&/^\\/devtools\\/browser\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(p),'invalid current profile endpoint');endpoint={debugPort:Number(port),browserPath:p,websocketUrl:'ws://127.0.0.1:'+port+p,source:'current-profile-file'};}
 }finally{stderrReady.close();}
 const {debugPort,browserPath:debugPath}=endpoint;save('endpoint.json',endpoint);`);
 s=exact(s,"new WebSocket('ws://127.0.0.1:'+debugPort+debugPath)","new WebSocket(endpoint.websocketUrl)");
 s=exact(s,'function send(method,params={},sessionId){return new Promise','function send(method,params={},sessionId){if(terminalError)return Promise.reject(terminalError);return new Promise');
 s=exact(s,"if(!closing)close('first transport UNKNOWN; no replay').catch(e=>console.error(e));",'fail(e);');
 s=exact(s,"if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));","if(r.exceptionDetails)throw fail(Error(JSON.stringify(r.exceptionDetails)));");
 s=exact(s,'async function event(v){','async function event(v){if(terminalError)return;');
 s=exact(s,'async function state(){',"function failAndLog(n,v){log(n,v);fail(Error(JSON.stringify(v)));}\nasync function state(){if(terminalError)throw terminalError;");
 for(const n of ['worker-errors','observer-errors','event-errors'])s=s.replaceAll("log('"+n+".jsonl',","failAndLog('"+n+".jsonl',");
 s=exact(s,'row.error=String(e);','row.error=String(e);fail(e);');
 s=exact(s,'async function close(reason){if(closing)return;',"async function close(reason){if(reason!=='ordinary completion')throw fail(Error(reason));if(terminalError)throw terminalError;if(closing)return;");
 s=exact(s,"v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result)","v.error?p.reject(fail(Error(JSON.stringify(v.error)))):p.resolve(v.result)");
 s=exact(s,"})().catch(async e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});process.exitCode=1;await close('first terminal failure');});","})().catch(e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});fail(e);});");
 s=exact(s,"['ArrowUp','ArrowLeft','Space','Enter','Escape']","['ArrowUp','ArrowLeft','Space','Enter','Escape','Alt']");
 s=s.replaceAll('nativeKeys.length,10','nativeKeys.length,12').replaceAll('n<10;n+=2','n<12;n+=2');
 // A stale refusal remains zero effect, but this task terminates on its first failure.
 s=exact(s,'await t.consume(out,n,execute);',"await t.consume(out,n,execute);const ack=JSON.parse(fs.readFileSync(out+'/reply-'+n+'.json'));if(ack.status)throw Error('first refusal terminal: '+ack.status);");
 return s;
}
function composeBound(root){
 let s=fs.readFileSync(path.join(root,prior,'bound-input.cjs'),'utf8');
 const begin=s.indexOf('const KEYS = '),end=s.indexOf('async function hold(',begin);assert(begin>0&&end>begin);
 s=s.slice(0,begin)+"const controls=require('../../../tools/native-key-controls.cjs');\n"+s.slice(end);
 const a=s.indexOf('  assert(Array.isArray(keys)'),b=s.indexOf("  assert(typeof sample===",a);assert(a>0&&b>a);
 s=s.slice(0,a)+'  controls.validateHold(keys,holdMs);\n'+s.slice(b);
 const c=s.indexOf('      const base={key:'),d=s.indexOf(' attempted.push(base);',c);assert(c>0&&d>c);
 s=s.slice(0,c)+'      const base=controls.eventForKey(key);'+s.slice(d);
 return s;
}
function emit(root,out){
 fs.mkdirSync(out,{recursive:true});
 for(const n of ['ack-client.cjs','transport.cjs','native-mouse.cjs','keyboard-bridge.cjs','page-observe.js','worker-observe.js','chain-controls.cjs','transport-controls.cjs'])fs.copyFileSync(path.join(root,prior,n),path.join(out,n),fs.constants.COPYFILE_EXCL);
 fs.writeFileSync(path.join(out,'ordinary-keys.cjs'),"module.exports=require('../../../tools/native-key-controls.cjs');\n",{flag:'wx'});
 fs.writeFileSync(path.join(out,'bound-input.cjs'),composeBound(root),{flag:'wx'});
 fs.writeFileSync(path.join(out,'browser-run.cjs'),compose(root),{flag:'wx'});
}
module.exports={compose,composeBound,emit,prior};
if(require.main===module)emit(path.resolve(__dirname,'..'),process.argv[2]);
