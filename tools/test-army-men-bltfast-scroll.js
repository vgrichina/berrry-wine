'use strict';
// Original-free public COM regression; native execution requires its own grant.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {makeFixture}=require('./kernel32-native-fixture');
const [runtime,grant]=process.argv.slice(2);assert(path.isAbsolute(runtime)&&grant==='--root-runtime-granted');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),wasm=fs.readFileSync(path.join(runtime,'build/wine-assembly.wasm'));
assert.equal(sha(wasm),'7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33');
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),ctx={getMemory:()=>memory.buffer};
const host=require(path.join(runtime,'lib/host-imports')).createHostImports(ctx).host;Object.assign(host,{memory,log:()=>{},log_i32:()=>{}});
const e=ctx.exports=new WebAssembly.Instance(new WebAssembly.Module(wasm),{host}).exports;
const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.init_dx_com_thunks();
const read=p=>e.guest_read32(p)>>>0,write=(p,v)=>e.guest_write32(p,v>>>0),alloc=n=>{const p=e.guest_alloc(n)>>>0;assert(p);return p};
const zero=(p,n)=>{for(let i=0;i<n;i+=4)write(p+i,0)},stack=alloc(8192)+4096;
function invoke(args,obj,slot,target){const code=[],word=n=>code.push(n&255,(n>>>8)&255,(n>>>16)&255,n>>>24);
 for(const a of [...args].reverse()){code.push(0x68);word(a)}
 if(obj){assert(read(obj)&&read(read(obj)+slot*4));code.push(0xb8);word(obj);code.push(0x8b,0,0xff,0x90);word(slot*4)}else{code.push(0xb8);word(target);code.push(0xff,0xd0)}
 code.push(0xc3);const p=alloc(code.length);code.forEach((b,i)=>e.guest_write8(p+i,b));e.set_esp(stack);e.clear_yield();e.call_func(p,0,0,0,0);for(let i=0;i<100&&e.get_eip();i++)e.run(10000);assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,stack-16);return e.get_eax()>>>0;
}
const com=(o,s,...a)=>invoke([o,...a],o,s),ok=v=>assert.equal(v,0);
// Public catalog dispatch only; no surface-record or handler internals seeded.
const regions=require(path.join(runtime,'lib/region-map.generated')),apis=require(path.join(runtime,'src/api_table.json'));
const dv=new DataView(memory.buffer),tw=regions.BASE.THUNK_BASE,tg=(tw-e.get_guest_base()+e.get_image_base())>>>0;
function api(name,...a){const old=dv.getUint32(tw+4,true),entry=apis.find(x=>x.name===name);assert(entry);try{dv.setUint32(tw+4,entry.id,true);return invoke(a,0,0,tg)}finally{dv.setUint32(tw+4,old,true)}}
const out=alloc(4);ok(api('DirectDrawCreate',0,out,0));const dd=read(out);assert(dd);
const desc=alloc(108),lock=alloc(108),rect=alloc(16),W=640,H=386;
function surface(bpp,width=W){zero(desc,108);write(desc,108);write(desc+4,0x1007);write(desc+8,H);write(desc+12,width);write(desc+72,32);write(desc+76,0x40);write(desc+84,bpp);write(desc+88,bpp===16?0xf800:0xff0000);write(desc+92,bpp===16?0x7e0:0xff00);write(desc+96,bpp===16?0x1f:0xff);write(desc+104,0x840);ok(com(dd,6,desc,out,0));return read(out)}
function locked(o,fn){zero(lock,108);write(lock,108);ok(com(o,25,0,lock,1,0));const pitch=read(lock+16),bits=read(lock+36);assert(pitch&&bits);try{return fn(bits,pitch)}finally{ok(com(o,32,bits))}}
function snapshot(o,width,bpp){return locked(o,(p,pitch)=>{const b=Buffer.alloc(width*H*(bpp/8));for(let y=0;y<H;y++)for(let x=0;x<width*(bpp/8);x++)b[y*width*(bpp/8)+x]=e.guest_read8(p+y*pitch+x);return {bytes:b,pitch}})}
function fill(o,width,bpp,seed){locked(o,(p,pitch)=>{for(let y=0;y<H;y++)for(let x=0;x<pitch;x++)e.guest_write8(p+y*pitch+x,(x*17+y*31+(x>>>3)*7+seed)&255)})}
const observed=[[3,1,640,386,0,0],[4,1,640,386,0,0],[5,1,640,386,0,0],[4,2,640,386,0,0],[3,2,640,386,0,0],[2,2,640,386,0,0],[1,3,640,386,0,0],[0,3,639,386,1,0]];
const rows=[];
function check(label,dst,src,r,width,bpp){const before=snapshot(dst,width,bpp),source=snapshot(src,width,bpp),expected=Buffer.from(before.bytes),[l,t,right,bottom,x,y]=r,bytes=bpp/8;for(let row=0;row<bottom-t;row++)source.bytes.copy(expected,((y+row)*width+x)*bytes,((t+row)*width+l)*bytes,((t+row)*width+right)*bytes);r.slice(0,4).forEach((v,i)=>write(rect+i*4,v));ok(com(dst,7,x,y,src,rect,0x10));const after=snapshot(dst,width,bpp);let first=-1;for(let i=0;i<expected.length;i++)if(expected[i]!==after.bytes[i]){first=i;break}rows.push({label,bpp,width,pitch:after.pitch,firstMismatch:first,expectedSha:sha(expected),actualSha:sha(after.bytes)});console.log(JSON.stringify(rows.at(-1)));assert.equal(first,-1,label)}
for(const bpp of [16,32]){const dst=surface(bpp),src=surface(bpp);fill(dst,W,bpp,5);fill(src,W,bpp,79);check('separate-surfaces-control',dst,src,observed[0],W,bpp);fill(dst,W,bpp,5);check('same-surface-nonoverlap',dst,dst,[0,0,40,20,80,60],W,bpp);fill(dst,W,bpp,5);for(let i=0;i<observed.length;i++)check('observed-scroll-'+i,dst,dst,observed[i],W,bpp);ok(com(src,2));ok(com(dst,2));}
const padded=surface(16,641);fill(padded,641,16,13);check('padded-width-upward',padded,padded,[3,1,641,386,0,0],641,16);ok(com(padded,2));
console.log(JSON.stringify({result:'PASS',moduleSha:sha(wasm),fixtureSha:sha(pe),rows,scope:'public COM self-copy pixel oracle; original game pitch remains unmeasured'}));
