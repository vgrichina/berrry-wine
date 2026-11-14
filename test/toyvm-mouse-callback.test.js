'use strict';
// Generated native 16-bit COM: all registrations, callbacks and RETFs execute
// on the actual ToyVM CPU. Host assertions inspect the guest's written log.
const assert = require('node:assert/strict');
const { Machine, loadExe } = require('../tools/toyvm/dos');
const { makeVm } = require('../tools/toyvm/vm');
const { DosSession } = require('../tools/toyvm/dos-loop');
const { LiveRun } = require('../tools/toyvm/live');
const callback = require('../tools/toyvm/mouse-callback');

function fixture(mode = 0, mask = 127) {
  const bytes = [], labels = {}, refs = [];
  const b = (...v) => bytes.push(...v), w = v => b(v & 255, v >> 8 & 255);
  const ref = name => { refs.push([bytes.length, name]); w(0); };
  const label = name => { labels[name] = bytes.length + 0x100; };
  b(0x0e,0x07,0xb9); w(mask); b(0xba); ref('handler'); b(0xb8); w(12); b(0xcd,0x33);
  if(mode===4) {
    b(0xb8);w(0x14);b(0x31,0xc9,0x31,0xd2,0x52,0x07,0xcd,0x33);
    for(const [reg,off] of [[1,0],[2,2]]) {b(0x2e,0x89,0x06|(reg<<3));refs.push([bytes.length,'exchange',off]);w(0);}
    b(0x8c,0xc0,0x2e,0xa3);refs.push([bytes.length,'exchange',4]);w(0);
    b(0xb8);w(0x14);b(0xcd,0x33);
  }
  if(mode===5) {
    for(const [fn,cx,dx] of [[7,0,2556],[8,0,1916],[15,3,3],[4,40,40]]) {
      b(0xb8);w(fn);b(0xb9);w(cx);b(0xba);w(dx);b(0xcd,0x33);
    }
  }
  label('loop'); b(0x2e,0xa1); ref('command'); b(0x85,0xc0,0x74,0xf8);
  b(0x48,0xb9); w(0); b(0xcd,0x33,0x2e,0xc7,0x06); ref('command'); w(0);
  b(0xe9); const back = bytes.length; w(0);
  label('handler');
  // Log actual callback inputs using BP as the row index, preserving its input.
  b(0x55,0x2e,0x8b,0x2e); ref('count');
  for (let i = 0; i < 5; i++) b(0xd1,0xe5);
  for (const [i, reg] of [0,3,1,2,6,7].entries()) { b(0x2e,0x89,0x86 | reg << 3); refs.push([bytes.length,'records',i*2]); w(0); }
  b(0x8c,0xd8,0x2e,0x89,0x86); refs.push([bytes.length,'records',12]); w(0); // DS
  b(0x9c,0x58,0x2e,0x89,0x86); refs.push([bytes.length,'records',14]); w(0); // FLAGS
  if (mode && mode<=3) { b(0xb8); w(mode === 1 ? 12 : mode === 2 ? 0 : 0x21); b(0xb9); w(0); b(0xcd,0x33); }
  b(0xfb,0x90,0x2e,0xff,0x06); ref('count');
  // Deliberately damage volatile/nonvolatile registers, segments and flags.
  for (let reg = 0; reg < 8; reg++) if (reg !== 4 && reg !== 5) { b(0xb8+reg); w(0xb000+reg); }
  b(0x8e,0xd8,0x8e,0xc0,0xf9,0xfd,0x5d,0xcb);
  label('exchange');w(0);w(0);w(0); label('count'); w(0); label('command'); w(0); label('records'); for(let i=0;i<256;i++) b(0);
  for(const [at,name,extra=0] of refs) { const v=labels[name]+extra; bytes[at]=v&255; bytes[at+1]=v>>8; }
  const v = labels.loop-(back+0x100+2); bytes[back]=v&255; bytes[back+1]=v>>8&255;
  return { bytes:Buffer.from(bytes), labels };
}

