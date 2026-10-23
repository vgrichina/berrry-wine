'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const {createCapture,createSelectedSend,SEND_HOOK,CaptureStop,ADDRESS}=require('../tools/shadow-man-null-capture.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.SHADOW_NULL_TEST_OUTPUT||fs.mkdtempSync(path.join(require('node:os').tmpdir(),'shadow-null-repair-controls-'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const runner=path.join(root,'test/run.js'),preload=path.join(root,'tools/shadow-man-null-preload.cjs');
const source=fs.readFileSync(runner,'utf8'),selection={actionSequence:3,batch:19,cmdId:3,hwnd:8194};
const records=[],events=[];
for(const maxRecords of [NaN,Infinity,0,33,1.5])assert.throws(()=>createCapture({metadata:{},retain:()=>{},stop:()=>{},maxRecords}),/invalid capture contract/);
const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi','eip'];
function mock() {
 const state={on:0,count:0,eip:0x402000,trace:0};
 const exports=Object.fromEntries(regs.map((n,i)=>['get_'+n,()=>n==='esp'?0x600000:n==='eip'?state.eip:0x100+i]));
 Object.assign(exports,{guest_read8:()=>0,set_bp:n=>events.push(['bp',n]),set_trace_eip_range:n=>{events.push(['trace',n]);state.trace=n;},set_null_diag:n=>{events.push(['arm',n]);state.on=n;state.count=0;},null_diag_field:i=>i===8?state.count:0,null_diag_token:()=>1n,null_diag_root:()=>1n});
 return {state,exports};
}
const make=()=>{const m=mock(),retained=[];const capture=createCapture({untilZero:true,metadata:{control:true},retain:r=>retained.push(r),stop:r=>events.push(['stop',r])});return {...m,capture,retained};};
const context=(instance,changes={})=>({instance,pid:process.pid,runner,action:'dlg-cmd',...selection,resolution:'resolved-dialog',...changes});
let f=make(),instance={exports:f.exports};
let adapter=createSelectedSend({instance,capture:f.capture,selection,runner});
for(let n=1;n<3;n++)adapter(context(instance,{actionSequence:n,batch:16+n,cmdId:n===1?1024:1}),()=>{assert.equal(f.state.on,0);for(let j=0;j<80;j++)assert.equal(f.capture.log(ADDRESS),false);});
assert.equal(f.retained.length,0);
assert.throws(()=>adapter(context(instance),()=>{assert.equal(f.state.on,1);assert.equal(f.state.count,0);f.state.eip=0;f.state.count++;f.capture.log(-5);events.push(['CONTINUED']);}),CaptureStop);
assert.equal(f.retained[0].receipt.selection.hwnd,8194);assert.equal(f.retained[0].receipt.prior.registers.eip,0x402000);assert.deepEqual(f.retained[0].receipt.selection.priorActions.map(a=>a.cmdId),[1024,1]);assert(Object.isFrozen(f.retained[0].receipt.prior.registers));
assert.equal(f.retained.at(-1).record.classification,'ordinary-or-unknown; zero-writer unproven');assert(!events.some(x=>x[0]==='CONTINUED'));
assert.throws(()=>adapter(context(instance),()=>{}),/duplicate or late/);
for(const changes of [{instance:{}},{pid:process.pid+1},{runner:'other'},{action:'post-cmd'},{hwnd:8195},{cmdId:1},{batch:20},{actionSequence:4},{resolution:'unknown'}]){
 f=make();instance={exports:f.exports};adapter=createSelectedSend({instance,capture:f.capture,selection,runner});
 let sent=false;assert.throws(()=>adapter(context(instance,changes),()=>{sent=true;}));assert.equal(sent,false);assert.equal(f.state.on,0);
}
for(const mode of ['return','exception','retention','block-required','starvation']){
 f=make();instance={exports:f.exports};
 if(mode==='retention')f.capture=createCapture({untilZero:true,metadata:{},retain:()=>{throw Error('disk failed');},stop:()=>{}});
 if(mode==='block-required')f.capture=createCapture({untilZero:true,requireBlock:true,metadata:{},retain:()=>{},stop:()=>{}});
 adapter=createSelectedSend({instance,capture:f.capture,selection,runner});
 assert.throws(()=>adapter(context(instance),()=>{if(mode==='exception')throw Error('send failed');if(mode==='block-required'){f.state.eip=0;f.capture.log(-5);}if(mode==='starvation')for(let n=0;n<32;n++)f.capture.log(-1);}),CaptureStop);
}
// Evaluate the EXACT actual runner dlg-cmd branch, including resolution/parent climb.
const start=source.indexOf("      } else if (ev.action === 'dlg-cmd') {");
const end=source.indexOf("      } else if (ev.action === 'dlg-post-cmd')",start);
assert(start>0&&end>start);const branch=source.slice(start,end).replace(/^      } else if/, 'if')+'}';
const orderCases=[];
for(const route of ['modal','renderer-parent','slot','none','disabled']){
 const order=[],r={windows:{8194:{hwnd:8194,visible:true,isDialog:true,zOrder:1},9000:{hwnd:9000,visible:true,isDialog:true,zOrder:2}}};
 const we={modal_dialog_hwnd:()=>{order.push('resolve-modal');return route==='modal'?8194:0;},wnd_get_parent:h=>{order.push('parent');return h===9000?8194:0;},wnd_slot_hwnd:s=>s===255?8194:0,dlg_get_style:()=>1,send_message:(h,msg,cmd,l)=>{order.push('send');assert.equal(h,8194);assert.equal(msg,0x111);assert.equal(cmd,3);assert.equal(l,0);}};
 const i={exports:we},globals={};
 if(route!=='disabled')globals[SEND_HOOK]=(c,send)=>{assert.equal(c.hwnd,8194);assert.equal(c.actionSequence,3);assert.equal(c.instance,i);if(process.env.SHADOW_NULL_TEST_LATE_ARM){const value=send();order.push('arm');return value;}order.push('arm');return send();};
 const ctx={instance:i,renderer:['renderer-parent','disabled'].includes(route)?r:null,ev:{action:'dlg-cmd',cmdId:3},batch:19,diagnosticActionSequence:3,logs:[],process,__filename:runner,globalThis:globals,Symbol};
 if(route==='none'){we.wnd_slot_hwnd=()=>0;}
 vm.runInNewContext('for(let once=0;once<1;once++){'+branch+'}',ctx,{timeout:1000});
 if(route==='none')assert(!order.includes('send')&&!order.includes('arm'));
 else if(route==='disabled')assert(!order.includes('arm')&&order.includes('send'));
 else assert(order.indexOf('arm')<order.indexOf('send')&&order.indexOf('arm')>order.indexOf('resolve-modal'));
 orderCases.push({route,order});
}
assert(source.includes('diagnosticActionSequence++;'));
// Reuse the native fixture generated by the original test in the durable wrapper.
// A standalone invocation generates it by running only that bounded fixture test.
const fixture=path.join(out,'fixture.wasm');
if(!fs.existsSync(fixture)){
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,'test-shadow-man-null-capture.cjs')],{env:{...process.env,SHADOW_NULL_TEST_OUTPUT:out},encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);
}
const binary=fs.readFileSync(fixture),moduleSha=sha(binary);
const driver=path.join(out,'binding-driver.cjs');
fs.writeFileSync(driver,`const fs=require('fs');const originalCompile=WebAssembly.compile;const real=process.argv[1];process.env.SHADOW_NULL_PID=String(process.pid+(process.env.CASE==='wrong-pid'?1:0));if(process.env.CASE!=='wrong-process')process.argv[1]=${JSON.stringify(runner)};require(${JSON.stringify(preload)});(async()=>{let b=fs.readFileSync(process.argv.find(x=>x.startsWith('--wasm=')).slice(7));if(process.env.CASE==='wrong-module')b=Buffer.concat([b,Buffer.from([0,2,1,120])]);if(process.env.CASE==='bytes')b[0]=1;if(process.env.CASE==='start')b=Buffer.from([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,8,1,0,10,4,1,2,0,11]);const m=process.env.CASE==='unbound'?await originalCompile(b):await WebAssembly.compile(b);if(process.env.CASE==='compile-twice')await WebAssembly.compile(b);const imports={host:{log_eip:()=>{}}};if(process.env.CASE==='constructor')new WebAssembly.Instance(m,imports);if(process.env.CASE==='streaming')await WebAssembly.instantiateStreaming({});const instance=await WebAssembly.instantiate(process.env.CASE==='alternate'?b:m,imports);if(process.env.CASE==='second-context')await WebAssembly.instantiate(m,imports);if(instance.exports.memory){new DataView(instance.exports.memory.buffer).setUint32(16,0x600000,true);for(let n=0;n<40;n++)instance.exports.event(3);}const hook=globalThis[Symbol.for('wine.shadow-null.selected-send.v1')];const c={instance,pid:process.pid,runner:process.argv[1],action:'dlg-cmd',actionSequence:3,batch:19,cmdId:3,hwnd:8194,resolution:'resolved-dialog'};hook(c,()=>{instance.exports.event(1);instance.exports.zero();});fs.writeFileSync(${JSON.stringify(path.join(out,'CONTINUED'))},'bad');})();`);
const cases={};
for(const mode of ['normal','wrong-pid','runner-hash','constructor','streaming','wrong-module','bytes','unbound','alternate','second-context','compile-twice','wrong-process','wrong-hash','exclusive','child','conflict','missing-exports','start']){
 const output=path.join(out,'binding-'+mode+'.jsonl');try{fs.unlinkSync(output);}catch(_){}if(mode==='exclusive')fs.writeFileSync(output,'PRESERVE\n');
 let input=fixture;let expectedSha=moduleSha;
 if(mode==='missing-exports'||mode==='start'){
  const b=mode==='start'?Buffer.from([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,8,1,0,10,4,1,2,0,11]):Buffer.from([0,97,115,109,1,0,0,0]);input=path.join(out,mode+'.wasm');fs.writeFileSync(input,b);expectedSha=sha(b);
 }
 const env={...process.env,CASE:mode,SHADOW_NULL_OUTPUT:output,SHADOW_NULL_MODE:'revised-first-zero',SHADOW_NULL_RUNNER_SHA:mode==='runner-hash'?'0'.repeat(64):sha(fs.readFileSync(runner)),SHADOW_NULL_REVISED_SHA:mode==='wrong-hash'?'0'.repeat(64):expectedSha,SHADOW_NULL_WATCHDOG_MS:'5000',SHADOW_NULL_BLOCK_POLICY:'optional',SHADOW_NULL_SELECTION:JSON.stringify(selection)};
 const args=[driver,'--wasm='+input];if(mode==='child')args.push('--spawned-child');if(mode==='conflict')args.push('--trace-api');
 const r=cp.spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:5000});
 const text=fs.existsSync(output)?fs.readFileSync(output,'utf8'):'';
 const reasons={'wrong-pid':'wrong target process PID','runner-hash':'wrong process/runner','constructor':'Instance constructor context forbidden','streaming':'streaming context forbidden','wrong-module':'compile bytes differ','bytes':'compile bytes differ','unbound':'unbound Module','alternate':'unbound Module','second-context':'second instance/context','compile-twice':'second compile/context','wrong-process':'wrong process/runner','wrong-hash':'explicit distinct revised','exclusive':'EEXIST','child':'conflicting diagnostic/child','conflict':'conflicting diagnostic/child','missing-exports':'capture-failed: missing export','start':'start section forbidden'};
 assert.equal(r.status,['normal','missing-exports'].includes(mode)?86:1,mode+': '+r.stderr);
 if(mode==='normal'){const rows=text.trim().split('\n').map(JSON.parse);assert(rows[0].receipt);assert.equal(rows[0].receipt.prior.boundary.eventCount,0);assert.equal(rows[1].record.kind,'sender-pre');assert.equal(rows[1].record.boundary.eventCount,1);assert.equal(rows.at(-2).record.kind,'first-zero');assert.equal(rows.at(-1).reason,'first-zero');assert.equal(rows[1].record.metadata.actualModule.moduleSha256,moduleSha);}
 else assert((r.stderr+text).includes(reasons[mode]),mode+': '+r.stderr+text);
 if(mode==='exclusive')assert.equal(text,'PRESERVE\n');
 assert(!fs.existsSync(path.join(out,'CONTINUED')));
 cases[mode]={argv:[process.execPath,...args],exit:r.status,signal:r.signal,reason:reasons[mode]||'first-zero',stderr:r.stderr,output:text,inputSha256:sha(fs.readFileSync(input)),submittedCompileSha256:sha(mode==='wrong-module'?Buffer.concat([fs.readFileSync(input),Buffer.from([0,2,1,120])]):mode==='bytes'?Buffer.concat([Buffer.from([1]),fs.readFileSync(input).subarray(1)]):fs.readFileSync(input)),compiledBytesChanged:mode==='wrong-module'||mode==='bytes',externalChildTimeoutMs:5000,noContinuation:true};
}
const result={exit:0,checks:['startup Config/OK OFF and 160 callbacks consume no quota','one-shot synchronous selected send, prior state immutable','wrong process/context/action/HWND/batch/late/rearm rejects before send','retention/exception/returned window/starvation/block-required rejects','ordinary-or-unknown legitimate zero label','exact runner modal/renderer parent/slot ordering plus absent and default-off controls','compile-byte/Module/context/start-section binding rejects'],runnerSha256:sha(fs.readFileSync(runner)),orderCases,preloadCases:cases,limits:{arenaBytes:8388608,childTimeoutMs:5000,perTestTimeoutMs:20000,maxRecords:32,reservedTerminalRecords:1},fullModule:'NOT EXECUTED',actualHandlerCompatibility:'NOT EXECUTED (scripted native seams only)'};
fs.writeFileSync(path.join(out,'repair-tests.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({exit:0,checks:result.checks,orderCases,preloadCases:Object.fromEntries(Object.entries(cases).map(([k,v])=>[k,{exit:v.exit,reason:v.reason}]))}));
