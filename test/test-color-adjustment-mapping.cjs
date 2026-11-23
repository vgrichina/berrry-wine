#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const apiTable=require('../src/api_table.json');
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getcoloradjustment
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setcoloradjustment
// Twelve WORD/SHORT fields (24 bytes); only public buffer transport is under test.
const extraWat = String.raw`
 (func (export "color_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "color_regs") (result i32) (global.get $reg_base))
 (func (export "color_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "color_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "color_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "color_error_seed") (param $v i32) (global.set $last_error (local.get $v)))
 (func (export "color_error") (result i32) (global.get $last_error))
 (func (export "color_table") (result i32) (global.get $GDI_COLOR_ADJUST_TABLE))
 (func (export "color_states") (result i32) (global.get $GDI_DC_STATE_TABLE))
 (func (export "color_entry") (param $dc i32) (result i32)
  (call $gdi_color_adjustment_entry (local.get $dc) (i32.const 0)))
 (func (export "color_physical_get") (param $dc i32) (param $p i32) (result i32)
  (call $gdi_color_adjustment_get (local.get $dc) (local.get $p)))
 (func (export "color_physical_set") (param $dc i32) (param $p i32) (result i32)
  (call $gdi_color_adjustment_set (local.get $dc) (local.get $p)))
 (func (export "color_window") (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
  (local.get $h))
`;

