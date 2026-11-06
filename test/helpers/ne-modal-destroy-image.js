'use strict';
const assert=require('node:assert/strict');
const {neLifecycleImage}=require('./ne-lifecycle-image');
function modalImage(detach=true){
 const b=Buffer.alloc(0x1c00),base=neLifecycleImage(),n=0x80;
 base.copy(b,0,0,0x200);
 const word=(p,v)=>b.writeUInt16LE(v,p);
 word(n+12,1);word(n+0x12,0x100);word(n+0x18,0xff00);word(n+0x1a,2);
 word(n+0x1e,2);word(n+0x42,0x1000);word(n+0x44,0x100);word(n+0x46,0x1000);
 word(n+0x48,0x180);word(n+0x4a,0x400);word(n+0x4e,0);
 word(n+0x90,0);b[n+0xb0]=4;b.write('USER',n+0xb1);
 word(n+0x92,5);b[n+0xb5]=6;b.write('KERNEL',n+0xb6);
 const c=[],labels={},jumps=[],relocs=[];
 b.fill(0,0x200,0x1800);b.fill(0,0x1800,0x1c00);
 const emit=(...x)=>c.push(...x),w=x=>emit(x&255,x>>>8&255),label=n=>{assert.equal(labels[n],undefined);labels[n]=c.length;};
 const lw=n=>{jumps.push({at:c.length,n,short:false});w(0);};
 const j=(op,n)=>{emit(op);jumps.push({at:c.length,n,short:true});emit(0);};
 const push=x=>{emit(0x68);w(x);};
 const api=(ordinal,module=1)=>{emit(0x9a);const at=c.length;w(0xffff);w(0);relocs.push({at,type:3,module,ordinal});};
 const ptr=n=>{emit(0x0e,0x68);lw(n);};
 const axstore=o=>{emit(0xa3);w(o);};
 const store=(o,v)=>{emit(0xc7,0x06);w(o);w(v);};
 const esword=(o,v)=>{emit(0x26,0xc7,0x06);w(o);w(v);};
 const esbyte=(o,v)=>emit(0x26,0xc6,0x06,o&255,o>>>8,v);
 const prologue=()=>emit(0x55,0x8b,0xec,0x53,0x56,0x57,0x06);
 const epilogue=()=>emit(0xb8,1,0,0x33,0xd2,0x07,0x5f,0x5e,0x5b,0xc9,0xca,10,0);
 label('main');emit(0x8b,0xc4);axstore(0x20);emit(0x8b,0xc5);axstore(0x22);
 // A genuine HGLOBAL template; no test-only API or guest map patch.
 push(0);push(0);push(64);api(15,2);axstore(0);
 emit(0x8e,0xc0,0x33,0xff,0xb9,32,0,0x33,0xc0,0xf3,0xab);
 esword(0,0x0080);esword(2,0x80c8);esbyte(4,1);esword(9,100);esword(11,60);
 esword(16,8);esword(18,8);esword(20,64);esword(22,20);esword(24,7);esword(26,0);esword(28,0x5000);esbyte(30,0x80);esbyte(31,0);
 emit(0xbb,0x5a,0x5a,0xbe,0x6b,0x6b,0xbf,0x7c,0x7c);
 emit(0x1e,0xff,0x36,0,0);push(0);ptr('dialog');api(218);axstore(2);
 emit(0xa1,12,0);axstore(0x46);emit(0xa1,10,0);axstore(0x4a);
 emit(0x1e,0xff,0x36,0,0);push(0);ptr('dialog');api(218);axstore(2);
 emit(0x8b,0xc4);axstore(0x24);emit(0x8b,0xc5);axstore(0x26);
 // Real API query after native modal completion.
 emit(0xff,0x36,10,0);api(47);axstore(0x28);
 emit(0xff,0x36,10,0);api(53);axstore(0x2a);
 store(0x7e,0x600d);label('done');emit(0xeb,0xfe);
 label('dialog');prologue();emit(0x81,0x7e,12,0x10,1);j(0x75,'dialogNotInit');
 emit(0x8b,0x46,14);axstore(8);emit(0x50);push(7);api(91);axstore(10);store(12,0xcafe);
 emit(0x50);push(0xfffc);ptr('child');api(136);axstore(0x30);emit(0x89,0x16,0x32,0);
 // Nested actual far callbacks precede the native EndDialog teardown.
 emit(0xff,0x36,10,0);push(0x400);push(0);push(0);push(0);api(111);
 emit(0xff,0x76,14);push(42);api(88);j(0xeb,'dialogReturn');
 label('dialogNotInit');emit(0x83,0x7e,12,2);j(0x75,'dialogNotDestroy');emit(0xff,0x06,0x10,0);
 label('dialogNotDestroy');emit(0x81,0x7e,12,0x82,0);j(0x75,'dialogReturn');emit(0xff,0x06,0x12,0);
 label('dialogReturn');epilogue();
 label('child');prologue();emit(0x81,0x7e,12,0,4);j(0x75,'childNotSend');
 emit(0xff,0x76,14);push(0x401);push(0);push(0);push(0);api(111);j(0xeb,'childReturn');
 label('childNotSend');emit(0x81,0x7e,12,1,4);j(0x75,'childNotNested');emit(0xff,0x06,0x18,0);j(0xeb,'childReturn');
 label('childNotNested');emit(0x83,0x7e,12,2);j(0x75,'childNotDestroy');emit(0xff,0x06,0x14,0);
 // Reentrant SendMessage while the destruction walk is suspended.
 emit(0xff,0x76,14);push(0x400);push(0);push(0);push(0);api(111);
 label('childNotDestroy');emit(0x81,0x7e,12,0x82,0);j(0x75,'childReturn');emit(0xff,0x06,0x16,0);
 if(detach)store(12,0);
 label('childReturn');epilogue();
 for(const q of jumps){assert.notEqual(labels[q.n],undefined,q.n);const v=q.short?labels[q.n]-q.at-1:labels[q.n];if(q.short)assert(v>=-128&&v<128,[q.n,v]);c[q.at]=v&255;if(!q.short)c[q.at+1]=v>>>8;}
 assert(c.length<0x1000);b.set(c,0x200);b.writeUInt16LE(relocs.length,0x1200);
 relocs.forEach((r,i)=>{const p=0x1202+8*i;b[p]=r.type;b[p+1]=1;b.writeUInt16LE(r.at,p+2);b.writeUInt16LE(r.module,p+4);b.writeUInt16LE(r.ordinal,p+6);});
 // Packed CS references are real internal selector relocations.
 for(const q of jumps.filter(q=>!q.short)){
   const at=q.at-2;assert.equal(c[at],0x0e); // push CS supplies relocated runtime selector.
 }
 return {b,labels,detach};
}
module.exports={modalImage};
