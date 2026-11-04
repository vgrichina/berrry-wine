'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {createCanvas} = require('../lib/canvas-compat');
const {Win98Renderer} = require('../lib/renderer');
const hostPath = require.resolve('../host.js');
const context = {require:createRequire(hostPath), module:{exports:{}}, console};
vm.runInNewContext(fs.readFileSync(hostPath,'utf8')+'\nglobalThis.Host = WineAssembly;', context);
const host = new context.Host();
const r = new Win98Renderer(createCanvas(800,600));
host.renderer = r;
function idle() {
  return Object.hasOwn(host,'_lastInputEvent') && Object.hasOwn(r,'_activeInputEvent') &&
    Object.hasOwn(r,'_mouseButtonsMask') && host._lastInputEvent === null &&
    r._activeInputEvent === null && r._mouseButtonsMask === 0 && r.inputQueue.length === 0;
}
assert(idle(), 'real constructors expose idle without a host poll or input');
let capture = 0;
const wasm = {exports:{get_capture_hwnd:()=>capture,
  wnd_mouse_msg_origin_x:()=>0,wnd_mouse_msg_origin_y:()=>0}};
r.wasm = wasm;
r.windows[7] = {hwnd:7,visible:true,isChild:false,x:0,y:0,w:800,h:600,
  clientRect:{x:0,y:0,w:800,h:600},zOrder:1,wasm};
r._buttonHoldFloorMs = -1; // This fixture explicitly controls press/release order.
assert.equal(r.queueMouseInput(2,0,0,0,0),1);
assert(!idle()); assert.equal(r._mouseButtonsMask,1);
const down = r.takeInput();
assert.equal(down.msg,0x201); assert.equal(r._activeInputEvent,down);
assert.equal(r.getMouseButtons(),1);
assert.equal(r.takeInput(()=>false),null);
assert.equal(r._activeInputEvent,null); // Truly empty poll ends active delivery.
assert(!idle(), 'empty poll must not erase a physically held button');
r.queueMouseInput(4,0,0,0,0);
const up = r.takeInput(); assert.equal(up.msg,0x202);
assert.equal(r.getMouseButtons(),0); assert(!idle(), 'delivered release remains active');
r.takeInput(); assert(idle());
capture = 7;
r.queueMouseInput(1,12,15,0,0);
const move = r.takeInput();
assert.equal(move.hwnd,7); assert.equal(move.msg,0x200);
assert.equal(move.mouseButtons,0); assert.equal(r._mouseButtonsMask,0);
assert(!idle(), 'capture movement remains active despite zero getter');
r.queueMouseInput(1,2,3,0,0);
const queued = r.inputQueue[0];
r._activeInputEvent = move;
assert.equal(r.takeInput(()=>false),null);
assert.equal(r._activeInputEvent,move, 'foreign queue must preserve live active event');
assert.equal(r.inputQueue[0],queued);
r.takeInput(); r.takeInput(); assert(idle());
for (const field of ['_lastInputEvent','_activeInputEvent','_mouseButtonsMask']) {
  const owner = field === '_lastInputEvent' ? host : r;
  const old = owner[field]; owner[field] = field === '_mouseButtonsMask' ? 2 : up;
  assert(!idle(), 'active/stale/mask states cannot qualify as idle');
  new Win98Renderer(createCanvas(8,8)); new context.Host();
  assert.notEqual(owner[field],old,'another construction must not clear live state');
  owner[field] = old;
}
assert(idle());
// Execute the production host input imports against the constructed objects.
// No guest module or controller assignment replaces the event lifecycle.
const hostSource = fs.readFileSync(hostPath,'utf8');
const begin = hostSource.indexOf('    h.check_input = () => {');
const end = hostSource.indexOf('    // One `_lastInputEvent`',begin);
assert(begin > 0 && end > begin);
const h = {};
host.logToUI = () => {};
vm.runInNewContext(hostSource.slice(begin,end),{h,self:host,ctx:{}});
r.queueMouseInput(2,0,0,0,0);
h.check_input();
assert.equal(host._lastInputEvent,r._activeInputEvent);
assert.equal(host._lastInputEvent.msg,0x201);
assert.equal(h.check_input_wparam(),1);
r.queueMouseInput(4,0,0,0,0);
h.check_input();
assert.equal(host._lastInputEvent.msg,0x202);
assert(!idle()); h.check_input(); assert(idle());
console.log('PASS real renderer/host constructor idle, enqueue/dequeue, press-release, capture, foreign queue and stale-state negatives');
