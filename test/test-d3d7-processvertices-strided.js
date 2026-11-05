'use strict';

// Injected unchanged into the full-module public-x86 COM fixture in Node and
// Chrome. Expected FVF records are authored here without producer helpers.
async function pvsFixture(c) {
  const {mode,negative,evidence,check,eq,raw,read,alloc,write,words,guard,guid,com,ok,acquire,
    hal,dd,texture,texturePalette,surface,lock,unlock,bits,observe,use,initial,countDraw,queue}=c;
  const r=evidence.processVerticesStrided={outputs:[],rejections:[],held:[],attempts:[]};
  const INVALID=0x80070057,FORMAT=0x88760800,OBJECT=0x88760082,BUSY=0x887601ae,UNSUPPORTED=0x80004001;
  const iid=await guid([0xf5049e77,0x11d24861,0xa00007a4,0xa82906c9]);
  const d3d=await acquire(out=>com('QI D3D7 PVS',dd,0,
    // GUID F5049E77-4861-11D2-A407-00A0C90629A8, little-endian DWORDs.
    iid,out));
  function layout(position,normal,colors,dims){
    let fvf=(position===3?2:4)|(normal?16:0)|colors|(dims.length<<8),n=position;
    const normalOffset=normal?n:null;if(normal)n+=3;
    const diffuse=colors&64?n++:null,specular=colors&128?n++:null;
    const tex=dims.map(d=>{const start=n;n+=d;return start;});
    dims.forEach((d,i)=>fvf|=({1:3,2:0,3:1,4:2}[d]<<(16+2*i)));
    return {fvf:fvf>>>0,n,normalOffset,diffuse,specular,tex,dims};
  }
  const snapshot=async(p,n)=>{const a=[];for(let i=0;i<n;i+=4)a.push(await read(p+i));return a;};
  const create=async f=>{const desc=await guard(16);await words(desc.p,[16,0,f.fvf,6]);
    const vb=await acquire(out=>com('CreateVertexBuffer7 PVS',d3d,5,desc.p,out,0));await desc.check();return vb;};
  const vbLock=async vb=>{const out=await guard(4),size=await guard(4);await ok(com('Lock VB PVS',vb,3,0,out.p,size.p));
    await out.check();await size.check();return {p:await read(out.p),size:await read(size.p)};};
  const vbUnlock=vb=>ok(com('Unlock VB PVS',vb,4));
  const makeTarget=async()=>{const rt=await surface(8,8,0x2840),device=await acquire(out=>com('CreateDevice7 PVS',d3d,4,hal,rt,out));return {rt,device};};
  const A=initial,B=await makeTarget();
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],matrix=await alloc(64),viewport=await alloc(24);
  async function state(t,{lighting=0,emissive=[0,0,0],depth=[0,1]}={}){
    await words(viewport,[0,0,8,8,...depth.map(bits)]);await ok(com('SetViewport7 PVS',t.device,13,viewport));
    const world=identity.slice();world[12]=.25;world[13]=-.5;
    const view=identity.slice();view[12]=-.125;view[13]=.25;
    const projection=identity.slice();projection[11]=2;projection[15]=0;
    for(const [id,m] of [[1,world],[2,view],[3,projection]]){await words(matrix,m.map(bits));await ok(com('SetTransform7 PVS',t.device,11,id,matrix));}
    for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[29,0],[41,0],[137,lighting],[139,0],[141,0],[143,0],[145,0],[146,0],[147,0],[148,0]])
      await ok(com('SetRenderState7 PVS',t.device,20,id,v));
    for(const [id,v] of [[1,2],[2,2],[4,2],[5,2],[11,0],[13,1],[14,1],[16,1],[17,1],[18,0],[24,0]])
      await ok(com('SetTextureStageState7 PVS',t.device,37,0,id,v));
    await ok(com('disable stage1 PVS',t.device,37,1,1,1));
    await ok(com('SetTexture7 PVS',t.device,35,0,texture));
    const material=await alloc(68);await words(material,[1,1,1,1,0,0,0,1,0,0,0,0,...emissive,1,0].map(bits));
    await ok(com('SetMaterial7 PVS',t.device,16,material));await raw('guest_free',material);
  }
  await state(A);await state(B);
  const positions=[[-8,-8],[24,-8],[-8,24]],ws=[1,2,4],uv=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
  const sourceRecord=(f,i,{normal=[0,0,1],diffuse=0xffa02060,specular=0x11654321}={})=>{
    // World+view translate by (+.125,-.25,0); projection W is 2*Z.
    const [x,y]=positions[i],w=ws[i],row=[bits((x/4-1)*w-.125),bits((1-y/4)*w+.25),bits(w/2)];
    if(f.normalOffset!==null)row.push(...normal.map(bits));
    if(f.diffuse!==null)row.push(diffuse>>>0);if(f.specular!==null)row.push(specular>>>0);
    f.dims.forEach((d,set)=>row.push(...[...uv[set%4],set+2+i/4,set+5+i/8].slice(0,d).map(bits)));return row;
  };
  async function streams(f,interleaved=false,opts={}){
    const desc=await alloc(96),pairs=Array(24).fill(0),allocations=[];
    const parts=[[0,0,3],[1,f.normalOffset,3],[2,f.diffuse,1],[3,f.specular,1],...f.tex.map((off,i)=>[4+i,off,f.dims[i]])].filter(p=>p[1]!==null);
    if(interleaved){
      const stride=f.n*4+28,p=await alloc(48+stride*5);await words(p,Array((48+stride*5)/4).fill(0xa5a5a5a5));
      for(let i=0;i<3;i++)await words(p+48+(i+1)*stride,sourceRecord(f,i,opts));
      for(const [s,off] of parts){pairs[2*s]=p+48+stride+off*4;pairs[2*s+1]=stride;}allocations.push({p,n:48+stride*5});
    }else for(const [s,off,n] of parts){
      const step=n*4+12,p=await alloc(32+step*5);await words(p,Array((32+step*5)/4).fill(0xa5a5a5a5));
      for(let i=0;i<3;i++)await words(p+32+(i+1)*step,sourceRecord(f,i,opts).slice(off,off+n));
      pairs[s*2]=p+32+step;pairs[s*2+1]=step;allocations.push({p,n:32+step*5});
    }
    if(negative==='stride')pairs[9]=f.dims[0]*4; // first texture's padded stride
    if(negative==='component')pairs[8]=pairs[10]; // texture set0 reads set1
    await words(desc,pairs);
    for(const a of allocations)a.before=await snapshot(a.p,a.n);
    return {desc,pairs,allocations};
  }
  async function unchanged(s){eq(await snapshot(s.desc,96),s.pairs,'descriptor immutable');
    for(const a of s.allocations)eq(await snapshot(a.p,a.n),a.before,'source storage immutable');}
  async function dropStreams(s){for(const a of s.allocations)await raw('guest_free',a.p);await raw('guest_free',s.desc);}
  async function fillVB(vb,f,value=0xcdcdcdcd){const l=await vbLock(vb);eq(l.size,f.n*4*6,'exact FVF allocation');
    await words(l.p,Array(l.size/4).fill(value));await vbUnlock(vb);return l;}
  async function verify(vb,f,expected,label,computed=false){const l=await vbLock(vb),actual=await snapshot(l.p,l.size);await vbUnlock(vb);
    const excludedAlphaWords=[];
    if(computed)for(let i=2;i<5;i++)for(const field of [f.diffuse,f.specular])if(field!==null)excludedAlphaWords.push(i*f.n+field);
    r.outputs.push({label,f,actual,expected,excludedAlphaWords});
    const masked=a=>a.map((v,i)=>excludedAlphaWords.includes(i)?v&0xffffff:v);
    eq(masked(actual),masked(expected),'DESTINATION BYTE ORACLE '+label);return actual;}
  function expected(f,src,opts={},flags=0,lit=null){
    const all=Array(f.n*6).fill(0xcdcdcdcd);
    for(let i=0;i<3;i++){
      const row=all.slice((i+2)*f.n,(i+3)*f.n),[x,y]=positions[i];
      row.splice(0,4,bits(x),bits(y),bits(opts.z??.5),bits(1/ws[i]));
      if(!flags||lit){if(f.diffuse!==null)row[f.diffuse]=lit?lit.diffuse:src.diffuse===null?0:(opts.diffuse??0xffa02060)>>>0;
        if(f.specular!==null)row[f.specular]=lit?lit.specular:src.specular===null?0:(opts.specular??0x11654321)>>>0;}
      if(!flags)f.dims.forEach((d,set)=>{const values=set<src.dims.length?sourceRecord(src,i,opts).slice(src.tex[set],src.tex[set]+src.dims[set]):[];
        for(let j=0;j<d;j++)row[f.tex[set]+j]=values[j]??0;});
      all.splice((i+2)*f.n,f.n,...row);
    }return all;
  }
  const process=async(vb,s,f,t=A,op=1,flags=0,index=2,count=3)=>{
    const vtable=await read(vb),target=await read(vtable+32),args=[vb,op,index,count,s.desc,f.fvf,t.device,flags];
    r.attempts.push({object:vb,slot:8,vtable,target,args});
    return com('ProcessVerticesStrided7',vb,8,op,index,count,s.desc,f.fvf,t.device,flags);
  };
  const indices=await alloc(8);await words(indices,[2,1]); // WORD indices 2,0,1
  async function draw(vb,t,label,{set=0,color=null,sampleUV=null,indexed=false}={}){
    use(t);await ok(com('SetTexture7 PVS draw',t.device,35,0,color?0:texture));
    for(const [id,v] of [[11,set],[1,2],[2,color?0:2]])await ok(com('PVS draw texture stage',t.device,37,0,id,v));
    await ok(com('BeginScene7 PVS',t.device,5));
    if(indexed)await ok(com('DrawIndexedPrimitiveVB7 PVS',t.device,32,4,vb,2,3,indices,3,0));
    else await ok(com('DrawPrimitiveVB7 PVS',t.device,31,4,vb,2,3,0));countDraw();
    await ok(com('EndScene7 PVS',t.device,6));
    const palette=color?[color,color,color,color]:texturePalette;
    await observe(label,{name:'independent selected UV',uv:color?[.25,.25]:sampleUV||uv[set%4]},{filter:1,address:1,palette});
  }
  const layouts=[[[4,3,2,1],[1,2,3,4]],[[1,2,3,4],[1,2,3,4]],[[1],[4,3,2,1]], [[],[]],
    [[1,2,3,4,4,3,2,1],[1,2,3,4,4,3,2,1]]];
  for(const [dims,dstDims] of layouts)for(const interleaved of [false,true]){
    const f=layout(3,false,0xc0,dims),out=layout(4,false,0xc0,dstDims),s=await streams(f,interleaved),vb=await create(out);
    await fillVB(vb,out);await ok(process(vb,s,f));await unchanged(s);
    const label='dims '+dims+' to '+dstDims+' interleaved '+interleaved;
    await verify(vb,out,expected(out,f),label);
    if(dims.length>=4&&dims[0]===1)for(const set of [0,1,2,3,7].filter(set=>set<dims.length))for(const indexed of [false,true])
      await draw(vb,A,label+' selector '+set+' indexed '+indexed,{set,indexed,sampleUV:[uv[set%4][0],dims[set]>=2&&dstDims[set]>=2?uv[set%4][1]:0]});
    if(!dims.length)await draw(vb,A,label,{color:[160,32,96]});
    await fillVB(vb,out);await ok(process(vb,s,f,A,1,1));await verify(vb,out,expected(out,f,{},1),label+' DONOTCOPYDATA');
    await dropStreams(s);eq(await com('Release PVS VB',vb,2),0,'VB final Release');
    eq(await process(vb,{desc:0},f),OBJECT,'released VB rejected before source access');
  }
  // Missing fields and dimension expansion are zero, not draw defaults.
  for(const [rect,minz,maxz,z] of [[[0,0,8,8],.125,.625,.375],[[0,0,8,8],.75,.75,.75],[[1,2,4,4],0,1,.5]]){
    const f=layout(3,false,64,[2]),out=layout(4,false,64,[2]),s=await streams(f),vb=await create(out);
    await words(viewport,[...rect,bits(minz),bits(maxz)]);await ok(com('SetViewport7 nondefault PVS',A.device,13,viewport));
    await fillVB(vb,out);await ok(process(vb,s,f));const bytes=expected(out,f);
    for(let i=0;i<3;i++){const offset=(i+2)*out.n;bytes[offset]=bits(rect[0]+positions[i][0]*rect[2]/8);
      bytes[offset+1]=bits(rect[1]+positions[i][1]*rect[3]/8);bytes[offset+2]=bits(z);}
    await verify(vb,out,bytes,'viewport '+rect+' depth '+minz+','+maxz);await unchanged(s);
    await dropStreams(s);await com('Release viewport PVS VB',vb,2);
  }
  await words(viewport,[0,0,8,8,bits(0),bits(1)]);await ok(com('restore viewport7 PVS',A.device,13,viewport));
  {
    const f=layout(3,false,0,[]),out=layout(4,false,0,[]),s=await streams(f),vb=await create(out);
    s.pairs.fill(0xfffffff0,2);await words(s.desc,s.pairs); // undeclared components are never accessed
    await fillVB(vb,out);await ok(process(vb,s,f));await verify(vb,out,expected(out,f),'position-only XYZ to XYZRHW');
    await unchanged(s);await dropStreams(s);await com('Release position-only VB',vb,2);
  }
  for(const colors of [0,64,128]){
    const f=layout(3,true,colors,[1]),out=layout(4,false,0xc0,[4,2]),s=await streams(f),vb=await create(out);
    await fillVB(vb,out);await ok(process(vb,s,f));await verify(vb,out,expected(out,f),'missing colors '+colors);await unchanged(s);
    await dropStreams(s);await com('Release missing VB',vb,2);
  }
  // Invalid spans/flags/ranges must leave the entire valid destination intact.
  const f=layout(3,true,0xc0,[1,2,3,4]),out=layout(4,false,0xc0,[1,2,3,4]),s=await streams(f),vb=await create(out);
  await fillVB(vb,out);const sentinel=Array(out.n*6).fill(0xcdcdcdcd);
  const reject=async(label,hr,fn)=>{eq(await fn(),hr,'REJECTION '+label);r.rejections.push({label,hr});await verify(vb,out,sentinel,'failure atomic '+label);};
  for(const [label,op,flags,index,count,hr] of [['missing transform',0,0,2,3,INVALID],['unknown operation',0x80000001,0,2,3,INVALID],
    ['unknown flags',1,2,2,3,INVALID],['clip',5,0,2,3,UNSUPPORTED],['extents',9,0,2,3,UNSUPPORTED],
    ['destination end',1,0,6,1,INVALID],['destination overrun',1,0,4,3,INVALID],['count wrap',1,0,2,0xffffffff,INVALID],
    ['index wrap',1,0,0xffffffff,3,INVALID]])await reject(label,hr,()=>process(vb,s,f,A,op,flags,index,count));
  for(const [label,desc] of [['null descriptor',0],['unmapped descriptor',0xfffffff0]])
    await reject(label,INVALID,()=>process(vb,{desc},f));
  for(const [label,fvf] of [['transformed source',0x44],['blended source',0x48],['missing normal LIGHT',0x42],['texture count9',0x942],['reserved flags',0x1001],['undeclared UV dimensions',0x10002]])
    await reject(label,FORMAT,()=>process(vb,s,{fvf},A,label.includes('LIGHT')?0x401:1));
  for(const df of [layout(3,false,64,[]),layout(4,true,64,[])]){
    const invalid=await create(df);await fillVB(invalid,df);
    eq(await process(invalid,s,f),FORMAT,'invalid destination FVF explicit');
    await verify(invalid,df,Array(df.n*6).fill(0xcdcdcdcd),'invalid destination preserved');
    await com('Release invalid-format PVS VB',invalid,2);
  }
  for(const slot of [0,1,2,3,4,5,6,7])for(const [label,pointer,stride] of [['null',0,32],['unmapped',0xfffffff0,32],['short stride',s.pairs[slot*2],1],['wrap stride',s.pairs[slot*2],0xfffffff0]]){
    const pairs=s.pairs.slice();pairs[slot*2]=pointer;pairs[slot*2+1]=stride;await words(s.desc,pairs);
    await reject(label+' stream'+slot,INVALID,()=>process(vb,s,f));await words(s.desc,s.pairs);
  }
  const heldLock=await vbLock(vb);eq(await process(vb,s,f),BUSY,'locked destination fails');eq(await snapshot(heldLock.p,heldLock.size),sentinel,'busy preserves destination');await vbUnlock(vb);
  await reject('null device',OBJECT,()=>process(vb,s,f,{device:0}));await reject('surface as device',OBJECT,()=>process(vb,s,f,{device:A.rt}));
  await reject('unmapped device',OBJECT,()=>process(vb,s,f,{device:0xfffffff0}));
  await reject('released device',OBJECT,async()=>{const t=await makeTarget();await com('Release temporary device',t.device,2);await com('Release temporary rt',t.rt,2);return process(vb,s,f,t);});
  for(const [id,value] of [[24,2],[11,0x10000]]){await ok(com('set unsupported PVS state',A.device,37,0,id,value));
    await reject('unsupported TSS '+id,UNSUPPORTED,()=>process(vb,s,f));await ok(com('restore PVS state',A.device,37,0,id,0));}
  await ok(com('enable unsupported fog PVS',A.device,20,28,1));
  await reject('unsupported fog',UNSUPPORTED,()=>process(vb,s,f));await ok(com('restore fog PVS',A.device,20,28,0));
  await ok(com('enable unsupported high-stage transform PVS',A.device,37,7,24,2));
  await reject('unsupported stage7 transform',UNSUPPORTED,()=>process(vb,s,f));
  await ok(com('restore high-stage transform PVS',A.device,37,7,24,0));
  const zeroMaterial=await alloc(68);await words(zeroMaterial,Array(17).fill(0));
  await ok(com('zero material PVS',A.device,16,zeroMaterial));await ok(com('lighting zero material PVS',A.device,20,137,1));
  await reject('unconfigured light-stage skip',UNSUPPORTED,()=>process(vb,s,f,A,0x401));
  await raw('guest_free',zeroMaterial);await state(A);
  await ok(process(vb,{desc:0},f,A,1,0,6,0));await verify(vb,out,sentinel,'zero at end');
  // A source stream can alias the destination allocation. The full gather
  // must precede output publication even when the first output covers a later
  // source vertex. Public Lock exposes the allocation; no private state edit.
  const af=layout(3,false,0x40,[]),ad=layout(4,false,0x40,[]),av=await create(ad);
  await fillVB(av,ad);const al=await vbLock(av),ap=await alloc(96);
  const aliasPairs=Array(24).fill(0);aliasPairs[0]=al.p;aliasPairs[1]=ad.n*4;aliasPairs[4]=al.p+12;aliasPairs[5]=ad.n*4;
  const aliasBefore=Array(ad.n*6).fill(0xcdcdcdcd);
  for(let i=0;i<3;i++){const row=sourceRecord(af,i);await words(al.p+i*ad.n*4,row);aliasBefore.splice(i*ad.n,row.length,...row);}
  await words(ap,aliasPairs);await vbUnlock(av);await ok(process(av,{desc:ap},af,A,1,0,1,3));
  const aliasExpected=aliasBefore.slice(),baseExpected=expected(ad,af);
  aliasExpected.splice(ad.n,ad.n*3,...baseExpected.slice(ad.n*2,ad.n*5));
  await verify(av,ad,aliasExpected,'overlapping source destination');await com('Release alias VB',av,2);await raw('guest_free',ap);
  // Nonfinal Release must preserve the VB; final release after a lock must
  // not leak that state into subsequently created vertex buffers.
  const life=await create(out);eq(await com('AddRef PVS VB',life,1),2,'VB reference added');
  eq(await com('nonfinal Release PVS VB',life,2),1,'VB nonfinal release');await fillVB(life,out);
  await ok(process(life,s,f));await verify(life,out,expected(out,f),'VB survives nonfinal Release');
  await vbLock(life);eq(await com('final Release locked PVS VB',life,2),0,'locked VB lifetime ends');
  const recreated=await create(out);await fillVB(recreated,out);await ok(process(recreated,s,f));
  await verify(recreated,out,expected(out,f),'recreated VB unlocked');await com('Release recreated PVS VB',recreated,2);
  await fillVB(vb,out);await ok(process(vb,s,f,A,0x401));
  await verify(vb,out,expected(out,f),'LIGHT bypassed by explicit LIGHTING false');
  // Interleaved device materials and normals determine independently known
  // RGB. Opaque diffuse sources avoid inventing an alpha conversion rule.
  await state(A,{lighting:1,emissive:[1,0,0]});await state(B,{lighting:1,emissive:[0,0,1],depth:[.125,.625]});
  if(negative==='state')await state(B,{lighting:1,emissive:[1,0,0],depth:[.125,.625]});
  for(const [t,rgb] of [[B,[0,0,255]],[A,[255,0,0]],[B,[0,0,255]]]){
    await fillVB(vb,out);await ok(process(vb,s,f,t,0x401));
    const opts={z:t===B?.375:.5};
    await verify(vb,out,expected(out,f,opts,0,{diffuse:(0xff000000|(rgb[0]<<16)|(rgb[1]<<8)|rgb[2])>>>0,specular:0}),t===A?'material A':'material B',true);
    await draw(vb,t,'computed emissive '+(t===A?'A':'B'),{color:rgb});
    await fillVB(vb,out);await ok(process(vb,s,f,t,0x401,1));
    await verify(vb,out,expected(out,f,opts,1,{diffuse:(0xff000000|(rgb[0]<<16)|(rgb[1]<<8)|rgb[2])>>>0,specular:0}),
      'LIGHT plus DONOTCOPYDATA '+(t===A?'A':'B'),true);
    await fillVB(vb,out);await ok(process(vb,s,f,t,1));await verify(vb,out,expected(out,f,opts),'TRANSFORM skips lighting '+(t===A?'A':'B'));
  }
  // A unit +Z normal and a -Z directional light contribute green; the
  // opposite normal contributes zero. Values are exact endpoint RGBs.
  await state(A,{lighting:1});
  const light=await alloc(104);
  await words(light,[3,...[0,1,0,0, 0,0,0,0, 0,0,0,0, 0,0,0, 0,0,-1, 100,1,1,0,0,0,0].map(bits)]);
  await ok(com('SetLight7 directional PVS',A.device,18,0,light));
  await ok(com('LightEnable7 directional PVS',A.device,44,0,1));
  for(const [normal,rgb] of [[[0,0,1],[0,255,0]],[[0,0,-1],[0,0,0]]]){
    const sf=layout(3,true,0xc0,[2]),df=layout(4,false,0xc0,[2]),ss=await streams(sf,false,{normal}),vv=await create(df);
    await fillVB(vv,df);await ok(process(vv,ss,sf,A,0x401));
    const color=(0xff000000|(rgb[0]<<16)|(rgb[1]<<8)|rgb[2])>>>0;
    await verify(vv,df,expected(df,sf,{normal},0,{diffuse:color,specular:0}),'directional '+normal,true);
    await draw(vv,A,'directional normal '+normal,{color:rgb});await unchanged(ss);
    await dropStreams(ss);await com('Release directional VB',vv,2);
  }
  await ok(com('LightEnable7 disabled PVS',A.device,44,0,0));await raw('guest_free',light);
  await state(A);await state(B);
  if(c.allocationFailure){
    // The actual allocator is pressured; prepare the COM call before OOM.
    const call=await c.prepareInvoke('PVS actual allocator failure',[vb,1,2,3,s.desc,f.fvf,A.device,0],vb,8);
    await fillVB(vb,out);const pressure=[];let failed=false;
    try{
      for(const n of [0x1000000,0x100000,0x10000,4096,256,128,64]){
        failed=false;
        for(let i=0;i<10000;i++){const p=(await raw('guest_alloc',n))>>>0;if(!p){failed=true;break;}pressure.push(p);}
        check(failed,'finite PVS allocator exhaustion '+n);
      }
      eq(await call(),0x8007000e,'actual PVS OOM explicit');
      r.oom={allocations:pressure.length,hr:0x8007000e};
    }finally{for(const p of pressure)await raw('guest_free',p);}
    await verify(vb,out,sentinel,'OOM destination preserved');await unchanged(s);
    await ok(process(vb,s,f));await verify(vb,out,expected(out,f),'recovery after OOM');
  }
  if(mode==='worker'){
    await fillVB(vb,out);await ok(process(vb,s,f));
    for(const t of [A,B]){
      use(t);await ok(com('bind held texture PVS',t.device,35,0,texture));await ok(com('select held UV PVS',t.device,37,0,11,1));
      queue.hold('PVS source reused');await ok(com('BeginScene held PVS',t.device,5));
      if(t===B)await ok(com('DrawIndexedPrimitiveVB held PVS',t.device,32,4,vb,2,3,indices,3,0));
      else await ok(com('DrawPrimitiveVB held PVS',t.device,31,4,vb,2,3,0));countDraw();await ok(com('EndScene held PVS',t.device,6));
      const packet=await queue.packet(),submitted=Array.from(packet.vertices);r.held.push({sequence:packet.sequence,submitted});
      for(const a of s.allocations)await words(a.p,Array(a.n/4).fill(0x7fc00000));
      await words(s.desc,Array(24).fill(0));await words(indices,[0xffffffff,0xffffffff]);await fillVB(vb,out,0x7fc00000);
      await ok(com('change live selected set PVS',t.device,37,0,11,3));
      if(negative==='queued')packet.vertices.fill(0);
      else eq(Array.from(packet.vertices),submitted,'queued data owned after storage reuse');
      queue.drain();await observe('queued immutable PVS '+(t===A?'A':'B'),{name:'selected set1',uv:uv[1]},{filter:1,address:1});
      // Restore real source arrays for the second device's independent draw.
      for(const a of s.allocations)await words(a.p,a.before);await words(s.desc,s.pairs);await words(indices,[2,1]);
      await ok(process(vb,s,f));
    }
  }
  await dropStreams(s);await com('Release final PVS VB',vb,2);await raw('guest_free',indices);
  use(A);await com('Release secondary PVS device',B.device,2);await com('Release secondary PVS target',B.rt,2);await com('Release PVS D3D',d3d,2);
}

