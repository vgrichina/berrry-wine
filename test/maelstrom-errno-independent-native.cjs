'use strict';
// Real production dispatch and x86 CALL/RET. Controlled fixtures, never original-game proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const O=path.resolve(__dirname,'../../ops'),H='/home/user/maelstrom-errno-api-canonical-native-oct25/ops',hook=require('/home/user/maelstrom-errno-api-canonical-native-oct25/repo/tools/maelstrom-native-errno-latch.cjs');
const select=require('/home/user/maelstrom-errno-api-canonical-native-oct25/repo/tools/maelstrom-select-completion-hook.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const scenario=process.argv[2]||'errno4',compat=process.argv.includes('--compat');
const evidenceCase=scenario+(compat?'-compat':'-tail');
const allowed=['errno0','errno4','errno37','wrong-select-return','wrong-native-target','wrong-return-pc','wrong-ebp','unsafe-errno','return-without-call','block-mode','stale-start','foreign-thread','foreign-regbank','postframe','unsafe-caller','uop-mode','code16-mode','nested-call'];
assert(allowed.includes(scenario));
const abi=JSON.parse(fs.readFileSync(H+'/static-abi.json'));assert.equal(abi.status,'PASS');
const bytes=fs.readFileSync(H+(compat?'/errno-latch.compat.wasm':'/errno-latch.wasm'));assert.equal(sha(bytes),abi.outputs[compat?1:0].sha256);
const sig=Object.fromEntries(abi.outputs[compat?1:0].exports.map(e=>[e.name,e.signature]));
const expected={run:[1,0],init_thread:[8,0],set_count:[2,0],get_count:[1,1],set_eip:[1,0],set_eax:[1,0],set_esp:[1,0],set_edi:[1,0],set_ebp:[1,0],set_ecx:[1,0],set_edx:[1,0],set_ebx:[1,0],set_esi:[1,0],set_yield_state:[2,0],test_vsock_alloc:[0,1],test_vsock_reset:[0,0],set_api_log:[1,0],set_block_exec:[1,0],test_shift:[6,1]};
for(const [n,[np,nr]]of Object.entries(expected))assert.deepEqual(sig[n],{params:Array(np).fill('i32'),results:Array(nr).fill('i32')},n);
for(const n of hook.FIELDS)assert.deepEqual(sig['mne_'+n],{params:[],results:['i32']});
assert.deepEqual(sig.mne_start,{params:[],results:[]});
const binaries=Object.fromEntries(['net','exe','crt'].map(n=>[n,fs.readFileSync(H+'/anchors/'+n)]));
const anchors=hook.verifyBinaries(binaries),pe=hook.pe(binaries.crt);
const authenticErrno=binaries.crt.subarray(pe.offset(0x7800c430,9),pe.offset(0x7800c430,9)+9);
assert.equal(authenticErrno.toString('hex'),'e82274ffff83c008c3');
const IMAGE=0x400000,THUNK=0x75040f8,BASE=0x522000,HEAD=0x7a3362,STALE=0x5a170123;
const direct=a=>(a-IMAGE+0x12000)>>>0;
const inventory=Object.fromEntries(abi.inventory.map(r=>[r.name,r]));
function fixture(enabled){
 const d=enabled?0:0x1000,cb=BASE+(enabled?0:0x20000);
 return {enabled,pc:HEAD+d,crtBase:cb,entry:cb+0xc430,provider:cb+0x3857,tail:cb+0xc435,
  fd:enabled?0x4a4000:0x494000,tv:enabled?0x4a4040:0x494040,esp:enabled?(scenario==='unsafe-caller'?0x83edecd:0x7412000):0x7402000,
  errnoPtr:enabled?0x451008:0x441008};
}
const fixtures=[fixture(false),fixture(true)],spans=[];
for(const f of fixtures){
 for(const [kind,a,n]of [['head',f.pc,16],['native-entry',f.entry,9],['synthetic-thread-provider',f.provider,6],['fdset',f.fd,32],['timeval',f.tv,8],['stack',f.esp-16,scenario==='unsafe-caller'?64:512],['errno',f.errnoPtr-8,16]]){
  assert(a>=0x10000&&a+n<=0xffffffff&&direct(a)>=0x12000&&direct(a)+n<=0x8000000);
  spans.push({enabled:f.enabled,kind,a,n});
 }
}
for(let i=0;i<spans.length;i++)for(let j=0;j<i;j++){const a=spans[i],b=spans[j];assert(a.a+a.n<=b.a||b.a+b.n<=a.a,'disjoint fixture spans');}
const preflight={status:'PASS',scenario,signatures:expected,spans,moduleSHA256:sha(bytes),nativeInstances:0,arenaMiB:512,heapMiB:512,
 mapping:'explicit synthetic CRT base 0x522000; authentic _errno CALL/ADD/RET bytes, synthetic _getptd returns controlled thread-data pointer; no original loader mapping',
 actualMountArgv:[],intendedFiles:[],controls:'actual counter starting counts checked immediately before each run; code/data/stack/fdset/timeval spans disjoint'};
fs.writeFileSync(O+'/native-preflight-'+evidenceCase+'.json',JSON.stringify(preflight,null,2));
if(process.argv.includes('--preflight')){console.log(JSON.stringify({status:'PASS',scenario,nativeInstances:0,spans:spans.length,signatures:Object.keys(expected).length}));return;}
assert(fs.existsSync(O+'/native-attempt.json'),'exclusive native supervisor admission required');
const mod=new WebAssembly.Module(bytes);
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});assert.equal(memory.buffer.byteLength,536870912);
const imports={},hosts=[],unexpected=[];
for(const item of WebAssembly.Module.imports(mod)){
 const ns=imports[item.module]||={};
 if(item.kind==='memory'){assert.equal(item.module+'.'+item.name,'host.memory');ns[item.name]=memory;}
 else{assert.equal(item.kind,'function');ns[item.name]=(...args)=>{
  hosts.push({name:item.module+'.'+item.name,args});
  if(item.module==='host'&&['beep_process_begin','beep_thread_begin'].includes(item.name))return 0;
  if(item.module==='host'&&item.name==='get_ticks')return 1000;
  if(item.module==='host'&&item.name==='socket_event'&&args[0]===3)return 0;
  unexpected.push(item.module+'.'+item.name);throw Error('unexpected behavioral host import '+item.name);
 };}
}
const e=new WebAssembly.Instance(mod,imports).exports;
e.init_thread(0,IMAGE,0x480000,0x7b0000,0x7500000,0x7540000,0,1);e.set_api_log(0);e.set_bp(0);
assert.equal(e.get_current_thread_id(),1);assert.equal(e.get_image_base(),IMAGE);
const dv=new DataView(memory.buffer),put=(a,b)=>new Uint8Array(memory.buffer,direct(a),b.length).set(b);
const words=(a,ws)=>ws.forEach((w,i)=>dv.setUint32(direct(a)+4*i,w>>>0,true));
const word=a=>dv.getUint32(direct(a),true);
const diag=()=>Object.fromEntries(hook.FIELDS.map(n=>[n,e['mne_'+n]()>>>0]));
const sdiag=()=>Object.fromEntries(select.FIELDS.map(n=>[n,e['msc_'+n]()>>>0]));
words(THUNK,[0x80000001,934]);
const errno=scenario==='errno0'?0:scenario==='errno37'?37:4;
const rows=[],snapshots=[];
function normalize(v,f){
 v>>>=0;
 for(const [name,a,n]of [['head',f.pc,32],['crt',f.crtBase,0x10000],['stack',f.esp-32,1024],['fd',f.fd,32],['tv',f.tv,8],['td',f.errnoPtr-8,16]])if(v>=a&&v<a+n)return name+'+'+(v-a);
 return v;
}
function lane(f){
 const enabled=f.enabled,n=v=>normalize(v,f);e.test_vsock_reset();e.set_yield_state(0,0);
 // Controlled fixture initialization through an existing export; count zero
 // seeds identical lazy flag inputs without executing a guest instruction.
 e.test_shift(32,4,123,0,1,0x1234);
 const idx=e.test_vsock_alloc();assert.equal(idx,0);const socket=0x53000000|idx,rec=inventory.VSOCK_TABLE.base;
 words(f.fd,[1,socket,0,0,0,0,0,0]);words(f.tv,[0,0]);dv.setUint32(rec+56,1,true);
 new Uint8Array(memory.buffer,direct(f.esp-16),scenario==='unsafe-caller'?64:512).fill(0);
 const head=[0x8b,0xe8,0xff,0xd7,0x83,0x38,4,0x74,0xa2];
 if(enabled&&scenario==='wrong-return-pc')head.splice(2,0,0x90);
 if(enabled&&scenario==='wrong-ebp')head.splice(0,2,0x33,0xed);
 put(f.pc,head);put(f.entry,authenticErrno);
 const providerPtr=enabled&&scenario==='unsafe-errno'?0xfffffff8:f.errnoPtr-8;
 const provider=Buffer.alloc(6);provider[0]=0xb8;provider.writeUInt32LE(providerPtr,1);provider[5]=0xc3;put(f.provider,provider);
 words(f.errnoPtr-8,[0x12345678,0,errno,0]);
 const ret=f.pc+(enabled&&scenario==='wrong-select-return'?0x40:0);
 if(ret!==f.pc)put(ret,head);
 words(f.esp,[ret,0,f.fd,0,0,f.tv]);const post=f.esp+24;
 if(!(enabled&&scenario==='unsafe-caller'))words(post+0x124,[0x40e12a,0x4103000,1000]);
 const edi=enabled&&scenario==='wrong-native-target'?fixtures[0].entry:f.entry;
 e.set_eip(THUNK);e.set_esp(f.esp);e.set_eax(STALE);e.set_ebp(0x123456);e.set_edi(edi);
 for(const [reg,v]of Object.entries({ecx:0x11,edx:0x22,ebx:0x33,esi:0x44}))e['set_'+reg](v);
 e.set_count(0,f.pc);e.set_count(1,f.pc+4);
 const starting=[e.get_count(0),e.get_count(1)];assert.deepEqual(starting,[0,0],'actual native counters must start clean');
 if(enabled){
  if(['block-mode','uop-mode','code16-mode','stale-start'].includes(scenario)){
   if(scenario==='block-mode')e.set_block_exec(1);
   if(scenario==='uop-mode')e.set_uop(1);
   if(scenario==='stale-start')e.msc_start();
   if(scenario==='code16-mode'){const t=e.win16_bridge_frame_begin();assert(t!==0n);assert.equal(e.win16_bridge_stack_enter(t),1);assert.equal(e.is_code16(),1);}
   e.mne_start();assert.equal(e.mne_status(),5);
   fs.writeFileSync(O+'/mode-'+evidenceCase+'.json',JSON.stringify({status:'PASS',scenario,diag:diag(),code16:e.is_code16(),uop:e.get_uop()}));return {states:[],starting};
  }else {e.mne_start();e.mne_start();assert.equal(e.mne_status(),1,'idempotent start');}
 }
 const states=[];
 function run(label){
  const beforeHost=hosts.length,beforeAPI=e.get_api_calls();e.run(1);
  const registers=Object.fromEntries('eax ecx edx ebx esp ebp esi edi eip'.split(' ').map(r=>[r,n(e['get_'+r]())]));
  const flags=Object.fromEntries(['op','a','b','res','sign_shift'].map(r=>[r,n(e['get_flag_'+r]())]));
  const state={label,registers,flags,budget:e.get_block_budget(),blocks:e.get_last_run_blocks(),halt:e.get_last_run_halt(),yieldReason:e.get_yield_reason(),yieldFlag:e.get_yield_flag(),counts:[e.get_count(0),e.get_count(1)],apiDelta:e.get_api_calls()-beforeAPI,hosts:hosts.slice(beforeHost),memory:{stack:Array.from({length:scenario==='unsafe-caller'?16:128},(_,i)=>n(word(f.esp-16+i*4))),fd:Array.from({length:8},(_,i)=>n(word(f.fd+i*4))),tv:[word(f.tv),word(f.tv+4)],td:Array.from({length:4},(_,i)=>n(word(f.errnoPtr-8+i*4)))}};
  states.push(state);snapshots.push({enabled,scenario,label,eip:e.get_eip()>>>0,esp:e.get_esp()>>>0,diag:diag(),select:sdiag()});
  fs.writeFileSync(O+'/native-progress-'+evidenceCase+'.json',JSON.stringify({scenario,snapshots,states},null,2));
  return state;
 }
 run('select-completion');assert.equal(e.get_eax(),1);assert.equal(e.get_esp(),post);assert.equal(e.get_eip(),ret);assert.equal(e.get_yield_reason(),0);
 if(enabled&&scenario==='return-without-call'){
  // Explicit rejecting fixture: enter a valid native RET without an owned CALL.
  e.set_eip(f.tail);e.set_eax(f.errnoPtr-8);e.set_ebp(1);e.set_esp(post-4);words(post-4,[f.pc+4]);
  run('unowned-return');assert.equal(e.mne_status(),5);return {states,starting};
 }
 if(enabled&&scenario==='wrong-select-return'){assert.equal(e.mne_status(),5);return {states,starting};}
 if(enabled&&['foreign-thread','foreign-regbank'].includes(scenario)){
  const before=diag();assert.equal(before.status,2);
  if(scenario==='foreign-thread')e.set_current_thread_id(2);
  else {const regs=Array.from({length:8},(_,i)=>dv.getUint32(inventory.REGFILE.base+i*4,true));e.init_thread(1,IMAGE,0x480000,0x7b0000,0x7500000,0x7540000,0,1);e.set_current_thread_id(1);for(let i=0;i<8;i++)dv.setUint32(inventory.REGFILE.base+64+i*4,regs[i],true);e.set_eip(f.pc);}
  run('foreign-owner-call');assert.equal(e.get_eip(),edi);assert.equal(e.get_esp(),post-4);assert.deepEqual(diag(),before,'foreign owner must not claim latch');return {states,starting};
 }
 run('owned-call');assert.equal(e.get_eip(),edi);assert.equal(e.get_esp(),post-4);
 if(enabled&&scenario==='nested-call'){e.set_eip(f.pc);run('second-owner-indirect-call');assert.equal(e.mne_status(),5);assert.equal(e.mne_event(),2);return {states,starting};}

 if(enabled&&['wrong-native-target','wrong-return-pc','wrong-ebp'].includes(scenario)){assert.equal(e.mne_status(),5);return {states,starting};}
 run('native-errno-call-getptd');assert.equal(e.get_eip(),f.provider);assert.equal(e.get_esp(),post-8);
 run('nested-getptd-ret');assert.equal(e.get_eip(),f.tail);assert.equal(e.get_esp(),post-4);
 if(enabled&&scenario!=='block-mode')assert.equal(e.mne_status(),3,'nested native return cannot capture');
 if(enabled&&scenario==='postframe'){e.set_esp(post);words(post,[f.pc+4]);}
 run('native-errno-ret');assert.equal(e.get_eip(),f.pc+4);assert.equal(e.get_esp(),post+(enabled&&scenario==='postframe'?4:0));assert.equal(e.get_ebp(),1);
 assert.equal(e.get_eax()>>>0,enabled&&scenario==='unsafe-errno'?0:f.errnoPtr);
 assert.equal(e.get_count(1),0,'CMP successor block must not execute');
 if(!enabled){assert(Object.values(diag()).every(x=>x===0));assert(Object.values(sdiag()).every(x=>x===0));}
 else if(['unsafe-errno','unsafe-caller','postframe'].includes(scenario))assert.equal(e.mne_status(),5);
 else if(scenario==='block-mode')assert.equal(e.mne_status(),5);
 else{
  const d=diag();assert.equal(d.status,4);assert.equal(d.event,3);assert.equal(d.errno,errno);
  assert.equal(d.eax,f.errnoPtr);assert.equal(d.ebp,1);assert.equal(d.result,1);assert.equal(d.token,1);assert.equal(d.thread,1);assert.equal(d.regs,inventory.REGFILE.base);
  assert.equal(d.pre,f.esp);assert.equal(d.post,post);assert.equal(d.esp,post);assert.equal(d.selectRet,HEAD);
  assert.equal(d.nativeEntry,BASE+0xc430);assert.equal(d.callBlock,HEAD);assert.equal(d.sourceBlock,BASE+0xc435);assert.equal(d.pc,HEAD+4);
  assert.equal(d.caller,0x40e12a);assert.equal(d.socketSet,0x4103000);assert.equal(d.timeout,1000);
  const frozen=diag();e.mne_start();assert.deepEqual(diag(),frozen,'single-shot start cannot reset captured native state');
 }
 return {states,starting};
}
const off=lane(fixtures[0]),on=lane(fixtures[1]);
let equivalent=false;if(scenario.startsWith('errno')){assert.deepEqual(on,off,'OFF/ON normalized registers, lazy flags, fixture memory, API/imports, budget and yields');equivalent=true;}
assert.deepEqual(unexpected,[]);
const result={status:'PASS',scenario,compat,errno:scenario.startsWith('errno')?errno:null,capture:diag(),select:sdiag(),equivalent,
 snapshots,off,on,hostCalls:hosts,nativeInstances:1,arenaMiB:512,heapMiB:512,moduleSHA256:sha(bytes),preflight,
 qualification:'actual retained '+(compat?'compat':'tailcall')+' module production dispatch and native CALL/ADD/RET; synthetic _getptd fixture; no original guest, loader or gameplay acceptance',
 notCovered:['full original _getptd implementation','loader-proven original CRT base','original errno/caller/gameplay','full-memory equivalence outside initialized guest fixtures','stale token/internal-global mutation after completion','cap exhaustion','foreign RET ownership isolation']};
fs.writeFileSync(O+'/native-result-'+evidenceCase+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:'PASS',scenario,errno:result.errno,capture:result.capture,equivalent,instances:1}));
