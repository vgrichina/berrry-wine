#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {bootRenderHarness}=require('./render-helper');
const table=require('../src/api_table.json');
// Independent literal 32-bit WNDCLASS/WNDCLASSEX layouts from Microsoft:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-wndclassa
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-wndclassexa
// Only the dynamically allocated saved name pointer is inserted into literals.
const saved40='2301000078563412180000003000000000f063004433221188776655ccbbaa993412000000000000';
const saved48='300000002301000078563412180000003000000000f063004433221188776655ccbbaa99341200000000000044332211';
const system40='0b4000000101feff0000000000000000000000000000000000000000000000000000000000000000';
const system48='300000000b4000000101feff000000000000000000000000000000000000000000000000000000000000000000000000';
const extraWat=String.raw`
 (func (export "ci_mapping_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "ci_mapping_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "ci_mapping_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "ci_mapping_id") (param $p i32) (result i32) (call $lookup_api_id (call $g2w (local.get $p))))
 (func (export "ci_mapping_regs") (result i32) (global.get $reg_base))
 (func (export "ci_mapping_call") (param $p i32)
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "ci_mapping_error") (param $v i32) (global.set $last_error (local.get $v)))
`;
async function main(){
 const {exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none'});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.ci_mapping_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0;
 const alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;},bytes=(p,n)=>mem.subarray(wa(p),wa(p)+n);
 const text=(s,wide=false)=>{const b=Buffer.from(s+'\0',wide?'utf16le':'latin1'),p=alloc(b.length);bytes(p,b.length).set(b);return p;};
 const regs=e.ci_mapping_regs()>>>0,stackArea=alloc(512),stack=stackArea+128,direct=alloc(128),unrelated=alloc(256);
 view.setUint32(regs+16,stack,true);const user32=e.ci_mapping_module(text('USER32.DLL'))>>>0;assert.ok(user32);
 const thunks={};
 for(const n of ['GetClassInfoA','GetClassInfoW','GetClassInfoExA','GetClassInfoExW','RegisterClassA','RegisterClassW']){
  const p=text(n),row=table.find(r=>r.name===n);assert.ok(row);assert.equal(e.ci_mapping_id(p),row.id);
  view.setUint32(regs+16,stack,true);const thunk=e.ci_mapping_resolve(user32,p)>>>0;assert.ok(thunk);assert.equal(view.getUint32(wa(thunk)+4,true),row.id);thunks[n]=thunk;
 }
 let calls=0,splitChecks=0,controlChecks=0;const failures=[],coverage={};
 const state=()=>[e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),e.get_flag_res(),e.get_flag_sign_shift(),e.get_eip(),e.get_handler_set_eip(),e.get_current_thread_id(),e.get_yield_reason(),e.get_yield_flag(),e.get_quit_flag()];
 function invoke(n,args){
  bytes(stackArea,512).fill(0xcc);for(let i=0;i<8;i++)view.setUint32(regs+4*i,0x41320000+i,true);
  view.setUint32(regs+16,stack,true);view.setUint32(wa(stack),0x12345678,true);args.forEach((v,i)=>view.setUint32(wa(stack)+4+i*4,v,true));
  const beforeStack=Buffer.from(bytes(stackArea,512)),beforeState=state();e.ci_mapping_error(0x5b);e.ci_mapping_call(thunks[n]);calls++;
  assert.equal(e.get_esp()>>>0,stack+4+4*args.length,'stdcall '+n);
  for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+4*i,true),0x41320000+i,'preserved register '+i);
  assert.deepEqual(Buffer.from(bytes(stackArea,512)),beforeStack,'full ABI frame');assert.deepEqual(state(),beforeState,'flags/thread/EIP/yield');
  return e.get_eax()>>>0;
 }
 const registered=[];
 for(const wide of [false,true]){
  const name=text(wide?'MappingRegisteredW':'MappingRegisteredA',wide),wc=alloc(40),literal=Buffer.from(saved40,'hex');literal.writeUInt32LE(name,36);bytes(wc,40).set(literal);
  const atom=invoke(wide?'RegisterClassW':'RegisterClassA',[wc]);assert.ok(atom>=0xc000&&atom<=0xffff);registered.push({name,atom,wide});
 }
 const base=0x30000000,decoy=0x28000000,contiguous=0x31000000;
 for(const p of [base,decoy,base+4096])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(contiguous,8192)>>>0,contiguous);
 const backing=[wa(base),wa(decoy),wa(base+4096)];assert.equal(backing[1],backing[0]+4096);assert.notEqual(backing[2],backing[0]+4096);assert.equal(wa(contiguous+4096),wa(contiguous)+4096);
 const spans=[[wa(direct),128],...backing.map(p=>[p,4096]),[wa(contiguous),8192],[wa(unrelated),256]];
 const snap=()=>spans.map(([p,n])=>Buffer.from(mem.subarray(p,p+n)));
 function equal(a,b,label,mapping){const digest=v=>Buffer.isBuffer(v)?crypto.createHash('sha256').update(v).digest('hex'):v;if(digest(a)!==digest(b))failures.push({label,mapping,actual:digest(a),expected:digest(b)});if(mapping==='split')splitChecks++;else controlChecks++;}
 function query(api,c,p,mapping,label){
  const category=api+'/'+(c.saved?'registered':'system')+'/'+mapping,previousFailures=failures.length;
  for(const [s,n] of spans)mem.fill(0xa5,s,s+n);const before=snap(),expected=before.map(b=>Buffer.from(b)),ex=api.includes('Ex');
  let want=null;
  if(c.valid){
   want=Buffer.from(c.saved?(ex?saved48:saved40):(ex?system48:system40),'hex');
   want.writeUInt32LE(c.saved?c.saved.name:c.name,ex?40:36);
   if(!c.saved){want.writeUInt32LE((0xfffe0100|c.id)>>>0,ex?8:4);want.writeUInt32LE(c.instance,ex?20:16);}
   for(let i=0;i<want.length;i++){const physical=wa(p+i),j=spans.findIndex(([s,n])=>physical>=s&&physical<s+n);assert.ok(j>=0);expected[j][physical-spans[j][0]]=want[i];}
  }
  assert.equal(invoke(api,[c.instance,c.name,p]),c.valid?1:0,'BOOL '+label);
  if(c.valid)equal(Buffer.from(Array.from({length:want.length},(_,i)=>mem[wa(p+i)])),want,label+' literal full output',mapping);
  snap().forEach((b,i)=>equal(b,expected[i],label+' full backing/canary '+i,mapping));
  const row=coverage[category]??={calls:0,failures:0};row.calls++;row.failures+=failures.length-previousFailures;
 }
 for(const api of ['GetClassInfoA','GetClassInfoW','GetClassInfoExA','GetClassInfoExW']){
  const wide=api.endsWith('W'),size=api.includes('Ex')?48:40;
  const cases=registered.map(r=>({name:text(r.wide?'MappingRegisteredW':'MappingRegisteredA',wide),saved:r,instance:0x63f000,valid:true,label:'registered-'+(r.wide?'W':'A')}));
  // A's existing registered-atom lookup first translates the small key; leave
  // that input-name path out of scope. Other entries use the existing atom key.
  if(api!=='GetClassInfoA')for(const r of registered)cases.push({name:r.atom,saved:r,instance:0x63f000,valid:true,label:'registered-atom'});
  cases.push({name:text('BUTTON',wide),id:1,instance:0,valid:true,label:'system-name'},{name:0x80,id:1,instance:0,valid:true,label:'system-atom'},
   {name:text('BUTTON',wide),id:1,instance:0x63f000,valid:true,label:'system-instance'},
   {name:text('msctls_trackbar32',wide),id:19,instance:0,valid:true,label:'common-NULL-fallback'});
  for(const c of cases)for(let repeat=0;repeat<2;repeat++){
   query(api,c,direct+16,'control',api+' '+c.label+' direct '+repeat);
   query(api,c,base+4096,'control',api+' '+c.label+' boundary-start '+repeat);
   query(api,c,base+4096-size,'control',api+' '+c.label+' boundary-end '+repeat);
   for(let n=1;n<size;n++){
    query(api,c,contiguous+4096-n,'control',api+' '+c.label+' adjacent '+n+' '+repeat);
    query(api,c,base+4096-n,'split',api+' '+c.label+' split '+n+' '+repeat);
   }
  }
  for(const c of [{name:text('NoSuchMappingClass',wide),instance:0,label:'missing'}, {name:text('ToolbarWindow32',wide),instance:0x63f000,label:'native-probe-no-fallback'}]){
   c.valid=false;for(const p of [direct+16,base+4096-size,base+4096])query(api,c,p,'control',api+' '+c.label);
   for(let n=1;n<size;n++)query(api,c,base+4096-n,'control',api+' '+c.label+' split '+n);
  }
  // Preserve this pre-existing A-only input conversion behavior without
  // presenting it as a Windows contract or changing the input lookup path.
  if(api==='GetClassInfoA')for(const r of registered)query(api,{name:r.atom,instance:0x63f000,valid:false},base+4091,'control','existing A registered-atom input route');
  if(api.includes('Ex')){
   for(const [name,out] of [[text('BUTTON',wide),0],[0,base+4091]]){
    for(const [s,n] of spans)mem.fill(0xa5,s,s+n);const before=snap();assert.equal(invoke(api,[0,name,out]),0);snap().forEach((b,i)=>assert.deepEqual(b,before[i],'Ex NULL early exit no output'));
   }
  }
 }
 // Native COMCTL registration must replace the NULL-instance fallback and be
 // returned with its saved fields, including its native wndproc and hInstance.
 const nativeName=text('ToolbarWindow32'),nativeWC=alloc(40),native=Buffer.from(saved40,'hex');native.writeUInt32LE(nativeName,36);bytes(nativeWC,40).set(native);assert.ok(invoke('RegisterClassA',[nativeWC]));
 for(const api of ['GetClassInfoA','GetClassInfoW','GetClassInfoExA','GetClassInfoExW'])for(const instance of [0,0x63f000]){
  const c={name:text('ToolbarWindow32',api.endsWith('W')),instance,saved:{name:nativeName},valid:true};const size=api.includes('Ex')?48:40;
  query(api,c,direct+16,'control',api+' native registered direct');
  for(let n=1;n<size;n++)query(api,c,base+4096-n,'split',api+' native registered split '+n);
 }
 const controlFailures=failures.filter(f=>f.mapping!=='split');
 console.log(JSON.stringify({phase:'mapping',calls,splitChecks,controlChecks,coverage,failureCount:failures.length,controlFailureCount:controlFailures.length,failures:failures.slice(0,16)}));
 assert.equal(controlFailures.length,0,'all contiguous/boundary/missing/native controls');
 assert.equal(failures.length,0,'every split boundary and complete backing/canary');
 console.log(JSON.stringify({status:'PASS',calls,splitChecks,controlChecks,all40and48ByteBoundaries:true,publicUSER32:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
