'use strict';
// Review fixture: exact runner queue prefix + dlg-cmd branch and actual sender
// fragment, with scripted window-resolution imports. No whole runner/guest claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const R=process.env.SHADOW_NULL_TEST_SOURCE_ROOT||path.resolve(__dirname,'..'),E=process.env.SHADOW_NULL_TEST_OUTPUT;assert(E,'bounded output directory required');const runner=path.join(R,'test/run.js');
const {createSelectedSend,createCapture,CaptureStop}=require('../tools/shadow-man-null-capture.cjs');
const intent={mode:'selected-action',actionSequence:3,cmdId:3};
const ctx=(instance,changes={})=>({instance,pid:process.pid,runner,action:'dlg-cmd',actionSequence:3,batch:27,cmdId:3,hwnd:54321,resolution:'modal',...changes});
const rejected=[];
for(const change of [{pid:process.pid+1},{runner:'other'},{instance:{}},{action:'post-cmd'},{actionSequence:4},{cmdId:1},{hwnd:0},{hwnd:4294967296},{hwnd:NaN},{batch:-1},{batch:1.5},{resolution:'unknown'}]){
 let sent=false,armed=false;const instance={exports:{}};
 const hook=createSelectedSend({instance,runner,selection:intent,capture:{arm(){armed=true;},run:fn=>fn()}});
 assert.throws(()=>hook(ctx(instance,change),()=>{sent=true;}));assert(!sent&&!armed);rejected.push(Object.keys(change)[0]);
}
for(const selection of [null,{}, {...intent,batch:19},{...intent,hwnd:8194},{...intent,register:true},{...intent,mode:'late-registration'},{...intent,actionSequence:0},{...intent,actionSequence:NaN},{...intent,cmdId:1}]){
 assert.throws(()=>createSelectedSend({instance:{},runner,selection,capture:{}}),/invalid final Beenden selector/);
}
// Exercise actual capture with instrumented exports: retention must precede every
// diagnostic mutation, then the selected send. Mutation cannot change the intent.
const events=[],retained=[],regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi','eip'];
const testExports=Object.fromEntries(regs.map(n=>['get_'+n,()=>n==='esp'?0x600000:0x402000]));
Object.assign(testExports,{guest_read8:()=>0,set_bp:()=>events.push('bp'),set_trace_eip_range:()=>events.push('trace'),set_null_diag:()=>events.push('arm'),null_diag_field:()=>0,null_diag_token:()=>1n,null_diag_root:()=>1n});
const instance={exports:testExports},capture=createCapture({metadata:{test:true},untilZero:true,retain:r=>{retained.push(r);events.push('persist');},stop:()=>events.push('stop')});
const mutable={...intent},hook=createSelectedSend({instance,runner,selection:mutable,capture});mutable.actionSequence=999;
assert.throws(()=>hook(ctx(instance),()=>{events.push('send');}),CaptureStop);
assert.deepEqual(events,['persist','bp','trace','arm','send','stop']);
assert(Object.isFrozen(retained[0].receipt.selection.intent));assert.equal(retained[0].receipt.selection.intent.actionSequence,3);
assert.equal(retained[0].receipt.selection.hwnd,54321);assert.equal(retained[0].receipt.selection.batch,27);
assert.throws(()=>hook(ctx(instance),()=>assert.fail('duplicate sent')),/duplicate or late arm/);
assert.throws(()=>capture.arm(testExports,ctx(instance)),CaptureStop);
fs.writeFileSync(path.join(E,'fresh-unit-controls.json'),JSON.stringify({exit:0,rejected,invalidRegistrations:9,events,immutableIntent:true,duplicateAndRearmRejected:true},null,2)+'\n');
const source=fs.readFileSync(runner,'utf8'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const start=source.indexOf("      } else if (ev.action === 'dlg-cmd') {");
const end=source.indexOf("      } else if (ev.action === 'dlg-post-cmd')",start);
const qstart=source.indexOf('    while (scheduledInput.length && scheduledInput[0].batch <= batch) {');
const qend=source.indexOf('      injectedInputThisBatch = true;',qstart);
assert(qstart>0&&qend>qstart&&start>0&&end>start);
const branch=source.slice(start,end).replace(/^      } else if/,'if')+'}';
const queuePrefix=source.slice(qstart,qend);
fs.writeFileSync(path.join(E,'runner-extract.js'),queuePrefix+branch+'\n}\n');
const {compile}=require(process.env.SHADOW_NULL_TEST_COMPILER);
// Add only resolver imports/exports and a public alias to the existing full sender.
const adapter=`
(import "probe" "modal" (func $probe_modal (result i32)))
(import "probe" "parent" (func $probe_parent (param i32) (result i32)))
(import "probe" "slot" (func $probe_slot (param i32) (result i32)))
(export "modal_dialog_hwnd" (func $probe_modal))
(export "wnd_get_parent" (func $probe_parent))
(export "wnd_slot_hwnd" (func $probe_slot))
(func (export "dlg_get_style") (param i32) (result i32) (i32.const 1))
(export "send_message" (func $wnd_send_message_inner))
`;
const wat=fs.readFileSync(path.join(E,'actual-paths.wat'),'utf8')+adapter;
fs.writeFileSync(path.join(E,'selection-path.wat'),wat);
const b=compile(wat,new Map(),{mode:'production'});assert(b.success,JSON.stringify(b.diagnostics));
const wasm=path.join(E,'selection-path.wasm');fs.writeFileSync(wasm,b.wasmBinary);
const driver=path.join(E,'selection-driver.cjs');
fs.writeFileSync(driver,`
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=__dirname,runner=${JSON.stringify(runner)},mode=process.env.CASE;
process.argv[1]=runner;process.env.SHADOW_NULL_PID=String(process.pid);
const trace=x=>fs.appendFileSync(path.join(E,'selection-'+mode+'.trace'),JSON.stringify(x)+'\\n');
const sync=fs.fsyncSync;fs.fsyncSync=function(fd){sync(fd);const text=fs.readFileSync(process.env.SHADOW_NULL_OUTPUT,'utf8').trim();const row=JSON.parse(text.split('\\n').at(-1));trace({phase:'persisted',row});};
if(mode!=='nohook')require(${JSON.stringify(path.join(R,'tools/shadow-man-null-preload.cjs'))});
(async()=>{
 let hwnd=8194,cmd=0,route=mode.includes('parent')?'parent':mode.includes('slot')?'slot':'modal';
 const imports={host:{log_eip:()=>{}},probe:{modal:()=>{trace({phase:'resolve-modal',cmd,hwnd});return route==='modal'?hwnd:0;},parent:h=>{trace({phase:'parent',h});return h===hwnd+1?hwnd:0;},slot:s=>route!=='none'&&s===255?hwnd:0}};
 const m=await WebAssembly.compile(fs.readFileSync(process.argv.find(x=>x.startsWith('--wasm=')).slice(7)));
 const instance=await WebAssembly.instantiate(m,imports),we=instance.exports;
 new DataView(we.memory.buffer).setUint32(16,0x600000,true);we.set_eip(0x402000);
 const context={instance,process,__filename:runner,globalThis,Symbol,logs:[],diagnosticActionSequence:0,batch:17,scheduledInput:[],renderer:null};
 const code=fs.readFileSync(path.join(E,'runner-extract.js'),'utf8');
 for(let n=0;n<3;n++){
  cmd=[1024,1,3][n];context.batch=17+n;
  if(n===2){hwnd=require('node:crypto').randomInt(12000,60000);context.batch=require('node:crypto').randomInt(20,30);trace({phase:'acquired-after-OK',hwnd,batch:context.batch});}
  if(n===2&&mode==='wrong-cmd')cmd=1;
  if(n===2&&mode==='absent'){route='none';}
  if(n===2&&mode.includes('env-update')){
   process.env.SHADOW_NULL_SELECTION=JSON.stringify({actionSequence:3,batch:context.batch,cmdId:3,hwnd});
   trace({phase:'env-update-with-fresh-values',selection:process.env.SHADOW_NULL_SELECTION});
  }
  context.renderer=route==='parent'?{windows:{[hwnd]:{hwnd,visible:true,isDialog:true,zOrder:1},[hwnd+1]:{hwnd:hwnd+1,visible:true,isDialog:true,zOrder:2}}}:null;
  context.scheduledInput.push({batch:17+n,action:'dlg-cmd',cmdId:cmd});
  trace({phase:'before-dequeue',batch:context.batch,sequence:context.diagnosticActionSequence,count:we.null_diag_field(8)});
  try{vm.runInNewContext(code,context,{timeout:1000});}
  catch(e){trace({phase:'rejected',message:e.message,logs:context.logs,count:we.null_diag_field(8)});throw e;}
  trace({phase:'returned',cmd,logs:context.logs.slice(),count:we.null_diag_field(8)});
 }
 if(['absent','nohook'].includes(mode)){trace({phase:'off-complete',count:we.null_diag_field(8)});return;}throw Error('CONTINUED');
})();
`);
const results=[];
for(const mode of ['fresh-modal','fresh-parent','fresh-slot','fresh-env-update-modal','wrong-cmd','stale-selection','stale-env-update','absent','nohook','invalid-intent']){
 const output=path.join(E,'selection-'+mode+'.jsonl'),trace=path.join(E,'selection-'+mode+'.trace');
 for(const p of [output,trace])try{fs.unlinkSync(p);}catch{}
 const selection=mode.startsWith('stale')?{actionSequence:3,batch:19,cmdId:3,hwnd:8194}:{mode:'selected-action',actionSequence:3,cmdId:3,...(mode==='invalid-intent'?{hwnd:8194}:{})};
 const env={...process.env,CASE:mode,SHADOW_NULL_OUTPUT:output,SHADOW_NULL_MODE:'revised-first-zero',SHADOW_NULL_BLOCK_POLICY:'optional',SHADOW_NULL_WATCHDOG_MS:'5000',SHADOW_NULL_RUNNER_SHA:hash(fs.readFileSync(runner)),SHADOW_NULL_REVISED_SHA:hash(b.wasmBinary),SHADOW_NULL_SELECTION:JSON.stringify(selection)};
 const argv=[driver,'--wasm='+wasm];const p=cp.spawnSync(process.execPath,argv,{env,encoding:'utf8',timeout:5000});
 const read=p=>fs.existsSync(p)&&fs.readFileSync(p,'utf8').trim()?fs.readFileSync(p,'utf8').trim().split('\n').map(JSON.parse):[];
 const rows=read(output),steps=read(trace),positive=mode.startsWith('fresh'),off=['absent','nohook'].includes(mode);
 assert.equal(p.status,positive?86:off?0:1,mode+': '+p.stderr);
 if(mode==='invalid-intent'){assert.match(p.stderr,/invalid final Beenden selector/);assert(!steps.some(x=>x.phase==='before-dequeue'));assert(!rows.some(x=>x.receipt||x.record));}
 else {
  const returned=steps.filter(x=>x.phase==='returned');assert.equal(returned.length,off?3:2);assert(returned.every(x=>x.count===0));
  if(off){assert.equal(returned.at(-1).logs.length,3);assert.equal(returned.at(-1).logs.at(-1).includes('NO DIALOG'),mode==='absent');assert.equal(returned.at(-1).count,0);}
  const acquired=steps.find(x=>x.phase==='acquired-after-OK');assert(acquired);assert.notEqual(acquired.hwnd,8194);assert(acquired.batch>19);
  if(positive){
   const receipt=rows[0].receipt,actual=receipt.selection;
   assert.deepEqual(actual.intent,selection);assert.equal(actual.hwnd,acquired.hwnd);assert.equal(actual.batch,acquired.batch);assert.equal(actual.actionSequence,3);assert.equal(actual.cmdId,3);
   assert.equal(receipt.prior.boundary.eventCount,0);assert.deepEqual(actual.priorActions.map(x=>x.cmdId),[1024,1]);
   assert.equal(rows[0].sha256,hash(JSON.stringify(receipt)));assert.equal(rows[1].record.kind,'sender-pre');assert.equal(rows[1].record.boundary.eventCount,1);
   const persisted=steps.findIndex(x=>x.phase==='persisted'&&x.row.receipt);const native=steps.findIndex(x=>x.phase==='persisted'&&x.row.record?.kind==='sender-pre');
   assert(persisted>steps.indexOf(acquired)&&native>persisted);assert.equal(rows.at(-1).reason,'first-zero');assert.equal(rows.at(-2).record.classification,'ordinary-or-unknown; zero-writer unproven');
   assert.equal(actual.resolution,mode.includes('modal')?'modal':'resolved-dialog');
  }else{assert(!rows.some(r=>r.receipt||r.record));if(!off)assert.match(p.stderr,/wrong or late selected action\/HWND/);}
 }
 results.push({mode,argv:[process.execPath,...argv],env:Object.fromEntries(Object.entries(env).filter(([k])=>k.startsWith('SHADOW_NULL_')||k==='CASE')),exit:p.status,signal:p.signal,stderr:p.stderr,output:path.basename(output),trace:path.basename(trace),positive});
}
fs.writeFileSync(path.join(E,'fresh-selection-results.json'),JSON.stringify({exit:0,results,module:{bytes:b.wasmBinary.length,sha256:hash(b.wasmBinary),memoryInitialAndMaximum:8388608},runnerSha256:hash(fs.readFileSync(runner)),limits:{childTimeoutMs:5000,vmTimeoutMs:1000},qualification:'actual source sender/queue/branch plus scripted resolver; not full handler/module/guest'},null,2)+'\n');
console.log(JSON.stringify({exit:0,controls:results.map(x=>({mode:x.mode,exit:x.exit}))}));
