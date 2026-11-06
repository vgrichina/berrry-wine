'use strict';
// Generated ordinary PE; every API method dereferences its public x86 COM vtable.
// Independent literal colors and scalar triangle coverage; no production oracle.
const assert=require('node:assert/strict');
function fixture(){
 const BASE=0x400000,b=Buffer.alloc(0x20200),raw=rva=>rva-0x1000+0x200,p=0x80,o=p+24,s=o+0xe0;
 b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,0x3c);b.writeUInt32LE(0x4550,p);
 b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(0xe0,p+20);b.writeUInt16LE(0x010e,p+22);
 b.writeUInt16LE(0x10b,o);b.writeUInt32LE(0x2000,o+16);b.writeUInt32LE(BASE,o+28);
 b.writeUInt32LE(0x1000,o+32);b.writeUInt32LE(0x200,o+36);b.writeUInt32LE(0x21000,o+56);b.writeUInt32LE(0x200,o+60);
 b.writeUInt16LE(3,o+68);b.writeUInt32LE(0x100000,o+72);b.writeUInt32LE(0x1000,o+76);b.writeUInt32LE(16,o+92);
 b.write('.all',s);b.writeUInt32LE(0x20000,s+8);b.writeUInt32LE(0x1000,s+12);b.writeUInt32LE(0x20000,s+16);
 b.writeUInt32LE(0x200,s+20);b.writeUInt32LE(0xe0000060,s+36);b.writeUInt32LE(0x1000,o+104);b.writeUInt32LE(80,o+108);
 let names=0x1500;const iat={};
 [['kernel32.dll',['OutputDebugStringA','Sleep']],['user32.dll',['CreateWindowExA']],['d3d9.dll',['Direct3DCreate9']]].forEach(([dll,apis],di)=>{
  const d=raw(0x1000+di*20),table=0x1200+di*64,dp=0x1400+di*64;
  b.writeUInt32LE(table,d);b.writeUInt32LE(dp,d+12);b.writeUInt32LE(table,d+16);b.write(dll+'\0',raw(dp));
  apis.forEach((name,i)=>{b.writeUInt32LE(names,raw(table+i*4));b.write(name+'\0',raw(names)+2);iat[name]=BASE+table+i*4;names+=name.length+3;});
 });
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],code=[],fixups=[],labels=new Map(),checks=[],frames=[],calls=[];
 const emit=(...x)=>code.push(...x.flat()),push=n=>Array.isArray(n)?emit(0xff,0x35,u32(n[0])):emit(0x68,u32(n)),api=name=>emit(0xff,0x15,u32(iat[name]));
 const D=BASE+0x18000,PP=D+64,M=D+128,OUT=D+256,LR=D+384,RT=D+400,V=D+448,STATUS=D+640,CONTROL=D+656,FRAMES=D+1024;
 const write=(address,value)=>emit(0xc7,0x05,u32(address),u32(value));
 let strings=0x16000;const str=t=>{const a=BASE+strings;b.write(t+'\0',raw(strings));strings+=t.length+1;return a;};
 const jump=label=>{emit(0xe9);fixups.push([code.length,label]);emit(0,0,0,0);};
 const expect=(value,label)=>{const id=checks.length+100;checks.push({id,expected:value>>>0,label});emit(0x3d,u32(value),0x0f,0x85);fixups.push([code.length,'fail'+id]);emit(0,0,0,0);};
 const readCheck=(address,value,label)=>{emit(0xa1,u32(address));expect(value,label);};
 const bits=n=>{const t=Buffer.alloc(4);t.writeFloatLE(n);return t.readUInt32LE();};
 const saveAbi=()=>{for(const [op,at] of [[0x25,24],[0x35,32],[0x1d,36],[0x3d,40],[0x2d,44]])emit(0x89,op,u32(D+at));};
 const checkAbi=()=>{for(const [op,at] of [[0xe0,24],[0xf0,32],[0xd8,36],[0xf8,40],[0xe8,44]]){
  emit(0x89,op,0x3b,0x05,u32(D+at),0x0f,0x85);fixups.push([code.length,'abi-fail']);emit(0,0,0,0);
 }};
 const dev=(slot,args=[],hr=0,label='method'+slot)=>{
  calls.push({iface:'IDirect3DDevice9',slot,args:args.length,label});saveAbi();
  for(const a of [...args].reverse())push(a);emit(0x56,0x8b,0x06,0xff,0x90,u32(slot*4));expect(hr,label+' return');checkAbi();
 };
 const object=(address,slot,args=[],rc=0,label='object'+slot)=>{
  calls.push({iface:address===D+12?'IDirect3D9':'IDirect3DSurface9',slot,args:args.length,label});saveAbi();
  for(const a of [...args].reverse())push(a);emit(0xa1,u32(address),0x50,0x8b,0x08,0xff,0x91,u32(slot*4));expect(rc,label+' return');checkAbi();
 };
 const checkpoint=n=>{
  write(STATUS,n);labels.set('wait'+n,code.length);emit(0xa1,u32(CONTROL),0x3d,u32(n),0x0f,0x84);
  fixups.push([code.length,'continue'+n]);emit(0,0,0,0);push(1);api('Sleep');jump('wait'+n);labels.set('continue'+n,code.length);
 };
 const params=(w,h)=>{for(let i=0;i<14;i++)write(PP+i*4,0);write(PP,w);write(PP+4,h);write(PP+8,22);write(PP+12,1);write(PP+24,1);emit(0xa1,u32(D+20),0xa3,u32(PP+28));write(PP+32,1);write(PP+44,1);write(PP+52,0x80000000);};
 const create=dest=>{calls.push({iface:'IDirect3D9',slot:16,args:6,label:'CreateDevice'});saveAbi();push(dest);push(PP);push(0x20);push([D+20]);push(1);push(0);push([D+12]);emit(0xa1,u32(D+12),0x8b,0x00,0xff,0x50,64);expect(0,'CreateDevice');checkAbi();};
 const select=address=>emit(0x8b,0x35,u32(address));
 const identity=()=>{for(let i=0;i<16;i++)write(M+i*4,bits(i%5===0?1:0));for(const selector of [256,2,3])dev(44,[selector,M]);};
 const draw=(name,w,h,color,reverse=false)=>{
  identity();dev(89,[0x42]);for(const [state,value] of [[137,0],[7,0],[22,1]])dev(57,[state,value]);
  dev(43,[0,0,1,0xff214365,bits(1),0]);
  const points=reverse?[[1,-1,.5],[-1,-1,.5],[1,1,.5]]:[[-1,1,.5],[1,1,.5],[-1,-1,.5]];
  points.forEach((point,i)=>{point.forEach((n,j)=>write(V+i*16+j*4,bits(n)));write(V+i*16+12,color);});
  dev(41,[],0,'BeginScene');dev(83,[4,1,V,16]);dev(42,[],0,'EndScene');dev(18,[0,0,0,RT],0,'GetBackBuffer');object(RT,12,[OUT]);
  readCheck(OUT+24,w,name+' width');readCheck(OUT+28,h,name+' height');
  object(RT,13,[LR,0,16]);
  const offset=frames.length*2048,probes=[{x:1,y:1,expected:reverse?0xff214365:color},{x:w-2,y:h-2,expected:reverse?color:0xff214365}];
  for(let y=0;y<h;y++){
   emit(0x8b,0x15,u32(LR),0x69,0xd2,u32(y),0x03,0x15,u32(LR+4));
   for(let x=0;x<w;x++)emit(0x8b,0x82,u32(x*4),0xa3,u32(FRAMES+offset+(y*w+x)*4));
  }
  for(const point of probes)readCheck(FRAMES+offset+(point.y*w+point.x)*4,point.expected,name+' independent corner '+point.x+','+point.y);
  object(RT,14);object(RT,2,[],1,'backbuffer Release');frames.push({name,w,h,color,reverse,offset,probes});
 };
 const klass=str('STATIC'),title=str('Generated public D3D9 Reset regression');
 for(const a of [0,0,0,0,32,32,0,0,0x10000000,title,klass,0])push(a);api('CreateWindowExA');emit(0xa3,u32(D+20));
 push(32);api('Direct3DCreate9');emit(0xa3,u32(D+12));params(8,8);create(D);params(8,8);create(D+8);
 select(D);draw('before-reset',8,8,0xffc17935);select(D+8);draw('peer-before',8,8,0xff3b91d7,true);checkpoint(2);
 select(D);for(const [offset,value] of [[0,2],[4,1],[8,4],[12,3],[16,bits(.25)],[20,bits(.75)]])write(OUT+offset,value);dev(47,[OUT],0,'nondefault viewport before Reset');params(12,10);dev(16,[PP],0,'healthy Reset');dev(3,[],0,'healthy cooperative level');for(const offset of [0,4,8,12])readCheck(PP+offset,0,'Reset PP output'+offset);
 dev(48,[OUT]);for(const [offset,value] of [[0,0],[4,0],[8,12],[12,10],[16,0],[20,bits(1)]])readCheck(OUT+offset,value,'Reset viewport'+offset);
 draw('after-resize',12,10,0xffd52f83,true);select(D+8);draw('peer-after-resize',8,8,0xff3b91d7,true);checkpoint(3);
 // An ordinary unsupported singular normal transform exercises strict failure
 // in the actual WebGL executor. No test-only error injection or worker death.
 select(D);dev(89,[0x52]);dev(57,[137,1]);for(let i=0;i<16;i++)write(M+i*4,0);dev(44,[256,M]);
 [[-.5,.5,.5],[.5,.5,.5],[-.5,-.5,.5]].forEach((point,i)=>{[...point,0,0,1].forEach((n,j)=>write(V+i*28+j*4,bits(n)));write(V+i*28+24,0xff28c864);});
 dev(41,[],0,'BeginScene before refusal');dev(83,[4,1,V,28],0x8876086c,'ordinary singular normal refusal');dev(42,[],0,'EndScene after refused draw');checkpoint(4);
 params(12,10);dev(16,[PP],0x88760868,'failed Reset preserves refused stream');dev(3,[],0x88760868,'TestCooperativeLevel after failed Reset');checkpoint(5);
 select(D+8);draw('peer-after-refusal',8,8,0xff3b91d7,true);select(D);dev(2,[],0,'failed device Release');checkpoint(6);
 params(8,8);create(D);select(D);draw('recreated',8,8,0xff8d27b9,true);checkpoint(7);
 // The browser runs the separate malformed-protocol old-lifetime control
 // at checkpoint7, after recovery pixels. The guest only releases afterward.
 select(D);dev(2,[],0,'recreated device Release');select(D+8);draw('peer-after-stale-control',8,8,0xff79a531);dev(2,[],0,'peer Release');
 object(D+12,2,[],0,'IDirect3D9 Release');write(STATUS,1);jump('sleep');
 for(const row of checks){labels.set('fail'+row.id,code.length);write(STATUS,row.id);emit(0xa3,u32(STATUS+4));write(STATUS+8,row.expected);jump('sleep');}
 labels.set('abi-fail',code.length);write(STATUS,0xffff);emit(0xa3,u32(STATUS+4));
 labels.set('sleep',code.length);push(1000);api('Sleep');jump('sleep');
 const bytes=Buffer.from(code);for(const [at,target] of fixups){assert(labels.has(target),target);bytes.writeInt32LE(labels.get(target)-at-4,at);}
 assert(bytes.length<0x14000);bytes.copy(b,raw(0x2000));
 return {bytes:b,checks,frames,calls,codeBytes:bytes.length,statusWasm:0x12000+STATUS-BASE,controlWasm:0x12000+CONTROL-BASE,frameWasm:0x12000+FRAMES-BASE,deviceWasm:0x12000+D-BASE};
}

