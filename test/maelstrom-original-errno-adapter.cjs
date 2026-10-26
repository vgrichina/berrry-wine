'use strict';
const assert=require('node:assert/strict');
const {createAdapter,verifyLoaded}=require('../tools/maelstrom-original-errno-adapter.cjs');
const {FIELDS,NET_ANCHORS}=require('../tools/maelstrom-native-errno-latch.cjs');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
function fixture(){
 const state=Object.fromEntries(FIELDS.map(k=>[k,0])),rows=[];let calls=0;
 const exports={mne_start(){calls++;state.status=1;}};
 for(const k of FIELDS)exports['mne_'+k]=()=>state[k];
 for(const k of ['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result'])exports['msc_'+k]=()=>k==='result'?0:1;
 const instance={exports};return {instance,state,rows,calls:()=>calls,make:()=>createAdapter(instance,{persist:r=>rows.push(r),readLive:()=>({eax:999,eip:888})})};
}
test('missing export rejects',()=>assert.throws(()=>createAdapter({exports:{}},{}),/missing/));
test('start exactly once; duplicate owner rejects',()=>{const f=fixture(),a=f.make();a.start();assert.throws(()=>a.start(),/one invocation/);assert.equal(f.calls(),1);assert.throws(()=>f.make(),/duplicate/);});
test('nonpristine refuses before invocation',()=>{const f=fixture();f.state.token=1;assert.throws(()=>f.make().start(),/nonpristine/);assert.equal(f.calls(),0);});
test('observation requires start',()=>assert.throws(()=>fixture().make().observe(1),/start required/));
test('rejection persists first state and closes',()=>{const f=fixture(),a=f.make();a.start();f.state.status=5;assert.throws(()=>a.observe(4),/status rejection/);assert.equal(f.rows.at(-1).kind,'rejected');assert.equal(a.observe(5),null);});
test('native capture remains historical and once, preserves errno zero',()=>{const f=fixture(),a=f.make();a.start();Object.assign(f.state,{status:4,event:3,errno:0,eax:123,caller:456});const r=a.observe(8);assert.equal(r.historicalNativeLatch.errno,0);assert.equal(r.historicalNativeLatch.eax,123);assert.equal(r.liveHostObservation.eax,999);assert.equal(a.observe(9),null);});
test('loaded mappings and authentic byte controls',()=>{
 const b=new ArrayBuffer(0x500000),u=new Uint8Array(b),d=new DataView(b),at=va=>va-0x400000+0x12000;
 const put=(va,hex)=>u.set(Buffer.from(hex,'hex'),at(va));
 put(0x52e430,'e82274ffff83c008c3');for(const [va,hex]of Object.entries(NET_ANCHORS))put(0x7a2000+Number(va)-0x10000000,hex);put(0x7a32f2,'8b3d10407a00');put(0x40e125,'e8c253000083c40885c0756e');d.setUint32(at(0x7a4010),0x52e430,true);
 const e={get_image_base:()=>0x400000},bases={msvcrt:{loadAddr:0x522000},sdl_net:{loadAddr:0x7a2000}};
 assert.equal(verifyLoaded(e,b,bases).authenticLoadedAnchors,true);
 put(0x7a32f2,'8b3d10200010');assert.throws(()=>verifyLoaded(e,b,bases),/expected=8b3d10407a00 actual=8b3d10200010/);put(0x7a32f2,'8b3d10407a00');
 assert.throws(()=>verifyLoaded(e,b,{...bases,msvcrt:{loadAddr:0x600000}}),/bases/);
 u[at(0x52e430)]^=1;assert.throws(()=>verifyLoaded(e,b,bases),/bytes/);u[at(0x52e430)]^=1;
 d.setUint32(at(0x7a4010),0x123456,true);assert.throws(()=>verifyLoaded(e,b,bases),/IAT/);
});
console.log(JSON.stringify({passed,offlineAdapterOnly:true,guestInvoked:false}));
