'use strict';
// Small run-specific composition; accepted providers stay separately hash pinned.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict');
function compose({root,prior=root+'/scratch/runs/20261108-browser-journal-remote-service',repair=true}){
let source=fs.readFileSync(prior+'/browser-run.cjs','utf8');
assert.equal(require('crypto').createHash('sha256').update(source).digest('hex'),'7e98748cc9e2b082f8c8c845be8ffb28bb83054b87cb2c552cf4d80860a928b4','actual0224 retained driver provider');
function replace(a,b){assert.equal(source.split(a).length,2,'unique composition anchor '+a.slice(0,100));source=source.replace(a,b);}
source=source.replaceAll("require('./", "require('"+prior+"/");
replace("const run=__dirname,root=path.resolve(run,'../../..')", "const run=__dirname,root="+JSON.stringify(root));
replace("const recorder=require('"+prior+"/recorder.cjs').create(out,{before:!!process.env.RECORDER_BEFORE});", "const recorder={write(){throw Error('unrequested journal refused')},async close(){}};");
replace('let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;',`let browser,server,ws,pageSession,chain,closing=false,latest=null,timer,guard,guardTimer;
const {EventEmitter}=require('events');const sessions=new Map();
function session(sid){if(!sessions.has(sid)){const e=new EventEmitter();e.id=()=>sid;e.send=(m,p)=>send(m,p,sid);sessions.set(sid,e);}return sessions.get(sid);}
function retain(name,value){const fd=fs.openSync(out+'/'+name,'a');try{fs.writeSync(fd,JSON.stringify(value)+'\\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
function check(){if(closing)throw Error('runtime closing');if(guard)guard.check();}
`);
replace(" const n=++id,w=workers.get(sessionId)"," if(method.startsWith('Input.')&&!method.endsWith('Released')&&params.type!=='keyUp'&&params.type!=='mouseReleased')check();\n const n=++id,w=workers.get(sessionId)");
replace('async function evaluate(expression,sessionId=pageSession){', 'async function evaluate(expression,sessionId=pageSession){check();');
replace('async function event(v){',`async function event(v){
 if(/^(Target\\.|Inspector\\.|Page\\.frame|Page\\.navigated)/.test(v.method))retain('lifetime-events.jsonl',{at:Date.now(),...v});
 // Browser events belong to the browser session even when flattened page events carry a sessionId.
 sessions.get(v.sessionId)?.emit(v.method,v.params||{});
 if(!v.sessionId)sessions.get(undefined)?.emit(v.method,v.params||{});
 if(guard&&guard.snapshot().unknown&&!closing){close('first UNKNOWN renderer lifetime').catch(e=>console.error(e));}
`);
replace("async function capture(label){return trace.span('capture.'+label,()=>captureImpl(label));}","async function capture(label){check();const v=await trace.span('capture.'+label,()=>captureImpl(label));check();return v;}");
replace("async function close(reason){if(closing)return;closing=true;", "async function close(reason){if(closing)return;closing=true;clearInterval(guardTimer);if(guard)save('renderer-identity-summary.json',guard.snapshot());");
// Keep event listeners until Chrome's actual terminal; gameplay tracing ends inside qualify().
replace("ws?.close();if(server)","if(guard){save('renderer-identity-summary.json',guard.snapshot());guard.dispose();}ws?.close();if(server)");
replace(" if(c.action==='quit'){await close('ordinary completion');return;}\n", " if(c.action==='quit'){await close('ordinary completion');return;}\n check();\n");
replace('floor:5000000000','floor:1500000000');replace("assert(free>5000000000,'5GB disk floor')","assert(free>1500000000,'1.5GB disk floor')");
replace("handleRequest:async(req,res)=>await require('"+prior+"/instrument.cjs').handle(req,res)||(process.env.LOCAL_PRODUCTION_FIXTURE?await require('"+prior+"/generated.cjs').handle(req,res):false)","handleRequest:async()=>false");
replace(" await send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(run+'/journal.js','utf8')},pageSession);", " // No call probes or journal observer: zero added per-import observer cost.\n");
replace("fs.readFileSync(run+'/worker-observe.js','utf8')","fs.readFileSync('"+prior+"/worker-observe.js','utf8')");
replace("fs.readFileSync(run+'/gl-owner.js','utf8')","fs.readFileSync('"+prior+"/gl-owner.js','utf8')");
replace(" await send('Page.navigate',{url},pageSession);",` await send('Page.navigate',{url},pageSession);
 for(let n=0;n<100;n++){const f=(await send('Page.getFrameTree',{},pageSession)).frameTree.frame;if(f.url===url&&f.loaderId)break;await wait(100);}
 guard=require(root+'/tools/warcraft3-prologue/renderer-identity.js').createRendererIdentity({browserSession:session(undefined),pageSession:session(pageSession),chromePid:browser.pid,deadline,
 retain:v=>retain('renderer-identity.jsonl',v),retainTrace:b=>{const fd=fs.openSync(out+'/renderer-identity-trace.json','wx');try{fs.writeSync(fd,b);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}});
 try{save('renderer-qualified.json',await guard.qualify());}catch(e){save('loading-linkage.json',{linkage:'UNKNOWN',error:String(e),noFixtureSubstitution:true});throw e;}
 guardTimer=setInterval(()=>{try{check()}catch(e){close('first UNKNOWN '+String(e)).catch(e=>console.error(e))}},250);guardTimer.unref();
`);
replace("const file=out+'/module-'+row.sha256+'.wasm';if(!fs.existsSync(file))fs.writeFileSync(file,b,{flag:'wx'});","row.retention='hash and size only; existing canonical build provider';");
replace("useBoundOwner:()=>fs.existsSync(run+'/use-bound-owner.json')","useBoundOwner:()=>true");
replace(" processSamples=setInterval(()=>{send('SystemInfo.getProcessInfo').then(v=>durable('browser-process-samples.jsonl.gz',{at:Date.now(),...v})).catch(e=>log('process-sample-errors.jsonl',{error:String(e)}));},1000);"," // Independent kernel custodian retains identities and actual waits; no CPU-leader sampling.");
replace("try{if(ws?.readyState===1)await send('Browser.close');}","try{if(ws?.readyState===1)await Promise.race([send('Browser.close'),new Promise((_,j)=>setTimeout(()=>j(Error('independent close deadline')),2000))]);}");
replace("ws.onmessage=msg=>{","ws.onclose=()=>{for(const e of sessions.values())e.emit('CDPSession.Disconnected',{});if(!closing)close('socket disconnected UNKNOWN').catch(e=>console.error(e));};ws.onmessage=msg=>{");
// Fail closed on worker setup failures, and never retry an owned command.
replace("task.catch(e=>log('worker-errors.jsonl',{at:new Date().toISOString(),error:String(e)}));", "task.catch(e=>{log('worker-errors.jsonl',{at:new Date().toISOString(),error:String(e)});close('owned worker setup failure').catch(e=>console.error(e))});");
// Apply after the retained renderer identity composition, without changing its caps.
if(repair){
 source=require('./startup').adapt(source,{root});
 // Qualification creates the proof required by ordinary commands. Its own
 // bounded metadata/trace requests use a private channel, while cancellation
 // and sticky lifetime invalidation still guard dispatch and continuation.
 replace("const {EventEmitter}=require('events');const sessions=new Map();", "const {EventEmitter}=require('events');const sessions=new Map();const qualificationToken=Symbol('renderer qualification');");
 replace('e.send=(m,p)=>send(m,p,sid)', 'e.send=(m,p)=>send(m,p,sid,qualificationToken)');
 replace('function send(method,params={},sessionId){', 'function send(method,params={},sessionId,token){');
 replace("function check(){if(closing)throw Error(closeReason+'; UNKNOWN; no replay');custody?.check();if(guard)guard.check();}", `function check(){checkRequest();}
function checkRequest(token){
 if(closing)throw Error(closeReason+'; UNKNOWN; no replay');custody?.check();
 if(guard){const state=guard.snapshot();if(token===qualificationToken&&!state.proof){if(state.unknown)throw Error(state.unknown)}else guard.check();}
}`);
 const guarded='if(!cleanup)check();';assert.equal(source.split(guarded).length,3,'dispatch and continuation guards');
 source=source.replaceAll(guarded,'if(!cleanup)checkRequest(token);');
 replace("const cleanup=method==='Browser.close'", "if(token===qualificationToken&&!['Target.getTargetInfo','Target.setDiscoverTargets','Page.enable','Inspector.enable','Page.getFrameTree','Target.getTargets','SystemInfo.getProcessInfo','Tracing.start','Tracing.end','IO.read','IO.close'].includes(method))throw Error('unsupported qualification request; UNKNOWN; no replay');\n const cleanup=method==='Browser.close'");
}
return source;
}
function run(directory,options={}){
 const root=path.resolve(__dirname,'../..'),source=compose({root,...options});
 const m=new Module(directory+'/browser-run.cjs',module);m.filename=directory+'/browser-run.cjs';m.paths=module.paths;m._compile(source,m.filename);
}
module.exports={compose,run};
if(require.main===module)run(path.resolve(process.argv[2]));
