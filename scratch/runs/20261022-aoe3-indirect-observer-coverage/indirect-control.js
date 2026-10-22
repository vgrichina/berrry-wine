'use strict';
// Actual historical WASM execution, SYNTHETIC programs/data/callees only.
// No PE loader, game startup, native MSXML implementation or runtime access.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const hookFactory=require('./instance-hook');
const fixture=JSON.parse(fs.readFileSync(process.env.AOE3_CONTROL_FIXTURE));
const create=require(process.env.AOE3_OBSERVER);
const bytes=fs.readFileSync(process.env.AOE3_CONTROL_MODULE);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(bytes),'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7');
const mod=new WebAssembly.Module(bytes),regs=['eax','ebx','ecx','edx','esi','edi','ebp','esp','eip'];
const region={BASE:{WND_RECORDS:0x7c00000,CONTROL_TABLE:0x7c02000,TITLE_TABLE:0x7c04000}};
const tr=a=>(a-0x400000+0x12000)>>>0;
const S=0x700000,O=0x680000,V=0x681000,TEXT=0x682000,OBJ=0x683000,DEST=0x684000,URL=0x685000;
const rows=[],raw=[],seals=[];
const le=n=>[n&255,(n>>>8)&255,(n>>>16)&255,n>>>24];
const mov=(r,n)=>[0xb8+r,...le(n)],push=n=>[0x68,...le(n)],jmp=(from,to)=>[0xe9,...le(to-from-5)];
function make(id) {
  const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true});
  const hook=hookFactory(create,x=>rows.push(x),region,id);
  let e;
  const getRegs=()=>Object.fromEntries(regs.map(r=>[r,e['get_'+r]()>>>0]));
  const seal=()=>({memory:hash(Buffer.from(memory.buffer)),registers:getRegs()});
  const sealed=f=>{const before=seal();f();assert.deepEqual(seal(),before,'observer changed WASM memory/registers');seals.push(id);};
  const imports={};for(const x of WebAssembly.Module.imports(mod)){imports[x.module]||={};imports[x.module][x.name]=x.kind==='memory'?memory:()=>0;}
  imports.host.log_eip=ip=>{raw.push({instanceId:id,ip:ip>>>0,regs:getRegs()});sealed(()=>hook.log_eip(ip));};
  e=new WebAssembly.Instance(mod,imports).exports;hook.bind(e,memory,tr);
  e.init_thread(0,0x400000,0x400000,0xb00000,0,0,0,0);
  const code=(a,b)=>b.forEach((v,i)=>e.guest_write8(a+i,v));
  const w=(a,n)=>code(a,le(n));
  const wide=(a,s)=>code(a,Buffer.from(s+'\0','utf16le'));
  // Untouched original opcode slices through indirect calls and branches.
  for(const x of fixture.fragments)code(x.address,x.bytes);
  // Deliberate fixture stop at final return boundary, never original code.
  code(0x8e9904,[0xeb,0xfe]);
  w(S+0x14,O);w(O,V);w(V+0x28,0x8e9730);w(V+0x38,0x930650);w(V+0x50,0x930695);
  w(0xb30894,0x9306be);code(0x9306be,[...mov(0,0),0xc2,20,0]);
  w(OBJ,TEXT);w(DEST,TEXT);wide(TEXT,'PRE'+id);wide(URL,'fixture://'+id);
  // Native-method surrogate invokes WM_INITDIALOG-shaped guest callback.
  const method=[...push(0xc4319c),...push(0),...push(0x110),...push(0x10000+id),...mov(1,0x486e30),0xff,0xd1];
  const methodReturn=0x8e9730+method.length;
  code(0x8e9730,[...method,...mov(0,0x100+id),0xc2,8,0]);
  // Literal callback entry branches to an indirect nested callback call.
  code(0x486e30,jmp(0x486e30,0x486fbc));
  const outer=[...push(0xab000000+id),...push(0),...push(0x222),...push(0x20000+id),...mov(0,0x930702),0xff,0xd0];
  assert.equal(0x486fbc+outer.length,0x486fd7);
  code(0x486fbc,[...outer,...mov(0,0xb000+id),0xc2,16,0]);
  // Inner guest callback writes dynamic UTF16, returns a distinct EAX.
  code(0x930702,[0xc7,5,...le(TEXT),...le(0x004e0049),...mov(0,0xc000+id),0xc2,16,0]);
  code(0x930650,[...mov(0,0x200+id),0xc2,8,0]);
  code(0x930695,[...mov(0,0x300+id),0xc2,8,0]);
  code(0x8e3060,[...mov(0,URL),0xc3]);
  // Extra actual indirect return to observer's dynamic object/string boundary.
  code(0x8e45fc,[...mov(0,0x918670),0xff,0xd0]); // ends exactly at 8e4603
  code(0x918670,[...mov(0,OBJ),0xc2,4,0]);
  code(0x8e4603,jmp(0x8e4603,0x8e46ca));code(0x8e46ca,[0xeb,0xfe]);
  // Fixture setup is outside seals. Only observation is sealed.
  e.set_esp(S);e.set_eax(0);e.set_ebx(0x11000000+id);e.set_ecx(0x22000000+id);
  e.set_edx(0x33000000+id);e.set_esi(0x686000);e.set_edi(0x44000000+id);e.set_ebp(0x55000000+id);
  // Earlier unrelated API traffic uses the actual module's exported getters;
  // API invocations here are mock host fixture events, NOT executed ReadFiles.
  code(0x687000,Buffer.from('c:\\art\\fixture.bar\0'));
  w(S,0x500000);w(S+4,0x687000);e.set_eax(0x70000001);
  sealed(()=>{hook.api('CreateFileA','entry');hook.api('CreateFileA','exit');});
  w(S+4,0x70000001);w(S+8,0x688000);w(S+12,4);w(S+16,0x689000);
  sealed(()=>{for(let i=0;i<800;i++){hook.api('ReadFile','entry');hook.api('ReadFile','exit');}});
  assert.equal(rows.filter(x=>x.instanceId===id).length,0);
  w(S+0x14,O);e.set_eax(0);e.set_esp(S-20);
  for(let i=0;i<5;i++)w(S-20+i*4,0x66000000+id+i);
  e.set_eip(0x8e98b1);e.set_trace_eip_range(1,0x400000,0xb00000);
  return {id,e,memory,hook,methodReturn,w};
}
const a=make(1),b=make(2);
// Alternate instances to expose accidental mutable-global export selection.
for(let i=0;i<22;i++){a.e.run(1);b.e.run(1);}
for(const c of [a,b]){c.w(S-4,19891);c.e.set_esp(S-4);c.e.set_ebx(DEST);c.e.set_eip(0x8e45fc);c.e.run(5);}
function validate(events) {
  for(const c of [a,b]) {
    const own=events.filter(x=>x.instanceId===c.id),at=ip=>{const x=own.find(x=>x.ip===ip);assert(x,'missing return/boundary '+ip.toString(16));return x;};
    for(const ip of [0x8e98b1,0x9306be,0x8e98b7,0x8e98bf,0x8e98ca,0x8e98dc,0x8e98fb,0x8e9904,0x486e30,0x486fd7,0x930702,c.methodReturn,0x8e4603,0x8e46ca])at(ip);
    for(const x of own){const actual=raw.find(r=>r.instanceId===c.id&&r.ip===x.ip);assert(actual);assert.deepEqual(x.regs,actual.regs,'observer register snapshot differs from actual WASM getters');}
    assert.equal(at(0x8e98b1).regs.esp,S-20);assert.equal(at(0x9306be).regs.esp,S-24);assert.equal(at(0x8e98b7).regs.eax,0);
    assert.deepEqual(at(0x8e9730).stack.slice(0,3),[0x8e98ca,O,0x686000]);
    assert.deepEqual(at(0x930650).stack.slice(0,3),[0x8e98dc,O,0x686004]);
    assert.deepEqual(at(0x930695).stack.slice(0,3),[0x8e9904,O,URL]);
    assert.equal(at(0x8e98bf).comObject,O);
    for(const [ip,result] of [[0x8e98ca,0x100],[0x8e98dc,0x200],[0x8e9904,0x300],[0x486fd7,0xc000],[c.methodReturn,0xb000]])assert.equal(at(ip).regs.eax,result+c.id,'stale/wrong return context');
    for(const ip of [0x8e98b7,0x8e98bf,0x8e98ca,0x8e98dc,0x8e9904])assert.equal(at(ip).regs.esp,S,'caller stack restoration');
    assert.equal(at(0x486e30).regs.esp,S-32);assert.deepEqual(at(0x486e30).stack.slice(1,5),[0x10000+c.id,0x110,0,0xc4319c]);
    assert.equal(at(0x930702).regs.esp,S-52);assert.deepEqual(at(0x930702).stack.slice(1,5),[0x20000+c.id,0x222,0,0xab000000+c.id]);
    assert.equal(at(0x486fd7).regs.esp,S-32);assert.equal(at(c.methodReturn).regs.esp,S-12);
    for(const ip of [0x8e98ca,0x8e98dc,0x8e9904]){assert.equal(at(ip).regs.ebx,0x11000000+c.id);assert.equal(at(ip).regs.edi,0x44000000+c.id);assert.equal(at(ip).regs.ebp,0x55000000+c.id);}
    assert.equal(at(0x8e98fb).parseUrl,'fixture://'+c.id);
    assert.equal(at(0x918670).lookupId,19891);assert.equal(at(0x8e4603).lookup,19891);
    assert.equal(at(0x8e4603).regs.esp,S);assert.equal(at(0x8e4603).returnText,'INE'+c.id);
    assert.equal(at(0x8e46ca).destination.text,'INE'+c.id);
    assert(own.indexOf(at(0x486e30))<own.indexOf(at(0x930702)));
    assert(own.indexOf(at(0x930702))<own.indexOf(at(0x486fd7)));
    assert(own.indexOf(at(c.methodReturn))<own.indexOf(at(0x8e98ca)));
  }
}
validate(rows);
assert.throws(()=>validate(rows.filter(x=>x.ip!==0x8e98dc)),/missing return/);
const stale=structuredClone(rows);for(const x of stale)if(x.ip===0x8e98ca)x.regs.eax=0;assert.throws(()=>validate(stale),/snapshot|stale\/wrong/);
const wrong=structuredClone(rows);for(const x of wrong)x.instanceId=3-x.instanceId;assert.throws(()=>validate(wrong));
const staleText=structuredClone(rows);for(const x of staleText)if(x.ip===0x8e4603)x.returnText='PRE'+x.instanceId;assert.throws(()=>validate(staleText));
assert.throws(()=>a.hook.bind(b.e,b.memory,tr),/already bound/);
b.e.set_eip(0x8e98dc);assert.throws(()=>b.hook.log_eip(0x8e98ca),/context mismatch/);
const out={pass:true,actualHistoricalWasm:true,syntheticProgramsAndData:true,originalNativeXmlEvidence:false,moduleSha256:hash(bytes),unrelatedMockReadPairsPerInstance:800,instances:2,readOnlySeals:seals.length,negativeControls:['missing return','stale pre-return EAX','wrong instance','stale dynamic UTF16','rebind','EIP mismatch'],rows,raw};
console.log(JSON.stringify(out));
