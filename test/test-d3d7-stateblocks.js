#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
// Public x86 COM calls from the established Device7/Surface7 acquisition harness.
// No production state helpers are called by the state/pixel oracle.
const base=require('./test-legacy-texture-rendered-contract');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');

async function stateblockCases(){
  const snapshot=async(p,n)=>Array.from(new Uint8Array(memory.buffer,await wa(p),n));
  const rs=(id,v,obj=device)=>ok(com('SetRenderState '+id,obj,20,id,v));
  const get=async(slot,args=[],n=4,obj=device)=>{const out=await guard(n);await ok(com('read '+slot,obj,slot,...args,out.p));await out.check();return snapshot(out.p,n);};
  const readScalar=async(slot,args=[],obj=device)=>{const b=await get(slot,args,4,obj);return (b[0]|b[1]<<8|b[2]<<16|b[3]<<24)>>>0;};
  const readRS=id=>readScalar(21,[id]);
  const begin=(obj=device)=>ok(com('BeginStateBlock',obj,22));
  const end=async(obj=device)=>{const out=await guard(4);await ok(com('EndStateBlock',obj,23,out.p));await out.check();return read(out.p);};
  const apply=(token,obj=device)=>ok(com('ApplyStateBlock',obj,39,token));
  const capture=(token,obj=device)=>ok(com('CaptureStateBlock',obj,40,token));
  const remove=(token,obj=device)=>ok(com('DeleteStateBlock',obj,41,token));
  const create=async type=>{const out=await guard(4);await ok(com('CreateStateBlock '+type,device,42,type,out.p));await out.check();return read(out.p);};
  const record=async action=>{await begin();await action();return end();};
  const setTSS=(stage,id,v)=>ok(com('SetTSS '+stage+'/'+id,device,37,stage,id,v));
  const getTSS=(stage,id)=>readScalar(36,[stage,id]);
  const structure=async(values)=>{const p=await alloc(values.length*4);await words(p,values);return p;};
  const material=v=>[v,0,0,1, 0,v,0,1, 0,0,v,1, v,0,v,1, 0].map(bits);
  const light=v=>[3,...[v,0,0,1, 0,v,0,1, 0,0,v,1, 0,0,0, 0,0,-1, 100,1,1,0,0,0,0].map(bits)];
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const matrix=v=>identity.map((x,i)=>bits(i===12?v:x));
  evidence.stateblocks={cases:[],pixels:[],typedMembership:'DX7 SDK lists; ALL-only typed objects resolved from static DX7 4.7.0.700 evidence; documented VERTEX transform/plane behavior retained',nativeBlockRefcounts:null};
  const passed=name=>evidence.stateblocks.cases.push(name);

  await rs(9,2);await rs(14,1);
  await begin();await rs(9,1);await rs(9,2);await rs(9,1);
  eq(await readRS(9),2,'RECORDING LIVE ISOLATION');
  const single=await end();eq(await readRS(9),2,'End leaves live state');
  await rs(14,0);await apply(single);eq(await readRS(9),1,'last write wins');eq(await readRS(14),0,'selective Apply unrelated RS');
  await rs(9,2);await rs(14,1);await capture(single);await rs(9,1);await rs(14,0);await apply(single);
  eq(await readRS(9),2,'selective Capture value');eq(await readRS(14),0,'selective Capture membership');await remove(single);
  const empty=await record(async()=>{});await rs(9,1);await rs(14,0);await apply(empty);eq(await readRS(9),1,'empty shade unchanged');eq(await readRS(14),0,'empty zwrite unchanged');await remove(empty);
  passed('recording isolation, empty block, last write, selective Capture/Apply');

  await setTSS(0,2,1);await setTSS(1,2,1);await setTSS(0,3,1);
  const stages=await record(()=>setTSS(0,2,2));await setTSS(1,2,2);await setTSS(0,3,2);await apply(stages);
  eq(await getTSS(0,2),2,'stage0 member');eq(await getTSS(1,2),2,'independent stage');eq(await getTSS(0,3),2,'independent TSS ID');
  await setTSS(0,2,1);await capture(stages);await setTSS(0,2,2);await setTSS(1,2,1);await apply(stages);
  eq(await getTSS(0,2),1,'TSS captured');eq(await getTSS(1,2),1,'TSS Capture fixed stage mask');await remove(stages);
  for(const [setter,getter,size,first,second] of [[46,47,16,[1,0,0,0],[0,1,0,0]]]){
    const a=await structure(first.map(bits)),b=await structure(second.map(bits));
    await ok(com('seed plane0',device,setter,0,a));await ok(com('seed plane1',device,setter,1,a));
    const block=await record(()=>ok(com('record plane0',device,setter,0,b)));
    await ok(com('mutate plane1',device,setter,1,b));await apply(block);
    eq(await get(getter,[0],size),await snapshot(b,size),'plane0 applied');eq(await get(getter,[1],size),await snapshot(b,size),'plane1 untouched');
    await ok(com('live plane0',device,setter,0,a));await capture(block);await ok(com('live plane0 second',device,setter,0,b));await ok(com('live plane1 second',device,setter,1,a));await apply(block);
    eq(await get(getter,[0],size),await snapshot(a,size),'plane0 captured');eq(await get(getter,[1],size),await snapshot(a,size),'plane1 capture excluded');await remove(block);
  }
  await ok(com('disable0',device,44,0,0));await ok(com('disable1',device,44,1,0));
  const enables=await record(()=>ok(com('enable0',device,44,0,1)));await ok(com('enable1 live',device,44,1,1));await apply(enables);
  eq(await readScalar(45,[0]),1,'enable0 applied');eq(await readScalar(45,[1]),1,'enable1 independent');
  await ok(com('disable0 live',device,44,0,0));await capture(enables);await ok(com('enable0 again',device,44,0,1));await ok(com('disable1 live',device,44,1,0));await apply(enables);
  eq(await readScalar(45,[0]),0,'enable0 captured');eq(await readScalar(45,[1]),0,'enable1 capture excluded');await remove(enables);
  passed('independent stage, TSS ID, plane and light-enable membership masks');

  const typed=[
    {name:'material',set:16,get:17,args:[],values:[material(0),material(1),material(.5)],n:68},
    {name:'light0',set:18,get:19,args:[0],values:[light(0),light(1),light(.5)],n:104},
    {name:'texture matrix0',set:11,get:12,args:[16],values:[matrix(0),matrix(1),matrix(2)],n:64},
    {name:'viewport',set:13,get:15,args:[],values:[[0,0,8,8,bits(0),bits(1)],[1,1,6,6,bits(.25),bits(.75)],[2,2,4,4,bits(0),bits(1)]],n:24}
  ];
  for(const t of typed){
    const inputs=await Promise.all(t.values.map(structure));
    await ok(com('seed '+t.name,device,t.set,...t.args,inputs[0]));
    const before=await get(t.get,t.args,t.n),saved=await snapshot(inputs[1],t.n);
    await begin();await ok(com('record '+t.name,device,t.set,...t.args,inputs[1]));
    await bytes(inputs[1],Array(t.n).fill(0xa7));eq(await get(t.get,t.args,t.n),before,'typed recording getter '+t.name);
    const block=await end();await ok(com('mutate '+t.name,device,t.set,...t.args,inputs[2]));await apply(block);
    eq(await get(t.get,t.args,t.n),saved,'owned caller value '+t.name);
    await ok(com('capture seed '+t.name,device,t.set,...t.args,inputs[0]));await capture(block);
    await ok(com('after capture '+t.name,device,t.set,...t.args,inputs[2]));await apply(block);
    eq(await get(t.get,t.args,t.n),before,'indirect Capture '+t.name);await remove(block);
  }
  for(const t of typed.filter(t=>t.name==='light0'||t.name==='texture matrix0')){
    const [a,b,c]=await Promise.all(t.values.map(structure)),idx=t.args[0];
    await ok(com('seed independent0',device,t.set,idx,a));await ok(com('seed independent1',device,t.set,idx+1,a));
    const block=await record(()=>ok(com('record independent0',device,t.set,idx,b)));
    await ok(com('change independent1',device,t.set,idx+1,c));await apply(block);
    eq(await get(t.get,[idx],t.n),await snapshot(b,t.n),'indirect selected index');
    eq(await get(t.get,[idx+1],t.n),await snapshot(c,t.n),'indirect excluded index');
    await ok(com('capture independent0',device,t.set,idx,a));await capture(block);
    await ok(com('mutate independent0',device,t.set,idx,b));await ok(com('mutate independent1',device,t.set,idx+1,b));await apply(block);
    eq(await get(t.get,[idx],t.n),await snapshot(a,t.n),'indirect captured selected index');
    eq(await get(t.get,[idx+1],t.n),await snapshot(b,t.n),'indirect Capture excluded index');await remove(block);
  }
  await setTSS(0,24,0);await setTSS(1,24,2);
  const flags=await record(()=>setTSS(0,24,3));eq(await getTSS(0,24),0,'flags isolated');await setTSS(1,24,4);await apply(flags);
  eq(await getTSS(0,24),3,'flags owned');eq(await getTSS(1,24),4,'other flags independent');await remove(flags);
  passed('owned material, indirect lights/matrices, viewport and flags; selective recapture');

  const boundTexture=async()=>{const p=await guard(4);await ok(com('GetTexture0',device,34,0,p.p));await p.check();const obj=await read(p.p);if(obj)await com('release GetTexture reference',obj,2);return obj;};
  const ordinary=await surface(2,2,0x1800);await ok(com('ordinary bind',device,35,0,ordinary));await com('ordinary caller release',ordinary,2);eq(await boundTexture(),ordinary,'ordinary SetTexture owns resource');await ok(com('ordinary unbind',device,35,0,0));
  const retained=await surface(2,2,0x1800);await ok(com('bind original texture',device,35,0,texture));
  const textureBlock=await record(()=>ok(com('record texture binding',device,35,0,retained)));
  eq(await boundTexture(),texture,'texture recording live isolation');await com('caller releases recorded surface',retained,2);
  await apply(textureBlock);eq(await boundTexture(),retained,'recorded texture remains usable after caller release');
  await ok(com('live original texture',device,35,0,texture));await capture(textureBlock);await ok(com('live NULL texture',device,35,0,0));
  await apply(textureBlock);eq(await boundTexture(),texture,'Capture replaces selected retained binding');await remove(textureBlock);
  passed('recorded texture resource lifetime and selective binding Capture; native exact refcounts unasserted');

  // Versioned overlap oracle authored from the DX7 SDK lists, not implementation.
  const selected=[[0,137,0,1,3],[0,14,0,1,2],[0,9,1,2,0],[1,1,2,4,2],[1,11,0,1,0],[1,24,0,2,0]];
  const put=async(row,value)=>row[0]?setTSS(0,row[1],value):rs(row[1],value);
  const value=row=>row[0]?getTSS(0,row[1]):readRS(row[1]);
  for(const type of [1,2,3]){
    for(const row of selected)await put(row,row[2]);const block=await create(type);
    for(const row of selected)await put(row,row[3]);await apply(block);
    for(const row of selected)eq(await value(row),type===1||row[4]===0||row[4]===type?row[2]:row[3],'predefined DX7 membership '+type+'/'+row[1]);
    for(const row of selected)await put(row,row[3]);await capture(block);
    for(const row of selected)await put(row,row[2]);await apply(block);
    for(const row of selected)eq(await value(row),type===1||row[4]===0||row[4]===type?row[3]:row[2],'predefined DX7 Capture '+type+'/'+row[1]);
    await remove(block);
  }
  // Typed membership: the SDK explicitly includes VERTEX transforms, planes
  // and enable states; retained DX7 code resolves the remaining ALL-only types.
  const la=await structure(light(1)),lb=await structure(light(0)),ma=await structure(matrix(1)),mb=await structure(matrix(2));
  const pa=await structure([1,0,0,0].map(bits)),pb=await structure([0,1,0,0].map(bits));
  const mata=await structure(material(1)),matb=await structure(material(0));
  const vpa=await structure([0,0,8,8,bits(0),bits(1)]),vpb=await structure([1,1,6,6,bits(0),bits(1)]);
  const objects=[
    [18,19,[0],la,lb,104,[1]], [16,17,[],mata,matb,68,[1]],
    [13,15,[],vpa,vpb,24,[1]], [11,12,[16],ma,mb,64,[1,3]],
    [46,47,[0],pa,pb,16,[1,3]]
  ];
  for(const type of [1,2,3]){
    for(const [set,,args,a] of objects)await ok(com('typed predefined seed',device,set,...args,a));
    await ok(com('predefined enable seed',device,44,0,0));await ok(com('predefined binding seed',device,35,0,texture));
    const block=await create(type);
    for(const [set,,args,,b] of objects)await ok(com('typed predefined mutation',device,set,...args,b));
    await ok(com('predefined enable mutation',device,44,0,1));await ok(com('predefined binding mutation',device,35,0,0));await apply(block);
    for(const [,getSlot,args,a,b,n,types] of objects)eq(await get(getSlot,args,n),await snapshot(types.includes(type)?a:b,n),'typed predefined membership '+type+'/'+getSlot);
    eq(await readScalar(45,[0]),type===2?1:0,'predefined enable membership');eq(await boundTexture(),type===1?texture:0,'predefined texture binding membership');
    await remove(block);
  }
  const all=await create(1);await ok(com('new light after ALL',device,18,7,la));await capture(all);
  await ok(com('new light after Capture',device,18,7,lb));await apply(all);
  eq(await get(19,[7],104),await snapshot(lb,104),'ALL Capture cannot add newly defined light');await remove(all);
  for(const type of [1,3]){
    const index=type===1?30:31,block=await create(type);
    await ok(com('define enable after Create',device,44,index,1));await capture(block);
    await ok(com('change excluded enable',device,44,index,0));await apply(block);
    eq(await readScalar(45,[index]),0,'Capture cannot add newly defined enable');await remove(block);
  }
  passed('predefined ALL/PIXEL/VERTEX overlap, typed membership and initialized light mask');

  const IN=0x88760835,NOT=0x88760836,INVALID=0x88760834,PARAM=0x80070057;
  const outputToken=await guard(4);await write(outputToken.p,0xabc123ef);
  eq(await com('unmatched End',device,23,outputToken.p),NOT,'unmatched End');eq(await read(outputToken.p),0xabc123ef,'failed End output untouched');
  for(const type of [0,4,0xffffffff])eq(await com('invalid type',device,42,type,outputToken.p),PARAM,'invalid type');
  eq(await com('null Create output',device,42,1,0),PARAM,'null Create');
  const block=await record(()=>rs(9,1));
  await begin();eq(await com('nested Begin',device,22),IN,'nested Begin');eq(await com('null End output',device,23,0),PARAM,'null End');
  for(const [slot,args] of [[39,[block]],[40,[block]],[41,[block]],[42,[1,outputToken.p]]])eq(await com('during recording '+slot,device,slot,...args),IN,'illegal recording transition');
  await rs(9,2);const survived=await end();await apply(survived);eq(await readRS(9),2,'recorder survives invalid transitions');await remove(survived);
  await remove(block);
  for(const token of [0,block,0xffffffff])for(const slot of [39,40,41])eq(await com('invalid/deleted token',device,slot,token),INVALID,'invalid token');
  await outputToken.check();passed('transitions, invalid types/output, deleted tokens, recorder preservation');

  const other=await acquire(out=>com('second Device7',d3d,4,hal,rt,out));
  const own=await record(()=>rs(9,1));
  for(const slot of [39,40,41])check((await com('foreign token',other,slot,own))!==0,'foreign token rejected');
  await begin();await rs(9,2,other);eq(await readScalar(21,[9],other),2,'second device setters stay live');
  eq(await com('other End',other,23,outputToken.p),NOT,'recorder receiver identity');const own2=await end();await remove(own2);await remove(own);
  await rs(9,2);await rs(9,1,other);await begin();await begin(other);await rs(9,1);await rs(9,2,other);
  eq(await readRS(9),2,'device A concurrent recorder isolated');eq(await readScalar(21,[9],other),1,'device B concurrent recorder isolated');
  const bToken=await end(other),aToken=await end();await apply(aToken);await apply(bToken,other);
  eq(await readRS(9),1,'device A concurrent membership');eq(await readScalar(21,[9],other),2,'device B concurrent membership');await remove(aToken);await remove(bToken,other);
  const iidDevice2=await guid([0x93281501,0x11d08cf8,0xa000ab89,0x294105c9]);
  const alias=await acquire(out=>com('QI Device2 alias',device,0,iidDevice2,out));
  await rs(9,2);await begin();await ok(com('alias recorded SetRenderState',alias,23,9,1));eq(await readRS(9),2,'QI alias recording isolation');
  const aliasBlock=await end();await apply(aliasBlock);eq(await readRS(9),1,'QI alias membership');await remove(aliasBlock);await com('release alias',alias,2);
  await com('release second device',other,2);passed('foreign tokens, independent devices and QI aliases');

  // Public Lock pixels: select a solid red texture or constant green diffuse.
  // Only exact RGB endpoints and an interior flat triangle are used.
  await ok(com('pixel viewport',device,13,viewport));await rs(137,0);await rs(27,0);await rs(14,0);
  const solid=await lock(texture);for(let y=0;y<2;y++)for(let x=0;x<2;x++)await write(solid.pointer+y*solid.pitch+x*4,0xffff0000);await unlock(texture);
  await ok(com('pixel red texture',device,35,0,texture));await setTSS(0,1,2);await setTSS(0,2,2);await setTSS(0,4,2);await setTSS(0,5,2);await setTSS(0,11,0);await setTSS(0,24,0);
  for(const [i,[x,y]] of [[0,0],[8,0],[0,8]].entries())await words(vertices+i*32,[bits(x),bits(y),bits(.5),bits(1),0xff00ff00,0,0,0]);
  const pixel=async(label,expected)=>{
    await ok(com('pixel BeginScene',device,5));await ok(com('pixel DrawPrimitive',device,25,4,0x1c4,vertices,3,0));await ok(com('pixel EndScene',device,6));
    const l=await lock(rt),v=await read(l.pointer+2*l.pitch+2*4);await unlock(rt);
    const rgb=[v>>>16&255,v>>>8&255,v&255];evidence.stateblocks.pixels.push({label,rgb,expected});eq(rgb,expected,'PUBLIC LOCK PIXEL '+label);
  };
  const derived=await record(async()=>{await setTSS(0,1,2);await rs(21,2);await setTSS(0,1,2);});
  await rs(21,2);await apply(derived);await pixel('derived blend last write',[255,0,0]);await remove(derived);
  await pixel('before recording',[255,0,0]);await begin();await setTSS(0,2,0);await pixel('during recording',[255,0,0]);
  const color=await end();await pixel('after End',[255,0,0]);await apply(color);await pixel('after Apply',[0,255,0]);await remove(color);
  passed('public surface Lock RGB before/during/after selective Apply');

  const full=[];let exhausted=false;
  for(let i=0;i<33;i++){
    const hr=await com('capacity Begin',device,22);
    if(hr===0x8007000e){exhausted=true;break;}
    eq(hr,0,'capacity Begin HRESULT');full.push(await end());
  }
  check(exhausted&&full.length>0&&full.length<=32,'bounded block capacity returns OOM');
  for(const token of full)await remove(token);
  const reused=await record(async()=>{});
  eq(await com('deleted token after slot reuse',device,39,full[0]),INVALID,'slot reuse cannot resurrect token');await remove(reused);
  passed('capacity failure recovery and deleted-token reuse');

  // Repeated unfinished/finished device destruction exceeds the table size,
  // proving teardown retires recorder/block storage rather than leaking slots.
  let stale=0;
  for(let i=0;i<40;i++){
    const d=await acquire(out=>com('teardown Device7',d3d,4,hal,rt,out));
    if(stale)check((await com('old owner token',d,39,stale))!==0,'destroyed owner token rejected');
    await ok(com('teardown light allocation',d,18,0,la));await ok(com('teardown texture matrix allocation',d,11,16,ma));
    const held=await surface(2,2,0x1800);await begin(d);await ok(com('teardown recorded resource',d,35,0,held));await com('teardown caller release',held,2);if(i%2===0)stale=await end(d);
    eq(await com('final device release',d,2),0,'final teardown');
  }
  passed('deleted/destroyed ownership and >table-capacity completed/unfinished teardown');
}