// Prepared addition only; not an executable test until ordered runtime release.
async function viewportDepthFixture(c) {
  const {mode,negative,evidence,check,eq,raw,read,alloc,words,guard,guid,com,ok,acquire,
    dd,hal,surface,bits,observe,use,initial,countDraw,queue}=c;
  const r=evidence.viewportDepth={outputs:[],held:[],failures:[]};
  const d3d=await acquire(async out=>com('depth QI D3D7',dd,0,
    await guid([0xf5049e77,0x11d24861,0xa00007a4,0xa82906c9]),out));
  const A=initial,B={rt:await surface(8,8,0x2840)};
  B.device=await acquire(out=>com('depth CreateDevice7',d3d,4,hal,B.rt,out));
  const matrix=await alloc(64),vp=await alloc(24),desc=await alloc(96),tl=await alloc(60),indices=await alloc(8);
  const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const positions=[[-8,-8],[24,-8],[-8,24]],ws=[1,2,4];
  const sourceRows=positions.map(([x,y],i)=>[
    bits((x/4-1)*ws[i]-.125),bits((1-y/4)*ws[i]+.25),bits(ws[i]/2),0xff20c040]);
  const normalized=[.25,.1875,.15625]; // Zc=.25*Z+.125; Wc=2*Z.
  const snap=async(p,n)=>{const a=[];for(let i=0;i<n;i+=4)a.push(await read(p+i));return a;};
  const vbCreate=async fvf=>{const d=await guard(16);await words(d.p,[16,0,fvf,6]);
    const vb=await acquire(out=>com('depth CreateVB7',d3d,5,d.p,out,0));await d.check();return vb;};
  const vbLock=async vb=>{const p=await guard(4),n=await guard(4);await ok(com('depth LockVB',vb,3,0,p.p,n.p));
    await p.check();await n.check();return {p:await read(p.p),n:await read(n.p)};};
  const vbUnlock=vb=>ok(com('depth UnlockVB',vb,4));
  let src=await vbCreate(0x42),dst=await vbCreate(0x44);
  let source=await vbLock(src);eq(source.n,96,'source capacity');
  await words(source.p,Array(24).fill(0xa5a5a5a5));
  for(let i=0;i<3;i++)await words(source.p+(i+1)*16,sourceRows[i]);await vbUnlock(src);
  const sourceBefore=await snap(source.p,source.n);
  // Equivalent strided source starts at vertex1 with its own explicit stride.
  await words(desc,Array(24).fill(0));await words(desc,[source.p+16,16]);await words(desc+16,[source.p+28,16]);
  await words(indices,[2,1]); // WORD indices 2,0,1.
  async function configure(t,rect,range){
    await words(vp,[...rect,...range.map(bits)]);await ok(com('depth SetViewport7',t.device,13,vp));
    const got=await guard(24);await ok(com('depth GetViewport7',t.device,15,got.p));await got.check();
    eq(await snap(got.p,24),[...rect,...range.map(bits)],'independent public viewport round trip');
    const world=I.slice();world[12]=.25;world[13]=-.5;
    const view=I.slice();view[12]=-.125;view[13]=.25;
    const proj=I.slice();proj[10]=.25;proj[14]=.125;proj[11]=2;proj[15]=0;
    for(const [id,m] of [[1,world],[2,view],[3,proj]]){await words(matrix,m.map(bits));await ok(com('depth SetTransform7',t.device,11,id,matrix));}
    for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[29,0],[137,0],[141,0]])
      await ok(com('depth SetRenderState7',t.device,20,id,v));
    await ok(com('depth no texture',t.device,35,0,0));
    for(const [id,v] of [[1,2],[2,0],[4,2],[5,0],[11,0],[24,0]])await ok(com('depth TSS7',t.device,37,0,id,v));
    await ok(com('depth disable stage1',t.device,37,1,1,1));
  }
  const process=(method,t,flags=0)=>method==='strided'
    ?com('depth ProcessVerticesStrided7',dst,8,1,2,3,desc,0x42,t.device,flags)
    :com('depth ProcessVertices7',dst,5,1,2,3,src,1,t.device,flags);
  const fill=async()=>{const l=await vbLock(dst);eq(l.n,120,'destination capacity');await words(l.p,Array(30).fill(0xcdcdcdcd));await vbUnlock(dst);};
  function expected(rect,range,flags){
    const out=Array(30).fill(0xcdcdcdcd);
    for(let i=0;i<3;i++)out.splice((i+2)*5,5,
      bits(rect[0]+positions[i][0]*rect[2]/8),bits(rect[1]+positions[i][1]*rect[3]/8),
      bits(range[0]+(range[1]-range[0])*normalized[i]),bits(1/ws[i]),flags?0xcdcdcdcd:0xff20c040);
    return out;
  }
  async function verify(method,t,rect,range,flags){
    const l=await vbLock(dst),actual=await snap(l.p,l.n);await vbUnlock(dst);
    const wanted=expected(rect,range,flags),label=method+' '+rect+' '+range+' flags'+flags;
    r.outputs.push({label,actual,expected:wanted});eq(actual,wanted,'DEPTH DESTINATION BYTE ORACLE '+label);
  }
  for(const [t,rect,range] of [[A,[1,2,4,4],[.125,.625]],[B,[0,0,8,8],[.625,.875]],
    [A,[0,0,8,8],[.75,.75]],[B,[2,1,4,6],[0,0]],[A,[0,0,8,8],[1,1]],
    [B,[0,0,8,8],[0,1]]]){
    await configure(t,rect,range);
    for(const method of ['buffer','strided'])for(const flags of [0,1]){
      await fill();await ok(process(method,t,flags));await verify(method,t,rect,range,flags);
    }
  }
  eq(await snap(source.p,source.n),sourceBefore,'both processing methods preserve entire source');
  await configure(A,[1,2,4,4],[.125,.625]);await configure(B,[0,0,8,8],[.625,.875]);
  for(const [t,rect,range] of [[A,[1,2,4,4],[.125,.625]],[B,[0,0,8,8],[.625,.875]],[A,[1,2,4,4],[.125,.625]]])
    for(const method of ['buffer','strided']){
      await fill();await ok(process(method,t));await verify(method,t,rect,range,0);
    }
  // Independent depth competition: normalized Z is <.5 but mapped Z is >.5.
  // The red .5 triangle must occlude processed green. Incorrect raw or twice
  // mapped depths have separate byte discrimination above; raw control here
  // must be rejected specifically by the final pixel oracle.
  async function submit(t,indexed){
    const device=negative==='secondary-route'&&t===B?A.device:t.device;
    await ok(com('depth BeginScene',device,5));
    if(indexed)await ok(com('depth DrawIndexedVB',device,32,4,dst,2,3,indices,3,0));
    else await ok(com('depth DrawVB',device,31,4,dst,2,3,0));
    countDraw();await ok(com('depth EndScene',device,6));
  }
  async function competing(t){
    use(t);await ok(com('depth zenable',t.device,20,7,1));await ok(com('depth zwrite',t.device,20,14,1));
    await ok(com('depth zfunc LESS',t.device,20,23,2));
    await ok(com('depth Clear7',t.device,10,0,0,3,0xff000000,bits(1),0));
    const rows=positions.flatMap(([x,y])=>[bits(x),bits(y),bits(.5),bits(1),0xffd03020]);await words(tl,rows);
    await ok(com('depth competitor BeginScene',t.device,5));await ok(com('depth competitor DrawPrimitive7',t.device,25,4,0x44,tl,3,0));
    countDraw();await ok(com('depth competitor EndScene',t.device,6));
  }
  async function pixels(label,color=[208,48,32]){await observe(label,{name:'independent target/depth color',uv:[.25,.25]},
    {filter:1,address:1,palette:Array(4).fill(color)});}
  for(const method of ['buffer','strided'])for(const range of [[.625,.875],[.75,.75]]){
    await configure(A,[0,0,8,8],range);await fill();await ok(process(method,A));
    await competing(A);
    if(negative==='depth'){
      const l=await vbLock(dst);for(let i=0;i<3;i++)await words(l.p+(i+2)*20+8,[bits(normalized[i])]);await vbUnlock(dst);
    }
    await submit(A,false);await pixels('viewport depth '+method+' '+range);
  }
  // Both ordinary and indexed public draws retain independent target depths.
  for(const indexed of [false,true]){
    await configure(A,[0,0,8,8],[.25,.25]);await competing(A);
    await configure(B,[0,0,8,8],[0,0]);await competing(B);
    await fill();await ok(process('strided',B));await submit(B,indexed);
    await pixels('secondary routing green '+indexed,[32,192,64]);
    use(A);await pixels('other target retained red '+indexed);
    if(negative==='shared-depth')await ok(com('adversarial other-target depth contamination',A.device,10,0,0,2,0,bits(0),0));
    await fill();await ok(process('buffer',A));await submit(A,indexed);
    await pixels('independent target depth green '+indexed,[32,192,64]);
    use(B);await pixels('secondary retained green '+indexed,[32,192,64]);
  }
  if(mode==='worker'){
    r.buffered=[];
    for(const indexed of [false,true]){
      await configure(B,[0,0,8,8],[.625,.875]);await fill();await ok(process('strided',B));
      use(B);queue.hold('busy secondary competitor '+indexed);await competing(B);
      const red=await queue.packet();
      eq(new DataView(red.vertices.buffer,red.vertices.byteOffset,red.vertices.byteLength).getUint32(16,true),0xffd03020,
        'controlled predecessor is red competitor');
      const before=queue.snapshot();await submit(B,indexed);const after=queue.snapshot();
      eq(queue.pendingPackets(),1,'small green draw remains producer-buffered behind held red');
      eq(after.submitted,before.submitted,'public secondary enqueue does not promise immediate submission');
      const z=bits(.625+.25*normalized[indexed?2:0]);
      check(after.buffers.some((slot,j)=>slot.header[1]===B.device&&slot.firstVertex[2]===z&&
        slot.firstVertex[4]===0xff20c040&&JSON.stringify(slot)!==JSON.stringify(before.buffers[j])),
        'public secondary green canonical bytes copied into changed producer slot');
      r.buffered.push({indexed,device:B.device,rt:B.rt,redSequence:red.sequence,before,after});
      queue.drain();await pixels('public buffered secondary '+indexed);
    }
  }
  if(mode==='worker')for(const t of [A,B])for(const [i,method] of ['buffer','strided'].entries()){
    await configure(t,[0,0,8,8],[.625,.875]);await fill();await ok(process(method,t));await competing(t);
    // Offscreen EndScene need not submit a small draw while its predecessor is
    // busy. Public readback completes/verifies that predecessor before holding
    // the next packet; target routing and production batching stay unchanged.
    await pixels('held competitor '+(t===A?'A':'B')+' '+method);
    await verify(method,t,[0,0,8,8],[.625,.875],0);eq(await snap(indices,8),[2,1],'held draw exact public indices');
    queue.hold('viewport depth storage reuse '+method);await submit(t,!!i);
    const packet=await queue.packet(),before=Array.from(packet.vertices);
    r.held.push({method,indexed:!!i,device:t.device,rt:t.rt,sequence:packet.sequence,before});
    const sl=await vbLock(src);await words(sl.p,Array(sl.n/4).fill(0x7fc00000));await vbUnlock(src);
    await words(desc,Array(24).fill(0));await words(indices,[0xffffffff,0xffffffff]);await fill();
    const oldSource=src,oldDestination=dst,oldStorage=await vbLock(dst);await vbUnlock(dst);
    eq(await com('depth release held source',src,2),0,'source VB final release while render held');
    eq(await com('depth release held destination',dst,2),0,'destination VB final release while render held');
    src=await vbCreate(0x42);dst=await vbCreate(0x44);await fill();
    const reused=await vbLock(src);await words(reused.p,Array(reused.n/4).fill(0x7fc00000));await vbUnlock(src);
    r.held.at(-1).storageReuse={oldSource,oldDestination,oldStorage,newSource:src,newDestination:dst,newSourceStorage:reused};
    await words(vp,[0,0,8,8,bits(0),bits(0)]);await ok(com('depth change live viewport',t.device,13,vp));
    if(negative==='depth-queued'||(t===B&&negative===(i?'secondary-indexed-queued':'secondary-queued'))){
      // Queue vertices are canonical 32-byte records; corrupt only depth.
      const d=new DataView(packet.vertices.buffer,packet.vertices.byteOffset,packet.vertices.byteLength);
      for(let n=8;n<d.byteLength;n+=32)d.setFloat32(n,.125,true);
    }else eq(Array.from(packet.vertices),before,'queued depth survives original storage reuse');
    queue.drain();await pixels('queued viewport depth '+(t===A?'A':'B')+' '+method);
    const l=await vbLock(src);for(let j=0;j<3;j++)await words(l.p+(j+1)*16,sourceRows[j]);await vbUnlock(src);
    await words(desc,Array(24).fill(0));await words(desc,[l.p+16,16]);await words(desc+16,[l.p+28,16]);await words(indices,[2,1]);
  }
  // Preserve existing buffer-method errors and source bytes on valid paths.
  eq(await com('depth PV invalid source index',dst,5,1,2,1,src,6,A.device,0),0x80070057,'PV source overrun');
  eq(await com('depth PV null source',dst,5,1,2,1,0,1,A.device,0),0x80004003,'PV null source');
  // A complete FVF tail distinguishes DONOTCOPYDATA from default copying.
  // Explicit supplied diffuse/specular avoids computed-alpha qualification.
  await configure(A,[0,0,8,8],[.125,.625]);
  const tailSrc=await vbCreate(0x1c2),tailDst=await vbCreate(0x1c4),ts=await vbLock(tailSrc);
  eq(ts.n,168,'tail source stride');await words(ts.p,Array(42).fill(0xa5a5a5a5));
  for(let i=0;i<3;i++)await words(ts.p+(i+1)*28,[...sourceRows[i],0x12345678,bits(.25+i/8),bits(.75-i/8)]);
  const tailBefore=await snap(ts.p,ts.n);await vbUnlock(tailSrc);
  for(const op of [1,0x401])for(const flags of [0,1]){
    const l=await vbLock(tailDst);eq(l.n,192,'tail destination stride');await words(l.p,Array(48).fill(0xcdcdcdcd));await vbUnlock(tailDst);
    await ok(com('depth PV tail DONOTCOPYDATA',tailDst,5,op,2,3,tailSrc,1,A.device,flags));
    const wanted=Array(48).fill(0xcdcdcdcd);
    for(let i=0;i<3;i++)wanted.splice((i+2)*8,8,bits(positions[i][0]),bits(positions[i][1]),
      bits(.125+.5*normalized[i]),bits(1/ws[i]),
      ...(flags?Array(4).fill(0xcdcdcdcd):[0xff20c040,0x12345678,bits(.25+i/8),bits(.75-i/8)]));
    const got=await vbLock(tailDst),actual=await snap(got.p,got.n);await vbUnlock(tailDst);
    r.outputs.push({label:'PV supplied tail op'+op+' flags'+flags,actual,expected:wanted});eq(actual,wanted,'DEPTH DESTINATION BYTE ORACLE PV tail');
    eq(await snap(ts.p,ts.n),tailBefore,'PV tail source immutable');
  }
  const litSrc=await vbCreate(0x1d2),ls=await vbLock(litSrc),material=await alloc(68);
  eq(ls.n,240,'lit source stride');await words(ls.p,Array(60).fill(0xa5a5a5a5));
  for(let i=0;i<3;i++)await words(ls.p+(i+1)*40,[...sourceRows[i].slice(0,3),bits(0),bits(0),bits(1),
    sourceRows[i][3],0x12345678,bits(.25+i/8),bits(.75-i/8)]);
  await vbUnlock(litSrc);
  await words(material,[0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,1,0].map(bits));
  await ok(com('depth PV emissive material',A.device,16,material));await ok(com('depth PV enable lighting',A.device,20,137,1));
  for(const flags of [0,1]){
    const l=await vbLock(tailDst);await words(l.p,Array(48).fill(0xcdcdcdcd));await vbUnlock(tailDst);
    await ok(com('depth PV LIGHT DONOTCOPYDATA',tailDst,5,0x401,2,3,litSrc,1,A.device,flags));
    const wanted=Array(48).fill(0xcdcdcdcd),excluded=[];
    for(let i=0;i<3;i++){
      wanted.splice((i+2)*8,8,bits(positions[i][0]),bits(positions[i][1]),bits(.125+.5*normalized[i]),bits(1/ws[i]),
        0xffff0000,0,...(flags?[0xcdcdcdcd,0xcdcdcdcd]:[bits(.25+i/8),bits(.75-i/8)]));
      excluded.push((i+2)*8+4,(i+2)*8+5);
    }
    const l2=await vbLock(tailDst),actual=await snap(l2.p,l2.n);await vbUnlock(tailDst);
    const mask=a=>a.map((v,i)=>excluded.includes(i)?v&0xffffff:v);
    r.outputs.push({label:'PV computed RGB tail flags'+flags,actual,expected:wanted,excludedAlphaWords:excluded});
    eq(mask(actual),mask(wanted),'DEPTH DESTINATION BYTE ORACLE PV computed RGB tail');
  }
  await raw('guest_free',material);await com('depth Release lit source',litSrc,2);
  await com('depth Release tail source',tailSrc,2);await com('depth Release tail destination',tailDst,2);
  await com('depth Release source',src,2);await com('depth Release destination',dst,2);
  await com('depth Release B device',B.device,2);await com('depth Release B target',B.rt,2);await com('depth Release D3D7',d3d,2);
  for(const p of [matrix,vp,desc,tl,indices])await raw('guest_free',p);use(A);
}


