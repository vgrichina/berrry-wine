'use strict';
const assert = require('assert');
// Independent of the generator's implementation/availability maps.
const shapes = [3,4].flatMap(n => [['b',8,true],['s',16,true],['i',32,true],['us',16,false],['ui',32,false]]
  .flatMap(([suffix,bits,signed])=>[false,true].map(vector=>({name:`glColor${n}${suffix}${vector?'v':''}`,n,bits,signed,vector}))));
function exerciseIntegerColors({e,memory,regs,stack,toWasm,staticLookup,lookup}) {
  const v=new DataView(memory.buffer), source=e.guest_alloc(32), output=e.guest_alloc(32);
  const thunks=new Map();
  function invokeThunk(thunk,args) {
    for(let i=0;i<8;i++)v.setUint32(regs+i*4,0xabc10000+i,true);
    v.setUint32(regs+16,stack,true);
    new Uint8Array(memory.buffer,toWasm(stack),128).fill(0xa5);
    v.setUint32(toWasm(stack),0x12345678,true);
    args.forEach((x,i)=>v.setUint32(toWasm(stack)+4+i*4,x>>>0,true));
    const before=new Uint8Array(memory.buffer,toWasm(stack),128).slice();
    const result=e.lookup_invoke(thunk)>>>0;
    assert.strictEqual(v.getUint32(regs+16,true),stack+4*(args.length+1),'exact stdcall');
    for(let i=1;i<8;i++)if(i!==4)assert.strictEqual(v.getUint32(regs+i*4,true),0xabc10000+i,'GPR preserved');
    assert.deepStrictEqual(new Uint8Array(memory.buffer,toWasm(stack),128),before,'guest stack preserved');
    return result;
  }
  const call=(name,args=[])=>{
    if(!thunks.has(name))thunks.set(name,staticLookup(name));
    assert(thunks.get(name),name+' resolves');return invokeThunk(thunks.get(name),args);
  };
  const f=x=>{const b=Buffer.alloc(4);b.writeFloatLE(x);return b.readUInt32LE();};
  const rgba=a=>call('glColor4f',a.map(f));
  function query(pname=0xB00,integer=false) {
    new Uint8Array(memory.buffer,toWasm(output),32).fill(0xcc);
    call(integer?'glGetIntegerv':'glGetFloatv',[pname,output]);
    assert(new Uint8Array(memory.buffer,toWasm(output)+16,16).every(x=>x===0xcc),'query writes four components');
    return Array.from({length:4},(_,i)=>integer?v.getInt32(toWasm(output)+4*i,true):v.getFloat32(toWasm(output)+4*i,true));
  }
  e.lookup_color_context();
  assert.deepStrictEqual(query(),[1,1,1,1],'initial current color');
  for(const s of shapes) {
    const max=s.signed?2**(s.bits-1)-1:2**s.bits-1, min=s.signed?-(2**(s.bits-1)):0;
    const interior=s.signed?-(s.bits===8?37:s.bits===16?12345:123456789):max-123;
    const cases=[[min,max,0,interior],[0,1,interior,max],[max,min,interior,0],[-1,0,1,min]];
    for(const resolve of [staticLookup,lookup]) {
      const thunk=resolve(s.name);assert(thunk,s.name+' implemented');
      for(const values of cases) {
        const raw=values.map(x=>s.signed?(x<<(32-s.bits))>>(32-s.bits):s.bits===32?x>>>0:x&((1<<s.bits)-1));
        const expected=raw.map(x=>Math.fround((s.signed?2*x+1:x)/(2**s.bits-1)));
        if(s.n===3)expected[3]=1;
        new Uint8Array(memory.buffer,toWasm(source),32).fill(0xcd);
        raw.slice(0,s.n).forEach((x,i)=>s.bits===8?v.setUint8(toWasm(source)+i,x):s.bits===16?v.setUint16(toWasm(source)+i*2,x,true):v.setUint32(toWasm(source)+i*4,x>>>0,true));
        const args=s.vector?[source]:raw.slice(0,s.n).map(x=>s.bits===8?(x&255)|0x76543200:s.bits===16?(x&65535)|0x76540000:x);
        rgba([.75,.5,.25,.125]);assert.strictEqual(invokeThunk(thunk,args),0);
        assert.deepStrictEqual(query(),expected,s.name+' normalized current color');
        const iq=query(0xB00,true);
        for(let i=0;i<4;i++) {
          if(expected[i]===-1)assert.strictEqual(iq[i],-2147483648);
          else if(expected[i]===1)assert.strictEqual(iq[i],2147483647);
          else assert(Math.abs(iq[i]-((4294967295*expected[i]-1)/2))<=1,s.name+' inverse integer query');
        }
        // Compilation records values and leaves current state untouched.
        const list=call('glGenLists',[1]);assert(list);
        const prior=[.125,.25,.5,.75];rgba(prior);
        call('glNewList',[list,0x1300]);invokeThunk(thunk,args);
        assert.deepStrictEqual(query(),prior,'Get executes immediately during compile');call('glEndList');
        new Uint8Array(memory.buffer,toWasm(source),32).fill(0);
        rgba([1,0,1,0]);call('glCallList',[list]);assert.deepStrictEqual(query(),expected,'list owns converted values');
        call('glDeleteLists',[list,1]);
      }
    }
  }
  // RasterPos snapshots and clamps color; a later setter leaves it frozen.
  call('glColor4b',[-128,0,127,-37]);const current=query();
  call('glRasterPos2f',[f(0),f(0)]);
  const raster=current.map(x=>Math.max(0,Math.min(1,x)));
  assert.deepStrictEqual(query(0xB04),raster);
  call('glColor3ui',[0,0xffffffff,0]);assert.deepStrictEqual(query(0xB04),raster);
  const list=call('glGenLists',[1]);call('glNewList',[list,0x1301]);call('glColor4s',[-32768,0,32767,12345]);
  const executed=query();call('glEndList');rgba([1,0,0,0]);call('glCallList',[list]);assert.deepStrictEqual(query(),executed,'compile-execute replay');
  call('glDeleteLists',[list,1]);
  call('glBegin',[0]);
  new Uint8Array(memory.buffer,toWasm(output),32).fill(0xcc);
  call('glGetFloatv',[0xB00,output]);
  assert(new Uint8Array(memory.buffer,toWasm(output),32).every(x=>x===0xcc),'query inside Begin writes nothing');
  call('glEnd');assert.strictEqual(call('glGetError'),0x502);
  // Execute resolved integer handlers through the packed/software point path.
  e.gl_sw_set_enabled(1);call('glViewport',[0,0,16,16]);
  call('glMatrixMode',[0x1700]);call('glLoadIdentity');
  call('glMatrixMode',[0x1701]);call('glLoadIdentity');
  call('glClearColor',[0,0,0,0]);call('glClear',[0x4000]);
  const point=()=>{call('glBegin',[0]);call('glVertex2f',[f(-.75),f(-.625)]);call('glEnd');e.gl_wat_stream_flush();};
  call('glColor4i',[-2147483648,2147483647,0,2147483647]);point();
  const entry=e.gl_sw_entry()>>>0;assert(entry,'software surface allocated');
  const height=v.getUint16(entry+14,true),pitch=v.getUint16(entry+18,true),pixels=v.getUint32(entry+20,true);
  const pixel=()=>v.getUint32(pixels+(height-1-2)*pitch+2*4,true)>>>0;
  assert.strictEqual(pixel(),0xff00ff00,'signed current color clamps when rasterized');
  assert.strictEqual(query()[0],-1,'drawing does not clamp current state');
  call('glClear',[0x4000]);
  [0,65535,0,65535].forEach((x,i)=>v.setUint16(toWasm(source)+2*i,x,true));
  call('glColor4usv',[source]);point();assert.strictEqual(pixel(),0xff00ff00,'unsigned vector matches signed scalar raster color');
  console.log('20 integer-color forms: resolved handlers, normalization, queries, list capture/replay, raster snapshot and ABI pass');
}
module.exports={shapes,exerciseIntegerColors};