// D3D9 integer pixel centers, with a margin excluding every edge and tie.
// For full-clip triangles, normalized coordinates sum to one on the diagonal.
function oracle(frame){
 const {w,h,color,reverse}=frame,out=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const diagonal=(x/w+y/h-1)/Math.hypot(1/w,1/h);
  if(Math.min(x,y,w-x,h-y,Math.abs(diagonal))<.8)continue;
  const inside=reverse?diagonal>0:diagonal<0;
  out.push({index:y*w+x,x,y,expected:(inside?color:0xff214365)>>>0});
 }
 assert(out.some(p=>p.expected===color));assert(out.some(p=>p.expected===0xff214365));
 return out;
}
function validateFixture(f,apis){
 const b=f.bytes,p=b.readUInt32LE(0x3c),o=p+24,s=o+0xe0,raw=rva=>rva-0x1000+0x200;
 assert.equal(b.readUInt16LE(),0x5a4d,'PE MZ, never raw code');assert.equal(b.readUInt32LE(p),0x4550);
 assert.equal(b.readUInt16LE(p+4),0x14c);assert.equal(b.readUInt16LE(p+6),1);
 assert.equal(b.readUInt16LE(o),0x10b);assert.equal(b.readUInt32LE(o+16),0x2000);
 assert.equal(b.readUInt32LE(o+28),0x400000);assert.equal(b.readUInt32LE(o+56),0x21000);
 assert.equal(b.readUInt32LE(s+12),0x1000);assert.equal(b.readUInt32LE(s+16)+b.readUInt32LE(s+20),b.length);
 assert.equal(b.readUInt32LE(o+104),0x1000);assert.equal(b.readUInt32LE(o+108),80);
 assert(f.codeBytes>1000&&0x2000+f.codeBytes<0x16000,'code does not overlap strings/data');
 const cstr=at=>{const end=b.indexOf(0,at);assert(end>=at&&end<at+128);return b.toString('ascii',at,end);},imports=[];
 for(let di=0;di<3;di++){
  const at=raw(0x1000+di*20),lookup=b.readUInt32LE(at),iat=b.readUInt32LE(at+16);
  assert.equal(lookup,iat);const dll=cstr(raw(b.readUInt32LE(at+12))),names=[];
  for(let n=0;n<16;n++){const hint=b.readUInt32LE(raw(lookup+n*4));if(!hint)break;assert.equal(b.readUInt16LE(raw(hint)),0);names.push(cstr(raw(hint)+2));}
  imports.push({dll,names});
 }
 assert(b.subarray(raw(0x103c),raw(0x1050)).every(v=>v===0),'null import descriptor');
 assert.deepEqual(imports,[{dll:'kernel32.dll',names:['OutputDebugStringA','Sleep']},{dll:'user32.dll',names:['CreateWindowExA']},{dll:'d3d9.dll',names:['Direct3DCreate9']}]);
 const slots={IDirect3D9:{2:['Release',0],16:['CreateDevice',6]},IDirect3DDevice9:{
  2:['Release',0],3:['TestCooperativeLevel',0],16:['Reset',1],18:['GetBackBuffer',4],
  41:['BeginScene',0],42:['EndScene',0],43:['Clear',6],44:['SetTransform',2],47:['SetViewport',1],48:['GetViewport',1],57:['SetRenderState',2],83:['DrawPrimitiveUP',4],89:['SetFVF',1]},
  IDirect3DSurface9:{2:['Release',0],12:['GetDesc',1],13:['LockRect',3],14:['UnlockRect',0]}};
 const bases=Object.fromEntries(Object.keys(slots).map(iface=>[iface,apis.findIndex(a=>a.name===iface+'_QueryInterface')]));
 for(const call of f.calls){
  const spec=slots[call.iface][call.slot];assert(spec,'known public COM slot');assert.equal(call.args,spec[1],call.label+' argument count');
  const entry=apis[bases[call.iface]+call.slot];assert.equal(entry.name,call.iface+'_'+spec[0]);
  assert.equal(entry.nargs,call.args+1,'production stdcall argument count');
 }
 for(const frame of f.frames){const points=oracle(frame);assert(frame.offset+frame.w*frame.h*4<2048*f.frames.length);assert(points.length>10);}
 return {bytes:b.length,codeBytes:f.codeBytes,imports,comCalls:f.calls.length,stackAndNonvolatileChecks:true};
}
module.exports={fixture,oracle,validateFixture};