async function main(){
 const {exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none',width:8,height:8});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.color_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),regs=e.color_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>e.guest_alloc(n)>>>0;
 const put=(p,b)=>b.forEach((v,i)=>e.guest_write8(p+i,v));
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const text=s=>{const p=alloc(s.length+1);put(p,Buffer.from(s+'\0'));return p;};
 const stackArea=alloc(256),stack=stackArea+64,unrelated=alloc(64),input=alloc(64),output=alloc(64);
 const thunks=new Map();
 for(const [dll,names] of [['GDI32.DLL',['CreateCompatibleDC','DeleteDC','GetColorAdjustment','SetColorAdjustment','SaveDC','RestoreDC','CreateDIBSection','SelectObject','DeleteObject','SetStretchBltMode','StretchBlt','StretchDIBits']],['USER32.DLL',['GetDC','ReleaseDC']]]){
  view.setUint32(regs+16,stack,true);const module=e.color_module(text(dll))>>>0;assert.ok(module);
  for(const name of names){view.setUint32(regs+16,stack,true);const thunk=e.color_resolve(module,text(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk);assert.equal(row.convention,'stdcall');assert.equal(view.getUint32(wa(thunk)+4,true),row.id);thunks.set(name,{thunk,nargs:row.nargs});}
 }
 let calls=0,queries=0,comparisons=0,pixelChecks=0,getterFailures=0,setterFailures=0,decoyCorruptions=0;const failures=[];
 function compare(actual,expected,label,kind='control'){
  comparisons++;
  if(Buffer.isBuffer(actual)?actual.equals(expected):JSON.stringify(actual)===JSON.stringify(expected))return;
  if(Buffer.isBuffer(actual)){let first=0;while(first<actual.length&&actual[first]===expected[first])first++;failures.push({label,kind,first,actual:actual.subarray(first,first+12).toString('hex'),expected:expected.subarray(first,first+12).toString('hex')});}
  else failures.push({label,kind,actual,expected});
 }
 function invoke(name,args){
  const entry=thunks.get(name);assert.equal(args.length,entry.nargs);
  mem.fill(0x5a,wa(stackArea),wa(stackArea)+256);e.guest_write32(stack,0x12345678);args.forEach((v,i)=>e.guest_write32(stack+4+i*4,v));
  const frame=read(stackArea,256),other=read(unrelated,64),seed=[0xa0123456,0x11223344,0x22334455,0x33445566,stack,0x44556677,0x55667788,0x66778899];
  seed.forEach((v,i)=>view.setUint32(regs+i*4,v,true));e.color_call(entry.thunk);calls++;
  assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');
  for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+i*4,true),seed[i],name+' register '+i);
  assert.deepEqual(read(stackArea,256),frame);assert.deepEqual(read(unrelated,64),other);
  return e.get_eax()>>>0;
 }
 const ok=(n,args,expected)=>{const r=invoke(n,args);if(expected===undefined)assert.ok(r,n);else assert.equal(r,expected,n);return r;};
 // These literal bytes specify the retained default independently of both APIs.
 const defaults=Buffer.from('180000000000102710271027000010270000000000000000','hex');
 const distinct=Buffer.from('180003000600c409393072fd3905ab209dff5300d5ff1300','hex');
 const alternate=Buffer.from('1800010002001027b80b50c3a00f701764009cff2700baff','hex');
 assert.equal(defaults.length,24);assert.equal(distinct.length,24);assert.equal(alternate.length,24);
 function set(dc,value){put(input,value);return invoke('SetColorAdjustment',[dc,input]);}
 function get(dc){ok('GetColorAdjustment',[dc,output+16],1);return read(output+16,24);}
 function arena(label){assert.equal(e.guest_span_cursor_bytes(),0,label+' span released');assert.equal(e.guest_span_overflow_count(),0,label+' bounded span');}
 const a=ok('CreateCompatibleDC',[0]),b=ok('CreateCompatibleDC',[0]),screen=ok('GetDC',[0]),deleted=ok('CreateCompatibleDC',[0]);ok('DeleteDC',[deleted],1);
 for(const dc of [a,b,screen])compare(get(dc),defaults,'independent initial default '+dc);
 put(input,distinct);const physicalInput=read(input,64);
 assert.equal(e.color_physical_set(a,wa(input)),1);assert.deepEqual(read(input,64),physicalInput);
 assert.equal(e.color_physical_get(a,wa(output)+16),1);compare(read(output+16,24),distinct,'physical helper ABI');compare(get(a),distinct,'public getter after physical setter');
 assert.equal(set(a,alternate),1);assert.equal(e.color_physical_get(a,wa(output)+16),1);compare(read(output+16,24),alternate,'physical getter after public setter');
 const base=0x30000000,decoy=0x28000000,after=0x29000000,adjacent=0x31000000;
 for(const p of [base,decoy,base+4096,after])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,8192)>>>0,adjacent);
 assert.equal(wa(decoy),wa(base)+4096);assert.equal(wa(after),wa(base+4096)+4096);assert.notEqual(wa(base+4096),wa(base)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const spans=[[wa(base),4096],[wa(decoy),4096],[wa(base+4096),4096],[wa(after),4096],[wa(adjacent),8192],[wa(output),64],[wa(input),64],[wa(0),32]];
 const snapshot=()=>spans.map(([p,n])=>Buffer.from(mem.subarray(p,p+n)));
 const state=()=>Buffer.from(mem.subarray(e.color_states(),e.color_states()+0xc000));
 const table=()=>Buffer.from(mem.subarray(e.color_table(),e.color_table()+0x1800));
 const stateBytes=()=>({state:state(),table:table()});
 const invalid=[];
 for(const [offset,values] of [[0,[0,23,25,65535]],[2,[4,0x8000,65535]],[4,[9,65535]],
  [6,[2499,65001]],[8,[2499,65001]],[10,[2499,65001]],[12,[4001,65535]],[14,[5999,10001]],
  [16,[-101,101]],[18,[-101,101]],[20,[-101,101]],[22,[-101,101]]]){
  for(const value of values){const bytes=Buffer.from(distinct);bytes.writeUInt16LE(value&65535,offset);invalid.push({name:offset+':'+value,bytes});}
 }
 const endpoints=[];
 for(const [offset,values] of [[2,[0,1,2,3]],[4,[0,8]],[6,[2500,65000]],[8,[2500,65000]],[10,[2500,65000]],[12,[0,4000]],[14,[6000,10000]],
  [16,[-100,100]],[18,[-100,100]],[20,[-100,100]],[22,[-100,100]]])for(const v of values){const bytes=Buffer.from(distinct);bytes.writeUInt16LE(v&65535,offset);endpoints.push({name:offset+':'+v,bytes});}
 function check(api,p,value,label,validValue=true,hdc=a,mapping=false){
  const initialFailures=failures.length;
  const kind=mapping?'mapping':'control',valid=!!p&&hdc!==0&&(api==='GetColorAdjustment'||validValue);
  spans.forEach(([s,n],i)=>mem.fill(0x91+i,s,s+n));
  assert.equal(set(a,alternate),1);assert.equal(set(b,distinct),1);assert.equal(set(screen,defaults),1);
  if(api==='GetColorAdjustment')assert.equal(set(a,value),1);
  // Preserve the existing physical helper's nonzero-HDC adoption policy.
  // Tightening invalid/deleted handle validation belongs to a separate change.
  if(hdc!==0&&![a,b,screen].includes(hdc))assert.equal(set(hdc,defaults),1);
  if(api==='SetColorAdjustment'&&p)put(p,value);
  const before=snapshot(),expected=before.map(v=>Buffer.from(v)),saved=stateBytes();
  const expectedTable=Buffer.from(saved.table);
  if(api==='GetColorAdjustment'&&valid){
   const wanted=hdc===a?value:hdc===b?distinct:defaults;
   for(let i=0;i<24;i++){const physical=wa(p+i),j=spans.findIndex(([s,n])=>physical>=s&&physical<s+n);assert.ok(j>=0);expected[j][physical-spans[j][0]]=wanted[i];}
  }
  if(api==='SetColorAdjustment'&&valid)value.copy(expectedTable,(e.color_entry(hdc)>>>0)-(e.color_table()>>>0));
  e.color_error_seed(0x5a1234);const result=invoke(api,[hdc,p]);queries++;
  compare(result,valid?1:0,label+' BOOL',kind);compare(e.color_error()>>>0,0x5a1234,label+' last error');
  const actual=snapshot();actual.forEach((v,i)=>compare(v,expected[i],label+' entire backing '+i,kind));
  if(!actual[1].equals(expected[1])||!actual[3].equals(expected[3]))decoyCorruptions++;
  compare(state(),saved.state,label+' DC state unchanged');compare(table(),expectedTable,label+' complete color table',kind);
  if(api==='SetColorAdjustment'){
   compare(get(a),valid&&hdc===a?value:alternate,label+' independent contiguous getter',kind);
   compare(get(b),valid&&hdc===b?value:distinct,label+' independent DC B',kind);
   compare(get(screen),valid&&hdc===screen?value:defaults,label+' independent screen DC',kind);
  }
  arena(label);
  if(failures.length>initialFailures){if(api==='GetColorAdjustment')getterFailures++;else setterFailures++;}
 }
 for(let repeat=0;repeat<2;repeat++)for(const [name,value] of [['default',defaults],['distinct',distinct],['alternate',alternate]])for(const api of ['GetColorAdjustment','SetColorAdjustment']){
  const label=repeat+'/'+name+'/'+api;check(api,output+16,value,label+'/contiguous');check(api,0,value,label+'/NULL');
  for(let cut=1;cut<24;cut++){
   check(api,adjacent+4096-cut,value,label+'/adjacent/'+cut);
   check(api,base+4096-cut,value,label+'/nonadjacent/'+cut,true,a,true);
  }
  for(const dc of [0,0xdeadbeef,deleted]){
   for(const p of [0,output+16])check(api,p,value,label+'/invalidDC/'+dc+'/'+p,true,dc);
   for(let cut=1;cut<24;cut++){
    check(api,base+4096-cut,value,label+'/invalidDC/'+dc+'/nonadjacent/'+cut,true,dc,true);
    check(api,adjacent+4096-cut,value,label+'/invalidDC/'+dc+'/adjacent/'+cut,true,dc);
   }
  }
 }
 // Invalid fields cannot modify caller bytes or any stored per-DC adjustment.
 for(const {name,bytes} of invalid)for(let cut=1;cut<24;cut++){
  check('SetColorAdjustment',base+4096-cut,bytes,'invalid/'+name+'/'+cut,false,a,true);
  check('SetColorAdjustment',adjacent+4096-cut,bytes,'invalid-adjacent/'+name+'/'+cut,false);
 }
 for(const {name,bytes} of endpoints){check('SetColorAdjustment',output+16,bytes,'endpoint/'+name);check('SetColorAdjustment',base+4095,bytes,'mapped-endpoint/'+name,true,a,true);}
 // A previously untouched window DC must stay lazy on NULL and invalid input.
 const hwnd=e.color_window()>>>0,lazy=hwnd+0x40000;
 for(const [api,p,bytes] of [['GetColorAdjustment',0,defaults],['SetColorAdjustment',0,defaults],['SetColorAdjustment',input,invalid[0].bytes]]){
  put(input,bytes);const before=stateBytes();ok(api,[lazy,p],0);compare(state(),before.state,'lazy rejected state');compare(table(),before.table,'lazy rejected color table');
 }
 compare(get(lazy),defaults,'lazy first getter default');assert.equal(set(lazy,distinct),1);compare(get(lazy),distinct,'lazy valid setter');compare(get(b),distinct,'lazy independent existing DC');
 // First use through mapped buffers must retain initialization and caller bytes.
 for(const api of ['GetColorAdjustment','SetColorAdjustment']){
  const fresh=(e.color_window()>>>0)+0x40000,p=base+4095;
  spans.forEach(([s,n],i)=>mem.fill(0xb1+i,s,s+n));
  if(api==='SetColorAdjustment')put(p,distinct);
  const before=snapshot(),expected=before.map(v=>Buffer.from(v));
  if(api==='GetColorAdjustment')for(let i=0;i<24;i++){
   const physical=wa(p+i),j=spans.findIndex(([s,n])=>physical>=s&&physical<s+n);expected[j][physical-spans[j][0]]=defaults[i];
  }
  const count=failures.length;
  compare(invoke(api,[fresh,p]),1,'first mapped '+api+' BOOL','mapping');queries++;
  snapshot().forEach((v,i)=>compare(v,expected[i],'first mapped '+api+' whole backing '+i,'mapping'));
  compare(get(fresh),api==='GetColorAdjustment'?defaults:distinct,'first mapped '+api+' contiguous getter','mapping');
  if(failures.length>count){if(api==='GetColorAdjustment')getterFailures++;else setterFailures++;}
  arena('first mapped '+api);
 }
 assert.equal(set(a,defaults),1);assert.equal(set(b,alternate),1);
 ok('SaveDC',[a],1);assert.equal(set(a,distinct),1);ok('SaveDC',[a],2);assert.equal(set(a,alternate),1);
 ok('RestoreDC',[a,-1],1);compare(get(a),distinct,'nested relative restore');compare(get(b),alternate,'independent saved DC');
 ok('RestoreDC',[a,1],1);compare(get(a),defaults,'absolute restore defaults');ok('RestoreDC',[a,-1],0);compare(get(a),defaults,'consumed state');
 const uninitialized=ok('CreateCompatibleDC',[0]),uninitializedEntry=e.color_entry(uninitialized)>>>0;
 compare(Buffer.from(mem.subarray(uninitializedEntry,uninitializedEntry+24)),Buffer.alloc(24),'new DC color storage remains lazy');
 ok('SaveDC',[uninitialized],1);assert.equal(set(uninitialized,distinct),1);ok('RestoreDC',[uninitialized,-1],1);
 compare(Buffer.from(mem.subarray(uninitializedEntry,uninitializedEntry+24)),Buffer.alloc(24),'restore uninitialized color storage');
 compare(get(uninitialized),defaults,'first getter after restoring lazy default');ok('DeleteDC',[uninitialized],1);
 // Literal DIB pixels exercise actual public rendering with all adjustment values.
 const bmi=alloc(40),bitsOut=alloc(4),sourceDC=ok('CreateCompatibleDC',[0]),targetDC=ok('CreateCompatibleDC',[0]);
 mem.fill(0,wa(bmi),wa(bmi)+40);e.guest_write32(bmi,40);e.guest_write32(bmi+4,8);e.guest_write32(bmi+8,-8);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const surfaces=[sourceDC,targetDC].map(dc=>{const bitmap=ok('CreateDIBSection',[dc,bmi,0,bitsOut,0,0]),bits=e.guest_read32(bitsOut)>>>0,old=ok('SelectObject',[dc,bitmap]);return{dc,bitmap,bits,old};});
 const pixels=Buffer.alloc(256);for(let i=0;i<64;i++){pixels[i*4]=(i*37+17)&255;pixels[i*4+1]=(i*71+31)&255;pixels[i*4+2]=(i*19+113)&255;pixels[i*4+3]=0;}
 put(surfaces[0].bits,pixels);
 const renders=[];
 for(const mode of [1,3,4])for(const [name,value] of [['default',defaults],['distinct',distinct],['alternate',alternate]]){
  assert.equal(set(targetDC,value),1);ok('SetStretchBltMode',[targetDC,mode]);
  for(const api of ['StretchBlt','StretchDIBits']){
   mem.fill(0x55,wa(surfaces[1].bits),wa(surfaces[1].bits)+256);
   const guardBefore=Buffer.from(mem.subarray(wa(surfaces[1].bits)-16,wa(surfaces[1].bits))),guardAfter=Buffer.from(mem.subarray(wa(surfaces[1].bits)+256,wa(surfaces[1].bits)+272));
   if(api==='StretchBlt')ok(api,[targetDC,0,0,8,8,sourceDC,0,0,8,8,0x00cc0020],1);
   else ok(api,[targetDC,0,0,8,8,0,0,8,8,surfaces[0].bits,bmi,0,0x00cc0020],8);
   const actual=read(surfaces[1].bits,256);compare(actual,pixels,api+'/'+mode+'/'+name+' retained literal rendered pixels');
   assert.deepEqual(Buffer.from(mem.subarray(wa(surfaces[1].bits)-16,wa(surfaces[1].bits))),guardBefore);assert.deepEqual(Buffer.from(mem.subarray(wa(surfaces[1].bits)+256,wa(surfaces[1].bits)+272)),guardAfter);
   renders.push({api,mode,name,sha256:require('node:crypto').createHash('sha256').update(actual).digest('hex'),sample:pixelChecks===0?actual.toString('hex'):undefined});pixelChecks++;
  }
 }
 for(const t of surfaces){ok('SelectObject',[t.dc,t.old]);ok('DeleteObject',[t.bitmap],1);ok('DeleteDC',[t.dc],1);}
 ok('DeleteDC',[a],1);ok('DeleteDC',[b],1);ok('ReleaseDC',[0,screen],1);arena('final');
 const controlFailures=failures.filter(f=>f.kind==='control');
 console.log(JSON.stringify({calls,queries,comparisons,pixelChecks,renders,getterFailures,setterFailures,decoyCorruptions,failureCount:failures.length,controlFailures:controlFailures.length,failures:failures.slice(0,40),all23ByteCuts:true,insideWORD:true,fullBackingAndTwoDecoys:true,repeats:2,independentLiteralOracles:true,ABI:true}));
 assert.equal(controlFailures.length,0,'controls');assert.equal(failures.length,0,'mapped color adjustment transport and complete backing');
 console.log('PASS public COLORADJUSTMENT mapping, literal defaults/fields, transactional validation, independent DCs, nested SaveRestore, rendered DIB controls and ABI');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
