'use strict';
// Bounded independent source/offline acceptance. Scripted resolver/run seams;
// queue/dequeue/dlg-cmd and native sender remain exact candidate source.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const E=__dirname,R=path.resolve(E,'../../..'),D='/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23',OLD='/home/user/wine-assembly-shadow-man-null-arming-identity-repair-oct23';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.existsSync(p)&&fs.readFileSync(p,'utf8').trim()?fs.readFileSync(p,'utf8').trim().split('\n').map(JSON.parse):[];
if(process.argv[2]==='child'){
 const spec=JSON.parse(process.env.ACCEPT_CASE),root=spec.old?OLD:R,runner=path.join(root,'test/run.js'),trace=x=>fs.appendFileSync(process.env.ACCEPT_TRACE,JSON.stringify(x)+'\n');
 process.argv[1]=runner;process.env.SHADOW_NULL_PID=String(process.pid);
 let stage='startup',cmd=0,hwnd=8194,route=spec.route||'modal',sequence=0;
 const sync=fs.fsyncSync;let failed=false;
 fs.fsyncSync=function(fd){
  const row=read(process.env.SHADOW_NULL_OUTPUT).at(-1);
  if(spec.fault==='fsync'&&row?.receipt&&!failed){failed=true;trace({phase:'fsync-failed',stage});throw Error('INDEPENDENT fsync failure');}
  sync(fd);trace({phase:'fsync-complete',stage,row});
 };
 if(!spec.nohook)require(path.join(root,'tools/shadow-man-null-preload.cjs'));
 (async()=>{
  const imports={host:{log_eip:()=>{}},probe:{modal:()=>{trace({phase:'resolve',stage,sequence,hwnd,route});return route==='modal'?hwnd:0;},parent:h=>h===hwnd+1?hwnd:0,slot:s=>route==='slot'&&s===255?hwnd:0,observe:n=>{
   trace({phase:n===4?'native-send':'mutation',n,stage,cmd,sequence});
   if((spec.fault==='prior-send'&&n===4&&stage==='prior')||(spec.fault==='arm'&&n===1&&stage==='selected'))throw Error('INDEPENDENT '+spec.fault+' failure');
  }}};
  const m=await WebAssembly.compile(fs.readFileSync(process.argv.find(x=>x.startsWith('--wasm=')).slice(7))),instance=await WebAssembly.instantiate(m,imports),we=instance.exports;
  new DataView(we.memory.buffer).setUint32(16,0x600000,true);we.set_eip(0x402000);
  const c={instance,process,__filename:runner,globalThis,Symbol,logs:[],diagnosticActionSequence:0,batch:17,scheduledInput:[],renderer:null};
  const code=fs.readFileSync(path.join(E,'independent-runner-extract.js'),'utf8');
  let schedule=spec.schedule||[1024,1,3];
  for(let i=0;i<schedule.length;i++){
   sequence=i+1;stage=sequence===spec.sequence?'selected':sequence<spec.sequence?'prior':'later';cmd=schedule[i];
   if(sequence===spec.sequence){hwnd=crypto.randomInt(65536,0x7ffffffe);c.batch=crypto.randomInt(40,80);trace({phase:'fresh-acquired',hwnd,batch:c.batch,sequence});if(spec.absent)route='none';}
   else if(sequence>spec.sequence){route=spec.route||'modal';c.batch++;}
   else c.batch=17+i;
   if(stage==='selected'&&spec.envReplace){process.env.SHADOW_NULL_SELECTION=JSON.stringify({mode:'selected-action',actionSequence:999,cmdId:3});trace({phase:'env-replaced'});}
   c.renderer=route==='parent'?{windows:{[hwnd]:{hwnd,visible:true,isDialog:true,zOrder:1},[hwnd+1]:{hwnd:hwnd+1,visible:true,isDialog:true,zOrder:2}}}:null;
   c.scheduledInput.push({batch:17+i,action:cmd===null?'independent-noop':'dlg-cmd',cmdId:cmd});
   trace({phase:'before-dequeue',sequence,count:we.null_diag_field(8)});
   try{vm.runInNewContext(code,c,{timeout:1000});}catch(e){trace({phase:'throw',stage,message:e.message,count:we.null_diag_field(8),sequence:c.diagnosticActionSequence});throw e;}
   trace({phase:'returned',stage,sequence:c.diagnosticActionSequence,cmd,count:we.null_diag_field(8),logs:c.logs.slice()});
  }
  trace({phase:'end',count:we.null_diag_field(8),sequence:c.diagnosticActionSequence});
 })();
}else{
 const runner=fs.readFileSync(path.join(R,'test/run.js'),'utf8');
 const qs=runner.indexOf('    while (scheduledInput.length && scheduledInput[0].batch <= batch) {'),qe=runner.indexOf('      injectedInputThisBatch = true;',qs);
 const bs=runner.indexOf("      } else if (ev.action === 'dlg-cmd') {"),be=runner.indexOf("      } else if (ev.action === 'dlg-post-cmd')",bs);
 assert(qs>0&&qe>qs&&bs>0&&be>bs);
 fs.writeFileSync(path.join(E,'independent-runner-extract.js'),runner.slice(qs,qe)+runner.slice(bs,be).replace(/^      } else if/,'if')+'}\n}\n');
 // Native observability only: imports report entry before existing mutations and
 // sender body. The actual sender instructions are otherwise unchanged.
 let wat=fs.readFileSync(path.join(E,'selection-path.wat'),'utf8');
 const substitutions=[['(func (export "set_bp") (param i32))','(func (export "set_bp") (param i32) (call $observe (i32.const 1)))'],['(func (export "set_trace_eip_range") (param i32) (param i32) (param i32))','(func (export "set_trace_eip_range") (param i32) (param i32) (param i32) (call $observe (i32.const 2)))'],['(func (export "set_null_diag") (param $on i32)','(func (export "set_null_diag") (param $on i32) (call $observe (i32.const 3))'],['(local $expected_child i64) (local $expected_root i64) (local $expected_depth i32)','(local $expected_child i64) (local $expected_root i64) (local $expected_depth i32) (call $observe (i32.const 4))']];
 for(const[a,b]of substitutions){assert.equal(wat.split(a).length,2,a);wat=wat.replace(a,b);}
 wat='(import "probe" "observe" (func $observe (param i32)))\n'+wat;
 fs.writeFileSync(path.join(E,'independent-path.wat'),wat);
 const {compile}=require(process.env.SHADOW_NULL_TEST_COMPILER),b=compile(wat,new Map(),{mode:'production'});assert(b.success,JSON.stringify(b.diagnostics));
 const wasm=path.join(E,'independent-path.wasm');fs.writeFileSync(wasm,b.wasmBinary);
 const cases=[
  {id:'modal',sequence:3,positive:true},{id:'parent',sequence:3,route:'parent',positive:true},{id:'slot',sequence:3,route:'slot',positive:true},
  {id:'late-env',sequence:3,envReplace:true,positive:true},
  {id:'all-dequeues',sequence:5,schedule:[1024,null,1,null,3],positive:true},
  {id:'earlier-same-command',sequence:3,schedule:[3,null,3],positive:true},
  {id:'wrong-selected-command',sequence:3,schedule:[1024,1,1,3],exit:1,error:/wrong or late/},
  {id:'selected-nondialog-action',sequence:2,schedule:[1024,null,3],exit:1,error:/wrong or late/},
  {id:'absent-selected-then-later-match',sequence:3,schedule:[1024,1,3,3],absent:true,exit:1,error:/wrong or late/},
  {id:'absent-selected',sequence:3,absent:true,exit:0},
  {id:'prior-throws',sequence:3,fault:'prior-send',exit:1,error:/INDEPENDENT prior-send failure/},
  {id:'fsync-throws',sequence:3,fault:'fsync',exit:86,failure:true},
  {id:'arm-throws',sequence:3,fault:'arm',exit:1,error:/INDEPENDENT arm failure/},
  {id:'nohook-off',sequence:3,nohook:true,exit:0},
  {id:'exact-valid',sequence:3,exact:true,positive:true},
  {id:'exact-stale-hwnd',sequence:3,stale:'hwnd',exit:1,error:/wrong or late/},
  {id:'exact-stale-batch',sequence:3,stale:'batch',exit:1,error:/wrong or late/},
  {id:'old-desired-fresh',sequence:3,old:true,exit:1,error:/invalid final Beenden selector/}
 ];
 // Exact-mode positive alone needs controlled values known before preload;
 // fresh-mode positives always acquire randomness only at the selected dequeue.
 const thisSource=fs.readFileSync(__filename,'utf8');
 const fixedDriver=path.join(E,'exact-driver.cjs');
 fs.writeFileSync(fixedDriver,thisSource.replace("hwnd=crypto.randomInt(65536,0x7ffffffe);c.batch=crypto.randomInt(40,80)","hwnd=90001;c.batch=61"));
 const results=[];
 for(const s of cases){
  const output=path.join(E,s.id+'.jsonl'),trace=path.join(E,s.id+'.trace');for(const p of[output,trace])try{fs.unlinkSync(p);}catch{}
  const root=s.old?OLD:R,selection=s.exact||s.stale?{actionSequence:s.sequence,cmdId:3,hwnd:s.stale==='hwnd'?8194:90001,batch:s.stale==='batch'?19:61}:{mode:'selected-action',actionSequence:s.sequence,cmdId:3};
  const env={...process.env,ACCEPT_CASE:JSON.stringify(s),ACCEPT_TRACE:trace,SHADOW_NULL_OUTPUT:output,SHADOW_NULL_MODE:'revised-first-zero',SHADOW_NULL_BLOCK_POLICY:'optional',SHADOW_NULL_WATCHDOG_MS:'5000',SHADOW_NULL_RUNNER_SHA:hash(fs.readFileSync(path.join(root,'test/run.js'))),SHADOW_NULL_REVISED_SHA:hash(b.wasmBinary),SHADOW_NULL_SELECTION:JSON.stringify(selection)};
  const argv=[s.exact||s.stale?fixedDriver:__filename,'child','--wasm='+wasm];
  const p=cp.spawnSync(process.execPath,argv,{env,encoding:'utf8',timeout:5000,maxBuffer:262144}),rows=read(output),steps=read(trace);
  results.push({id:s.id,argv:[process.execPath,...argv],env:Object.fromEntries(Object.entries(env).filter(([k])=>k.startsWith('SHADOW_NULL_')||k.startsWith('ACCEPT_'))),exit:p.status,signal:p.signal,error:p.error?.message,stderr:p.stderr,timeoutMs:5000});
  fs.writeFileSync(path.join(E,'independent-results.json'),JSON.stringify({results,module:{bytes:b.wasmBinary.length,sha256:hash(b.wasmBinary),initialAndMaximum:8388608},substitutions,limits:{childMs:5000,vmMs:1000,maxBuffer:262144}},null,2)+'\n');
  assert.equal(p.status,s.positive?86:s.exit,s.id+': '+p.stderr);assert(!p.error,s.id);if(s.error)assert.match(p.stderr,s.error);
  if(s.positive){
   const receipt=rows[0].receipt,sel=receipt.selection,fresh=steps.find(x=>x.phase==='fresh-acquired');
   assert(receipt&&fresh,s.id);assert.equal(sel.actionSequence,s.sequence);assert.equal(sel.hwnd,fresh.hwnd);assert.equal(sel.batch,fresh.batch);assert.equal(sel.cmdId,3);assert.equal(receipt.prior.boundary.eventCount,0);
   assert.equal(rows[0].sha256,hash(JSON.stringify(receipt)));if(!s.exact)assert.deepEqual(sel.intent,selection);
   const syncIndex=steps.findIndex(x=>x.phase==='fsync-complete'&&x.row.receipt),mutIndex=steps.findIndex(x=>x.phase==='mutation'),nativeIndex=steps.findIndex(x=>x.phase==='native-send'&&x.stage==='selected');
   assert(syncIndex>steps.indexOf(fresh)&&mutIndex>syncIndex&&nativeIndex>mutIndex,s.id+' persist before mutation/send');
   assert.deepEqual(steps.filter(x=>x.phase==='mutation').map(x=>x.n),[1,2,3]);
   assert.equal(rows.at(-1).reason,'first-zero');assert.equal(rows[1].record.kind,'sender-pre');
   assert.equal(steps.filter(x=>x.phase==='returned').length,s.sequence-1);assert(steps.filter(x=>x.phase==='returned').every(x=>x.count===0));
   if(s.id==='all-dequeues')assert.deepEqual(sel.priorActions.map(x=>x.actionSequence),[1,3]);
   if(s.id==='earlier-same-command')assert.deepEqual(sel.priorActions.map(x=>x.cmdId),[3]);
  }else{
   assert(!rows.some(x=>x.record),s.id+' must not create capture');
   if(!s.nohook)assert(!steps.some(x=>x.phase==='native-send'&&x.stage==='selected'),s.id+' no selected native send');
   if(s.failure){assert.match(rows.at(-1).reason,/capture-failed: arm retention/);assert(!steps.some(x=>x.phase==='mutation'));assert(!steps.some(x=>x.phase==='fsync-complete'&&x.row.receipt));}
   else assert(!rows.some(x=>x.terminal===true),s.id+' no terminal success');
   if(s.id.startsWith('absent'))assert(steps.some(x=>x.phase==='returned'&&x.logs.some(y=>y.includes('NO DIALOG'))));
  }
 }
 console.log(JSON.stringify({exit:0,cases:results.map(x=>[x.id,x.exit]),qualification:'SOURCE/OFFLINE, scripted dependencies, no full handler/module/guest'}));
}
