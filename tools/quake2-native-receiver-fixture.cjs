'use strict';
// Real x86 PE derived from the authored GLTron continuous producer. No clocks,
// host-export calls, synthetic native receipts, or original game state.
const assert=require('node:assert/strict');
const ROOT=process.env.WINE_BRIDGE_ROOT||'/home/user/wine-assembly';
function fixture({filter=false}={}){
 const fs=require('node:fs'),crypto=require('node:crypto');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(ROOT+'/test/test-gltron-browser-live-input.cjs')).digest('hex'),
  'b64e5f260308d68d91be2658aa566bdba19f7aa218854852429c67c69fc478ce','genuine GLTron generator dependency changed');
 const b=require(ROOT+'/test/test-gltron-browser-live-input.cjs').fixture();
 const raw=r=>r-0x1000+0x400,u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 const old=Buffer.from('PeekMessageA\0'),off=b.indexOf(old);assert(off>0);
 if(!filter){b.fill(0,off,off+old.length);b.write('GetMessageA\0',off);}
 // Same IAT slot, four stdcall arguments. Preserve branch displacements by
 // replacing only the removed fifth push with NOPs.
 const pump=Buffer.from([0x68,...u(1),0x68,...u(0),0x68,...u(0),0x68,...u(0),0x68,...u(0x403640),0xff,0x15,...u(0x40130c)]);
 const at=b.indexOf(pump);assert(at>=raw(0x2000));if(!filter)b.fill(0x90,at,at+5);
 if(filter){b.writeUInt32LE(0x8000,at+6);b.writeUInt32LE(0x8000,at+11);}
 // Append a real USER import; the original null IAT terminator moves one slot.
 assert.equal(b.readUInt32LE(raw(0x1324)),0);assert(b.subarray(raw(0x1e00),raw(0x1e40)).every(v=>v===0));
 b.writeUInt32LE(0x1e00,raw(0x1324));b.write('SetWindowTextA\0',raw(0x1e02));
 b.writeUInt32LE(0x1e20,raw(0x1328));b.write('SetTimer\0',raw(0x1e22));
 // A real guest timer keeps the authored GL producer publishing while its
 // GetMessage pump waits. Without it the initial frames can precede the
 // presentation transfer observer, leaving startup without a native receipt.
 // This code and timer exist only in the fixture, never in original Quake II.
 const start=0x402700,back=at+5-0x400+0x1000+0x400000;
 const init=Buffer.from([
  0x83,0x3d,...u(0x403af4),0,0x75,37,
  0xc7,0x05,...u(0x403af4),...u(1),
  0x68,...u(0),0x68,...u(16),0x68,...u(1),
  0xff,0x35,...u(0x403600),0xff,0x15,...u(0x401328),
  ...(filter?[0x68,...u(1)]:[]),
  0xe9,0,0,0,0,
 ]);
 assert.equal(init.length,filter?56:51);
 init.writeInt32LE(back-(start+init.length),init.length-4);
 init.copy(b,raw(0x2700));
 b[at]=0xe9;b.writeInt32LE(start-(back-5+5),at+1);
 b.fill(0,raw(0x3a00),raw(0x3b00));
 const code=[],labels=new Map(),fix=[];
 const emit=(...v)=>code.push(...v),push=n=>emit(0x68,...u(n));
 const call=addr=>emit(0xff,0x15,...u(addr)),label=n=>labels.set(n,code.length);
 const jump=(n,c)=>{emit(...(c?[0x0f,c]:[0xe9]));fix.push([code.length,n]);emit(0,0,0,0);};
 emit(0x55,0x89,0xe5);
 for(const [msg,marker,name]of [[0x100,68,'kd'],[0x101,85,'ku'],[0x201,77,'md'],[0x202,82,'mu']]){
  emit(0x81,0x7d,12,...u(msg));jump('next-'+name,0x85);emit(0xb0,marker);jump('append');label('next-'+name);
 }
 for(const o of [20,16,12,8])emit(0xff,0x75,o);call(0x401318);jump('return');
 label('append');emit(0x8b,0x0d,...u(0x403af0),0x83,0xf9,63);jump('zero',0x83);
 emit(0x88,0x81,...u(0x403a00),0x41,0x89,0x0d,...u(0x403af0));
 // Public caption is a guest callback consequence, separate from native MSG
 // consumption. Publish only after UP, preserving the DOWN's scene fence.
 emit(0x81,0x7d,12,...u(0x101));jump('publish',0x84);
 emit(0x81,0x7d,12,...u(0x202));jump('zero',0x85);
 label('publish');push(0x403a00);emit(0xff,0x75,8);call(0x401324);
 emit(0x81,0x7d,12,...u(0x101));jump('zero',0x85);
 emit(0x83,0x7d,16,70);jump('escape',0x85);push(0);call(0x401308);jump('zero');
 label('escape');emit(0x83,0x7d,16,27);jump('zero',0x85);push(0);call(0x401200);
 label('zero');emit(0x31,0xc0);label('return');emit(0x5d,0xc2,16,0);
 const body=Buffer.from(code);for(const [o,n]of fix){assert(labels.has(n));body.writeInt32LE(labels.get(n)-o-4,o);}
 assert(body.length<0x800);b.fill(0,raw(0x2800),raw(0x3000));body.copy(b,raw(0x2800));return b;
}
const CASES=Object.freeze(['oldfail','newpass','healthy','late','lost','stale','focus','independentUP']);
// Transport faults surround actual page calls. A late native reply is retained
// as evidence but never accepted. Lost means discard the real status reply.
function faultPage(page,kind){
 assert(CASES.includes(kind));
 return async(method,...args)=>{
  const value=await page(method,...args);
  if(method==='status'&&kind==='late')await new Promise(r=>setTimeout(r,550));
  if(method==='status'&&kind==='lost')return new Promise(()=>{});
  return value;
 };
}
module.exports={fixture,CASES,faultPage};
