'use strict';

// This function is serialized unchanged into the existing real-x86 COM browser
// fixture. Node uses the same function against each shipped module in place.
async function immediateFixture(c) {
  const {mode,negative,evidence,check,eq,raw,read,alloc,wa,write,bytes,words,guard,guid,
    stack,prepareInvoke,com,ok,acquire,dd,hal,texture,surface,lock,unlock,bits,observe,use,initial,countDraw,queue}=c;
  const report=evidence.immediate={checkpoints:[],invalid:[],held:[],limits:65536};
  const INVALID=0x80070057,OOM=0x8007000e,UNSUPPORTED=0x80004001;
  const colors={A:[224,64,32],B:[32,192,96],C:[64,48,208]};
  const argb=rgb=>(0xff000000|(rgb[0]<<16)|(rgb[1]<<8)|rgb[2])>>>0;
  const ids={2:[0x6aae1ec1,0x11d0662a,0xaa009d88,0x6ab7bb00],
    3:[0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]};
  const targets=[];
  // Creation is intentionally below a single helper so interleaving never
  // shares a builder, viewport or target between the two interface versions.
  async function create(version) {
    const iid=await guid(ids[version]);
    const d3d=await acquire(out=>com('QI IDirect3D'+version,dd,0,iid,out));
    const rt=await surface(8,8,0x2840);
    const device=await acquire(out=>com('CreateDevice'+version,d3d,8,hal,rt,out,...(version===3?[0]:[])));
    const viewport=await acquire(out=>com('CreateViewport'+version,d3d,6,out,0));
    const vp=await alloc(44);
    await words(vp,[44,0,0,8,8,bits(-1),bits(1),bits(2),bits(2),bits(0),bits(1)]);
    const slots=version===2?{begin:17,indexed:18,vertex:19,index:20,end:21,scene:10,endScene:11,rs:23,ls:25,getls:24,draw:29}
      :{begin:16,indexed:17,vertex:18,index:19,end:20,scene:9,endScene:10,rs:22,ls:24,getls:23,draw:28};
    await ok(com('AddViewport '+version,device,version===2?6:5,viewport));
    await ok(com('SetViewport2 '+version,viewport,17,vp));
    await ok(com('SetCurrentViewport '+version,device,version===2?13:12,viewport));
    for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[41,0],[137,0]])
      await ok(com('seed immediate RS '+version,device,slots.rs,id,v));
    return {version,d3d,rt,device,viewport,slots};
  }
  // Each pixel uses a solid diffuse color, independent of sampler/production
  // shading helpers. A second offscreen triangle makes dropped tails visible.
  const positions=[[-40,-40],[-32,-40],[-40,-32],[-8,-8],[24,-8],[-8,24]];
  const rows=(format,rgb)=>positions.map(([x,y])=>{
    const color=argb(rgb),f=n=>bits(n);
    if(format===0x44)return [f(x),f(y),f(.5),f(1),color];
    if(format===0x42)return [f(x/4-1),f(1-y/4),f(.5),color];
    if(format===0x52)return [f(x/4-1),f(1-y/4),f(.5),0,0,0,color];
    if(format===0x12)return [f(x/4-1),f(1-y/4),f(.5),0,0,0];
    if(format===0x1e2)return [f(x/4-1),f(1-y/4),f(.5),0xdeadbeef,color,0,0,0];
    if(format===0x112)return [f(x/4-1),f(1-y/4),f(.5),0,0,f(1),0,0];
    return [f(x),f(y),f(.5),f(1),color,0,0,0];
  });
  const formatArg=(t,f)=>t.version===2?({0x112:1,0x1e2:2,0x1c4:3})[f]:f;
  const call=(t,m,...a)=>com('Device'+t.version+' '+m,t.device,t.slots[m],...a);
  const start=t=>ok(call(t,'scene'));
  const finish=t=>ok(call(t,'endScene'));
  const begin=(t,f=0x1c4,flags=0,prim=4)=>ok(call(t,'begin',prim,formatArg(t,f),flags));
  const end=async t=>{await ok(call(t,'end',0));countDraw();};
  async function fill(t,rgb=[0,0,0]) {
    const l=await lock(t.rt);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)await write(l.pointer+y*l.pitch+x*4,argb(rgb));
    await unlock(t.rt);
  }
  async function witness(t,label,rgb) {
    use(t);await observe(label,{name:'solid independent color',uv:[.25,.25]},
      {filter:1,address:1,palette:[rgb,rgb,rgb,rgb]});
    report.checkpoints.push({label,version:t.version,device:t.device,rt:t.rt,expected:rgb});
    const pixels=evidence.observations.at(-1).dibRGBA;
    if(!label.startsWith('topology'))for(let p=0;p<pixels.length;p+=4)
      eq(pixels.slice(p,p+3),rgb,'independent full-target RGB '+label+' pixel '+p/4);
    return pixels;
  }
  const scratch=await alloc(64);
  async function submit(t,f,rgb,{indexed=false,grow=0,drop=false,flags=0}={}) {
    const data=rows(f,rgb),stride=data[0].length*4;
    if(indexed){
      const source=await alloc(stride*data.length);for(let i=0;i<data.length;i++)await words(source+i*stride,data[i]);
      await ok(call(t,'indexed',4,formatArg(t,f),source,data.length,flags));
      await words(source,Array(stride*data.length/4).fill(0x7fc00000));
      for(let i=0;i<(drop?3:data.length);i++)await ok(call(t,'index',i===2?0x10002:i));
      await raw('guest_free',source);
    }else{
      await begin(t,f,flags);
      for(let i=0;i<grow;i++){await words(scratch,data[i%3]);await ok(call(t,'vertex',scratch));}
      for(const row of data.slice(0,drop?3:6)){
        await words(scratch,row);await ok(call(t,'vertex',scratch));
        await words(scratch,Array(16).fill(0x7fc00000));
      }
    }
  }
  const A=await create(2),B=await create(3);targets.push(A,B);
  report.objects=targets.map(t=>({version:t.version,device:t.device,rt:t.rt,d3d:t.d3d}));
  // Orphan calls and the scene contract execute through both actual vtables.
  async function fails(t,label,method,args,expected=INVALID){
    const hr=await call(t,method,...args);eq(hr,expected,label);report.invalid.push({label,version:t.version,hr});
  }
  for(const t of targets){
    // Seed an actual black GPU target before asserting that invalid calls
    // preserve it. No uncreated-target readback is used as GPU evidence.
    await fill(t);await start(t);await submit(t,0x1c4,[0,0,0]);await end(t);await finish(t);
    await fails(t,'Begin outside scene','begin',[4,formatArg(t,0x1c4),0],0x887602f9);
    for(const [method,args] of [['vertex',[scratch]],['index',[0]],['end',[0]]])await fails(t,'orphan '+method,method,args);
    await fill(t);await start(t);
    await fails(t,'bad primitive','begin',[0,formatArg(t,0x1c4),0]);
    await fails(t,'bad format','begin',[4,t.version===2?4:3,0]);
    await fails(t,'reserved Begin flags','begin',[4,formatArg(t,0x1c4),0x80000000]);
    await fails(t,'indexed points','indexed',[1,formatArg(t,0x1c4),scratch,1,0]);
    if(t.version===3)await fails(t,'unsupported normal plus prelit colors','begin',[4,0x52,0],UNSUPPORTED);
    if(t.version===3){
      for(const [id,value,label] of [[11,0x10000,'generated coordinates'],[24,2,'texture transform']]){
        await ok(com('set unsupported '+label,t.device,40,0,id,value));
        await fails(t,'unsupported '+label,'begin',[4,0x1c4,0],UNSUPPORTED);
        await ok(com('restore unsupported '+label,t.device,40,0,id,0));
      }
    }
    for(const [label,action] of [
      ['nested Begin',()=>fails(t,'nested Begin','begin',[4,formatArg(t,0x1c4),0])],
      ['wrong Index',()=>fails(t,'wrong Index','index',[0])],
      ['null Vertex',()=>fails(t,'null Vertex','vertex',[0])],
      ['state change',()=>fails(t,'state change','rs',[22,2])],
      ['BeginScene during sequence',()=>fails(t,'BeginScene during sequence','scene',[])],
      ['EndScene during sequence',()=>fails(t,'EndScene during sequence','endScene',[])],
      ['alternate DrawPrimitive',()=>fails(t,'alternate DrawPrimitive','draw',[4,formatArg(t,0x1c4),scratch,3,0])],
      ['device query',()=>fails(t,'device query','getls',[1,0])],
    ]){await begin(t);await action();await fails(t,'latched '+label,'end',[0]);}
    await begin(t);await fails(t,'insufficient vertices','end',[0]);
    await begin(t);await fails(t,'reserved End flags','end',[1]);
    await words(scratch,rows(0x1c4,colors.A)[3]);
    await ok(call(t,'indexed',4,formatArg(t,0x1c4),scratch,1,0));
    await fails(t,'wrong Vertex in indexed','vertex',[scratch]);await fails(t,'latched wrong Vertex','end',[0]);
    await ok(call(t,'indexed',4,formatArg(t,0x1c4),scratch,1,0));
    await fails(t,'out-of-range WORD index','index',[1]);await fails(t,'latched bad index','end',[0]);
    await finish(t);await witness(t,'invalid sequences draw nothing v'+t.version,[0,0,0]);
  }
  for(const f of [0x12,0x52])for(const indexed of [false,true]){
    const expected=f===0x12?[255,255,255]:colors.B;
    await fill(B);await start(B);await submit(B,f,expected,{indexed,flags:16|8|4|1});
    await end(B);await finish(B);await witness(B,'DONOTLIGHT '+f.toString(16)+' '+indexed,expected);
  }
  await fill(A);await start(A);await submit(A,0x1c4,colors.C,{flags:15});await end(A);await finish(A);
  await witness(A,'DX5 WAIT OUTOFORDER DONOTCLIP DONOTUPDATEEXTENTS',colors.C);
  for(const t of targets){
    const formats=t.version===2?[0x1c4,0x1e2,0x112]:[0x44,0x42,0x1c4,0x1e2,0x112];
    for(const f of formats)for(const indexed of [false,true]){
      const expected=f===0x112?[255,255,255]:colors.A;
      await fill(t);await start(t);
      await submit(t,f,expected,{indexed,drop:negative==='dropped'&&t===A&&f===0x1c4&&!indexed});
      await end(t);await finish(t);
      const actual=await witness(t,`v${t.version} ${f.toString(16)} ${indexed?'Index':'Vertex'}`,expected);
      // Existing DrawPrimitive supplies an independently contiguous source.
      await fill(t);const data=rows(f,expected),p=await alloc(data.length*data[0].length*4);
      for(let i=0;i<data.length;i++)await words(p+i*data[i].length*4,data[i]);
      await start(t);await ok(call(t,'draw',4,formatArg(t,f),p,data.length,0));countDraw();await finish(t);
      const baseline=await witness(t,`DrawPrimitive v${t.version} ${f.toString(16)}`,expected);
      eq(actual,baseline,'all 64 pixels versus DrawPrimitive');await raw('guest_free',p);
    }
  }
  const textureIID=await guid([0x93281502,0x11d08cf8,0xa000ab89,0x294105c9]);
  const texture2=await acquire(out=>com('QI IDirect3DTexture2',texture,0,textureIID,out)),handle=await guard(4);
  await ok(com('Texture2 GetHandle',texture2,3,A.device,handle.p));await handle.check();
  for(const [id,value] of [[1,await read(handle.p)],[21,2],[3,1],[17,1],[18,1]])await ok(call(A,'rs',id,value));
  await ok(com('Device3 SetTexture',B.device,38,0,texture));
  for(const [id,value] of [[1,2],[2,2],[4,2],[5,2],[11,1],[13,1],[14,1],[16,1],[17,1],[18,0]])
    await ok(com('Device3 texture stage',B.device,40,0,id,value));
  await ok(com('Device3 disable stage1',B.device,40,1,1,1));
  for(const t of targets)for(const indexed of [false,true]){
    const f=t.version===2?0x1c4:0x2c4,data=rows(0x1c4,[255,255,255]).map(row=>{
      row[6]=bits(t.version===2?.25:.75);row[7]=bits(t.version===2?.75:.25);
      return t.version===2?row:[...row,bits(.25),bits(.75)];
    }),stride=data[0].length*4,source=await alloc(stride*6);
    for(let i=0;i<6;i++)await words(source+i*stride,data[i]);
    await fill(t);await start(t);
    if(indexed){await ok(call(t,'indexed',4,formatArg(t,f),source,6,0));
      await words(source,Array(stride*6/4).fill(0x7fc00000));
      for(let i=0;i<6;i++)await ok(call(t,'index',i));
    }else{await begin(t,f);for(const row of data){await words(scratch,row);await ok(call(t,'vertex',scratch));
      await words(scratch,Array(16).fill(0x7fc00000));}}
    await end(t);await finish(t);
    const actual=await witness(t,`texture UV v${t.version} ${indexed}`,c.texturePalette[2]);
    await fill(t);for(let i=0;i<6;i++)await words(source+i*stride,data[i]);
    await start(t);await ok(call(t,'draw',4,formatArg(t,f),source,6,0));countDraw();await finish(t);
    eq(actual,await witness(t,`texture DrawPrimitive v${t.version} ${indexed}`,c.texturePalette[2]),'textured full target matches DrawPrimitive');
    await raw('guest_free',source);
  }
  await ok(call(A,'rs',1,0));await ok(com('Device3 unbind fixture texture',B.device,38,0,0));
  await ok(com('Device3 restore selected UV',B.device,40,0,11,0));await com('Release fixture Texture2',texture2,2);
  await fill(A);await start(A);await submit(A,0x1c4,colors.C,{grow:303});await end(A);await finish(A);
  await witness(A,'growth retains final triangle',colors.C);
  // Two live builders, caller storage reused for every submission, reversed
  // completion order, plus a nonfinal Release while the first builder is live.
  await fill(A);await fill(B);await start(A);await start(B);await begin(A);await begin(B,0x44);
  eq(await com('AddRef active A',A.device,1),2,'active AddRef');
  eq(await com('nonfinal Release active A',A.device,2),1,'nonfinal release preserves builder');
  for(let i=0;i<6;i++)for(const [t,f,rgb] of [[A,0x1c4,colors.A],[B,0x44,negative==='cross-device'?colors.A:colors.B]]){
    await words(scratch,rows(f,rgb)[i]);await ok(call(t,'vertex',scratch));await words(scratch,Array(16).fill(0));
  }
  await end(B);await finish(B);await end(A);await finish(A);
  await witness(A,'interleaved A',colors.A);await witness(B,'interleaved B',colors.B);
  for(const first of targets){
    const second=await create(first.version),format=first.version===2?0x1c4:0x44;
    await fill(first);await fill(second);await start(first);await start(second);
    await begin(first,format);await begin(second,format);
    for(let i=0;i<6;i++)for(const [t,rgb] of [[first,colors.A],[second,colors.B]]){
      await words(scratch,rows(format,rgb)[i]);await ok(call(t,'vertex',scratch));
      await words(scratch,Array(16).fill(0x7fc00000));
    }
    await end(second);await finish(second);await end(first);await finish(first);
    await witness(first,'same-version first v'+first.version,colors.A);
    await witness(second,'same-version second v'+first.version,colors.B);
    for(const [label,p] of [['device',second.device],['viewport',second.viewport],['target',second.rt],['D3D',second.d3d]])
      await com('Release same-version '+label,p,2);
  }
  {
    report.topologies=[];
    for(const t of targets)for(const prim of [1,2,3,4,5,6])for(const indexed of prim===1?[false]:[false,true]){
      const minimum=prim===1?1:prim<=3?2:3,source=await alloc(96);
      const positions=prim===1?[[2,2]]:prim<=3?[[1,2],[6,2]]:[[-8,-8],[24,-8],[-8,24]];
      for(let i=0;i<minimum;i++)await words(source+i*32,[bits(positions[i][0]),bits(positions[i][1]),bits(.5),bits(1),argb(colors.A),0,0,0]);
      await fill(t);await start(t);
      if(indexed)await ok(call(t,'indexed',prim,formatArg(t,0x1c4),source,minimum,0));
      else await begin(t,0x1c4,0,prim);
      for(let i=0;i<minimum;i++)await ok(call(t,indexed?'index':'vertex',indexed?i:source+i*32));
      // Disjoint triangle/line lists ignore a final incomplete primitive.
      if(prim===2||prim===4)await ok(call(t,indexed?'index':'vertex',indexed?0:source));
      await end(t);await finish(t);await witness(t,`topology v${t.version} ${prim} ${indexed}`,colors.A);
      if(minimum>1){
        await start(t);
        if(indexed)await ok(call(t,'indexed',prim,formatArg(t,0x1c4),source,minimum,0));else await begin(t,0x1c4,0,prim);
        for(let i=0;i<minimum-1;i++)await ok(call(t,indexed?'index':'vertex',indexed?i:source+i*32));
        await fails(t,'insufficient primitive '+prim+' '+indexed,'end',[0]);await finish(t);
      }
      report.topologies.push({version:t.version,prim,indexed,minimum,trailingRemainderIgnored:prim===2||prim===4});
      await raw('guest_free',source);
    }
  }
  // Capacity uses one real x86 loop, not 65537 host API dispatch injections.
  if(mode==='software'){
    await start(A);await words(scratch,rows(0x1c4,colors.A)[3]);
    await ok(call(A,'indexed',4,3,scratch,1,0));
    const result=await guard(8),code=[],u32=n=>code.push(n&255,n>>>8&255,n>>>16&255,n>>>24&255);
    code.push(0xbf);u32(65537);const loop=code.length;
    code.push(0x68);u32(0);code.push(0x68);u32(A.device);
    code.push(0xb8);u32(A.device);code.push(0x8b,0x00,0xff,0x90);u32(A.slots.index*4);
    code.push(0x85,0xc0,0x75,7,0x4f,0x0f,0x85);u32(loop-(code.length+4));
    code.push(0xa3);u32(result.p);code.push(0x89,0x3d);u32(result.p+4);code.push(0xc3);
    const pc=await alloc(code.length);await bytes(pc,code);await raw('set_esp',stack);await raw('call_func',pc,0,0,0,0);
    for(let i=0;i<500&&(await raw('get_eip'));i++)await raw('run',10000);
    eq(await raw('get_eip'),0,'bounded capacity loop');eq(await read(result.p),OOM,'65537th submission fails');
    eq(await read(result.p+4),1,'all 65536 earlier submissions retained');await result.check();
    await fails(A,'capacity error latches','end',[0],OOM);await finish(A);report.capacity={accepted:65536,rejected:65537,hr:OOM};
  }
  if(c.allocationFailure){
    // Exhaust the real allocator, without patching production state/exports.
    // Prepare every x86 call/result/guard before exhaustion so HRESULT testing
    // itself never needs an allocation. All pressure belongs to this fixture.
    const D=await create(3);await fill(A);await start(A);await submit(A,0x1c4,colors.A);
    await start(B);await start(D);await begin(D,0x44);
    const source=await alloc(192);for(let i=0;i<6;i++)await words(source+i*32,rows(0x1c4,colors.A)[i]);
    const prepare=(t,m,...args)=>prepareInvoke('OOM Device'+t.version+' '+m,[t.device,...args],t.device,t.slots[m]);
    const endA=await prepare(A,'end',0),vertexD=await prepare(D,'vertex',source),
      beginB=await prepare(B,'indexed',4,0x1c4,source,6,0);
    const pressure=[],failures=[];
    try{
      for(const size of [0x1000000,0x100000,0x10000,4096,256,128]){
        let failed=false;
        for(let i=0;i<10000;i++){const p=(await raw('guest_alloc',size))>>>0;
          if(!p){failures.push(size);failed=true;break;}pressure.push(p);}
        check(failed,'finite allocator exhaustion '+size);
      }
      eq(await endA(),OOM,'End allocation failure explicit');
      eq(await vertexD(),OOM,'stream growth allocation failure explicit');
      eq(await beginB(),OOM,'indexed copy allocation failure explicit');
      report.allocationFailure={actualAllocator:true,pressureAllocations:pressure.length,failedSizes:failures,
        end:OOM,growth:OOM,indexedCopy:OOM};
    }finally{for(const p of pressure)await raw('guest_free',p);}
    await finish(A);await witness(A,'allocation failure draws nothing',[0,0,0]);
    await fails(D,'growth allocation error latched','end',[0],OOM);await finish(D);
    await fails(B,'failed indexed Begin leaves idle','end',[0]);await finish(B);
    await fill(A);await start(A);await submit(A,0x1c4,colors.C);await end(A);await finish(A);
    await witness(A,'recovery after allocator failure',colors.C);
    for(const [label,p] of [['device',D.device],['viewport',D.viewport],['target',D.rt],['D3D',D.d3d]])
      await com('Release allocation fixture '+label,p,2);
    await raw('guest_free',source);
  }
  if(mode==='worker')for(const [n,t,rgb] of [[0,A,colors.A],[1,B,colors.B],[2,A,colors.C]]){
    await ok(call(t,'rs',22,1));
    await fill(t);await start(t);await submit(t,t.version===2?0x1c4:0x44,rgb,{indexed:n===1});
    const held=queue.hold('delayed '+n);await end(t);await finish(t);
    const packet=await queue.packet();check(packet.completed<packet.sequence,'real consumer has not consumed vertices');
    held.sequence=packet.sequence;held.completedBefore=packet.completed;held.device=t.device;report.held.push(held);
    // Reuse the same device's stream and temporary heap allocations while its
    // previous draw remains held; no second batch is submitted until drained.
    await start(t);await submit(t,t.version===2?0x1c4:0x44,colors.C);
    await ok(call(t===A?B:A,'rs',22,2));
    if(negative==='queued-vertices'&&n===0){
      const view=new DataView(packet.vertices.buffer,packet.vertices.byteOffset,packet.vertices.byteLength);
      for(let p=16;p<packet.vertices.byteLength;p+=32)view.setUint32(p,argb(colors.B),true);
      report.mutation={kind:negative,bytes:packet.vertices.byteLength};
    }
    eq(queue.completed(),packet.completed,'still held after caller/storage reuse');queue.drain();
    await witness(t,'queued immutable vertices '+n,rgb);
    held.completedAfter=queue.completed();check(held.completedAfter>=held.sequence,'actual queued draw consumed');
    await end(t);await finish(t);await witness(t,'later reused stream '+n,colors.C);
  }
  // Final Release abandons an active indexed sequence and frees its copies.
  const retired=await create(3);await start(retired);await words(scratch,rows(0x1c4,colors.A)[3]);
  await ok(call(retired,'indexed',4,0x1c4,scratch,1,0));
  eq(await com('final Release unfinished Device3',retired.device,2),0,'unfinished builder released');
  await com('Release retired viewport',retired.viewport,2);await com('Release retired target',retired.rt,2);await com('Release retired D3D',retired.d3d,2);
  const recreated=await create(3);await fails(recreated,'recreated device has no stale sequence','end',[0]);
  await fill(recreated);await start(recreated);await submit(recreated,0x44,colors.B);await end(recreated);await finish(recreated);
  await witness(recreated,'recreated device independent',colors.B);
  for(const [label,p] of [['device',recreated.device],['viewport',recreated.viewport],['target',recreated.rt],['D3D',recreated.d3d]])
    await com('Release recreated '+label,p,2);
  for(const t of targets){await com('Release immediate device',t.device,2);await com('Release immediate viewport',t.viewport,2);
    await com('Release immediate target',t.rt,2);await com('Release immediate D3D',t.d3d,2);}
  use(initial);report.status='PASS';
}