function fixtureSource(){
  let source=base.browserFixture.toString();
  const a=source.indexOf('    const geometry=async uv=>{'),b=source.indexOf("    await ok(com('unbind texture'",a);
  assert(a>0&&b>a);source=source.slice(0,a)+'    await ('+stateblockCases.toString()+')();\n'+source.slice(b);
  source=source.replace('      const code=[],word=n=>code.push',`      await write(stack-256,0x6b73a91d);await write(stack+16,0x39e5c72b);
      const code=[],word=n=>code.push`);
  source=source.replace('      evidence.calls.push(row);await result.check();',`      evidence.calls.push(row);await result.check();
      eq(await read(stack-256),0x6b73a91d,label+' lower stack guard');eq(await read(stack+16),0x39e5c72b,label+' upper stack guard');row.stackGuards=true;`);
  return source;
}
async function run(modulePath){
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],['/test/binaries/calc.exe',pe],['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
  const config={...base.plan(),imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',config,'()=>[]');}
  catch(error){error.partial=context.legacyTextureEvidence;throw error;}
}
async function main(){
  const dir=process.env.D3D7_STATEBLOCK_EVIDENCE;if(dir)fs.mkdirSync(dir,{recursive:true});
  const modules=process.argv.includes('--old')?['wine-assembly.wasm']:['wine-assembly.wasm','wine-assembly.compat.wasm'];
  for(const name of modules){const file=path.join(ROOT,'build',name),sha256=hash(fs.readFileSync(file));
    try{const evidence=await run(file);if(dir)fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({sha256,evidence}));
      console.log('PASS public Device7 stateblocks',JSON.stringify({name,sha256,cases:evidence.stateblocks.cases,pixels:evidence.stateblocks.pixels,calls:evidence.calls.length}));}
    catch(error){if(dir)fs.writeFileSync(path.join(dir,'failure-'+name+'.json'),JSON.stringify({sha256,error:String(error),partial:error.partial}));throw error;}
  }
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={fixtureSource,run};
