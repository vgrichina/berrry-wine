'use strict';
// Source-only acceptance: exact production bytes; no module or guest initialization.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const repo=process.cwd(), ops=__dirname;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(path.join(repo,'test/run.js'),'utf8');
assert.equal(hash(source),'f81747fefe987ff85bbe1e34d37d7ba86649e0930a788c401a534331f99208c4');
const {createInputConsumptionTrace}=require(path.join(repo,'test/input-consumption-trace'));
const {inputEventHwnd}=require(path.join(repo,'lib/host-window'));
assert(source.includes("const { createInputConsumptionTrace } = require('./input-consumption-trace');"));
const excerpts=[];
function part(s,a,b,label){const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,label);const text=s.slice(i,j);excerpts.push({label,startByte:Buffer.byteLength(s.slice(0,i)),endByte:Buffer.byteLength(s.slice(0,j)),bytes:Buffer.byteLength(text),sha256:hash(text)});return text;}
const init=part(source,'  const inputConsumptionTrace =','  // Every OTHER import table','init');
const input=part(source,'  let lastInputEvent = null;','  let lastMouseTracePos =','host-input');
const control=part(source,'  const controlSafeValue =','  const control = (CONTROL || CONTROL_STDIN)','request-handler');
const hasFlag=part(source,'const hasFlag =','// Was `--name=','flag-parser');
const flag=part(source,"const TRACE_INPUT_DISPATCH = hasFlag('trace-input-dispatch');",'\n','flag-declaration');
const startup=JSON.parse(fs.readFileSync(path.join(ops,'node-startup.stdout')));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>k!=='PALETTE_BROWSER_SUPERVISED').sort(([a],[b])=>a.localeCompare(b)));
assert.equal(hash(JSON.stringify(env)),startup.environmentSHA256);
assert.equal(process.execPath,startup.node);assert.deepEqual(process.execArgv,startup.flags);
assert.equal(fs.readFileSync('/proc/self/limits','utf8'),startup.limits);
const responses=[],controls=[];
function fixture({enabled=true,code=control, factory=createInputConsumptionTrace}={}){
 const calls={ticks:0,publish:0,guest:0,poll:0,scheduler:0,worker:0};
 const forbidden=k=>(()=>{calls[k]++;throw Error('FORBIDDEN '+k);});
 const e={get_eip:()=>0x55995b,get_yield_reason:()=>1,get_wait_handle:()=>0xe0005,get_wait_timeout:()=>100,get_focus_hwnd:()=>0x10001,get_main_hwnd:()=>0x10001,run:forbidden('guest'),post_message_q:forbidden('guest'),get_sleep_yielded:forbidden('guest')};
 const renderer={windows:{},canvas:{width:800,height:600},inputQueue:[],_physicalKeys:{32:false},_asyncKeys:{32:true},_asyncPressedKeys:{32:true},checkInput:forbidden('poll'),getAsyncKeyState:forbidden('poll')};
 const c=vm.createContext({Map,createInputConsumptionTrace:factory,inputEventHwnd,logs:[],h:{},args:enabled?['--trace-input-dispatch']:[],renderer,instance:{exports:e},threadManager:{backend:'cooperative',threads:new Map(),_mainThreadState:{state:'active',suspendCount:0},_mainSleepUntil:150,runSlice:forbidden('scheduler'),pollMainWait:forbidden('scheduler')},inputEvent:null,crossThreadMsgs:[],inputQueue:[],installingFiles:false,scheduledInput:[],tickState:{batch:5003},controlFrozen:true,controlRunCredits:0,videoRecorder:null,batchClock:{getTickMsPerBatch:()=>5},guestClock:{ticks:forbidden('ticks'),publish:()=>{calls.publish++;return 15;}},TRACE_API:false,TRACE_API_PAUSED:false,liveOutstanding:new Map(),parseInputEntries:()=>[{action:'keydown',wParam:32,batch:5003}],Date:{now:forbidden('scheduler')}});
 vm.runInContext(hasFlag+flag+'\n'+init+input+code,c);
 const send=q=>{c.request=q;const result=vm.runInContext('handleControlCommand(request)',c);const clean=JSON.parse(JSON.stringify(result));responses.push({request:q,response:clean});return clean;};
 const state=()=>JSON.stringify({renderer:c.renderer,scheduled:c.scheduledInput,pending:c.inputEvent,cross:c.crossThreadMsgs,buttons:c.inputQueue,threads:c.threadManager&&[...c.threadManager.threads],main:c.threadManager&&c.threadManager._mainThreadState,sleep:c.threadManager&&c.threadManager._mainSleepUntil,batch:c.tickState,frozen:c.controlFrozen,credits:c.controlRunCredits,logs:c.logs,calls});
 return {c,e,renderer,calls,send,state,trace:vm.runInContext('inputConsumptionTrace',c)};
}
const request={action:'input-state',id:'independent-5003-A'};
function rejectControl(name,f){f();controls.push(name);console.log('PASS rejecting control '+name);}
// Controls are first behavioral work at production request dispatch.
const base=fs.readFileSync(path.join(ops,'base-runner.stdout'),'utf8');
const oldControl=part(base,'  const controlSafeValue =','  const control = (CONTROL || CONTROL_STDIN)','base-request-handler');
rejectControl('exact-base-omits-observer',()=>{const f=fixture({code:oldControl});assert.throws(()=>f.send(request));assert(!('queues' in f.send({action:'snapshot',id:'base'})));});
const detached=control.replace("if (cmd.action === 'input-state')","if (cmd.action === 'detached-input-state')");assert.notEqual(detached,control);
rejectControl('detached-production-handler',()=>assert.throws(()=>fixture({code:detached}).send(request)));
const probing=control.replace('() => ({ scheduledInput','() => (guestClock.ticks(), { scheduledInput');assert.notEqual(probing,control);
rejectControl('clock-probe',()=>assert.throws(()=>fixture({code:probing}).send(request),/FORBIDDEN ticks/));
const draining=control.replace('() => ({ scheduledInput,','() => ({ scheduledInput: scheduledInput.splice(0),');assert.notEqual(draining,control);
rejectControl('queue-drain',()=>{const f=fixture({code:draining});f.c.scheduledInput.push({batch:5003});const before=f.state();f.send(request);assert.notEqual(f.state(),before);});
if(process.argv.includes('--controls-only')){
 fs.writeFileSync(path.join(ops,'controls-receipt.json'),JSON.stringify({candidate:'229f420238644feb368d8b2cc4975a790af0534a',excerpts,controls,stubs:'Guest instance exports are scalar-returning JS stubs; run/post_message_q/clock/poll/scheduler throw. Real helper, inputEventHwnd, production CLI parser/init/input/request handler. No guest initializer/module invoked.'},null,2)+'\n');
 process.exit(0);
}
throw Error('Select explicit group; no unchanged control rerun');
