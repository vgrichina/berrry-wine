'use strict';
const assert=require('assert/strict'),crypto=require('crypto'),create=require('./observer');
const memory={buffer:new ArrayBuffer(16*1024*1024)},dv=new DataView(memory.buffer);
const region={BASE:{WND_RECORDS:0x8000,CONTROL_TABLE:0x9800,TITLE_TABLE:0xa800}};
const values={image_base:0x400000,eax:0x10000,ebx:0x11000,ecx:0xce2518,edx:0,esi:0,edi:0,ebp:0,esp:0x20000,eip:0x8e4603};
let calls=[];
const guestExports=new Proxy({}, {get(t,k){assert.match(k,/^get_/);calls.push(k);return ()=>values[k.slice(4)];}});
const set=(a,v)=>dv.setUint32(a,v,true),wide=(a,s)=>Buffer.from(s+'\0','utf16le').copy(Buffer.from(memory.buffer),a);
set(0xce26d0,0);set(0x10000,0x12000);wide(0x12000,'Exit Game');
set(0x20004,19891);set(0x8000,65537);set(0x8014,0x13000);set(0x9800,1);set(0x9804,2);
set(0x13000,0x14000);set(0x13004,6);Buffer.from('<exit>\0').copy(Buffer.from(memory.buffer),0x14000);
const events=[],observer=create(x=>events.push(x),region),translate=a=>a;
const hash=()=>crypto.createHash('sha256').update(Buffer.from(memory.buffer)).digest('hex');
const before=hash(),regsBefore=JSON.stringify(values);
observer.block(0x918670,guestExports,memory,translate);
observer.block(0x8e4603,guestExports,memory,translate);
assert.equal(events.at(-1).lookup,19891);assert.equal(events.at(-1).returnText,'Exit Game');
values.eip=0x487040;observer.block(0x487040,guestExports,memory,translate);
assert.equal(events.at(-1).windows[0].text,'<exit>');
values.eip=0x8e4603;assert.equal(JSON.stringify(values),regsBefore);
assert.equal(hash(),before);assert.ok(calls.every(k=>/^get_/.test(k)));
// Negative control: the same seal detects an actual simulated guest write.
dv.setUint8(0x12000,0);assert.notEqual(hash(),before);dv.setUint8(0x12000,'E'.charCodeAt(0));
// Null/empty lookup is distinguished from populated UTF16.
set(0x10000,0);observer.block(0x8e4603,guestExports,memory,translate);assert.equal(events.at(-1).returnText,null);
// The built-in API dump uses the requested stdcall pointer; the observer
// preserves that contract and records both UTF16 and state without getters
// that allocate guest scratch or send messages.
set(0x20004,65537);set(0x20008,12);set(0x2000c,0);set(0x20010,0x12000);
const apiBefore=hash();observer.api('SendMessageW',guestExports,memory,translate,'entry');
assert.equal(events.at(-1).text,'Exit Game');assert.equal(hash(),apiBefore);
const starved=[],volume=create(x=>starved.push(x),region),volumeSeal=hash();
for(let i=0;i<800;i++){volume.api('ReadFile',guestExports,memory,translate,'entry');volume.api('ReadFile',guestExports,memory,translate,'exit');}
volume.block(0x489ece,guestExports,memory,translate);
assert.equal(starved.length,1600);assert.equal(starved.filter(x=>x.kind==='block').length,0);assert.equal(hash(),volumeSeal);
console.log(JSON.stringify({pass:true,events:events.length,readOnlyGetterCalls:calls.length,knownStarvationReproduced:true,controls:['populated UTF16','ID19891','stored placeholder','empty lookup','WM_SETTEXT pointer','unchanged full memory/registers','negative write detected','800 unrelated API pairs suppress mandatory load boundary']}));
