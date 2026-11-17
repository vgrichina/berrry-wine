'use strict';
// Small native NE input. Every API is an imported far CALL with Pascal words.
const { neLifecycleImage } = require('./ne-lifecycle-image');
function cursorImage(alternate=false) {
  const b=Buffer.alloc(116),w=(p,v)=>b.writeUInt16LE(v,p),d=(p,v)=>b.writeUInt32LE(v,p);
  w(0,alternate?3:1);w(2,alternate?1:2);d(4,40);d(8,8);d(12,16);w(16,1);w(18,1);d(24,64);b.fill(255,48,51);
  // All four AND/XOR combinations, plus distinct visible source patterns.
  for(let y=0;y<8;y++){b[52+4*y]=alternate?(y===3?255:24):24;b[84+4*y]=y===0?0xc0:0;}
  return b;
}
function cursorFixture({modules=false}={}) {
  const b=Buffer.alloc(0x3000),n=0x80,w=(p,v)=>b.writeUInt16LE(v,p);neLifecycleImage().copy(b,0,0,0x200);
  w(n+12,1);w(n+14,2);w(n+0x12,0x100);w(n+0x14,0);w(n+0x16,1);w(n+0x18,0xff00);w(n+0x1a,2);
  w(n+0x1e,2);w(n+0x42,0x1000);w(n+0x44,0x100);w(n+0x46,0x1000);w(n+0x48,0x180);w(n+0x4a,0x400);w(n+0x4e,0);
  w(n+0x90,0);b[n+0xb0]=4;b.write('USER',n+0xb1);w(n+0x92,5);b[n+0xb5]=6;b.write('KERNEL',n+0xb6);
  b.fill(0,0x200);const c=[],rel=[],slots={};let slot=0;
  const emit=(...x)=>c.push(...x),word=x=>emit(x&255,(x>>>8)&255),push=x=>{emit(0x68);word(x);};
  const api=(ordinal,module=1)=>{emit(0x9a);const at=c.length;word(0xffff);word(0);rel.push({at,ordinal,module});};
  const save=name=>{const p=slot;slot+=2;slots[name]=p;emit(0xa3);word(p);};
  const get=name=>{emit(0xff,0x36);word(slots[name]);};
  const load=(name,id,instance='self')=>{if(instance==='self')emit(0x1e);else if(typeof instance==='string')get(instance);else push(instance);push(0);push(id);api(173);save(name);};
  const select=name=>{get(name);api(69);save('previous_'+name);};
  emit(0x8b,0xc4);save('spBefore');
  load('systemA',0x7f84,0);load('systemB',0x7f85,0);select('systemA');select('systemB');
  push(0);api(69);save('previousNull');
  load('resourceA',1);load('resourceB',2);load('resourceAgain',1);select('resourceA');select('resourceB');
  load('rawCursor',101);load('malformed',103);
  emit(0x1e,0x1e);push(0x100);api(173);save('named');select('named');
  get('resourceA');api(458);save('destroyShared');get('resourceA');api(69);save('afterSharedDestroy');
  api(247);save('getCursor');push(0);api(71);save('hiddenCount');push(1);api(71);save('visibleCount');
  if(modules){
    for(const [name,off] of [['moduleA',0x110],['moduleB',0x120]]){emit(0x1e);push(off);api(47,2);save(name);}
    load('moduleCursorA',1,'moduleA');load('moduleCursorB',1,'moduleB');
    select('moduleCursorA');select('moduleCursorB');
    get('moduleA');api(96,2);get('moduleCursorA');api(69);save('retiredCursor');
    api(247);save('afterOtherUnload');get('moduleB');api(96,2);api(247);save('afterSelectedUnload');
  }
  // An ordinary native window owns focus; neither focus transfer fabricates
  // a cursor selection nor erases the input thread's installed cursor.
  emit(0x8c,0xc8,0xa3);word(0x184);emit(0x8c,0xd8,0xa3);word(0x18a);emit(0xa3);word(0x198);
  emit(0x1e);push(0x180);api(57);save('class');
  emit(0x1e);push(0x140);push(0);push(0);push(0x1000);push(0);
  for(const value of [10,10,16,16,0,0])push(value);
  emit(0x1e);push(0);push(0);api(41);save('window');
  get('resourceA');api(69);save('afterRetireSelect');get('window');api(22);api(23);save('focused');
  push(0);api(22);api(23);save('unfocused');api(247);save('afterFocus');get('window');api(53);
  load('badModule',1,0x4321);load('missing',999);load('badSystem',123,0);
  push(0x7fff);api(69);save('badSet');
  push(0x7fff);api(458);save('badDestroy');push(0);api(458);save('nullDestroy');
  emit(0x8b,0xc4);save('spAfter');emit(0xc7,0x06,0x7e,0,0x0d,0x60,0xeb,0xfe);
  b.set(c,0x200);b.set([0xea,0xff,0xff,0,0],0xb00);rel.push({at:0x901,ordinal:107,module:1});
  w(0x1200,rel.length);rel.forEach((r,i)=>{const p=0x1202+8*i;b[p]=3;b[p+1]=1;w(p+2,r.at);w(p+4,r.module);w(p+6,r.ordinal);});
  b.write('CUR_A\0',0x1900);
  b.write('ART_A\0',0x1910);b.write('ART_B\0',0x1920);
  b.write('C_TEST\0',0x1940);w(0x1982,0x900);w(0x1996,0x140);
  const rt=0x150;w(n+0x24,rt-n);w(rt,4);let p=rt+2;
  const type=(t,items)=>{w(p,0x8000|t);w(p+2,items.length);p+=8;for(const [id,off,size] of items){w(p,off>>>4);w(p+2,(size+15)>>>4);w(p+6,id);p+=12;}};
  type(12,[[0x8001,0x2000,20],[0x8002,0x2020,20],[0x70,0x2040,20]]);type(1,[[0x8065,0x2100,116],[0x8066,0x2180,116],[0x8067,0x2200,16]]);w(p,0);
  b[rt+0x70]=5;b.write('CUR_A',rt+0x71);
  for(const [off,id] of [[0x2000,101],[0x2020,102],[0x2040,101]]){w(off+2,2);w(off+4,1);w(off+6,8);w(off+8,8);w(off+10,1);w(off+12,1);b.writeUInt32LE(116,off+14);w(off+18,id);}
  b.set(cursorImage(false),0x2100);b.set(cursorImage(true),0x2180);
  return {b,slots,codeLength:c.length};
}
module.exports={cursorFixture,cursorImage};
