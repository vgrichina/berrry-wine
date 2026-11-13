#!/usr/bin/env node
'use strict';
// Real shared-memory instances share process menu tracking (e7bd19742). A page menu must
// consume Escape without invoking a guest callback on its shadow CPU. With no
// menu, preserve the game's own Escape (Tetris deliberately minimizes).
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');
const { Win98Renderer: Renderer } = require('../lib/renderer');
const moduleBytes = fs.readFileSync(path.join(__dirname, '../build/wine-assembly.wasm'));
const wasmModule = new WebAssembly.Module(moduleBytes);
const memory = new WebAssembly.Memory({ initial:8192, maximum:8192, shared:true });
function instance() {
  const imports = {};
  for (const item of WebAssembly.Module.imports(wasmModule)) {
    imports[item.module] ||= {};
    imports[item.module][item.name] = item.kind === 'memory' ? memory :
      () => { throw Error('Unexpected host callback: '+item.name); };
  }
  return new WebAssembly.Instance(wasmModule, imports);
}
const owner=instance(), page=instance();
page.exports.set_host_shadow(1);
function make(worker=true) {
  const r=Object.create(Renderer.prototype);
  // Keyboard ownership token differs from the instance with the painted menu.
  r.wasm=owner; r.mainWasm=page; r.windows={}; r.inputQueue=[];
  r._guestWorkerWasms=new Set(worker?[owner]:[]);
  r._restoreKeyboardInputOwner=()=>{}; r._seedKeyboardFocus=()=>{};
  r.pokeKeyDownState=()=>{}; r._signalDirectInputDevice=()=>{};
  r._wakeMessageWait=()=>{}; r.repaint=()=>{};
  return r;
}
function press(r,key=27,char=true) {
  r.handleKeyDown(key);
  if(char)r.handleKeyPress(key);
  r.handleKeyUp(key);
}
function open() { page.exports.menu_open(0x10001,0); }
open();
assert.equal(owner.exports.menu_open_hwnd(),0x10001,'menu identity is process-shared');
assert.equal(page.exports.menu_open_hwnd(),0x10001);
const r=make();
r.handleKeyDown(27);r.handleKeyPress(27);
assert.equal(page.exports.menu_open_hwnd(),0,'Escape must close the real page menu');
assert.equal(owner.exports.menu_open_hwnd(),0,'owner observes the shared dismissal');
assert.deepEqual(r.inputQueue,[],'consumed Escape cannot reach guest minimize handler');
r.handleKeyDown(27);r.handleKeyPress(27); // repeat after menu closed
// Other keys still reach the Worker during the consumed Escape press.
r.handleKeyDown(37);r.handleKeyUp(37);
r.handleKeyUp(27);
assert.deepEqual(r.inputQueue.map(e=>[e.msg,e.wParam]),[[256,37],[257,37]]);
assert.equal(r._asyncKeys[27],false,'release cannot leave Escape held');
r.inputQueue=[];
press(r);
assert.deepEqual(r.inputQueue.map(e=>[e.msg,e.wParam,e.lParam>>>0]),[
  [256,27,0x00010001],[258,27,0x00010001],[257,27,0xc0010001],
],'menu-closed Escape retains exact normal down/char/up payload');
// DOM input need not generate char: suppression cannot leak into next press.
open(); r.inputQueue=[];press(r,27,false);press(r);
assert.deepEqual(r.inputQueue.map(e=>e.msg),[256,258,257]);
// Cooperatively owned existing menu handling still closes its own popup.
open(); const coop=make(false);coop.handleKeyDown(27);coop.handleKeyPress(27);
assert.equal(page.exports.menu_open_hwnd(),0);
assert.deepEqual(coop.inputQueue,[]);
coop.handleKeyDown(27);coop.handleKeyPress(27);coop.handleKeyUp(27);
assert.deepEqual(coop.inputQueue,[],'cooperative menu also consumes the entire press');
press(coop);
assert.deepEqual(coop.inputQueue.map(e=>[e.msg,e.wParam,e.lParam>>>0]),[
  [256,27,0x00010001],[258,27,0x00010001],[257,27,0xc0010001],
],'cooperative menu-closed Escape preserves the normal payload');
open(); owner.exports.menu_close();
assert.equal(page.exports.menu_open_hwnd(),0,'explicit owner menu_close is visible to the page');
r.inputQueue=[];press(r);
assert.deepEqual(r.inputQueue.map(e=>e.msg),[256,258,257],
  'explicit menu_close does not consume the next ordinary Worker Escape');
console.log('PASS shared owner/shadow menu, callback-free Escape, repeat/char/up suppression, unrelated Left, exact normal Escape, cooperative menu');
