'use strict';
// Explicit observation build. Source providers remain immutable; only this
// in-memory closure gains a void import at existing compiled transfer seams.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const version='q3-passive-menu-v1';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function compile(){
 const {watxSourceClosure,compileClosure}=require('./watx-closure.js');
 const c=watxSourceClosure();
 function edit(name,before,after){const s=c.vfs.get(name);assert.equal(s.split(before).length,2,name+' observation seam');
  const v=s.replace(before,after);for(const key of [name,'src/'+name,'./'+name])c.vfs.set(key,v);}
 edit('01-header.wat','(import "host" "log_eip"',
  '(import "host" "q3_menu_event" (func $q3_menu_event (param i32 i32 i32 i32)))\n  (global $q3_menu_on (mut i32) (i32.const 0))\n  (global $q3_console_on (mut i32) (i32.const 0))\n  (func (export "q3_console_arm") (param $on i32) (global.set $q3_console_on (local.get $on)))\n  (func (export "q3_menu_arm") (param $on i32) (global.set $q3_menu_on (local.get $on)))\n  (import "host" "log_eip"');
 const call=(kind,a,b,d)=>`(if (global.get $q3_menu_on) (then (call $q3_menu_event (i32.const ${kind}) ${a} ${b} ${d})))`;
 edit('05-alu.wat','(func $pending_push (param $target i32) (param $ret i32) (param $esp i32)',
  '(func $pending_push (param $target i32) (param $ret i32) (param $esp i32)\n'+
  '(if (global.get $q3_console_on) (then (if (i32.eq (local.get $target) (i32.const 0x443840)) (then (call $q3_menu_event (i32.const 5) (local.get $target) (local.get $ret) (local.get $esp))))))\n'+
  call(1,'(local.get $target)','(local.get $ret)','(local.get $esp)'));
 edit('05-alu.wat','(func $pending_pop (param $ret i32) (param $esp i32)\n    (local $p i32) (local $entry i32)',
  '(func $pending_pop (param $ret i32) (param $esp i32)\n    (local $p i32) (local $entry i32)\n'+call(2,'(local.get $ret)','(i32.const 0)','(local.get $esp)'));
 edit('05-alu.wat','(func $pending_entry (param $pc i32) (param $esp i32)\n    (local $p i32)',
  '(func $pending_entry (param $pc i32) (param $esp i32)\n    (local $p i32)\n'+call(4,'(local.get $pc)','(i32.const 0)','(local.get $esp)'));
 edit('09a5-handlers-window.wat',';; ShowWindowAsync\'s queue record is a USER operation',
  call(3,'(local.get $arg0)','(i32.const 0)','(i32.load offset=16 (global.get $reg_base))')+'\n    ;; ShowWindowAsync\'s queue record is a USER operation');
 const out=compileClosure(c,{tailCalls:true});
 assert(out.success&&out.wasmBinary,JSON.stringify(out.errors));
 return Buffer.from(out.wasmBinary);
}
// Self-contained so the emitted Worker program and offline controls execute
// exactly the same recorder. Reads are bounded direct-window reads, never g2w
// (which can service faults). All failures are sticky; original work proceeds.
function recorder({getExports,getMemory,now=()=>performance.now(),emit=()=>{},limit=512,qvmSites={}}){
 if(!Number.isInteger(limit)||limit<1||limit>512)throw Error('Q3 menu record bounds');
 const fields='processId processObject endpoint endpointObject workerObject workerTarget workerInstance moduleObject moduleSha256 epoch renderEndpoint renderEndpointObject renderWorkerObject rendererContext rendererTarget rendererEpoch rendererModuleSha256 pageRendererObject canvasObject'.split(' ');
 const copy=v=>JSON.parse(JSON.stringify(v));
 let binding=null,owner=null,deadline=0,terminal=null,sequence=0,events=0;
 const rows=[],frames=[];
 let startupOn=false,startupSequence=0;
 const startupRows=[];
 const same=(a,b)=>fields.every(k=>a?.[k]!==undefined&&a[k]!==null&&a[k]!==''&&a[k]===b?.[k]);
 const stop=reason=>{if(!terminal)terminal=reason;startupOn=false;try{getExports()?.q3_menu_arm?.(0);getExports()?.q3_console_arm?.(0);}catch{}};
 function read(p){
  const wa=(p>>>0)-0x400000+0x12000,m=getMemory();
  if(!Number.isSafeInteger(wa)||wa<0x12000||wa+4>Math.min(0x8000000,m.byteLength))throw Error('direct read bounds');
  return new DataView(m).getUint32(wa,true);
 }
 function row(kind,data){
  if(!binding||terminal)return;
  if(now()>=deadline){stop('deadline');return;}
  if(rows.length>=limit){stop('record-limit');return;}
  const r={kind,sequence:++sequence,binding:copy(binding),at:now(),...data};rows.push(r);try{emit(r);}catch{stop('sink');}
 }
 function event(kind,a,b,esp){
  if(kind===5){
   if(!startupOn)return;
   let r;
   try{
    const pointer=read((esp>>>0)+4),wa=pointer-0x400000+0x12000,m=getMemory();
    if(wa<0x12000||wa>=Math.min(0x8000000,m.byteLength))throw Error('console direct read bounds');
    const bytes=new Uint8Array(m,wa,Math.min(2048,Math.min(0x8000000,m.byteLength)-wa));
    let text='',terminated=false;
    for(const byte of bytes){if(byte===0){terminated=true;break;}text+=String.fromCharCode(byte);}
    r={kind:'console-call',at:now(),target:a>>>0,callerReturn:b>>>0,esp:esp>>>0,pointer,text,terminated,truncated:!terminated};
   }catch{r={kind:'console-read-error',target:a>>>0,callerReturn:b>>>0,esp:esp>>>0};}
   r.sequence=++startupSequence;startupRows.push(r);
   try{emit({observation:'startup-console',...r});}catch{}
   if(startupRows.length>=64){startupOn=false;try{getExports()?.q3_console_arm?.(0);}catch{}}
   return;
  }
  if(!binding||terminal)return;
  try{
   if(++events>500000){stop('event-limit');return;}
   if(now()>=deadline){stop('deadline');return;}
   a>>>=0;b>>>=0;esp>>>=0;
   if(kind===1){
    const nested=frames.length>0;
    if(a===0x40aa70||nested&&(a===0x43aee0||b>=0x43af25&&b<=0x43afa4)){
     if(frames.length>=32){stop('frame-limit');return;}
     const args=Array.from({length:6},(_,i)=>read(esp+4+i*4));
     const f={target:a,ret:b,esp,args};frames.push(f);row('guest-call',f);
     if(a===0x43aee0){const vm=args[0];row('ui-vm-binding',{vm,name:Array.from({length:4},(_,i)=>read(vm+4+i*4)),dll:read(vm+0x4c),compiled:read(vm+0x54),code:read(vm+0x58),data:read(vm+0x68),command:args[1],key:args[2]});}
    }
   }else if(kind===2){
    const f=frames.at(-1);
    if(f&&a===f.ret&&esp===f.esp){frames.pop();row('guest-return',{...f,result:getExports().get_eax()>>>0,returnEsp:getExports().get_esp()>>>0});}
   }else if(kind===3){
    const msg=read(a+4);if(msg>=0x100&&msg<=0x109)row('win32-dispatch',{pointer:a,hwnd:read(a),msg,wParam:read(a+8),lParam:read(a+12),esp});
   }
   if(kind===4){const f=frames.at(-1);if(f&&!f.entered&&a===f.target&&esp===f.esp){f.entered=true;row('guest-entry',f);}}
   // Both the threaded branch seam and compiled successor seam reach here.
   if((kind===4||kind===2)&&a===0x43b418&&frames.some(f=>f.target===0x43aee0)){
    const e=getExports(),offset=e.get_esi()>>>0;if(qvmSites[offset])row('qvm-instruction',{site:qvmSites[offset],offset,vm:e.get_ebx()>>>0,programStack:read(esp+0x1c),operandStack:e.get_edi()>>>0});
   }
  }catch{stop('observation-error');}
 }
 return {event,stop,
  startup(){if(startupSequence||startupOn)throw Error('Q3 startup console already armed');startupOn=true;getExports()?.q3_console_arm?.(1);},
  startupSnapshot(){return {version:1,active:startupOn,recordLimit:64,textByteLimit:2048,records:copy(startupRows)};},
  begin(b,identity){
   if(terminal)throw Error('Q3 menu observer terminal: '+terminal);
   if(!b?.id||!b.label||!/^[a-f0-9]{64}$/.test(b.previous?.sha256??'')||!same(b.previous.identity,identity)||owner&&!same(owner,identity)){
    stop('binding');throw Error('Q3 menu owner/image binding');}
   if(frames.length){stop('incomplete prior command');throw Error('Q3 menu incomplete prior command');}
   owner=copy(identity);binding=copy(b);deadline=now()+60000;getExports()?.q3_menu_arm?.(1);row('menu-command-begin',{});return {active:true};
  },
  wrap(name,fn){return function(...args){let result;try{result=Reflect.apply(fn,this,args);}
   catch(e){stop('production-import-failure');throw e;}
   if(binding&&!terminal&&(name!=='check_input'||result))row('worker-rpc-return',{name,result});return result;};},
  snapshot(identity){if(owner&&!same(owner,identity))stop('owner');return {version:1,status:terminal?'UNKNOWN':'PASSIVE',reason:terminal,pendingFrames:frames.length,frames:copy(frames),records:copy(rows)};}
 };
}
function workerInstall(config,makeRecorder){
 const original=WebAssembly.instantiate;
 let installed=false;
 WebAssembly.instantiate=async function(module,imports,...rest){
  if(installed||!imports?.host?.check_input)return Reflect.apply(original,this,[module,imports,...rest]);
  installed=true;
  const response=await fetch(config.url),bytes=new Uint8Array(await response.arrayBuffer());
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(!response.ok||digest!==config.sha256||bytes.length!==config.size)throw Error('Q3 observation module integrity');
  let exports;
  const observation=makeRecorder({getExports:()=>exports,getMemory:()=>imports.host.memory?.buffer??imports.env?.memory?.buffer??memory.buffer,qvmSites:config.qvmSites,
   emit:r=>console.debug(r.observation==='startup-console'?'Q3_STARTUP_CONSOLE':'Q3_MENU_CONSUMPTION',JSON.stringify(r))});
  imports.host.q3_menu_event=observation.event;
  for(const name of ['check_input','check_input_hwnd','check_input_lparam','check_input_wparam'])if(imports.host[name])imports.host[name]=observation.wrap(name,imports.host[name]);
  const result=await Reflect.apply(original,this,[await WebAssembly.compile(bytes),imports,...rest]);
  const installedInstance=result.instance??result;
  exports=installedInstance.exports;globalThis.__q3MenuConsumption=observation;
  if(config.startupConsole===true)observation.startup();
  observation.moduleIdentity=()=>{
   if(instance!==installedInstance||instance?.exports!==exports)throw Error('Q3 observation instance replaced');
   return {sha256:digest,bytes:bytes.length};
  };
  const begin=observation.begin;
  observation.begin=(b,identity)=>{
   if(identity?.moduleSha256!==config.sha256||identity.endpoint!==endpointIdentity||workerSlot!==0||
      globalThis.__mcmPassiveInstanceV1?.ids.get(instance)!==identity.workerInstance){
    observation.stop('live Worker owner');throw Error('Q3 menu live Worker owner');}
   return begin(b,identity);
  };
  return result;
 };
}
// Runtime.evaluate's existing execution-boundary transport nests this in an
// expression. A trailing statement semicolon is invalid inside that wrapper.
function workerSource(config){return '('+workerInstall.toString()+')('+JSON.stringify(config)+','+recorder.toString()+')';}
// The retained chain predates the observation replacement. Keep its owner,
// renderer, capture and input checks, but distinguish compiled from installed.
function boundAdapter(base,config,onFailure){
 return {...base,createChain(options){
  const selected=require('./q3-current-module.cjs').SELECTED;
  const workers={values:function*(){
   try{
    for(const w of options.workers.values()){
     if(w.closed||!w.url.includes('guest-worker')){yield w;continue;}
     const scripts=[...new Map(w.scripts.map(s=>[s.scriptId,s])).values()];
     assert(scripts.length>=1&&scripts.length<=2,'bounded Q3 chain modules');
     let canonical=0,observation;
     for(const s of scripts){
      assert(s.bytecodeAvailable&&!s.error,'Q3 chain bytecode metadata');
      if(s.sha256===config.sha256){assert(!observation,'duplicate Q3 chain observation');observation=s;}
      else {assert.equal(s.sha256,selected.sha256,'unknown Q3 chain module');assert(++canonical===1,'duplicate Q3 chain canonical');}
     }
     assert(observation,'Q3 chain observation missing');yield {...w,scripts:[observation]};
    }
   }catch(error){onFailure(error);throw error;}
  }};
  return base.createChain({...options,workers,evaluate:async(expression,session)=>{
   try{
    const value=await options.evaluate(expression,session);
    if(expression===base.WORKER_READ&&value){
     assert.deepEqual(await options.evaluate('globalThis.__q3MenuConsumption.moduleIdentity()',session),
      {sha256:config.sha256,bytes:config.size},'Q3 chain installed instance');
    }
    return value;
   }catch(error){onFailure(error);throw error;}
  }});
 }};
}
function startup(config){
 const Module=require('node:module'),filename=path.join(root,'tools/q3-startup.cjs');
 let source=fs.readFileSync(filename,'utf8');
 assert.equal(sha(Buffer.from(source)),require('./q3-current-module.cjs').migration['tools/q3-startup.cjs'],'canonical startup provider');
 const once=(a,b)=>{assert.equal(source.split(a).length,2,'observation startup seam');source=source.replace(a,b);};
 once('  source = admissionSource()}) {','  source = admissionSource(), onFailure}) {\n  assert.equal(typeof onFailure,\'function\',\'Q3 owning terminal callback required\');');
 const refusal=source.slice(source.indexOf('  } catch(error) {'),source.indexOf('\n}\nmodule.exports='));
 assert(refusal.includes("WINE_REDLINE_STARTUP.abort('Q3 caller refusal')"),'canonical refusal cleanup seam');
 once(refusal,`  } catch(error) {
    onFailure(error);
    save('startup-refusal.json',{error:String(error),noReplay:true,owningCancellation:true});
    throw error;
  }`);
 // The Worker compiles the canonical page module before the installer compiles
 // its replacement. Authenticate both scripts, then bind the replacement to
 // the actual parked instance rather than counting every compiled script as live.
 once(`    assert.equal(scripts.length,1,'unique actual Q3 Worker module required');
    const r=await send('Debugger.getScriptSource',{scriptId:scripts[0].scriptId},w.sessionId);
    assert(r.bytecode,'actual Q3 Worker bytecode required');
    const bytes=Buffer.from(r.bytecode,'base64');`,
 `    assert(scripts.length>=1&&scripts.length<=2,'bounded Q3 Worker modules required');
    let bytes,canonical=0;
    for(const script of scripts){
      const r=await send('Debugger.getScriptSource',{scriptId:script.scriptId},w.sessionId);
      assert(r.bytecode,'actual Q3 Worker bytecode required');
      const candidate=Buffer.from(r.bytecode,'base64'),digest=sha(candidate);
      if(digest===${JSON.stringify(config.sha256)}&&candidate.length===${config.size}){
        assert(!bytes,'duplicate Q3 observation module');bytes=candidate;
      }else{
        assert(digest===SELECTED.sha256&&candidate.length===SELECTED.bytes,'unknown Q3 Worker module');
        assert(++canonical===1,'duplicate Q3 canonical module');
      }
    }
    assert(bytes,'actual Q3 observation module required');
    assert.deepEqual(await evaluate('globalThis.__q3MenuConsumption.moduleIdentity()',w.sessionId),
      ${JSON.stringify({sha256:config.sha256,bytes:config.size})},'actual parked Q3 observation instance');`);
 // Admission continues to authenticate the canonical page Module. Independently
 // authenticate the actual observation Worker module before releasing it.
 once("assert.equal(sha(bytes),SELECTED.sha256,'Q3 live selected CPU SHA-256');",`assert.equal(sha(bytes),${JSON.stringify(config.sha256)},'Q3 live observation CPU SHA-256');`);
 once("assert.equal(bytes.length,SELECTED.bytes,'Q3 live selected CPU length');",`assert.equal(bytes.length,${config.size},'Q3 live observation CPU length');`);
 once('sha256:sha(bytes),bytes:bytes.length,workerTarget:',`sha256:SELECTED.sha256,bytes:SELECTED.bytes,observationModule:${JSON.stringify({sha256:config.sha256,bytes:config.size})},workerTarget:`);
 const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(source,filename);return m.exports;
}
function compose(source,config){
 if(!config)return source;
 const once=(a,b)=>{assert.equal(source.split(a).length,2,'Q3 menu generated seam: '+a);source=source.replace(a,b);};
 // The retained bound declaration precedes root. Resolve the adapter only
 // when the initialized caller creates its chain, preserving other methods.
 once("...require('./bound-input.cjs'),hold:","...require('./bound-input.cjs'),createChain:options=>require(root+'/tools/q3-menu-consumption.cjs').boundAdapter(require('./bound-input.cjs'),"+JSON.stringify(config)+",observeTerminal).createChain(options),hold:");
 once("task.catch(e=>log('worker-errors.jsonl',{at:new Date().toISOString(),error:String(e)}));", "task.catch(e=>{observeTerminal(e);log('worker-errors.jsonl',{at:new Date().toISOString(),error:String(e)});});");
 once("await require(root+'/tools/q3-startup.cjs').launch({evaluate,send,workers,pageSession,deadline,wait,save});",`await require(root+'/tools/q3-menu-consumption.cjs').startup(${JSON.stringify(config)}).launch({evaluate,send,workers,pageSession,deadline,wait,save,onFailure:observeTerminal});`);
 once("await send('Runtime.runIfWaitingForDebugger',{},sessionId);",`if(targetInfo.url.includes('guest-worker'))await evaluate(${JSON.stringify(workerSource(config))},sessionId);await send('Runtime.runIfWaitingForDebugger',{},sessionId);`);
 once(".map(p=>p.sha256)});",`.map(p=>p.sha256).concat(${JSON.stringify(config.sha256)})});`);
 once(' markDispatch();',` const menuWorker=[...workers.values()].find(w=>w.targetId===latest.identity.workerTarget&&!w.closed);assert(menuWorker,'Q3 menu owning Worker');
 const menuBegin=await evaluate('globalThis.__q3MenuConsumption.begin('+JSON.stringify({id:c.id,label:c.label,previous:latest})+','+JSON.stringify(latest.identity)+')',menuWorker.sessionId);
 assert.equal(menuBegin?.active,true,'Q3 menu observer binding');
 markDispatch();`);
 once("console.log('CAPTURE '+label);",`if(latest.identity?.workerTarget){const mw=[...workers.values()].find(w=>w.targetId===latest.identity.workerTarget&&!w.closed);assert(mw,'Q3 menu capture Worker');save(label+'-menu-consumption.json',await evaluate('globalThis.__q3MenuConsumption.snapshot('+JSON.stringify(latest.identity)+')',mw.sessionId));}
 console.log('CAPTURE '+label);`);
 return source;
}
module.exports={version,compile,recorder,workerSource,startup,boundAdapter,compose,sha};
