'use strict';
// Self-checking real x86 PE fixtures; also used by ordinary browser upload.
const { X86, u32 } = require('../test/test-dll-lifecycle-real-pe');
const { image, negativeImage } = require('./gears-sse-reshape.cjs');
const IN = 0x430000, OUT = IN + 64, STATE = OUT + 32;
const qw = n => [Number(BigInt.asUintN(64, n) & 0xffffffffn), Number(BigInt.asUintN(64, n) >> 32n)];
const db = n => { const b = Buffer.alloc(8); b.writeDoubleLE(n); return b.readBigUInt64LE(); };
const fb = n => { const b = Buffer.alloc(4); b.writeFloatLE(n); return b.readUInt32LE(); };
const isnan = n => (n & 0x7fffffffffffffffn) > 0x7ff0000000000000n;
const val = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b.readDoubleLE(); };
function expected(op, a, b) {
  if (isnan(a)) return a | 0x8000000000000n;
  if (isnan(b)) return b | 0x8000000000000n;
  const x = val(a), y = val(b), r = op === 0x58 ? x+y : op === 0x59 ? x*y : op === 0x5c ? x-y : x/y;
  return Number.isNaN(r) ? 0xfff8000000000000n : db(r);
}
function demote(b) {
  return isnan(b) ? Number(((b >> 32n) & 0x80000000n) | 0x7fc00000n | ((b & 0xfffffffffffffn) >> 29n)) : fb(val(b));
}
function controlImage() {
  const a = new X86(); let cases = 0;
  const put = (p, w) => w.forEach((v,i)=>a.emit(0xc7,5,u32(p+i*4),u32(v)));
  const load = (r,p) => a.emit(0x0f,0x10,5+r*8,u32(p));
  const save = (r,p) => a.emit(0x0f,0x11,5+r*8,u32(p));
  const upper = [0x7ff01234,0xdeadbeef];
  function run(prefix, op, src, dst, want, mode, reg = 0, alias = false) {
    put(IN, src); put(IN+16,dst); load(alias?reg:1,IN); if(!alias)load(reg,IN+16);
    for(const r of [0,1,2,3,5,6,7])a.emit(0xb8+r,u32(0x12340000+r));
    // Record the implemented flags baseline and stack; all must be unchanged.
    a.push(0x8d7).emit(0x9d,0x9c,0x8f,5,u32(STATE+32),0x89,0x25,u32(STATE+36));
    if(mode==='sib')a.emit(0xbb,u32(IN-12),0xbe,u32(4));
    a.emit(prefix,0x0f,op,mode==='reg'?[0xc0+reg*8+(alias?reg:1)] :
      mode==='sib'?[0x44+reg*8,0x73,4] : [5+reg*8,...u32(IN)]);
    save(reg,OUT);a.emit(0x9c,0x8f,5,u32(STATE+40),0x89,0x25,u32(STATE+44));
    for(const r of [0,1,2,3,5,6,7])a.emit(0x89,5+r*8,u32(STATE+r*4));
    want.forEach((v,i)=>a.emit(0xa1,u32(OUT+i*4)).checkEax(v));
    for(const [x,y] of [[32,40],[36,44]])a.emit(0xa1,u32(STATE+x),0x3b,5,u32(STATE+y)).branch([0x0f,0x85],'bad');
    for(const r of [0,1,2,3,5,6,7])a.emit(0xa1,u32(STATE+r*4)).checkEax(mode==='sib'&&r===3?IN-12:mode==='sib'&&r===6?4:0x12340000+r);
    if(!alias&&reg!==1){save(1,OUT);src.forEach((v,i)=>a.emit(0xa1,u32(OUT+i*4)).checkEax(v));}
    cases++;
  }
  const pairs = [[db(3),db(2)],[db(-3),db(2)],[db(0),db(-0)],[db(-0),db(-0)],
    [db(1),db(2**-53)],[db(1+2**-52),db(2**-53)], [db(Number.MAX_VALUE),db(2)],
    [1n,db(2)],[3n,db(2)],[0x0010000000000000n,db(0.5)],
    [db(Infinity),db(-Infinity)],[db(Infinity),db(0)],[db(0),db(0)],[db(1),db(-0)],
    [0x7ff0123456789abcn,db(1)],[db(1),0xfff923456789abcdn],
    [0x7ff0123456789abcn,0xfff923456789abcdn],[0xfff923456789abcdn,0x7ff0123456789abcn]];
  for(const op of [0x58,0x59,0x5c,0x5e])for(const mode of ['reg','mem','sib'])for(const [x,y] of pairs)
    run([0xf2],op,[...qw(y),0x12345678,0x7ff01234],[...qw(x),...upper],[...qw(expected(op,x,y)),...upper],mode);
  // Every XMM selector and aliased read-before-write, upper qword is opaque.
  for(let r=0;r<8;r++)for(const op of [0x58,0x59,0x5c,0x5e]){
    const x=db(1.5);run([0xf2],op,[...qw(x),...upper],[],[...qw(expected(op,x,x)),...upper],'reg',r,true);
  }
  for(const mode of ['reg','mem'])for(const pair of [[db(1+2**-24),db(1+3*2**-24)],
    [db(-0),db(Infinity)],[db(2**-149),db(2**-150)],[db(3*2**-150),db(-(2**-150))],
    [db(Number.MAX_VALUE),db(-Number.MAX_VALUE)],[0x7ff0000000000001n,0xfff923456789abcdn],
    [1n,0x8000000000000001n]])
    run([0x66],0x5a,pair.flatMap(qw),[1,2,3,4],[...pair.map(demote),0,0],mode);
  for(const mode of ['reg','mem','sib'])for(const pair of [[0,-1],[2147483647,-2147483648],[16777217,-16777219]])
    run([0xf3],0xe6,[...pair,0x7fffffff,0x80000000],[1,2,3,4],pair.flatMap(x=>qw(db(x))),mode);
  a.emit(0xc7,5,u32(0x4014d0),u32(0x600dcafe)).push(0).api('ExitProcess').emit(0xcc);
  a.label('bad').push(246).api('ExitProcess').emit(0xcc);
  const code=a.finish();if(code.length>0x2e000)throw Error('fixture overlaps data: '+code.length);
  return {bytes:image([[0x2000,code]]),cases,codeBytes:code.length};
}
function threadImage() {
  const m=new X86(),w=new X86(),n=new X86();
  m.emit(0xb8,u32(1234),0x66,0x0f,0x6e,0xf8,0xf3,0x0f,0xe6,0xff);
  for(const v of [111,222,333])m.push(0).push(0).push(v).push(0x420000).push(0).push(0).api('CreateThread').eaxTo(v===111?0x100:v===222?0x104:0x108);
  for(let i=0;i<3;i++){
    m.push(30000).emit(0xff,0x35,u32(0x401500+i*4)).api('WaitForSingleObject').checkEax(0);
    m.push(0x401520).emit(0xff,0x35,u32(0x401500+i*4)).api('GetExitCodeThread').checkEax(1);
    m.emit(0xa1,u32(0x401520)).checkEax(0);
  }
  m.emit(0x66,0x0f,0x5a,0xc7,0xf3,0x0f,0x2c,0xc0).checkEax(1234);
  m.emit(0xc7,5,u32(0x4014d0),u32(0x600dcafe)).push(0).api('ExitProcess').emit(0xcc);
  w.emit(0x66,0x0f,0x7e,0xf8).checkEax(0);
  w.emit(0x8b,0x5c,0x24,4,0x66,0x0f,0x6e,0xfb,0xf3,0x0f,0xe6,0xff,0xbe,u32(20));
  w.emit(0xf0,0xff,5,u32(0x401540));
  w.label('barrier').push(10).api('Sleep').emit(0xa1,u32(0x401540),0x83,0xf8,3).branch([0x0f,0x85],'barrier');
  w.label('loop').push(10).api('Sleep').emit(0x66,0x0f,0x5a,0xc7,0xf3,0x0f,0x2c,0xc0,0x3b,0xc3).branch([0x0f,0x85],'bad');
  w.emit(0x66,0x0f,0x6e,0xc3,0xf3,0x0f,0xe6,0xc0,0xb9,u32(4),0xe8,u32(0));const at=w.code.length-4;
  w.emit(0x66,0x0f,0x5a,0xc0,0xf3,0x0f,0x2c,0xc0,0x3b,0xc3).branch([0x0f,0x85],'bad');
  w.emit(0x4e).branch([0x0f,0x85],'loop');w.push(0).api('ExitThread').emit(0xcc);
  w.label('bad').push(249).api('ExitProcess').emit(0xcc);
  const wc=w.finish();wc.writeInt32LE(0x421000-(0x420000+at+4),at);
  n.emit(0x52,0x89,0xca,0x83,0xec,16,0x0f,0x11,0x04,0x24,
    0x66,0x0f,0x6e,0xc1,0xf3,0x0f,0xe6,0xc0,
    0xf2,0x0f,0x58,0xc0,0xf2,0x0f,0x59,5,u32(IN),
    0xf2,0x0f,0x5c,0xc0,0xf2,0x0f,0x58,0xc7,0x49).branch([0x0f,0x84],'restore');
  n.emit(0xe8);const nc=n.code.length;n.emit(u32(-(nc+4)));
  n.label('restore').emit(0xf2,0x0f,0x5e,5,u32(IN),0xf2,0x0f,0x59,5,u32(IN),
    0x66,0x0f,0x5a,0xc8,0xf3,0x0f,0x2c,0xc1,0x3b,0xc3).branch([0x0f,0x85],'bad');
  n.emit(0x0f,0x10,0x04,0x24,0x83,0xc4,16,0x5a,0xc3);
  n.label('bad').push(247).api('ExitProcess').emit(0xcc);
  return image([[0x2000,m.finish()],[0x20000,wc],[0x21000,n.finish()],[0x30000,qw(db(2)).flatMap(u32)]]);
}
function nestedImage() {
  const a=new X86(),o=new X86(),i=new X86();const set=[0xff,0x15,...u32(0x401948)],call=[0xff,0x15,...u32(0x40194c)];
  a.emit(0xb8,u32(1234),0x66,0x0f,0x6e,0xf8,0xf3,0x0f,0xe6,0xff);
  a.push(0x402200).emit(set).checkEax(0);a.push(0x401600).emit(call).checkEax(0xffffffff);
  a.emit(0x66,0x0f,0x5a,0xc7,0xf3,0x0f,0x2c,0xc0).checkEax(1234);
  a.emit(0xc7,5,u32(0x4014d0),u32(0x600dcafe)).push(0).api('ExitProcess').emit(0xcc);
  o.emit(0x83,0xec,16,0x0f,0x11,0x3c,0x24,0xf2,0x0f,0x58,0xff);
  o.push(0x402400).emit(set).checkEax(0x402200);o.push(0x401600).emit(call).checkEax(1);
  o.emit(0x66,0x0f,0x5a,0xc7,0xf3,0x0f,0x2c,0xc0).checkEax(617);
  o.emit(0x0f,0x10,0x3c,0x24,0x83,0xc4,16,0xb8,u32(-1),0xc2,4,0);
  i.emit(0x66,0x0f,0x5a,0xc7,0xf3,0x0f,0x2c,0xc0).checkEax(2468);
  i.emit(0xf2,0x0f,0x59,0x3d,u32(IN),0xf2,0x0f,0x5e,0x3d,u32(IN+8),0xf2,0x0f,0x5c,0x3d,u32(IN+16),0xb8,u32(1),0xc2,4,0);
  const b=image([[0x2000,a.finish()],[0x2200,o.finish()],[0x2400,i.finish()],
    [0x1600,[0x401620,0x401680].flatMap(u32)],[0x1620,u32(0xe1234567)],
    [0x30000,[db(2),db(4),db(617)].flatMap(qw).flatMap(u32)]]);
  const raw=r=>r-0x1000+0x200;
  for(const [slot,name,loc] of [[0x1948,'SetUnhandledExceptionFilter',0x17a0],[0x194c,'UnhandledExceptionFilter',0x17d0]]){
    b.writeUInt32LE(loc,raw(slot));b.write(name+'\0',raw(loc+2));
  }return b;
}
function widthImage() {
  const a=new X86(),p=0x30000ff8;
  const alloc=[0xff,0x15,...u32(0x401948)];
  a.push(4).push(0x3000).push(4096).push(0x30000000).emit(alloc).checkEax(0x30000000);
  for(const offset of [0,-1]){
    // The last eight bytes of a mapped sparse page; the following page is
    // unallocated. A mistaken m128 read must fault under the native guard.
    for(const [i,v] of qw(db(2)).entries())a.emit(0xc7,5,u32(p+offset+i*4),u32(v));
    a.emit(0xf2,0x0f,0x10,5,u32(p+offset),0xf2,0x0f,0x58,5,u32(p+offset),
      0xf2,0x0f,0x59,5,u32(p+offset),0xf2,0x0f,0x5c,5,u32(p+offset),
      0xf2,0x0f,0x5e,5,u32(p+offset),0x66,0x0f,0x5a,0xc0,0xf3,0x0f,0x2c,0xc0).checkEax(3);
    a.emit(0xc7,5,u32(p+offset),u32(-1),0xc7,5,u32(p+offset+4),u32(2147483647),
      0xf3,0x0f,0xe6,5,u32(p+offset),0x0f,0x11,5,u32(OUT));
    [-1,2147483647].flatMap(x=>qw(db(x))).forEach((v,i)=>a.emit(0xa1,u32(OUT+i*4)).checkEax(v));
  }
  // Cross-page m64 reads through two separately translated sparse pages.
  a.push(4).push(0x3000).push(4096).push(0x30001000).emit(alloc).checkEax(0x30001000);
  qw(db(2)).forEach((v,i)=>a.emit(0xc7,5,u32(0x30000ffc+i*4),u32(v)));
  a.emit(0xf2,0x0f,0x10,5,u32(0x30000ffc),0xf2,0x0f,0x59,5,u32(0x30000ffc),
    0x66,0x0f,0x5a,0xc0,0xf3,0x0f,0x2c,0xc0).checkEax(4);
  a.emit(0xc7,5,u32(0x4014d0),u32(0x600dcafe)).push(0).api('ExitProcess').emit(0xcc);
  const b=image([[0x2000,a.finish()]]),raw=x=>x-0x1000+0x200;
  b.writeUInt32LE(0x17a0,raw(0x1948));b.write('VirtualAlloc\0',raw(0x17a2));return b;
}
function alignmentImage() {
  const a=new X86(),f=new X86(),r=new X86(),initial=[0x01234567,0x89abcdef,0x7ff00001,0xfff00000];
  initial.forEach((v,i)=>a.emit(0xc7,5,u32(IN+i*4),u32(v)));
  a.emit(0x0f,0x10,5,u32(IN));a.push(0x402400).emit(0xff,0x15,u32(0x401948)).checkEax(0);
  a.emit(0x90);const fault=0x402000+a.code.length;
  a.emit(0x66,0x0f,0x5a,5,u32(IN+1)).push(245).api('ExitProcess').emit(0xcc);
  // Check actual fault address/EIP and resume past the rejected instruction.
  for(const [off,v] of [[0,0xc0000005],[12,fault],[20,0],[24,IN+1]])
    f.emit(0x8b,0x44,0x24,4,0x8b,0,0x8b,0x40,off).checkEax(v);
  f.emit(0x8b,0x44,0x24,4,0x8b,0x40,4,0x8b,0x88,u32(0xb8),0x89,0xc8).checkEax(fault);
  f.emit(0x8b,0x44,0x24,4,0x8b,0x40,4,0xc7,0x80,u32(0xb8),u32(0x402800),0xb8,u32(-1),0xc2,4,0);
  r.emit(0x0f,0x11,5,u32(OUT));initial.forEach((v,i)=>r.emit(0xa1,u32(OUT+i*4)).checkEax(v));
  r.emit(0xc7,5,u32(0x4014d0),u32(0x600dcafe)).push(0).api('ExitProcess').emit(0xcc);
  const b=image([[0x2000,a.finish()],[0x2400,f.finish()],[0x2800,r.finish()]]),raw=x=>x-0x1000+0x200;
  b.writeUInt32LE(0x17a0,raw(0x1948));b.write('SetUnhandledExceptionFilter\0',raw(0x17a2));return b;
}
module.exports={controlImage,negativeImage,threadImage,nestedImage,widthImage,alignmentImage};
if(require.main===module){const fs=require('node:fs'),out=process.argv[2];fs.mkdirSync(out,{recursive:true});const c=controlImage();for(const [name,bytes] of Object.entries({control:c.bytes,threads:threadImage(),nested:nestedImage(),width:widthImage(),alignment:alignmentImage()}))fs.writeFileSync(out+'/'+name+'.exe',bytes);console.log(JSON.stringify({cases:c.cases,codeBytes:c.codeBytes}));}