async function rig(mode, mask=127) {
  const f=fixture(mode,mask), m=new Machine(new Uint8Array(0),{autoKey:false});
  const vm=await makeVm('tailcall',{portIn:(p,w)=>m.portIn(p,w),portOut:(p,v,w)=>m.portOut(p,v,w)});
  m.setMemory(vm.mem,vm.exports); m.installIvt();
  const info=loadExe(vm.mem,f.bytes); vm.setAll({...info,flags:0xf202});
  const s=new DosSession(vm,m,{slice:32,stuckLimit:0});
  const live=Object.assign(Object.create(LiveRun.prototype),{machine:m,inputStopped:false});
  const at=name=>(info.cs<<4)+f.labels[name];
  const word=a=>vm.mem[a]|vm.mem[a+1]<<8;
  const until=(pred,label)=>{for(let i=0;i<3000;i++){if(pred())return;s.step();}throw Error('guest timeout: '+label);};
  until(()=>m.mouse.callback?.mask===mask,'registration');
  // Execute to the ordinary main loop before supplying asynchronous input.
  until(()=>vm.get('gip')===f.labels.loop,'main loop');
  return {f,m,vm,s,live,at,word,until};
}

async function main() {
  {
    const r=await rig(0), {m,vm,s,live,word,at,until}=r;
    const regs=['ax','bx','cx','dx','si','di','bp','sp','cs','ss','ds','es','fs','gs','gip','flags'];
    for(const [i,reg] of ['ax','bx','cx','dx','si','di','bp'].entries()) vm.exports[`set_${reg}`]((0xa100+i)<<16 | vm.get(reg));
    vm.set('flags',0xfed7);
    const before=Object.fromEntries(regs.map(k=>[k,vm.raw(k)]));
    const stack=vm.mem.slice((vm.get('ss')<<4)+vm.get('sp'),(vm.get('ss')<<4)+vm.get('sp')+2);
    vm.set('flags',before.flags&~0x200);
    live.mouseInput(123,45,1,7,-9);
    for(let i=0;i<3;i++)s.step();
    assert.equal(word(at('count')),0,'IF=0 defers delivery');
    for(const [reg,value] of Object.entries(before)) vm.exports[`set_${reg}`](value);
    live.mouseInput(125,46,3,2,1);
    live.mouseInput(125,46,0);
    assert.equal(word(at('count')),0,'enqueue must never run guest synchronously');
    until(()=>s.mouseCallback,'entry');
    // Input while a callback is active must queue, even if the guest enables IF.
    live.mouseInput(125,46,4);
    live.releaseMouse();
    until(()=>!s.mouseCallback,'first RETF');
    assert.deepEqual(Object.fromEntries(regs.map(k=>[k,vm.raw(k)])),before,'full interrupted context restored');
    assert.deepEqual(vm.mem.slice((vm.get('ss')<<4)+vm.get('sp'),(vm.get('ss')<<4)+vm.get('sp')+2),stack,'caller stack untouched');
    until(()=>word(at('count'))===5&&!s.mouseCallback,'five native RETFs');
    const expected=[[3,1,123,45,7,65527],[9,3,125,46,9,65528],[20,0,125,46,9,65528],[32,4,125,46,9,65528],[64,0,125,46,9,65528]];
    for(let i=0;i<5;i++) {
      const row=Array.from({length:8},(_,j)=>word(at('records')+32*i+2*j));
      assert.deepEqual(row.slice(0,6),expected[i]); assert.equal(row[6],callback.RETURN_SEG); assert.equal(row[7]&0x700,0);
    }
    assert.equal(m.mouse.buttons,0); assert.deepEqual(m.mouse.pressed,[1,1,1]); assert.deepEqual(m.mouse.released,[1,1,1]);
    vm.mem[at('command')]=12; // native INT33 0Bh clears accumulated motion
    until(()=>word(at('command'))===0,'guest motion counter read');
    assert.deepEqual([m.mouse.dx,m.mouse.dy],[0,0]);
    live.mouseInput(123,51,0,-2,5);
    until(()=>word(at('count'))===6&&!s.mouseCallback,'motion after guest counter clear');
    assert.deepEqual([word(at('records')+160+8),word(at('records')+160+10)],[65534,5]);
    console.log('PASS native queue/event masks/register ABI/RETF/full context/stack/nonrecursive lifetime');
  }
  {
    const {s,live,word,at,until}=await rig(0,2);
    live.mouseInput(11,12,0,3,4);live.mouseInput(11,12,2);
    for(let i=0;i<10;i++)s.step();
    assert.equal(word(at('count')),0,'mask filters movement and right press');
    live.mouseInput(11,12,3);live.releaseMouse();
    until(()=>word(at('count'))===1&&!s.mouseCallback,'selected left press');
    assert.deepEqual([word(at('records')),word(at('records')+2)],[2,3]);
    for(let i=0;i<10;i++)s.step();assert.equal(word(at('count')),1);
    console.log('PASS native selection mask excludes unrelated movement/button transitions');
  }
  for(const mode of [1,2,3]) {
    const {m,s,live,word,at,until}=await rig(mode);
    live.mouseInput(20,30,1);live.releaseMouse();
    until(()=>word(at('count'))===1&&!s.mouseCallback,'active unregister/reset RETF');
    assert.equal(m.mouse.callback.mask,0); assert.equal(m.mouse.events.length,0);
    live.mouseInput(21,31,1);live.releaseMouse(); for(let i=0;i<20;i++)s.step();
    assert.equal(word(at('count')),1,'no invocation after unregister/reset');
    console.log('PASS native active-callback '+['','unregister','reset','software reset'][mode]);
  }
  {
    const {m,s,live,word,at,until}=await rig(5);
    assert.deepEqual([m.mouse.rangeX,m.mouse.rangeY,m.mouse.x,m.mouse.y],[[0,2556],[0,1916],40,40]);
    const [x,y,dx,dy]=callback.screenInput(m.mouse,543,103,640,480,503,63);
    assert.deepEqual([x,y,dx,dy],[2172,412,799,139]);
    live.mouseInput(x,y,1,dx,dy);live.releaseMouse();
    until(()=>word(at('count'))===2&&!s.mouseCallback,'native guest virtual coordinate callback');
    assert.deepEqual(Array.from({length:6},(_,j)=>word(at('records')+2*j)),[3,1,2172,412,799,139]);
    { // Native mainline reset also restores the frontend grid.
      const a=at('command');s.vm.mem[a]=1;
      until(()=>m.mouse.callback.mask===0,'range reset');
      assert.equal(m.mouse.rangeX,undefined);assert.equal(m.mouse.rangeY,undefined);
    }
    console.log('PASS native guest range/ratio programming, mapped callback coordinates and reset');
  }
  {
    const {m,vm,s,live,word,at,until}=await rig(0);
    // Mainline reset must take the host path even with INT fast calls enabled.
    const a=at('command');vm.mem[a]=1;
    until(()=>m.mouse.callback.mask===0,'mainline hardware reset');
    live.mouseInput(25,25,1);live.releaseMouse();for(let i=0;i<20;i++)s.step();
    assert.equal(word(at('count')),0);
    console.log('PASS native mainline hardware reset with INT fast path enabled');
  }
  {
    const {f,m,s,live,word,at,until}=await rig(4);
    assert.deepEqual([word(at('exchange')),word(at('exchange')+2),word(at('exchange')+4)],
      [127,f.labels.handler,0x100],'guest exchange returned previous FAR tuple');
    live.mouseInput(25,25,1);live.releaseMouse();
    until(()=>word(at('count'))===2&&!s.mouseCallback,'exchanged handler restored and executed');
    assert.equal(m.mouse.callback.mask,127);
    console.log('PASS native function14 exchange/unregister/restore and actual callback execution');
  }
}
if(require.main===module) main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture,rig,main};
