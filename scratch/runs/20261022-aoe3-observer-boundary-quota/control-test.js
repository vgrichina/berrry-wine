'use strict';
// All writes below construct independent mock input, never live guest memory.
const assert=require('assert/strict'),crypto=require('crypto'),create=require('./observer');
const memory={buffer:new ArrayBuffer(16*1024*1024)},dv=new DataView(memory.buffer);
const region={BASE:{WND_RECORDS:0x8000,CONTROL_TABLE:0x9800,TITLE_TABLE:0xa800}};
const values={image_base:0x400000,eax:0,ebx:0x11000,ecx:0xce2518,edx:0,esi:0x15000,edi:0,ebp:0,esp:0x20000,eip:0};
const calls=[],ex=new Proxy({}, {get(t,k){assert.match(k,/^get_(?:image_base|eax|ebx|ecx|edx|esi|edi|ebp|esp|eip)$/);calls.push(k);return ()=>values[k.slice(4)];}});
const set=(a,v)=>dv.setUint32(a,v>>>0,true),wide=(a,s)=>Buffer.from(s+'\0','utf16le').copy(Buffer.from(memory.buffer),a),ascii=(a,s)=>Buffer.from(s+'\0').copy(Buffer.from(memory.buffer),a);
const hash=()=>crypto.createHash('sha256').update(Buffer.from(memory.buffer)).digest('hex');
const events=[],o=create(x=>events.push(x),region),translate=a=>a;
function sealed(f){const h=hash(),r=JSON.stringify(values);f();assert.equal(hash(),h);assert.equal(JSON.stringify(values),r);}
function api(name,args,eax=0,ret=0x500000){set(values.esp,ret);args.forEach((v,i)=>set(values.esp+4+i*4,v));sealed(()=>o.api(name,ex,memory,translate,'entry'));values.eax=eax;sealed(()=>o.api(name,ex,memory,translate,'exit'));}
function block(ip){values.eip=ip;sealed(()=>o.block(ip,ex,memory,translate));}
ascii(0x30000,'c:\\art\\art1.bar');api('CreateFileA',[0x30000],0x70000001);
set(0x20000,0x500000);[0x70000001,0x31000,128,0x32000].forEach((v,i)=>set(0x20004+i*4,v));values.eax=1;
sealed(()=>{for(let i=0;i<800;i++){o.api('ReadFile',ex,memory,translate,'entry');o.api('ReadFile',ex,memory,translate,'exit');}});
assert.equal(events.length,0,'unrelated opens/reads must emit nothing');
// Also saturate a different XML block and API callsite before mandatory points.
for(let i=0;i<100;i++)block(0x8e9730);
for(let i=0;i<100;i++)api('GetDlgItem',[1,2],2,0x600000);
set(0xce26d0,1);set(0xce26cc,0x16000);set(0x16000,0x17000);set(0x17000,19891);
values.eax=1;block(0x489ece);values.eax=0;block(0x489ef6);
for(let id=1;id<101;id++){set(0x20004,id);block(0x918670);block(0x8e4603);}
set(0x20004,19891);block(0x918670);
set(0x18000,0x19000);wide(0x19000,'Exit Game');values.eax=0x18000;block(0x8e4603);
set(0x11000,0x1a000);wide(0x1a000,'Exit Game');block(0x8e46ca);
[0x1000f,0x110,0,0xc4319c].forEach((v,i)=>set(0x20004+i*4,v));block(0x486e30);
// Native COM continuations are distinct block inputs, not API-exit substitutes.
for(const ip of [0x8e98b7,0x8e98ca,0x8e98dc,0x8e9904])block(ip);
const ids=[2,1032,1034,1035,1036,1030];
ids.forEach((id,s)=>{set(0x8000+s*24,0x10010+s);set(0x8000+s*24+8,0x1000f);set(0x8000+s*24+20,0x40000+s*64);set(0x9800+s*16,id===1034||id===1036?3:1);set(0x9804+s*16,id);});
const returns=[0x48700d,0x487040,0x487070,0x4870b5,0x4870e5,0x487119,0x4871ab];
for(let i=0;i<7;i++){
 const hwnd=i===0?0x1000f:0x1000f+i,ret=0x48700d+i*0x30;
 set(0x20000,ret);[hwnd,12,0,0x1a000].forEach((v,j)=>set(0x20004+4*j,v));
 sealed(()=>o.api('SendMessageW',ex,memory,translate,'entry'));
 // Simulate the guest's dispatch storage in the fixture, outside observer.
 if(i){set(0x40000+(i-1)*64,0x50000+(i-1)*64);set(0x40004+(i-1)*64,9);ascii(0x50000+(i-1)*64,'Exit Game');}
 sealed(()=>o.api('SendMessageW',ex,memory,translate,'exit'));block(returns[i]);
}
// Relevant path and handle lifetime; unrelated handle reuse must filter again.
ascii(0x30000,'c:\\data\\stringtable.xml');api('CreateFileA',[0x30000],0x70000002);
set(0x32000,4);ascii(0x31000,'<xml');api('ReadFile',[0x70000002,0x31000,4,0x32000],1);
ascii(0x30000,'c:\\art\\art2.bar');api('CreateFileA',[0x30000],0x70000002);const n=events.length;api('ReadFile',[0x70000002,0x31000,4,0x32000],1);assert.equal(events.length,n);
function validate(rows){
 for(const ip of [0x489ece,0x489ef6,0x918670,0x8e4603,0x8e46ca,0x486e30,0x8e98b7,0x8e98ca,0x8e98dc,0x8e9904])assert(rows.some(x=>x.kind==='block'&&x.ip===ip),'missing boundary '+ip.toString(16));
 assert.equal(rows.find(x=>x.ip===0x489ece).loadAL,1);assert.equal(rows.find(x=>x.ip===0x489ef6).loadAL,0);
 const lookup=rows.find(x=>x.ip===0x8e4603&&x.lookup===19891);assert.equal(lookup.lookup,19891);assert.equal(lookup.returnText,'Exit Game');assert.deepEqual(lookup.returnObject.slice(0,4),[0,0x90,1,0]);
 assert.equal(rows.find(x=>x.ip===0x8e46ca).destination.text,'Exit Game');
 assert.deepEqual(rows.find(x=>x.ip===0x486e30).stack.slice(1,5),[0x1000f,0x110,0,0xc4319c]);
 for(const kind of ['api-entry','api-exit'])assert.equal(rows.filter(x=>x.kind===kind&&x.name==='SendMessageW').length,7);
 const pre=rows.find(x=>x.kind==='api-entry'&&x.name==='SendMessageW');assert.equal(pre.text,'Exit Game');assert(pre.windows.every(w=>w.textPtr===0));
 for(const ip of returns)assert(rows.some(x=>x.ip===ip&&x.windows),'missing real caller continuation state');
 const post=rows.filter(x=>x.kind==='api-exit'&&x.name==='SendMessageW').at(-1);assert(post.windows.every(w=>w.text==='Exit Game'));
 assert(rows.some(x=>x.kind==='api-exit'&&x.name==='ReadFile'&&x.file==='c:\\data\\stringtable.xml'&&x.readCount===4));
}
validate(events);assert.throws(()=>validate(events.filter(x=>x.ip!==0x489ef6)),/missing boundary 489ef6/);
const before=hash();dv.setUint8(0x19000,0);assert.notEqual(hash(),before,'seal detects a write');dv.setUint8(0x19000,69);
const r=JSON.stringify(values);values.eax^=1;assert.notEqual(JSON.stringify(values),r,'seal detects register change');values.eax^=1;
console.log(JSON.stringify({pass:true,mockOnly:true,unrelatedReadPairs:800,mandatoryRecordsSurvive:true,events:events.length,readOnlyGetterCalls:calls.length,missingBoundaryNegative:true,memoryWriteNegative:true,registerWriteNegative:true,actualModuleCoverageProven:false}));