module.exports={pvsFixture,viewportDepthFixture};

// The same public COM fixture runs against both shipped modules.
async function main(){
  const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
  const root=path.resolve(__dirname,'..'),{browserFixture,plan,oracle}=require('./test-legacy-texture-rendered-contract');
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  const pe=fs.readFileSync(path.join(root,'test/binaries/calc.exe'));
  const source=`async c=>{await (${pvsFixture.toString()})(c);await (${viewportDepthFixture.toString()})(c);}`;
  const config={...plan(),immediate:true,immediateSource:source,noPreview:!process.argv.includes('--browser'),
    thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
  const dir=process.env.D3D7_PVS_EVIDENCE;
  if(dir)fs.mkdirSync(dir,{recursive:true});
  const save=(name,value)=>{if(dir)fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)+'\n');};
  const modules=['wine-assembly.wasm','wine-assembly.compat.wasm'];
  save('inputs.json',{source:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    modules:modules.map(name=>({path:'build/'+name,sha256:hash(fs.readFileSync(path.join(root,'build',name)))})),
    media:{path:'test/binaries/calc.exe',sha256:hash(pe)}});
  const negatives=['stride','component','state','depth','secondary-route','shared-depth'];
  const failureOracle=negative=>({
    queued:/PIXEL ORACLE queued immutable PVS/,
    depth:/PIXEL ORACLE viewport depth/,
    'depth-queued':/PIXEL ORACLE queued viewport depth A buffer/,
    'secondary-route':/PIXEL ORACLE secondary routing green/,
    'shared-depth':/PIXEL ORACLE independent target depth green/,
    'secondary-queued':/PIXEL ORACLE queued viewport depth B buffer/,
    'secondary-indexed-queued':/PIXEL ORACLE queued viewport depth B strided/,
  })[negative]||/DESTINATION BYTE ORACLE/;
  if(!process.argv.includes('--browser')){
    const saved=globalThis.fetch;
    try{for(const name of modules){
      globalThis.fetch=async url=>{const p=url==='/legacy-render.wasm'?path.join(root,'build',name):path.join(root,url.slice(1));
        const b=fs.readFileSync(p);return {arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),json:async()=>JSON.parse(b)};};
      let result;
      try{result=await browserFixture('software',config,oracle.toString());}
      catch(error){save(name+'-failure.json',{error:String(error),partial:globalThis.legacyTextureEvidence});throw error;}
      assert.equal(result.status,'PASS');save(name+'.json',result);
      console.log('PASS real x86 PVS '+name+' '+result.calls.length+' COM records '+result.observations.length+' pixel checkpoints');
      for(const negative of negatives){let failure;try{await browserFixture('software',config,oracle.toString(),negative);}catch(e){failure=e;}
        const partial=globalThis.legacyTextureEvidence;save(name+'-negative-'+negative+'.json',{failure:String(failure),partial});
        assert.match(String(failure),failureOracle(negative),'designated oracle must discriminate '+negative);
        assert(partial.calls.some(x=>x.label==='ProcessVerticesStrided7'&&x.result===0),'successful faulty public call');
      }
    }}finally{globalThis.fetch=saved;}
    return;
  }
  assert(dir,'D3D7_PVS_EVIDENCE required for browser captures');
  const {startStaticServer,closeServer}=require('./static-server'),puppeteer=require('puppeteer');
  const scripts=['lib/region-map.generated.js','lib/gl-command-stream.js','lib/d3d-command-stream.js','lib/guest-rpc.js',
    'lib/guest-thread-host.js','lib/render-worker.js','lib/gpu-backend.js','lib/d3d9-shader.js','lib/d3d-shader-ir.js',
    'lib/d3d9-fixed.js','lib/d3d9-texture.js','lib/render-clear.js','lib/d3d9-backend.js','lib/d3dim-gpu.js'];
  let wasm,browser,server,page,deadline;const report={cells:[],negativeControls:[]};
  try{
    server=await startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url!=='/pvs-fixture')return false;
      res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(p=>'<script src="/'+p+'"></script>').join('\n'));return true;
    }});
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/chromium',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    const child=browser.process();report.process={pid:child.pid,startTicks:fs.readFileSync('/proc/'+child.pid+'/stat','utf8').split(') ')[1].split(' ')[19],
      profile:child.spawnargs.find(a=>a.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length)};
    child.once('exit',(code,signal)=>{report.process.exit={code,signal,at:new Date().toISOString()};});
    report.serverAddress=server.address();report.devtools=browser.wsEndpoint();report.browser=await browser.version();
    deadline=setTimeout(()=>{report.deadlineExceeded=true;browser.close().catch(()=>{});},360000);
    for(const name of modules){wasm=fs.readFileSync(path.join(root,'build',name));
      for(const mode of ['software','webgl','worker']){
        page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/pvs-fixture');
        const result=await page.evaluate(browserFixture,mode,config,oracle.toString());assert.equal(result.status,'PASS');
        save(name+'-'+mode+'.json',result);report.cells.push({name,mode,moduleSha256:hash(wasm),calls:result.calls.length,pixels:result.observations.length});
        await page.screenshot({path:path.join(dir,name+'-'+mode+'.png'),fullPage:true});await page.close();page=null;
        console.log('PASS rendered PVS '+name+' '+mode);
      }
      for(const negative of ['stride','component','state','queued','depth','depth-queued','secondary-route','shared-depth','secondary-queued','secondary-indexed-queued']){
        const mode=['queued','depth-queued','secondary-queued','secondary-indexed-queued'].includes(negative)?'worker':'software';page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/pvs-fixture');
        let failure;try{await page.evaluate(browserFixture,mode,config,oracle.toString(),negative);}catch(e){failure=String(e);}
        const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);save(name+'-browser-negative-'+negative+'.json',{failure,partial});
        assert.match(failure,failureOracle(negative));
        report.negativeControls.push({name,negative,failure});await page.close();page=null;
      }
    }report.status='PASS';
  }catch(error){report.status='FAIL';report.error=String(error);if(page){save('failure-partial.json',await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null));
    await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});}throw error;
  }finally{
    clearTimeout(deadline);
    try{if(browser)await browser.close();if(server)await closeServer(server);
      if(browser)assert.deepEqual([report.process.exit?.code,report.process.exit?.signal],[0,null],'normal Chrome exit');}
    finally{report.cleanupAt=new Date().toISOString();save('browser-result.json',report);}
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
