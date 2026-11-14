'use strict';
// Generated ordinary PE; every API method dereferences its public x86 COM vtable.
// Independent literal colors and scalar triangle coverage; no production oracle.
const assert=require('node:assert/strict');
function fixture({reuseIdentity=false,contextLoss=false}={}){
 assert(!(reuseIdentity&&contextLoss));
 const BASE=0x400000,b=Buffer.alloc(0x30200),raw=rva=>rva-0x1000+0x200,p=0x80,o=p+24,s=o+0xe0;
 b.writeUInt16LE(0x5a4d);b.writeUInt32LE(p,0x3c);b.writeUInt32LE(0x4550,p);
 b.writeUInt16LE(0x14c,p+4);b.writeUInt16LE(1,p+6);b.writeUInt16LE(0xe0,p+20);b.writeUInt16LE(0x010e,p+22);
 b.writeUInt16LE(0x10b,o);b.writeUInt32LE(0x2000,o+16);b.writeUInt32LE(BASE,o+28);
 b.writeUInt32LE(0x1000,o+32);b.writeUInt32LE(0x200,o+36);b.writeUInt32LE(0x31000,o+56);b.writeUInt32LE(0x200,o+60);
 b.writeUInt16LE(3,o+68);b.writeUInt32LE(0x100000,o+72);b.writeUInt32LE(0x1000,o+76);b.writeUInt32LE(16,o+92);
 b.write('.all',s);b.writeUInt32LE(0x30000,s+8);b.writeUInt32LE(0x1000,s+12);b.writeUInt32LE(0x30000,s+16);
 b.writeUInt32LE(0x200,s+20);b.writeUInt32LE(0xe0000060,s+36);b.writeUInt32LE(0x1000,o+104);b.writeUInt32LE(80,o+108);
 let names=0x1500;const iat={};
 [['kernel32.dll',['OutputDebugStringA','Sleep']],['user32.dll',['CreateWindowExA']],['d3d9.dll',['Direct3DCreate9']]].forEach(([dll,apis],di)=>{
  const d=raw(0x1000+di*20),table=0x1200+di*64,dp=0x1400+di*64;
  b.writeUInt32LE(table,d);b.writeUInt32LE(dp,d+12);b.writeUInt32LE(table,d+16);b.write(dll+'\0',raw(dp));
  apis.forEach((name,i)=>{b.writeUInt32LE(names,raw(table+i*4));b.write(name+'\0',raw(names)+2);iat[name]=BASE+table+i*4;names+=name.length+3;});
 });
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255],code=[],fixups=[],labels=new Map(),checks=[],frames=[],calls=[];
 const emit=(...x)=>code.push(...x.flat()),push=n=>Array.isArray(n)?emit(0xff,0x35,u32(n[0])):emit(0x68,u32(n)),api=name=>emit(0xff,0x15,u32(iat[name]));
 const D=BASE+0x28000,PP=D+64,M=D+128,OUT=D+256,LR=D+384,RT=D+400,V=D+448,STATUS=D+640,CONTROL=D+656,FRAMES=D+1024;
 const write=(address,value)=>emit(0xc7,0x05,u32(address),u32(value));
 let strings=0x26000;const str=t=>{const a=BASE+strings;b.write(t+'\0',raw(strings));strings+=t.length+1;return a;};
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
  for(const a of [...args].reverse())push(a);emit(0x56,0x8b,0x06,0xff,0x90,u32(slot*4));if(hr!==null)expect(hr,label+' return');checkAbi();
 };
 const object=(address,slot,args=[],rc=0,label='object'+slot,iface=address===D+12?'IDirect3D9':'IDirect3DSurface9')=>{
  calls.push({iface,slot,args:args.length,label});saveAbi();
  for(const a of [...args].reverse())push(a);emit(0xa1,u32(address),0x50,0x8b,0x08,0xff,0x91,u32(slot*4));if(rc!==null)expect(rc,label+' return');checkAbi();
 };
 const checkpoint=n=>{
  write(STATUS,n);labels.set('wait'+n,code.length);emit(0xa1,u32(CONTROL),0x3d,u32(n),0x0f,0x84);
  fixups.push([code.length,'continue'+n]);emit(0,0,0,0);push(1);api('Sleep');jump('wait'+n);labels.set('continue'+n,code.length);
 };
 const params=(w,h)=>{for(let i=0;i<14;i++)write(PP+i*4,0);write(PP,w);write(PP+4,h);write(PP+8,22);write(PP+12,1);write(PP+24,1);emit(0xa1,u32(D+20),0xa3,u32(PP+28));write(PP+32,1);write(PP+44,1);write(PP+52,0x80000000);};
 const create=dest=>{calls.push({iface:'IDirect3D9',slot:16,args:6,label:'CreateDevice'});saveAbi();push(dest);push(PP);push(0x20);push([D+20]);push(1);push(0);push([D+12]);emit(0xa1,u32(D+12),0x8b,0x00,0xff,0x50,64);expect(0,'CreateDevice');checkAbi();};
 const select=address=>emit(0x8b,0x35,u32(address));
 const identity=()=>{for(let i=0;i<16;i++)write(M+i*4,bits(i%5===0?1:0));for(const selector of [256,2,3])dev(44,[selector,M]);};
 const draw=(name,w,h,color,reverse=false,acceptOnly=false)=>{
  identity();dev(89,[0x42]);for(const [state,value] of [[137,0],[7,0],[22,1]])dev(57,[state,value]);
  dev(43,[0,0,1,0xff214365,bits(1),0]);
  const points=reverse?[[1,-1,.5],[-1,-1,.5],[1,1,.5]]:[[-1,1,.5],[1,1,.5],[-1,-1,.5]];
  points.forEach((point,i)=>{point.forEach((n,j)=>write(V+i*16+j*4,bits(n)));write(V+i*16+12,color);});
  dev(41,[],0,'BeginScene');dev(83,[4,1,V,16]);dev(42,[],0,'EndScene');if(acceptOnly)return;dev(18,[0,0,0,RT],0,'GetBackBuffer');object(RT,12,[OUT]);
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
 emit(0xbb,u32(0x13579bdf),0xbe,u32(0x5a5aa5a5),0xbf,u32(0x2468ace0),0xbd,u32(0x31415926));
 for(const a of [0,0,0,0,32,32,0,0,0x10000000,title,klass,0])push(a);api('CreateWindowExA');emit(0xa3,u32(D+20));
 push(32);api('Direct3DCreate9');emit(0xa3,u32(D+12));
 // An ordinary released parent immediately precedes the first surface/device
 // pair. Its returned pointer is only an equality witness; never overwrite a
 // guest COM pointer, wrapper, allocation cursor or renderer map.
 const PAD=D+704,FILL=D+708,CHURN=D+712,ORIGINAL=D+716,REUSE_LIMIT=16384;
 const parent=dest=>{saveAbi();push(32);api('Direct3DCreate9');emit(0xa3,u32(dest));checkAbi();
  emit(0xa1,u32(dest),0x85,0xc0,0x0f,0x84);fixups.push([code.length,'allocation-fail']);emit(0,0,0,0);};
 if(reuseIdentity){parent(PAD);object(PAD,2,[],0,'padding parent Release','IDirect3D9');}
 params(8,8);create(D);params(8,8);create(D+8);
 if(reuseIdentity)emit(0xa1,u32(D),0xa3,u32(ORIGINAL));
 // Public selector/lifetime controls. Record failures without consuming the
 // unspecified output pointer; an unexpected baseline success is released.
 const REPORT=D+17000,IMPLICIT=D+512,SWAP=D+516,EXTRA=D+520,TARGET=D+524;
 const selectors=[];
 const same=(a,b,label)=>{emit(0xa1,u32(a),0x33,0x05,u32(b));expect(0,label);};
 const copy=(from,to)=>emit(0xa1,u32(from),0xa3,u32(to));
 const capture=(iface,address,slot,args,at,label)=>{
  calls.push({iface,slot,args:args.length,label});saveAbi();
  for(const a of [...args].reverse())push(a);
  emit(0xa1,u32(address),0x50,0x8b,0x08,0xff,0x91,u32(slot*4),0xa3,u32(at));checkAbi();
 };
 const chain=(slot,args=[],rc=0,label='swap method'+slot)=>{
  capture('IDirect3DSwapChain9',SWAP,slot,args,REPORT+2048,label);
  emit(0xa1,u32(REPORT+2048));expect(rc,label);
 };
 const validIdentity=label=>{
  dev(18,[0,0,0,RT],0,label+' valid device');same(RT,IMPLICIT,label+' implicit device identity');
  object(RT,3,[OUT],0,label+' owner');same(OUT,D,label+' owner identity');dev(2,[],null,label+' owner Release');
  object(RT,12,[OUT]);readCheck(OUT+24,8,label+' width');readCheck(OUT+28,8,label+' height');
  object(RT,2,[],null,label+' valid device surface Release');
  chain(5,[0,0,RT],0,label+' valid chain');same(RT,IMPLICIT,label+' implicit chain identity');
  object(RT,2,[],null,label+' valid chain surface Release');
 };
 if(contextLoss){
  select(D);draw('healthy',8,8,0xffc17935);
  // Keep the successful LockRect's actual guest DIB pointer for canary checks.
  copy(LR+4,D+720);copy(LR,D+724);
  select(D+8);draw('peer-before',8,8,0xff3b91d7,true);
  select(D);draw('accepted-before-loss',8,8,0xff28c864,false,true);checkpoint(2);
  dev(18,[0,0,0,RT]);write(LR,0x76543210);write(LR+4,0x12345678);
  object(RT,13,[LR,0,16],0x8876086c,'actual loss LockRect refusal');
  object(RT,2,[],1,'failed LockRect surface Release');checkpoint(3);
  params(12,10);dev(16,[PP],0x88760868,'Reset preserves actual loss');
  dev(3,[],0x88760868,'lost cooperative level');checkpoint(4);
  dev(2,[],0,'lost device Release');checkpoint(5);
  params(12,10);create(D);select(D);draw('fresh-changed',12,10,0xff8d27b9,true);
  select(D+8);draw('peer-after',8,8,0xff3b91d7,true);checkpoint(6);
  select(D);dev(2,[],0,'fresh Release');select(D+8);dev(2,[],0,'peer Release');
 }else{
 select(D+8);dev(43,[0,0,1,0xff5c7d9e,bits(1),0],0,'peer clear before selectors');
 select(D);dev(15,[],1,'one actual swap chain');dev(14,[0,SWAP],0,'GetSwapChain');
 dev(18,[0,0,0,IMPLICIT]);object(IMPLICIT,2,[],1,'initial selector reference Release');
 chain(9,[OUT],0,'actual presentation parameters');readCheck(OUT+12,1,'one actual back buffer');
 // Acceptance of larger requested counts already collapses to one physical
 // buffer. Preserve creation; use the publicly reported actual count as bound.
 for(const requested of [0,1,2,3]){
  params(8,8);write(PP+12,requested);create(EXTRA);
  capture('IDirect3DDevice9',EXTRA,15,[],REPORT+2048,'requested count chain count');
  readCheck(REPORT+2048,1,'one chain for requested count '+requested);
  capture('IDirect3DDevice9',EXTRA,14,[0,TARGET],REPORT+2048,'requested count GetSwapChain');readCheck(REPORT+2048,0,'GetSwapChain requested '+requested);
  capture('IDirect3DSwapChain9',TARGET,9,[OUT],REPORT+2048,'requested count parameters');readCheck(REPORT+2048,0,'parameters requested '+requested);
  readCheck(OUT+12,1,'actual count for requested '+requested);
  capture('IDirect3DDevice9',EXTRA,18,[0,0,0,RT],REPORT+2048,'requested count valid device buffer');readCheck(REPORT+2048,0,'valid device buffer requested '+requested);
  capture('IDirect3DSwapChain9',TARGET,5,[0,0,OUT],REPORT+2048,'requested count valid chain buffer');readCheck(REPORT+2048,0,'valid chain buffer requested '+requested);
  same(RT,OUT,'requested count route identity '+requested);object(RT,2,[],2,'requested count first buffer Release');object(OUT,2,[],1,'requested count second buffer Release');
  for(const [route,iface,address,slot,args] of [
   ['device','IDirect3DDevice9',EXTRA,18,[0,1,0,OUT]],['swap','IDirect3DSwapChain9',TARGET,5,[1,0,OUT]]]){
   const at=REPORT+(32+requested*2+(route==='swap'?1:0))*16,label='requested '+requested+' '+route;
   selectors.push({iface:route,chain:0,index:1,type:0,requestedCount:requested,actualCount:1,offset:at-REPORT});
   capture('IDirect3DDevice9',EXTRA,18,[0,0,0,RT],REPORT+2048,label+' current valid implicit');readCheck(REPORT+2048,0,label+' current valid implicit');
   copy(RT,at+12);object(RT,2,[],1,label+' current valid implicit Release');
   write(OUT,0x76543210);capture(iface,address,slot,args,at,label+' actual count boundary');copy(OUT,at+4);
   params(8,8);capture('IDirect3DDevice9',EXTRA,16,[PP],at+8,label+' Reset eligibility');
   emit(0xa1,u32(at),0x85,0xc0,0x0f,0x85);fixups.push([code.length,'count-no-acquire'+requested+route]);emit(0,0,0,0);
   object(at+4,2,[],1,label+' unexpected success cleanup');params(8,8);
   capture('IDirect3DDevice9',EXTRA,16,[PP],REPORT+2048,label+' cleanup Reset');readCheck(REPORT+2048,0,label+' cleanup Reset');
   labels.set('count-no-acquire'+requested+route,code.length);
  }
  capture('IDirect3DSwapChain9',TARGET,2,[],REPORT+2048,'requested count swap Release');readCheck(REPORT+2048,1,'count swap Release');
  capture('IDirect3DDevice9',EXTRA,2,[],REPORT+2048,'requested count device Release');readCheck(REPORT+2048,0,'count device Release');
 }
 // A successful surface acquisition retains its device after the original
 // device reference is released; the final surface Release retires it.
 params(8,8);create(EXTRA);
 capture('IDirect3DDevice9',EXTRA,18,[0,0,0,RT],REPORT+2048,'retaining child GetBackBuffer');readCheck(REPORT+2048,0,'retaining child GetBackBuffer');
 capture('IDirect3DDevice9',EXTRA,2,[],REPORT+2048,'release original parent reference');readCheck(REPORT+2048,1,'surface retains released parent');
 object(RT,3,[OUT],0,'recover retained parent through public GetDevice');same(OUT,EXTRA,'retained parent identity');
 capture('IDirect3DDevice9',OUT,43,[0,0,1,0xff7b395d,bits(1),0],REPORT+2048,'retained parent still renders');readCheck(REPORT+2048,0,'retained parent Clear');
 object(RT,13,[LR,0,16],0,'retained parent public readback');
 emit(0x8b,0x15,u32(LR+4),0x8b,0x02);expect(0xff7b395d,'retained parent rendered first pixel');
 emit(0x8b,0x15,u32(LR),0x69,0xd2,u32(7),0x03,0x15,u32(LR+4),0x8b,0x82,u32(28));expect(0xff7b395d,'retained parent rendered last pixel');
 object(RT,14,[],0,'retained parent unlock');
 capture('IDirect3DDevice9',OUT,2,[],REPORT+2048,'release recovered parent reference');readCheck(REPORT+2048,1,'surface remains final parent hold');
 object(RT,2,[],0,'last acquired surface retires parent');
 const cases=[... [1,0x80000000,0xffffffff].map(chain=>({iface:'device',chain,index:0,type:0})),
  ...[1,2,0x80000000,0xffffffff].flatMap(index=>[{iface:'device',chain:0,index,type:0},{iface:'swap',index,type:0}]),
  ...[1,2,0xffffffff].flatMap(type=>[{iface:'device',chain:0,index:0,type},{iface:'swap',index:0,type}])];
 for(const [i,c] of cases.entries()){
  const at=REPORT+i*16,label='selector '+JSON.stringify(c);selectors.push({...c,offset:i*16});
  copy(IMPLICIT,at+12);write(OUT,0x76543210);
  capture(c.iface==='device'?'IDirect3DDevice9':'IDirect3DSwapChain9',c.iface==='device'?D:SWAP,
   c.iface==='device'?18:5,c.iface==='device'?[c.chain,c.index,c.type,OUT]:[c.index,c.type,OUT],at,label);
  copy(OUT,at+4);validIdentity(label+' subsequent');
  // No Release of a failed request: Reset is the public leak witness.
  params(8,8);capture('IDirect3DDevice9',D,16,[PP],at+8,label+' Reset eligibility');
  emit(0xa1,u32(at),0x85,0xc0,0x0f,0x85);fixups.push([code.length,'selector-no-acquire'+i]);emit(0,0,0,0);
  // Observation mode permits the old divergence to finish on both modules.
  object(at+4,2,[],1,label+' unexpected success cleanup');params(8,8);dev(16,[PP],0,label+' cleanup Reset');
  labels.set('selector-no-acquire'+i,code.length);
  dev(18,[0,0,0,IMPLICIT]);object(IMPLICIT,2,[],1,label+' fresh post-Reset implicit Release');
 }
 // Successful GetBackBuffer really owns references: releasing one of two
 // acquisitions, plus an explicit AddRef, cannot unblock Reset prematurely.
 dev(18,[0,0,0,RT]);chain(5,[0,0,OUT]);same(RT,OUT,'two successful routes share implicit identity');
 object(RT,1,[],4,'explicit implicit AddRef');object(RT,2,[],3,'release explicit AddRef');
 object(RT,2,[],2,'release first acquisition');params(8,8);dev(16,[PP],0x8876086c,'remaining successful acquisition blocks Reset');
 object(OUT,2,[],1,'release last acquisition');params(8,8);dev(16,[PP],0,'all successful acquisitions released Reset');
 dev(18,[0,0,0,IMPLICIT]);object(IMPLICIT,2,[],1,'fresh implicit after lifetime Reset');
 // Independent RT binding must not redirect either implicit-buffer selector.
 dev(28,[8,8,22,0,0,1,TARGET,0],0,'CreateRenderTarget for selector independence');
 dev(37,[0,[TARGET]],0,'bind independent target');
 dev(38,[0,OUT],0,'query independent bound target');same(OUT,TARGET,'independent target actually bound');object(OUT,2,[],1,'bound target query Release');
 validIdentity('independent bound target');
 dev(38,[0,OUT],0,'query target after implicit lookups');same(OUT,TARGET,'implicit lookups preserve target binding');object(OUT,2,[],1,'preserved target query Release');
 dev(37,[0,[IMPLICIT]],0,'restore implicit target');object(TARGET,2,[],0,'independent target Release');
 chain(2,[],1,'selector swap Release');
 select(D+8);dev(18,[0,0,0,RT]);object(RT,3,[OUT]);same(OUT,D+8,'peer retains its own device');dev(2,[],2,'peer owner Release');object(RT,13,[LR,0,16],0,'peer readback after selectors');
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  emit(0x8b,0x15,u32(LR),0x69,0xd2,u32(y),0x03,0x15,u32(LR+4),0x8b,0x82,u32(x*4));expect(0xff5c7d9e,'peer preserved selector pixel '+x+','+y);
 }
 object(RT,14,[],0,'peer unlock after selectors');object(RT,2,[],1,'peer selector Release');
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
 if(reuseIdentity){
  // At most one pool's worth of cheap public parent objects. Every iteration
  // releases its sole reference and checks both public ABI and return value.
  // No GPU device/context/endpoint is created by Direct3DCreate9 alone.
  write(CHURN,0);labels.set('reuse-churn',code.length);
  parent(FILL);object(FILL,2,[],0,'filler parent Release','IDirect3D9');
  emit(0xff,0x05,u32(CHURN),0xa1,u32(FILL),0x3b,0x05,u32(PAD),0x0f,0x84);
  fixups.push([code.length,'reuse-ready']);emit(0,0,0,0);
  emit(0xa1,u32(CHURN),0x3d,u32(REUSE_LIMIT),0x0f,0x82);
  fixups.push([code.length,'reuse-churn']);emit(0,0,0,0);jump('allocation-fail');
  labels.set('reuse-ready',code.length);
 }
 params(8,8);create(D);
 if(reuseIdentity){emit(0xa1,u32(D),0x33,0x05,u32(ORIGINAL));expect(0,'ordinary recreation reuses retired device identity');}
 select(D);draw('recreated',8,8,0xff8d27b9,true);
 if(reuseIdentity){select(D+8);draw('peer-after-recreation',8,8,0xff3b91d7,true);select(D);}
 checkpoint(7);
 // The browser runs the separate malformed-protocol old-lifetime control
 // at checkpoint7, after recovery pixels. The guest only releases afterward.
 select(D);dev(2,[],0,'recreated device Release');select(D+8);draw('peer-after-stale-control',8,8,0xff79a531);dev(2,[],0,'peer Release');
 }
 object(D+12,2,[],0,'IDirect3D9 Release');write(STATUS,1);jump('sleep');
 for(const row of checks){labels.set('fail'+row.id,code.length);write(STATUS,row.id);emit(0xa3,u32(STATUS+4));write(STATUS+8,row.expected);jump('sleep');}
 labels.set('allocation-fail',code.length);write(STATUS,0xfffe);jump('sleep');
 labels.set('abi-fail',code.length);write(STATUS,0xffff);emit(0xa3,u32(STATUS+4));
 labels.set('sleep',code.length);push(1000);api('Sleep');jump('sleep');
 const bytes=Buffer.from(code);for(const [at,target] of fixups){assert(labels.has(target),target);bytes.writeInt32LE(labels.get(target)-at-4,at);}
 assert(bytes.length<0x24000);bytes.copy(b,raw(0x2000));
 return {bytes:b,checks,frames,calls,selectors,lossReceiptWasm:contextLoss?0x12000+D+720-BASE:null,lockWasm:0x12000+LR-BASE,reuse:reuseIdentity?{limit:REUSE_LIMIT,wasm:0x12000+PAD-BASE}:null,selectorWasm:0x12000+REPORT-BASE,codeBytes:bytes.length,statusWasm:0x12000+STATUS-BASE,controlWasm:0x12000+CONTROL-BASE,frameWasm:0x12000+FRAMES-BASE,deviceWasm:0x12000+D-BASE};
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
 assert.equal(b.readUInt32LE(o+28),0x400000);assert.equal(b.readUInt32LE(o+56),0x31000);
 assert.equal(b.readUInt32LE(s+12),0x1000);assert.equal(b.readUInt32LE(s+16)+b.readUInt32LE(s+20),b.length);
 assert.equal(b.readUInt32LE(o+104),0x1000);assert.equal(b.readUInt32LE(o+108),80);
 assert(f.codeBytes>1000&&0x2000+f.codeBytes<0x26000,'code does not overlap strings/data');
 assert.equal(b.subarray(raw(0x2000),raw(0x2000)+20).toString('hex'),'bbdf9b5713bea5a55a5abfe0ac6824bd26594131','nonzero nonvolatile register seeds');
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
  2:['Release',0],3:['TestCooperativeLevel',0],14:['GetSwapChain',2],15:['GetNumberOfSwapChains',0],16:['Reset',1],18:['GetBackBuffer',4],28:['CreateRenderTarget',8],37:['SetRenderTarget',2],38:['GetRenderTarget',2],
  41:['BeginScene',0],42:['EndScene',0],43:['Clear',6],44:['SetTransform',2],47:['SetViewport',1],48:['GetViewport',1],57:['SetRenderState',2],83:['DrawPrimitiveUP',4],89:['SetFVF',1]},
  IDirect3DSwapChain9:{2:['Release',0],5:['GetBackBuffer',3],9:['GetPresentParameters',1]},
  IDirect3DSurface9:{1:['AddRef',0],2:['Release',0],3:['GetDevice',1],12:['GetDesc',1],13:['LockRect',3],14:['UnlockRect',0]}};
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
