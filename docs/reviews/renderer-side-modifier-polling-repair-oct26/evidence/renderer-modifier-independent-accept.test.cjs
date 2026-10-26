'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { installInputHandlers } = require('../lib/renderer-input');
class Input {
  constructor() { this.inputQueue = []; this.windows = {}; this.wasm = null; this.mainWasm = null; }
}
installInputHandlers(Input);
const families = [[16, 'Shift', 160, 161, 42, 54], [17, 'Control', 162, 163, 29, 29], [18, 'Alt', 164, 165, 56, 56]];
const down = (r, vk, code, extra = {}) => r.handleKeyDown(vk, { code, ...extra });
const up = (r, vk, code, extra = {}) => r.handleKeyUp(vk, { code, ...extra });
const drain = r => { const out = []; for (let i=0;i<100;i++) { const e=r.takeInput(); if(!e)return out; out.push(e); } throw Error('queue did not drain'); };
const bit = (e, n) => (e.lParam >>> n) & 1;
for (const [vk, name, leftVK, rightVK, leftScan, rightScan] of families) {
  for (const first of ['Left', 'Right']) for (const releasedFirst of ['Left', 'Right']) {
    test(`${name} public aggregate both press/release orders ${first}/${releasedFirst}`, () => {
      const r=new Input(), other=first==='Left'?'Right':'Left', remaining=releasedFirst==='Left'?'Right':'Left';
      down(r,vk,name+first); down(r,vk,name+other); up(r,vk,name+releasedFirst);
      assert.equal(r.peekKeyDownState(vk),0x8000);
      down(r,65,'KeyA'); up(r,vk,name+remaining);
      assert.equal(r.peekKeyDownState(vk),0);
      const events=drain(r);
      assert.equal(events.length,5);
      for (let i=0;i<2;i++) {
        assert.equal(bit(events[i],30),0);
        assert.equal((events[i].lParam>>>16)&255,[first,other][i]==='Left'?leftScan:rightScan);
        assert.equal(bit(events[i],24),name!=='Shift'&&[first,other][i]==='Right'?1:0);
      }
      assert.equal(bit(events[2],30),1); assert.equal(bit(events[2],31),1);
      assert.equal(events[3].wParam,65);
      assert.equal(bit(events[3],29),name==='Alt'?1:0);
      assert.equal(r.peekAsyncKeyState(vk),0);
      assert.equal(r.peekKeyDownState(65),0x8000);
      up(r,65,'KeyA');drain(r);assert.equal(r.peekKeyDownState(65),0);
    });
  }
  test(`${name} side-specific public physical and async polling`, () => {
    const r=new Input();
    const trace=[];
    const sample=()=>trace.push([vk,leftVK,rightVK].map(k=>[r.peekKeyDownState(k),r.peekAsyncKeyState(k)]));
    down(r,vk,name+'Left'); r.takeInput();
    assert.equal(r.peekAsyncKeyState(vk),0x8000,'aggregate positive control');
    sample();down(r,vk,name+'Right');r.takeInput();sample();up(r,vk,name+'Left');r.takeInput();sample();
    up(r,vk,name+'Right');drain(r);sample();
    const on=[32768,32768],off=[0,0];
    assert.deepEqual(trace,[[on,on,off],[on,on,on],[on,off,on],[off,off,off]],'physical and async aggregate/left/right sequence');
  });
  test(`${name} side-specific async alone through public input`, () => {
    const r=new Input();down(r,vk,name+'Right');r.takeInput();
    assert.equal(r.getAsyncKeyState(vk)&0x8000,0x8000,'aggregate control');
    assert.equal(r.getAsyncKeyState(rightVK)&0x8000,0x8000,'right async VK must reflect right press');
  });
  test(`${name} repeat, unmatched release, contradictory location and reset`, () => {
    const r=new Input();
    down(r,vk,name+'Left',{location:2});down(r,vk,name+'Left',{repeat:false});
    down(r,vk,name+'Left',{repeat:true});up(r,vk,name+'Right');
    assert.equal(r.peekKeyDownState(vk),0x8000,'code identity wins conflicting location');
    const es=drain(r);assert.deepEqual(es.slice(0,3).map(e=>bit(e,30)),[0,1,1]);
    assert.equal(r.peekAsyncKeyState(vk),0x8000);
    up(r,vk,name+'Left');up(r,vk,name+'Left');drain(r);
    assert.equal(r.peekAsyncKeyState(vk),0);
    down(r,vk,name+'Right',{repeat:true});assert.equal(bit(r.takeInput(),30),1,'DOM repeat explicitly sets previous bit');
    r.handleKeyUp(vk);drain(r);assert.equal(r.peekKeyDownState(vk),0);
    down(r,vk,name+'Right');assert.equal(bit(r.takeInput(),30),0);
    r.handleKeyUp(vk);drain(r);
  });
  test(`${name} CLI numeric ownership mixed with physical and focus release`, () => {
    const r=new Input();r.handleKeyDown(vk);down(r,vk,name+'Left');down(r,vk,name+'Right');drain(r);
    up(r,vk,name+'Left');up(r,vk,name+'Right');drain(r);
    assert.equal(r.peekKeyDownState(vk),0x8000,'numeric owner survives physical releases');
    assert.equal(r.peekAsyncKeyState(vk),0x8000);
    r.handleKeyUp(vk);drain(r);assert.equal(r.peekAsyncKeyState(vk),0);
    down(r,vk,name+'Left');down(r,vk,name+'Right');
    // Browser blur's public numeric release route, with pending messages.
    r.handleKeyUp(vk);drain(r);assert.equal(r.peekKeyDownState(vk),0);assert.equal(r.peekAsyncKeyState(vk),0);
    down(r,vk,name+'Left');assert.equal(bit(r.takeInput(),30),0);r.handleKeyUp(vk);drain(r);
  });
}
test('numeric browser key codes and nonmodifier message bits remain unchanged', () => {
  const r=new Input();
  for(const [vk,code,scan,extended] of [[65,'KeyA',30,0],[49,'Digit1',2,0],[97,'Numpad1',79,0],[13,'NumpadEnter',28,1],[39,'ArrowRight',77,1]]) {
    down(r,vk,code);down(r,vk,code,{repeat:true});up(r,vk,code);
    const es=drain(r);assert.equal(es.length,3);
    assert.deepEqual(es.map(e=>e.wParam),[vk,vk,vk]);
    assert.deepEqual(es.map(e=>e.msg),[256,256,257]);
    assert.deepEqual(es.map(e=>bit(e,30)),[0,1,1]);
    for(const e of es){assert.equal(e.lParam&65535,1);assert.equal((e.lParam>>>16)&255,scan);assert.equal(bit(e,24),extended);assert.equal(bit(e,29),0);}
    assert.equal(r.peekAsyncKeyState(vk),0);assert.equal(r.peekKeyDownState(vk),0);
    r.handleKeyDown(vk);r.handleKeyUp(vk);assert.equal(drain(r).length,2);
  }
});
test('Alt chord context survives opposite-side release; Ctrl suppresses system family', () => {
  const r=new Input();down(r,18,'AltRight');down(r,18,'AltLeft');up(r,18,'AltRight');down(r,65,'KeyA');
  let e=r.inputQueue.at(-1);assert.equal(e.msg,260);assert.equal(bit(e,29),1);
  down(r,17,'ControlRight');down(r,17,'ControlLeft');up(r,17,'ControlRight');down(r,66,'KeyB');
  e=r.inputQueue.at(-1);assert.equal(e.msg,256);assert.equal(bit(e,29),0);
  up(r,18,'AltLeft');drain(r);assert.equal(!!r._menuMode,false);
});
test('Alt tap final release and F10 system messages', () => {
  const r=new Input();down(r,18,'AltRight');down(r,18,'AltLeft');up(r,18,'AltLeft');
  assert.equal(!!r._menuMode,false);up(r,18,'AltRight');assert.equal(r._menuMode,true);
  const es=drain(r);assert.deepEqual(es.map(e=>e.msg),[260,260,261,261]);assert.equal(bit(es.at(-1),29),0);
  const f=new Input();down(f,121,'F10');up(f,121,'F10');assert.deepEqual(drain(f).map(e=>e.msg),[260,261]);
});
test('Alt+Space and Alt+F4 system menu/close hotkeys retain context after side release', () => {
  for(const [vk,code,scan] of [[32,'Space',57],[115,'F4',62]]) {
    const r=new Input();down(r,18,'AltLeft');down(r,18,'AltRight');up(r,18,'AltRight');
    down(r,vk,code);up(r,vk,code);up(r,18,'AltLeft');
    const es=drain(r);const key=es.filter(e=>e.wParam===vk);
    assert.deepEqual(key.map(e=>e.msg),[260,261]);
    for(const e of key){assert.equal(bit(e,29),1);assert.equal((e.lParam>>>16)&255,scan);}
    assert.equal(!!r._menuMode,false,'hotkey cancels Alt tap');
  }
});
test('Shift+F10 context menu survives first-side release', () => {
  const r=new Input(),calls=[];
  r.wasm={exports:{get_focus_hwnd:()=>7,post_message_q:(...args)=>calls.push(args)}};
  down(r,16,'ShiftRight');down(r,16,'ShiftLeft');up(r,16,'ShiftRight');down(r,121,'F10');
  assert.deepEqual(calls,[[7,123,7,4294967295]]);
  r.handleKeyUp(16);drain(r);
});
