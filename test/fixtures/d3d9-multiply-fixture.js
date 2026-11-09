'use strict';
// Small generated PE. Every method dereferences a public COM vtable in x86.
// The scalar matrix/pixel oracle has no dependency on production math/rendering.
const assert=require('node:assert/strict');
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function product(left,right){
 const out=[];
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  let sum=0;for(let k=0;k<4;k++)sum+=left[row*4+k]*right[k*4+col];out.push(Math.fround(sum));
 }
 return out;
}
function fixture({defaultTarget=false,colorUpload=false,surfaceUpload=false}={}){
 const BASE=0x400000,b=Buffer.alloc(0x30200),raw=rva=>rva-0x1000+0x200,p=0x80,o=p+24,s=o+0xe0;
 b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,0x3c);b.writeUInt32LE(0x4550,p);
 b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(0xe0,p+20);b.writeUInt16LE(0x010e,p+22);
 b.writeUInt16LE(0x10b,o);b.writeUInt32LE(0x2000,o+16);b.writeUInt32LE(BASE,o+28);
 b.writeUInt32LE(0x1000,o+32);b.writeUInt32LE(0x200,o+36);b.writeUInt32LE(0x31000,o+56);b.writeUInt32LE(0x200,o+60);
 b.writeUInt16LE(3,o+68);b.writeUInt32LE(0x100000,o+72);b.writeUInt32LE(0x1000,o+76);b.writeUInt32LE(16,o+92);
 b.write('.all',s);b.writeUInt32LE(0x30000,s+8);b.writeUInt32LE(0x1000,s+12);b.writeUInt32LE(0x30000,s+16);
 b.writeUInt32LE(0x200,s+20);b.writeUInt32LE(0xe0000060,s+36);b.writeUInt32LE(0x1000,o+104);b.writeUInt32LE(80,o+108);
 let names=0x1500;const iat={};
 [['kernel32.dll',['OutputDebugStringA','Sleep','VirtualAlloc']],['user32.dll',['CreateWindowExA']],['d3d9.dll',['Direct3DCreate9']]].forEach(([dll,apis],di)=>{
  const d=raw(0x1000+di*20),table=0x1200+di*64,dp=0x1400+di*64;
  b.writeUInt32LE(table,d);b.writeUInt32LE(dp,d+12);b.writeUInt32LE(table,d+16);b.write(dll+'\0',raw(dp));
  apis.forEach((name,i)=>{b.writeUInt32LE(names,raw(table+i*4));b.write(name+'\0',raw(names)+2);iat[name]=BASE+table+i*4;names+=name.length+3;});
 });
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],code=[],fixups=[],labels=new Map(),checks=[],pixels=[];
 const emit=(...x)=>code.push(...x.flat()),push=n=>Array.isArray(n)?emit(0xff,0x35,u32(n[0])):emit(0x68,u32(n)),api=name=>emit(0xff,0x15,u32(iat[name]));
 const D=BASE+0x28000,PP=D+64,M=D+128,OUT=D+256,LR=D+384,RT=D+400,V=D+448,STATUS=D+512,OBS=D+1024,FRAMES=D+2048;
 const write=(address,value)=>emit(0xc7,0x05,u32(address),u32(value));
 let strings=0x24000;const str=t=>{const a=BASE+strings;b.write(t+'\0',raw(strings));strings+=t.length+1;return a;};
 const jump=label=>{emit(0xe9);fixups.push([code.length,label]);emit(0,0,0,0);};
 const expect=(value,label)=>{
  const id=checks.length+2;checks.push({id,expected:value>>>0,label});emit(0x3d,u32(value),0x0f,0x85);
  fixups.push([code.length,'fail'+id]);emit(0,0,0,0);
 };
 const readCheck=(address,value,label)=>{emit(0xa1,u32(address));expect(value,label);};
 const bits=n=>{const t=Buffer.alloc(4);t.writeFloatLE(n);return t.readUInt32LE();};
 const matrix=a=>a.forEach((n,i)=>write(M+i*4,bits(n)));
 const abi=label=>{
  emit(0x89,0xe0,0x3b,0x05,u32(D+16),0x0f,0x85);fixups.push([code.length,'abi-fail']);emit(0,0,0,0);
  emit(0x89,0xe8);expect(0x13579bdf,label+' preserves EBP');
  for(const [op,addr,name] of [[0xf0,D,'ESI'],[0xf8,D+12,'EDI'],[0xd8,D+20,'EBX']]){
   emit(0x89,op,0x3b,0x05,u32(addr),0x0f,0x85);fixups.push([code.length,'abi-fail']);emit(0,0,0,0);
  }
 };
 const dev=(slot,args=[],hr=0,label='method'+slot,checkAbi=false)=>{
  for(const a of [...args].reverse())push(a);emit(0x56,0x8b,0x06,0xff,0x90,u32(slot*4));expect(hr,label+' HRESULT');if(checkAbi)abi(label);
 };
 const object=(address,slot,args=[],label='object'+slot)=>{
  for(const a of [...args].reverse())push(a);emit(0xa1,u32(address),0x50,0x8b,0x08,0xff,0x91,u32(slot*4));expect(0,label+' HRESULT');
 };
 const get=(selector,a,label)=>{
  write(OUT-4,0xabcddcba);write(OUT+64,0xbadc0ffe);dev(45,[selector,OUT]);
  a.forEach((n,i)=>readCheck(OUT+i*4,bits(n),label+' word'+i));
  readCheck(OUT-4,0xabcddcba,label+' leading guard');readCheck(OUT+64,0xbadc0ffe,label+' trailing guard');
 };
 const set=(selector,a)=>{matrix(a);dev(44,[selector,M]);};
 const mul=(selector,a,label='MultiplyTransform')=>{matrix(a);dev(46,[selector,M],0,label,true);};
 const mark=text=>{push(str('MULTIPLY '+text));api('OutputDebugStringA');};
 const klass=str('STATIC'),title=str('D3D9 MultiplyTransform public COM control');
 for(const a of [0,0,0,0,64,64,0,0,0x10000000,title,klass,0])push(a);
 api('CreateWindowExA');emit(0x89,0xc3,0xa3,u32(D+20));
 write(PP,32);write(PP+4,32);write(PP+8,21);write(PP+12,1);write(PP+24,1);emit(0x89,0x1d,u32(PP+28));write(PP+32,1);write(PP+52,0x80000000);
 if(defaultTarget)write(PP+44,1); // Public LockRect on the implicit backbuffer.
 push(32);api('Direct3DCreate9');emit(0x89,0xc7,0xa3,u32(D+12));
 for(const output of [D,D+8]){
  push(output);push(PP);push(0);emit(0x53);push(1);push(0);emit(0x57,0x8b,0x07,0xff,0x50,64);expect(0,'CreateDevice');
 }
 emit(0x8b,0x35,u32(D),0xbd,u32(0x13579bdf),0x89,0x25,u32(D+16));mark('created');
 const A=[1,2,0,1,0,1,3,0,4,0,1,2,1,5,0,1],B=[2,0,1,0,1,3,0,2,0,2,4,0,3,0,1,1],C=A.map(n=>n/2);
 const BA=product(B,A),AB=product(A,B);assert.notDeepEqual(BA,A);assert.notDeepEqual(BA,AB);assert.equal(BA[0],6);assert.equal(AB[0],7);
 for(const selector of [256,2,3,16,23,257,511]){
  set(selector,A);mul(selector,B);get(selector,BA,'product selector'+selector);
  matrix(Array(16).fill(0));get(selector,BA,'immutable input selector'+selector);
 }
 mark('noncommuting-products');
 // A second device and independent selectors must retain their own state.
 emit(0x8b,0x35,u32(D+8));get(256,I,'second device');emit(0x8b,0x35,u32(D));get(258,I,'untouched world');get(17,I,'untouched texture');
 const invalid=0x8876086c;
 for(const selector of [0,1,4,15,24,255,512,0xffffffff,0x7fffffff])dev(46,[selector,M],invalid,'invalid selector'+selector,true);
 for(const pointer of [0,0xfffffff0,0xf0000000])dev(46,[256,pointer],invalid,'invalid input'+pointer,true);
 get(256,BA,'rejection preserves state');
 // Empty recording: Multiply updates live state but must not select a block field.
 set(256,A);dev(60);mul(256,B);get(256,BA,'live during empty recording');dev(61,[D+4]);
 set(256,C);object(D+4,5);get(256,C,'empty Apply does not replay Multiply');object(D+4,2);
 // Recorded setters remain last-value copies, independent of live multiplication.
 set(256,A);dev(60);set(256,C);mul(256,B);get(256,BA,'live during selected recording');
 set(256,I);mul(256,B);get(256,product(B,BA),'second live multiply during recording');dev(61,[D+4]);
 object(D+4,5);get(256,I,'Apply last recorded SetTransform');mul(256,B);object(D+4,4);
 set(256,A);object(D+4,5);get(256,B,'Capture refreshes product without replay');object(D+4,2);
 dev(59,[1,D+4]);mul(256,B);object(D+4,5);get(256,B,'ALL Apply restores captured product');object(D+4,2);
 mark('stateblocks-and-invalid-inputs');
 // Commit adjacent guest pages around an intervening allocation, so their
 // physical backing is deliberately nonadjacent. Source is unaligned: one
 // float itself straddles the boundary. The owning page verifies both PTEs.
 const va=(address,size,flags,dest)=>{push(4);push(flags);push(size);push(address);api('VirtualAlloc');emit(0xa3,u32(dest));};
 va(0,8192,0x2000,D+24);va([D+24],4096,0x1000,D+32);va(0,4096,0x3000,D+28);
 emit(0xa1,u32(D+24),0x05,u32(4096),0xa3,u32(D+32));va([D+32],4096,0x1000,D+32);
 emit(0x8b,0x15,u32(D+24),0x81,0xc2,u32(4096-31),0x89,0x15,u32(D+32));
 B.forEach((n,i)=>emit(0xc7,0x82,u32(i*4),u32(bits(n))));
 set(256,A);dev(46,[256,[D+32]],0,'noncontiguous unaligned input',true);get(256,BA,'split sparse product');
 // Missing second page must not be confused with physically split backing.
 va(0,8192,0x2000,D+36);va([D+36],4096,0x1000,D+40);
 emit(0xa1,u32(D+36),0x05,u32(4096-31),0xa3,u32(D+40));
 dev(46,[256,[D+40]],invalid,'missing second page',true);get(256,BA,'missing page preserves entire destination');
 mark('split-sparse-input');

 // Independent scalar geometry oracle; choose points well away from edges.
 const scale=[.5,0,0,0,0,.75,0,0,0,0,1,0,0,0,0,1],translate=I.slice();translate[12]=.75;translate[13]=-.25;
 const original=[[-.75,.75,.5,1],[.75,.75,.5,1],[-.75,-.75,.5,1]];
 const cases=[{name:'product',m:product(translate,scale),multiply:true},{name:'reversed-negative',m:product(scale,translate)},{name:'noop-negative',m:scale}];
 const screen=m=>original.map(v=>{const out=[];for(let c=0;c<4;c++){let sum=0;for(let k=0;k<4;k++)sum+=v[k]*m[k*4+c];out.push(sum);}return [(1+out[0]/out[3])*16,(1-out[1]/out[3])*16];});
 const classify=(m,x,y)=>{
  const p=screen(m),edge=(a,b)=>(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
  const es=p.map((a,i)=>edge(a,p[(i+1)%3])),dist=p.map((a,i)=>Math.abs(es[i])/Math.hypot(p[(i+1)%3][0]-a[0],p[(i+1)%3][1]-a[1]));
  return {inside:es.every(v=>v>0)||es.every(v=>v<0),safe:Math.min(...dist)>.35};
 };
 const probes=[];
 for(const pattern of ['100','010','001','000']){
  let point;
  for(let y=2;y<30&&!point;y++)for(let x=2;x<30;x++){
   const v=cases.map(c=>classify(c.m,x,y));if(v.every(r=>r.safe)&&v.map(r=>+r.inside).join('')===pattern){point={x,y,pattern};break;}
  }
  assert(point,'independent exclusive geometry control '+pattern);probes.push(point);
 }
 // Establish the endpoint before introducing named storage, so its first
 // Clear must publish an owned definition instead of using startup admission.
 dev(43,[0,0,1,0,0,0]);
 push(20);api('Sleep'); // Let the endpoint's shared-state message reach the CPU Worker.
 if(defaultTarget)dev(38,[0,RT]); // GetRenderTarget leaves implicit storage bound.
 else{
  dev(38,[0,D+404]); // Keep the implicit target for final unbinding/retirement.
  dev(28,[32,32,21,0,0,1,RT,0]);
  emit(0xa1,u32(RT),0x50);push(0);emit(0x56,0x8b,0x06,0xff,0x90,u32(37*4));expect(0,'SetRenderTarget explicit');
 }
 const SRC=D+408,RECT=D+416,POINT=D+432;
 if(colorUpload){
  object(RT,12,[OUT],'GetDesc upload destination');
  dev(36,[32,32,[OUT],2,SRC,0]); // Match the public backbuffer/target format.
  [0,0,1,1].forEach((v,i)=>write(RECT+i*4,v));write(POINT,0);write(POINT+4,0);
 }
 dev(89,[0x42]);for(const [state,value] of [[137,0],[7,0],[22,1]])dev(57,[state,value]);set(2,I);set(3,I);
 original.forEach((v,i)=>{v.slice(0,3).forEach((n,j)=>write(V+i*16+j*4,bits(n)));write(V+i*16+12,0xff28c864);});
 for(const [ci,c] of cases.entries()){
  dev(43,[0,0,1,0xff000000,bits(1),0]);
  if(c.multiply){set(256,scale);mul(256,translate,'rendered multiply');}else set(256,c.m);
  dev(83,[4,1,V,16]);matrix(Array(16).fill(0));dev(44,[256,M]); // immutable lowered draw, not live matrix reference
  if(colorUpload){
   object(SRC,13,[LR,0,0],'LockRect upload source');
   emit(0x8b,0x15,u32(LR+4),0xc7,0x02,u32(0xff112233));
   object(SRC,14,[],'UnlockRect upload source');
   dev(30,[[SRC],RECT,[RT],POINT]); // UpdateSurface, with later source reuse.
   emit(0x8b,0x15,u32(LR+4),0xc7,0x02,u32(0xffabcdef));
  }
  if(surfaceUpload){
   object(RT,13,[LR,0,0],'LockRect writable target');
   emit(0x8b,0x15,u32(LR+4),0xc7,0x02,u32(0xff445566));
   object(RT,14,[],'UnlockRect writable target');
   emit(0x8b,0x15,u32(LR+4),0xc7,0x02,u32(0xffabcdef));
  }
  object(RT,13,[LR,0,16],'LockRect rendered '+c.name);
  if(colorUpload||surfaceUpload){emit(0x8b,0x15,u32(LR+4),0x8b,0x02);expect(surfaceUpload?0xff445566:0xff112233,'owned uploaded pixel '+c.name);}
  // Copy the actual public readback while locked, including row pitch. These
  // pixels produce evidence captures; they never supply the scalar oracle.
  for(let y=0;y<32;y++){
   emit(0x8b,0x15,u32(LR),0x69,0xd2,u32(y),0x03,0x15,u32(LR+4));
   for(let x=0;x<32;x++)emit(0x8b,0x82,u32(x*4),0xa3,u32(FRAMES+ci*4096+(y*32+x)*4));
  }
  for(const point of probes){
   emit(0x8b,0x15,u32(LR),0x69,0xd2,u32(point.y),0x03,0x15,u32(LR+4),0x8b,0x82,u32(point.x*4));
   const expected=point.pattern[ci]==='1'?0xff28c864:0xff000000;
   emit(0xa3,u32(OBS+pixels.length*4));expect(expected,c.name+' pixel '+point.x+','+point.y);pixels.push({case:c.name,...point,expected});
  }
  object(RT,14,[],'UnlockRect rendered');mark('rendered-'+c.name);
 }
 if(!defaultTarget){
  dev(37,[0,[D+404]]);object(RT,2,[],'Release final unbound target');
  push(20);api('Sleep'); // Deliver the owned retirement before inspecting counters.
 }
 mark('PASS');write(STATUS,1);jump('sleep');
 for(const row of checks){labels.set('fail'+row.id,code.length);write(STATUS,row.id);emit(0xa3,u32(STATUS+4));write(STATUS+8,row.expected);jump('failure');}
 labels.set('abi-fail',code.length);write(STATUS,0xffff);emit(0xa3,u32(STATUS+4));
 labels.set('failure',code.length);mark('FAIL');
 labels.set('sleep',code.length);push(1000);api('Sleep');jump('sleep');
 const bytes=Buffer.from(code);for(const [at,target] of fixups){assert(labels.has(target),target);bytes.writeInt32LE(labels.get(target)-at-4,at);}
 assert(bytes.length<0x22000,'bounded generated code');bytes.copy(b,raw(0x2000));
 return {bytes:b,statusWasm:0x12000+STATUS-BASE,statusGuest:STATUS,pixelWasm:0x12000+OBS-BASE,frameWasm:0x12000+FRAMES-BASE,allocationWasm:0x12000+D-BASE,checks,pixels,codeBytes:bytes.length,oracle:{A,B,BA,AB,cases,probes}};
}
module.exports={fixture,product,I};
