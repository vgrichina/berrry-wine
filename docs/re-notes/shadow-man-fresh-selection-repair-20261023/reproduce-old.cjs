'use strict';
// Review fixture: exact runner queue prefix + dlg-cmd branch and actual sender
// fragment, with scripted window-resolution imports. No whole runner/guest claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const E=process.env.SHADOW_NULL_TEST_OUTPUT,R=process.env.SHADOW_NULL_TEST_SOURCE_ROOT;assert(E&&R);const runner=path.join(R,'test/run.js');
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
require(${JSON.stringify(path.join(R,'tools/shadow-man-null-preload.cjs'))});
const trace=x=>fs.appendFileSync(path.join(E,'selection-'+mode+'.trace'),JSON.stringify(x)+'\\n');
(async()=>{
 let hwnd=8194,cmd=0,route=mode.includes('parent')?'parent':mode.includes('slot')?'slot':'modal';
 const imports={host:{log_eip:()=>{}},probe:{modal:()=>{trace({phase:'resolve-modal',cmd,hwnd});return route==='modal'?hwnd:0;},parent:h=>{trace({phase:'parent',h});return h===hwnd+1?hwnd:0;},slot:s=>s===255?hwnd:0}};
 const m=await WebAssembly.compile(fs.readFileSync(process.argv.find(x=>x.startsWith('--wasm=')).slice(7)));
 const instance=await WebAssembly.instantiate(m,imports),we=instance.exports;
 new DataView(we.memory.buffer).setUint32(16,0x600000,true);we.set_eip(0x402000);
 const context={instance,process,__filename:runner,globalThis,Symbol,logs:[],diagnosticActionSequence:0,batch:17,scheduledInput:[],renderer:null};
 const code=fs.readFileSync(path.join(E,'runner-extract.js'),'utf8');
 for(let n=0;n<3;n++){
  cmd=[1024,1,3][n];context.batch=17+n;
  if(n===2&&mode.includes('fresh'))hwnd=12291;
  if(n===2&&mode.includes('batch'))context.batch=20;
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
 throw Error('CONTINUED');
})();
`);
const results=[];
for(const mode of ['normal-modal','normal-parent','normal-slot','fresh-modal','fresh-parent','fresh-slot','batch-modal','fresh-env-update-modal']){
 const output=path.join(E,'selection-'+mode+'.jsonl'),trace=path.join(E,'selection-'+mode+'.trace');
 for(const p of [output,trace])try{fs.unlinkSync(p);}catch{}
 const selection={actionSequence:3,batch:19,cmdId:3,hwnd:8194};
 const env={...process.env,CASE:mode,SHADOW_NULL_OUTPUT:output,SHADOW_NULL_MODE:'revised-first-zero',SHADOW_NULL_BLOCK_POLICY:'optional',SHADOW_NULL_WATCHDOG_MS:'5000',SHADOW_NULL_RUNNER_SHA:hash(fs.readFileSync(runner)),SHADOW_NULL_REVISED_SHA:hash(b.wasmBinary),SHADOW_NULL_SELECTION:JSON.stringify(selection)};
 const argv=[driver,'--wasm='+wasm];const p=cp.spawnSync(process.execPath,argv,{env,encoding:'utf8',timeout:5000});
 const rows=fs.readFileSync(output,'utf8').trim().split('\n').map(JSON.parse),steps=fs.readFileSync(trace,'utf8').trim().split('\n').map(JSON.parse);
 const normal=mode.startsWith('normal');assert.equal(p.status,normal?86:1,p.stderr);
 assert.equal(steps.filter(x=>x.phase==='returned').length,2);
 assert(steps.filter(x=>x.phase==='returned').every(x=>x.count===0));
 if(normal){assert.equal(rows[0].receipt.selection.hwnd,8194);assert.equal(rows[0].receipt.selection.priorActions.length,2);assert.equal(rows.at(-1).reason,'first-zero');assert.equal(rows.at(-2).record.classification,'ordinary-or-unknown; zero-writer unproven');}
 else {assert.match(p.stderr,/wrong or late selected action\/HWND/);assert(!rows.some(r=>r.receipt||r.record));assert.equal(steps.at(-1).count,0);assert.equal(steps.at(-1).logs.length,2);}
 results.push({mode,argv:[process.execPath,...argv],env:Object.fromEntries(Object.entries(env).filter(([k])=>k.startsWith('SHADOW_NULL_')||k==='CASE')),exit:p.status,signal:p.signal,stderr:p.stderr,output:path.basename(output),trace:path.basename(trace),normalControl:normal,sourceWindow:'exact queue dequeue prefix + exact dlg-cmd branch',freshAcquisitionContractPass:normal?'pre-known synthetic only':false});
}
fs.writeFileSync(path.join(E,'fresh-selection-results.json'),JSON.stringify({verdict:'REQUEST CHANGES: immutable pre-start selector cannot accept fresh late-acquired HWND/batch; exact runner path rejects before selected send',results,module:{bytes:b.wasmBinary.length,sha256:hash(b.wasmBinary),memoryInitialAndMaximum:8388608},runnerSha256:hash(fs.readFileSync(runner)),limits:{childTimeoutMs:5000,vmTimeoutMs:1000},qualification:'actual source sender/queue/branch plus scripted resolver; not full handler/module/guest'},null,2)+'\n');
console.log(JSON.stringify({exit:0,expectedContractFailures:results.filter(x=>!x.normalControl).map(x=>({mode:x.mode,exit:x.exit})),normalControlExits:results.filter(x=>x.normalControl).map(x=>x.exit)}));
