'use strict';
// SimGolf-only composition of the retained caller. Never edit shared helpers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const PRIOR='scratch/runs/20261108-simgolf-native-championship-shot';
const BOUND='scratch/runs/20261107-boids-visible-flock/bound-input.cjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function exact(s,a,b){assert.equal(s.split(a).length,2,'unique SimGolf seam: '+a);return s.replace(a,b);}
function terminalGuard({cancel,save,clear=()=>{}}){
 let error=null;
 return {check(){if(error)throw error;},fail(e){if(!error){error=e instanceof Error?e:Error(String(e));try{clear();save({error:error.stack,noLaterProtocol:true});}finally{cancel();}}return error;},get error(){return error;}};
}
function compose(root){
 let s=fs.readFileSync(path.join(root,PRIOR,'browser.cjs'),'utf8');
 assert.equal(sha(s),'bcfea4b8af212ebfe1074ae189655cf9aaa9cfaf13d81389359b0b396d2b190a','immutable original caller');
 s=exact(s,"const readiness=require('../20261107-boids-visible-flock/readiness.cjs');const bound=require('../20261107-boids-visible-flock/bound-input.cjs'),ordinary=require('../20261107-boids-visible-flock/ordinary-keys-fixed.cjs');ordinary.assertRequired();", "const readiness=require('../20261107-boids-visible-flock/readiness.cjs');const bound=require('./bound-input.cjs');");
 s=exact(s,'let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;',`const simgolf=require('../../../tools/simgolf-native-hole-driver.cjs');
let guard;
function fail(e){return guard.fail(e);}
let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;`);
 s=exact(s,'const pending=new Map(),workers=new Map(),workerPromises=[];',`const pending=new Map(),workers=new Map(),workerPromises=[];
assert.equal(Number(process.env.SIMGOLF_OWNER_PID),process.ppid,'explicit owning cancellation parent required');
assert(process.ppid>1,'owning cancellation parent');
guard=simgolf.terminalGuard({clear:()=>{closing=true;process.exitCode=1;clearTimeout(timer);},save:v=>save('terminal-error.json',v),cancel:()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(guard.error);}pending.clear();process.kill(process.ppid,'SIGTERM');}});`);
 s=exact(s,'async function send(method,params={},sessionId){','async function send(method,params={},sessionId){guard.check();');
 s=exact(s,"reject(Error('CDP UNKNOWN '+method+'; no replay'));","reject(fail(Error('CDP UNKNOWN '+method+'; no replay')));");
 s=exact(s,'ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));',"try{ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));}catch(e){reject(fail(e));}");
 s=exact(s,'if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));','if(r.exceptionDetails)throw fail(Error(JSON.stringify(r.exceptionDetails)));');
 s=exact(s,'async function event(v){','async function event(v){guard.check();');
 s=exact(s,'async function state(){','async function state(){guard.check();');
 s=exact(s,' await Promise.all(workerPromises);'," if(page.apps.some(a=>a.stopped||!a.running))throw fail(Error('guest stopped; terminal'));\n await Promise.all(workerPromises);");
 s=exact(s,"if(v.method==='Runtime.exceptionThrown')log('exceptions.jsonl',{at:new Date().toISOString(),session:v.sessionId,details:v.params.exceptionDetails});", "if(v.method==='Runtime.exceptionThrown'){log('exceptions.jsonl',{at:new Date().toISOString(),session:v.sessionId,details:v.params.exceptionDetails});fail(Error('runtime exception'));}");
 s=exact(s,"async function capture(label){assert(","async function capture(label){guard.check();assert(");
 s=exact(s,"async function close(reason){if(closing)return;","async function close(reason){guard.check();if(reason!=='ordinary completion')throw fail(Error(reason));if(closing)return;");
 s=exact(s,'async function execute(c,markDispatch){','async function execute(c,markDispatch){guard.check();try{');
 s=exact(s,' await wait(c.waitMs);await capture(c.label);\n}',` guard.check();const previous=latest?.sha256;await wait(c.waitMs);guard.check();await capture(c.label);
 if(c.action!=='capture')assert.notEqual(latest.sha256,previous,'unchanged expected transition; terminal');
 }catch(e){throw fail(e);}
}`);
 s=exact(s,"v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result)","v.error?p.reject(fail(Error(JSON.stringify(v.error)))):p.resolve(v.result)");
 s=exact(s,"browser.once('exit',(code,signal)=>save('chrome-exit.json',{at:new Date().toISOString(),code,signal}));","browser.once('exit',(code,signal)=>{save('chrome-exit.json',{at:new Date().toISOString(),code,signal});if(!closing)fail(Error('browser exited'));});");
 for(const n of ['worker-errors','event-errors'])s=exact(s,"log('"+n+".jsonl',{", "failAndLog('"+n+".jsonl',{");
 s=exact(s,'async function event(v){guard.check();',"function failAndLog(n,v){log(n,v);fail(Error(JSON.stringify(v)));}\nasync function event(v){guard.check();");
 s=exact(s,'row.error=String(e);','row.error=String(e);fail(e);');
 s=exact(s,"})().catch(async e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});process.exitCode=1;await close('first terminal failure');});","})().catch(e=>{fail(e);});");
 return s;
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
 return {'bound-input.cjs':bound,'transport.cjs':transport,'input.cjs':fs.readFileSync(path.join(root,PRIOR,'input.cjs'),'utf8')};
}
function generate(root,out){
 fs.mkdirSync(out,{recursive:true});const pins=[];
 for(const [name,text]of Object.entries({'browser.cjs':compose(root),...helpers(root)})){
  fs.writeFileSync(path.join(out,name),text,{flag:'wx'});pins.push({path:name,size:Buffer.byteLength(text),sha256:sha(text)});
 }return pins;
}
module.exports={PRIOR,BOUND,compose,helpers,generate,terminalGuard,sha};
if(require.main===module)console.log(JSON.stringify(generate(path.resolve(__dirname,'..'),path.resolve(process.argv[2]))));
