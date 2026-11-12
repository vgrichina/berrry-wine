'use strict';
// SimGolf-only composition of the retained caller. Never edit shared helpers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const PRIOR='scratch/runs/20261108-simgolf-native-championship-shot';
const BOUND='scratch/runs/20261107-boids-visible-flock/bound-input.cjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function guestPixels(bytes,rect){
 const png=require('pngjs').PNG.sync.read(bytes,{checkCRC:true});
 assert(rect&&[rect.left,rect.top,rect.width,rect.height].every(Number.isFinite),'guest canvas rectangle required');
 const x=Math.floor(rect.left),y=Math.floor(rect.top),right=Math.ceil(rect.left+rect.width),bottom=Math.ceil(rect.top+rect.height);
 assert(x>=0&&y>=0&&right>x&&bottom>y&&right<=png.width&&bottom<=png.height,'usable guest pixels required');
 const rows=[];for(let row=y;row<bottom;row++)rows.push(png.data.subarray((row*png.width+x)*4,(row*png.width+right)*4));
 const pixels=Buffer.concat(rows);let varied=false;
 for(let i=4;i<pixels.length&&!varied;i+=4)varied=!pixels.subarray(i,i+4).equals(pixels.subarray(0,4));
 assert(varied,'unusable uniform guest image; terminal');
 return {sha256:sha(pixels),x,y,width:right-x,height:bottom-y};
}
function exact(s,a,b){assert.equal(s.split(a).length,2,'unique SimGolf seam: '+a);return s.replace(a,b);}
function terminalGuard({cancel,save,clear=()=>{},poll=()=>{}}){
 let error=null;
 const guard={check(){if(!error)try{poll();}catch(e){guard.fail(e);}if(error)throw error;},fail(e){if(!error){error=e instanceof Error?e:Error(String(e));try{clear();save({error:error.stack,noLaterProtocol:true});}finally{cancel();}}return error;},get error(){return error;}};
 return guard;
}
function owningCanceller(expected){
 const {identity}=require('./native-clock-process-proof.cjs');
 assert.equal(expected.pid,process.ppid,'explicit owning cancellation parent required');
 assert(process.ppid>1,'owning cancellation parent');
 assert.deepEqual(identity(process.ppid),expected,'owning parent identity');
 let called=false;
 return ()=>{if(called)return;called=true;
  assert.equal(process.ppid,expected.pid,'owning parent changed');
  const actual=identity(expected.pid);
  assert.equal(actual.startTicks,expected.startTicks,'owning parent PID reused');
  assert.equal(actual.bootId,expected.bootId,'owning parent boot changed');
  assert.deepEqual(actual.namespaces,expected.namespaces,'owning parent namespace changed');
  process.kill(expected.pid,'SIGTERM');
 };
}
function observeTerminal(out,guard){
 const check=()=>{try{guard.check();}catch(e){guard.fail(e);}};
 const watcher=fs.watch(out,check);watcher.on('error',e=>guard.fail(e));check();
 if(guard.error)watcher.close();
 return ()=>watcher.close();
}
function compose(root){
 let s=fs.readFileSync(path.join(root,PRIOR,'browser.cjs'),'utf8');
 assert.equal(sha(s),'bcfea4b8af212ebfe1074ae189655cf9aaa9cfaf13d81389359b0b396d2b190a','immutable original caller');
 s=exact(s,"const readiness=require('../20261107-boids-visible-flock/readiness.cjs');const bound=require('../20261107-boids-visible-flock/bound-input.cjs'),ordinary=require('../20261107-boids-visible-flock/ordinary-keys-fixed.cjs');ordinary.assertRequired();", "const readiness=require('../20261107-boids-visible-flock/readiness.cjs');const bound=require('./bound-input.cjs');");
 s=exact(s,"localStorage.setItem('wine-assembly.threads','1');",'');
 s=exact(s,'let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;',`const simgolf=require('../../../tools/simgolf-native-hole-driver.cjs');
let guard,stopTerminalWatch=()=>{};
function fail(e){return guard.fail(e);}
let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;`);
 s=exact(s,'const pending=new Map(),workers=new Map(),workerPromises=[];',`const pending=new Map(),workers=new Map(),workerPromises=[];
const cancelOwner=simgolf.owningCanceller(JSON.parse(process.env.SIMGOLF_OWNER_IDENTITY));
guard=simgolf.terminalGuard({poll:()=>t.assertOpen(out),clear:()=>{closing=true;process.exitCode=1;clearTimeout(timer);stopTerminalWatch();},save:v=>save('terminal-error.json',v),cancel:()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(guard.error);}pending.clear();cancelOwner();}});
stopTerminalWatch=simgolf.observeTerminal(out,guard);`);
 s=exact(s,'async function send(method,params={},sessionId){','async function send(method,params={},sessionId){guard.check();');
 s=exact(s,"reject(Error('CDP UNKNOWN '+method+'; no replay'));","reject(fail(Error('CDP UNKNOWN '+method+'; no replay')));");
 s=exact(s,'ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));',"try{ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));}catch(e){reject(fail(e));}");
 s=exact(s,'if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));','if(r.exceptionDetails)throw fail(Error(JSON.stringify(r.exceptionDetails)));');
 s=exact(s,'async function event(v){','async function event(v){guard.check();');
 s=exact(s,'async function state(){','async function state(){guard.check();');
 s=exact(s,' await Promise.all(workerPromises);'," if(page.apps.some(a=>a.stopped||!a.running))throw fail(Error('guest stopped; terminal'));\n await Promise.all(workerPromises);");
 s=exact(s,"if(v.method==='Runtime.exceptionThrown')log('exceptions.jsonl',{at:new Date().toISOString(),session:v.sessionId,details:v.params.exceptionDetails});", "if(v.method==='Runtime.exceptionThrown'){log('exceptions.jsonl',{at:new Date().toISOString(),session:v.sessionId,details:v.params.exceptionDetails});fail(Error('runtime exception'));}");
 s=exact(s,"async function capture(label){assert(","async function capture(label){guard.check();assert(");
 s=exact(s,'latest=shot.capture;',"latest={...shot.capture,guestPixels:simgolf.guestPixels(shot.png,s.canvas.rect)};");
 s=exact(s,"async function close(reason){if(closing)return;","async function close(reason){guard.check();if(reason!=='ordinary completion')throw fail(Error(reason));if(closing)return;");
 s=exact(s,'closing=true;clearTimeout(timer);try{','closing=true;stopTerminalWatch();clearTimeout(timer);try{');
 s=exact(s,'async function execute(c,markDispatch){','async function execute(c,markDispatch){guard.check();try{');
 s=exact(s,' await wait(c.waitMs);await capture(c.label);\n}',` guard.check();const previous=latest?.sha256;await wait(c.waitMs);guard.check();await capture(c.label);
 if(c.action!=='capture')assert.notEqual(latest.sha256,previous,'unchanged expected transition; terminal');
 }catch(e){throw fail(e);}
}`);
 s=exact(s,"const previous=latest?.sha256;",'const previous=latest?.guestPixels?.sha256??latest?.sha256;');
 s=exact(s,"if(c.action!=='capture')assert.notEqual(latest.sha256,previous,'unchanged expected transition; terminal');", "if(previous!==undefined)assert.notEqual(latest.guestPixels?.sha256??latest.sha256,previous,'unchanged expected transition; terminal');");
 s=exact(s,"v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result)","v.error?p.reject(fail(Error(JSON.stringify(v.error)))):p.resolve(v.result)");
 s=exact(s,"browser.once('exit',(code,signal)=>save('chrome-exit.json',{at:new Date().toISOString(),code,signal}));","browser.once('exit',(code,signal)=>{save('chrome-exit.json',{at:new Date().toISOString(),code,signal});if(!closing)fail(Error('browser exited'));});");
 for(const n of ['worker-errors','event-errors'])s=exact(s,"log('"+n+".jsonl',{", "failAndLog('"+n+".jsonl',{");
 s=exact(s,'async function event(v){guard.check();',"function failAndLog(n,v){log(n,v);fail(Error(JSON.stringify(v)));}\nasync function event(v){guard.check();");
 s=exact(s,'row.error=String(e);','row.error=String(e);fail(e);');
 s=exact(s,"})().catch(async e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});process.exitCode=1;await close('first terminal failure');});","})().catch(e=>{fail(e);});");
 // Run the very same generated caller in an effect-free import-only mode.
 // This branch precedes mkdir, clocks, parent identity, server and Chrome.
 const imports=`() => [require('../20261107-boids-visible-flock/readiness.cjs'),require('./bound-input.cjs'),require('./transport.cjs'),require('./input.cjs'),require('../../../test/static-server.js'),require('./mount.cjs'),require('../../../tools/native-clock-process-proof.cjs'),require('pngjs')]`;
 s=exact(s,"'use strict';",`'use strict';
if(process.argv.includes('--staged-import-check')) {
 const driver=require('../../../tools/simgolf-native-hole-driver.cjs');
 console.log(JSON.stringify(driver.checkImports(${imports}, {permanent:true})));
 return;
}`);
 return s;
}
function checkImports(load,{permanent=false}={}){
 const undo=[],blocked=[];
 const deny=(object,names)=>{for(const name of names)if(typeof object[name]==='function'){
  const old=object[name];object[name]=()=>{blocked.push(name);throw Error('import attempted effect: '+name);};undo.push(()=>object[name]=old);
 }};
 try{
  deny(require('node:child_process'),['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']);
  deny(fs,['mkdir','mkdirSync','writeFile','writeFileSync','appendFile','appendFileSync','createWriteStream','watch','unlink','unlinkSync','rename','renameSync']);
  deny(fs.promises,['mkdir','writeFile','appendFile','unlink','rename']);
  const open=fs.openSync;fs.openSync=(file,flags,...args)=>{assert(flags==='r'||flags===0,'import attempted writable open');return open(file,flags,...args);};undo.push(()=>fs.openSync=open);
  deny(require('node:net').Server.prototype,['listen']);
  deny(require('node:net'),['connect','createConnection']);
  deny(require('node:http'),['request','get']);deny(require('node:https'),['request','get']);
  deny(globalThis,['setTimeout','setInterval','fetch','WebSocket']);
  const before=new Set(Object.keys(require.cache));load();
  assert.equal(blocked.length,0,'import swallowed an effect rejection');
  return {passed:true,importOnly:true,effects:blocked,loaded:Object.keys(require.cache).filter(p=>!before.has(p))};
 }finally{if(!permanent)for(const restore of undo.reverse())restore();}
}
function helpers(root){
 let bound=fs.readFileSync(path.join(root,BOUND),'utf8');
 bound=exact(bound,"if (effects || e.code !== 'STALE_SCENE_BEFORE_DISPATCH') closed = true;",'closed = true;');
 let transport=fs.readFileSync(path.join(root,PRIOR,'transport.cjs'),'utf8');
 assert.equal(sha(transport),'0e804950876a8e7b8e6f0fa399b3e0d4cce38861b21c771b7aa131db1d22ab85');
 const a=transport.indexOf('  if(ack.status){'),b=transport.indexOf('\n }\n}',a);assert(a>=0&&b>a);
 transport=transport.slice(0,a)+"  assert(!ack.status,'refusal is terminal');"+transport.slice(b);
 const c=transport.indexOf("   if(e.code==='STALE_SCENE_BEFORE_DISPATCH'"),d=transport.indexOf('\n   throw e;',c);assert(c>=0&&d>c);
 transport=transport.slice(0,c)+transport.slice(d);
 transport=exact(transport," const file=path.join(out,'commands',number+'.json');", " exports.assertOpen(out);\n const file=path.join(out,'commands',number+'.json');");
 transport=exact(transport,"  base.writeJson(path.join(out,'reply-'+number+'.json'),{ok:true,id:c.id});", "  exports.assertOpen(out);\n  base.writeJson(path.join(out,'reply-'+number+'.json'),{ok:true,id:c.id});");
 transport=exact(transport,"assert.equal(ack.id,id,'exact ACK ID');return ack;", "assert.equal(ack.id,id,'exact ACK ID');assert(ack.ok&&!ack.status,'terminal ACK required');return ack;");
 transport+=`
exports.assertOpen=out=>{
 for(const name of ['transport-closed.json','first-failure.json'])
  assert(!fs.existsSync(path.join(out,name)),'terminal notification: '+name);
};
// Every requester failure is terminal, including prepublication admission errors.
const request=exports.request;
exports.request=async(out,id,command,timeout)=>{
 try{return await request(out,id,command,timeout);}
 catch(e){if(!fs.existsSync(path.join(out,'transport-closed.json')))
  base.writeJson(path.join(out,'transport-closed.json'),{at:new Date().toISOString(),id,error:String(e),sticky:true});throw e;}
};
`;
 return {'bound-input.cjs':bound,'transport.cjs':transport,'input.cjs':fs.readFileSync(path.join(root,PRIOR,'input.cjs'),'utf8')};
}
function generate(root,out){
 fs.mkdirSync(out,{recursive:true});const pins=[];
 for(const [name,text]of Object.entries({'browser.cjs':compose(root),...helpers(root)})){
  fs.writeFileSync(path.join(out,name),text,{flag:'wx'});pins.push({path:name,size:Buffer.byteLength(text),sha256:sha(text)});
 }return pins;
}
module.exports={PRIOR,BOUND,compose,helpers,generate,terminalGuard,owningCanceller,observeTerminal,guestPixels,sha,checkImports};
if(require.main===module){
 if(process.argv[2]==='owner-exec'){
  process.env.SIMGOLF_OWNER_IDENTITY=JSON.stringify(require('./native-clock-process-proof.cjs').identity(process.ppid));
  require(path.resolve(process.argv[3]));
 }else console.log(JSON.stringify(generate(path.resolve(__dirname,'..'),path.resolve(process.argv[2]))));
}