async function main() {
  const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
  const root=path.resolve(__dirname,'..'),{browserFixture,plan,oracle}=require('./test-legacy-texture-rendered-contract');
  const api=require('../src/api_table.json'),base=require('../lib/region-map.generated').BASE;
  const pe=fs.readFileSync(path.join(root,'test/binaries/calc.exe'));
  const config={...plan(),immediate:true,immediateSource:immediateFixture.toString(),noPreview:true,
    thunkBase:base.THUNK_BASE,factoryId:api.find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
  const saved=globalThis.fetch;
  try{for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    globalThis.fetch=async url=>{const p=url==='/legacy-render.wasm'?path.join(root,'build',name):path.join(root,url.slice(1));
      const b=fs.readFileSync(p);return {arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),json:async()=>JSON.parse(b)};};
    const result=await browserFixture('software',config,oracle.toString());assert.equal(result.status,'PASS');
    console.log('PASS real x86 Device2/3 immediate '+name+' '+result.calls.length+' COM records, '+result.observations.length+' pixel checkpoints');
    if(process.env.D3DIM_IMMEDIATE_EVIDENCE){fs.mkdirSync(process.env.D3DIM_IMMEDIATE_EVIDENCE,{recursive:true});
      fs.writeFileSync(path.join(process.env.D3DIM_IMMEDIATE_EVIDENCE,name+'.json'),JSON.stringify(result,null,2)+'\n');}
  }}finally{globalThis.fetch=saved;}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={immediateFixture};
