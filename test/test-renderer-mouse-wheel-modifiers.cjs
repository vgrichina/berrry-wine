#!/usr/bin/env node
'use strict';

// Independently specified from Microsoft's WM_MOUSEWHEEL contract:
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousewheel
// Signed delta in HIWORD, currently held MK flags in LOWORD, signed SCREEN
// coordinates, delivered to focus. Zero DOM delta is covered by the DOM regression below.
const assert = require('node:assert/strict');
const { Win98Renderer } = require('../lib/renderer');
const { BASE } = require('../lib/region-map.generated');
const canvas = { width: 640, height: 480, getContext() {
  return new Proxy({}, { get: (_, k) => k === 'measureText'
    ? () => ({ width: 0 }) : () => {} });
} };
const leftShift = { code: 'ShiftLeft', location: 1 };
const rightShift = { code: 'ShiftRight', location: 2 };
const leftCtrl = { code: 'ControlLeft', location: 1 };
const rightCtrl = { code: 'ControlRight', location: 2 };
const cases = [
  ['bare', [], 0],
  ['generic Shift', [[16]], 4],
  ['generic Ctrl', [[17]], 8],
  ['generic both', [[16], [17]], 12],
  ['generic releases undrained', [[16], [17], [-16], [-17]], 0],
  ['left Shift', [[16, leftShift]], 4],
  ['right Ctrl', [[17, rightCtrl]], 8],
  ['sided releases undrained', [[16, leftShift], [17, rightCtrl], [-16, leftShift], [-17, rightCtrl]], 0],
  ['both Shift sides one released', [[16, leftShift], [16, rightShift], [-16, leftShift]], 4],
  ['both Ctrl sides one released', [[17, leftCtrl], [17, rightCtrl], [-17, rightCtrl]], 8],
  ['both sides released', [[16, leftShift], [16, rightShift], [17, leftCtrl],
    [17, rightCtrl], [-16, rightShift], [-16, leftShift], [-17, leftCtrl], [-17, rightCtrl]], 0],
  ['release then repress', [[16], [-16], [16, rightShift], [17, rightCtrl]], 12],
];
const memory = new WebAssembly.Memory({ initial: 2048, maximum: 2048, shared: true });
const words = new Int32Array(memory.buffer);
const di = BASE.DI_MOUSE_INPUT_STATE >>> 2;
const failures = [];
let count = 0;
for (const route of ['focus', 'EDIT', 'disabled', 'no-focus', 'no-callback', 'exclusive']) {
  for (const held of [0, 1, 2, 3]) for (const deltaY of [-1, 1]) {
    for (const [name, keys, flags] of cases) {
      const r = new Win98Renderer(canvas), sent = [], foreign = [];
      const owner = { exports: {
        get_focus_hwnd: () => route === 'no-focus' ? 0 : 101,
        ctrl_get_class: () => route === 'EDIT' ? 2 : 0,
        wnd_top_level: () => 100,
        get_capture_hwnd: () => 200,
        send_message: (hwnd, msg, wParam, lParam) => sent.push({ hwnd, msg, wParam, lParam }),
      } };
      const sibling = { exports: { get_focus_hwnd: () => 201,
        send_message: (...args) => foreign.push(args) } };
      r.wasm = owner; r.wasmMemory = memory;
      const win = { hwnd: 100, visible: true, isChild: false, x: 40, y: 50,
        w: 200, h: 160, style: route === 'disabled' ? 0x08000000 : 0,
        zOrder: 1, wasm: owner, wasmMemory: memory };
      r.windows[100] = win;
      r.windows[200] = { ...win, hwnd: 200, wasm: sibling, zOrder: 2 };
      // Physical button handlers run outside either window. Wheel must neither
      // hit-test there nor follow another process's capture or scheduler slice.
      if (held & 1) r.handleMouseDown(600, 450, 0);
      if (held & 2) r.handleMouseDown(600, 450, 2);
      r._foregroundWindow = win;
      for (const [vk, info] of keys) {
        if (vk > 0) r.handleKeyDown(vk, info);
        else r.handleKeyUp(-vk, info);
      }
      const label = `${route}/${held}/${deltaY}/${name}`;
      try {
        assert.equal(r._mouseButtonsMask || 0, held, 'real held buttons');
        assert.equal(!!r.peekKeyDownState(16), !!(flags & 4), 'physical Shift setup');
        assert.equal(!!r.peekKeyDownState(17), !!(flags & 8), 'physical Ctrl setup');
        const queue = r.inputQueue.slice();
        const presses = JSON.stringify(r._asyncPressedKeys);
        const before = Atomics.load(words, di + 71);
        const tail = Atomics.load(words, di + 3) >>> 0;
        if (route === 'no-callback') delete owner.exports.send_message;
        r.refreshInputPresentation = () => {};
        if (route === 'exclusive') r._exclusiveTransform = { hwnd: 100,
          srcX: -160, srcY: -100, srcW: 320, srcH: 200,
          dstX: 0, dstY: 0, dstW: 640, dstH: 400 };
        r.wasm = sibling;
        sent.length = 0; foreign.length = 0;
        r.handleWheel(route === 'exclusive' ? 100 : -71,
          route === 'exclusive' ? 80 : -29, deltaY);
        const delta = deltaY > 0 ? -120 : 120;
        assert.equal(Atomics.load(words, di + 71) - before, delta, 'DirectInput signed notch');
        assert.equal(Atomics.load(words, di + 3) >>> 0, tail + 1, 'one DI record');
        const event = Atomics.load(words, di + 4 + (tail & 63));
        assert.equal(event >>> 28, 9, 'DI wheel record type');
        assert.equal(event << 4 >> 4, delta, 'DI wheel record delta');
        assert.deepEqual(r.inputQueue, queue, 'keyboard queue stays undrained');
        assert.equal(JSON.stringify(r._asyncPressedKeys), presses, 'peek preserves press bits');
        assert.deepEqual(foreign, [], 'foreground process owns wheel');
        const wheels = sent.filter(e => e.msg === 0x20a);
        if (route === 'no-focus' || route === 'no-callback') {
          assert.deepEqual(wheels, [], 'no USER wheel without focus/callback');
        } else {
          assert.equal(wheels.length, 1, 'one USER wheel');
          const e = wheels[0];
          assert.equal(e.hwnd, 101, 'focus wins over pointer/capture/sibling');
          assert.equal(e.wParam >> 16, delta, 'signed high word');
          assert.equal(e.lParam << 16 >> 16, route === 'exclusive' ? -110 : -71, 'signed SCREEN X');
          assert.equal(e.lParam >> 16, route === 'exclusive' ? -60 : -29, 'signed SCREEN Y');
          assert.equal(e.wParam & 0xffff, flags | held, 'physical MK flags');
        }
      } catch (error) { failures.push({ label, error: error.message, sent }); }
      count++;
      // Fresh physical ring per case, without allocating a new large memory.
      words.fill(0, di, di + 72);
    }
  }
}
console.log(JSON.stringify({ count, failures }, null, 2));
assert.equal(failures.length, 0, `${failures.length}/${count} wheel cases failed`);

// Zero vertical DOM events must be inert before restoring process ownership.
// Bounded, stateful DOM for setup + wheel. No production input algorithms.
function createDOM() {
  let doc;
  const calls = [];
  class Event {
    constructor(type, init={}) {
      Object.assign(this, {type, bubbles:false, cancelable:false, isTrusted:false,
        defaultPrevented:false, preventCalls:0, eventPhase:0, target:null,
        currentTarget:null, _passive:false, _stop:false, _immediate:false}, init);
    }
    preventDefault() {
      this.preventCalls++; this.onPrevent?.();
      if (this.cancelable && !this._passive) this.defaultPrevented=true;
    }
    stopPropagation() { this._stop=true; }
    stopImmediatePropagation() { this._stop=true; this._immediate=true; }
  }
  class Target {
    constructor() { this.listeners=new Map(); this.parentNode=null; }
    addEventListener(type, fn, options={}) {
      if (!fn) return;
      const capture=options===true || !!options.capture;
      const list=this.listeners.get(type)||[];
      if (!list.some(x=>x.fn===fn && x.capture===capture)) list.push({fn,capture,
        passive:!!options.passive,once:!!options.once,removed:false,
        options:typeof options==='object'?{...options}:options});
      this.listeners.set(type,list);
    }
    removeEventListener(type,fn,options={}) {
      const capture=options===true || !!options.capture;
      for(const row of this.listeners.get(type)||[]) if(row.fn===fn&&row.capture===capture)row.removed=true;
      this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>!x.removed));
    }
    dispatchEvent(event) {
      if (!(event instanceof Event)) throw Error('fixture requires its Event');
      if (event.eventPhase) throw Error('event already dispatching');
      event.target=this;
      const ancestors=[]; for(let p=this.parentNode;p;p=p.parentNode)ancestors.push(p);
      const invoke=(node,capture,phase)=>{
        event.currentTarget=node; event.eventPhase=phase;
        for(const row of [...(node.listeners.get(event.type)||[])]) {
          if(row.removed||row.capture!==capture)continue;
          if(row.once)node.removeEventListener(event.type,row.fn,row.capture);
          event._passive=row.passive;
          try { typeof row.fn==='function'?row.fn.call(node,event):row.fn.handleEvent(event); }
          finally { event._passive=false; }
          if(event._immediate)break;
        }
        if(!capture&&!event._immediate&&typeof node['on'+event.type]==='function') {
          if(node['on'+event.type](event)===false)event.preventDefault();
        }
      };
      try {
        for(const node of [...ancestors].reverse()){invoke(node,true,1);if(event._stop)break;}
        if(!event._stop){invoke(this,true,2);if(!event._immediate)invoke(this,false,2);}
        if(event.bubbles&&!event._stop)for(const node of ancestors){invoke(node,false,3);if(event._stop)break;}
      } finally {event.currentTarget=null;event.eventPhase=0;event._stop=false;event._immediate=false;}
      return !event.defaultPrevented;
    }
  }
  class Node extends Target {
    constructor(tagName){super();this.tagName=tagName;this.children=[];this.attributes=new Map();
      this.style={};this.value='';this.rect={left:0,top:0,width:0,height:0};
      const tokens=()=>new Set((this.getAttribute('class')||'').split(/\s+/).filter(Boolean));
      const put=set=>this.setAttribute('class',[...set].join(' '));
      this.classList={contains:t=>tokens().has(t),
        add:(...ts)=>{const s=tokens();ts.forEach(t=>s.add(t));put(s);},
        remove:(...ts)=>{const s=tokens();ts.forEach(t=>s.delete(t));put(s);},
        toggle:(t,force)=>{const s=tokens(),on=force===undefined?!s.has(t):!!force;
          on?s.add(t):s.delete(t);put(s);return on;}};
    }
    appendChild(child){if(child.parentNode instanceof Node)child.parentNode.children.splice(child.parentNode.children.indexOf(child),1);
      child.parentNode=this;this.children.push(child);return child;}
    contains(other){for(let n=other;n;n=n.parentNode)if(n===this)return true;return false;}
    setAttribute(name,value){this.attributes.set(String(name).toLowerCase(),String(value));}
    getAttribute(name){return this.attributes.get(String(name).toLowerCase())??null;}
    get tabIndex(){const raw=this.getAttribute('tabindex');return raw===null?-1:Number.parseInt(raw,10);}
    getBoundingClientRect(){const r=this.rect;calls.push('rect');return {...r,x:r.left,y:r.top,right:r.left+r.width,bottom:r.top+r.height};}
    matches(selector){
      if(selector.startsWith('.'))return selector.slice(1).split('.').every(t=>this.classList.contains(t));
      if(/^\[[\w-]+\]$/.test(selector))return this.getAttribute(selector.slice(1,-1))!==null;
      throw Error('unsupported selector '+selector);
    }
    closest(selector){for(let n=this;n instanceof Node;n=n.parentNode)if(n.matches(selector))return n;return null;}
    focus(options={}) {
      if(this.tabIndex<0&&!['INPUT','TEXTAREA','SELECT','BUTTON','BODY'].includes(this.tagName))return;
      if(doc.activeElement===this)return;
      const old=doc.activeElement;
      doc.activeElement=doc.body;
      if(old){old.dispatchEvent(new Event('blur',{relatedTarget:this}));old.dispatchEvent(new Event('focusout',{bubbles:true,relatedTarget:this}));}
      doc.activeElement=this;
      this.dispatchEvent(new Event('focus',{relatedTarget:old}));
      this.dispatchEvent(new Event('focusin',{bubbles:true,relatedTarget:old}));
      calls.push({focus:this.tagName,preventScroll:!!options.preventScroll});
    }
    blur(){if(doc.activeElement!==this)return;doc.activeElement=doc.body;
      this.dispatchEvent(new Event('blur'));this.dispatchEvent(new Event('focusout',{bubbles:true}));}
  }
  const win=new Target();doc=new Target();doc.parentNode=win;
  doc.documentElement=new Node('HTML');doc.documentElement.parentNode=doc;
  doc.body=doc.documentElement.appendChild(new Node('BODY'));
  const canvas=doc.body.appendChild(new Node('CANVAS'));
  canvas.width=640;canvas.height=480;canvas.rect={left:10,top:20,width:320,height:240};
  doc.activeElement=doc.body;doc.pointerLockElement=null;doc.webkitPointerLockElement=null;
  doc.fullscreenElement=null;doc.webkitFullscreenElement=null;doc.visibilityState='visible';
  Object.defineProperty(doc,'hidden',{get:()=>doc.visibilityState==='hidden'});
  const all=()=>{const out=[];function walk(n){out.push(n);for(const c of n.children)walk(c);}walk(doc.documentElement);return out;};
  doc.getElementById=id=>all().find(n=>n.getAttribute('id')===String(id))||null;
  doc.querySelectorAll=selector=>all().filter(n=>n.matches(selector));
  doc.elementFromPoint=()=>{throw Error('layout hit-test outside wheel fixture contract');};
  let nextTimer=1;const timers=new Map();
  const setTimer=(kind,fn,ms)=>{const id=nextTimer++;timers.set(id,{id,kind,fn,ms});return id;};
  const clearTimer=id=>timers.delete(id);
  const api={win,doc,canvas,Node,Event,calls,timers,
    setInterval:(fn,ms)=>setTimer('interval',fn,ms),clearInterval:clearTimer,
    setTimeout:(fn,ms)=>setTimer('timeout',fn,ms),clearTimeout:clearTimer};
  api.install=()=>Object.assign(global,{window:win,document:doc,Node,MouseEvent:Event,
    setInterval:api.setInterval,clearInterval:api.clearInterval});
  return api;
}
function runWheelZeroDeltaRegression(root) {
  const assert = require('node:assert/strict');
  const crypto = require('node:crypto');
  const hash = b => crypto.createHash('sha256').update(b).digest('hex');
  const {installInputHandlers} = require(root + '/lib/renderer-input.js');
  const {wireCanvasInput} = require(root + '/lib/browser-input.js');
  const {BASE} = require(root + '/lib/region-map.generated.js');
  const result = {rows:[], failures:[], assertions:0};
  const check = (actual, expected, label) => {
    result.assertions++;
    try {assert.deepStrictEqual(actual, expected, label);}
    catch(e) {result.failures.push({label, actual:e.actual, expected:e.expected, message:e.message});}
  };
  const dom = createDOM(); dom.install();
  class Renderer {}
  installInputHandlers(Renderer);
  const r = new Renderer(), base = BASE.DI_MOUSE_INPUT_STATE, b = base >>> 2;
  const memory = {buffer:new SharedArrayBuffer(base + 4096)};
  const foreignMemory = {buffer:new SharedArrayBuffer(base + 4096)};
  const bytes = new Uint8Array(memory.buffer), foreign = new Uint8Array(foreignMemory.buffer);
  bytes.fill(0x7a, base-64, base+352); foreign.fill(0x93, base-64, base+352);
  const words = new Int32Array(memory.buffer);
  const messages=[], signals=[], invalidations=[], publications=[], order=[];
  const wasm = {exports:{get_focus_hwnd:()=>0x2345, send_message:(...args)=>{order.push('send');messages.push(args);}}};
  const foreignWasm = {exports:{send_message:()=>{throw Error('foreign dispatch');}}};
  const foreground = {hwnd:0x1234,visible:true,isChild:false,wasm,wasmMemory:memory};
  const heldOwner = {wasm:foreignWasm,memory:foreignMemory,button:1};
  const devices = new Map([[93,{capacity:2,events:[{vk:65,down:1}],head:0,length:1,active:true,sequence:73}]]);
  Object.assign(r,{canvas:dom.canvas,wasm,wasmMemory:memory,windows:{4660:foreground},_foregroundWindow:foreground,
    _keyboardInputWasm:wasm,_keyboardInputMemory:memory,_mouseButtonsMask:0x11,_mouseInputOwner:heldOwner,
    _asyncKeys:{16:true,17:true,65:true},_physicalKeys:{16:true,17:true,65:false},_asyncPressedKeys:{65:true},
    _diKeyboardClients:new Set([new WeakRef(devices)]),_pointerProcessOwners:new Map(),
    inputQueue:[{type:'key',vk:65},{type:'mouse',msg:0x201}],_cursorX:19,_cursorY:23,
    invalidate:hwnd=>invalidations.push(hwnd),_signalDirectInputDevice:t=>{order.push('signal');signals.push(t);},
    _directInputMousePublished:(mem,seq,code)=>publications.push({foreground:mem===memory,seq,code:code>>>0})});
  dom.canvas.style.cursor='crosshair';
  wireCanvasInput(dom.canvas,r,{runningApps:[],setTimeout:dom.setTimeout,clearTimeout:dom.clearTimeout});
  check(dom.canvas.listeners.get('wheel').map(x=>x.options),[{passive:false}],'DOM retains nonpassive policy');
  const stable=()=>JSON.stringify({keys:r._asyncKeys,physical:r._physicalKeys,presses:r._asyncPressedKeys,
    queue:r.inputQueue,buttons:r._mouseButtonsMask,devices:[...devices],cursor:[r._cursorX,r._cursorY,dom.canvas.style.cursor]});
  const outside=()=>hash(Buffer.concat([Buffer.from(bytes.subarray(0,base)),Buffer.from(bytes.subarray(base+288))]));
  const foreignHash=hash(foreign), outsideHash=outside(), stableBefore=stable();
  function seed(head,tail) {
    words.fill(0,b,b+72); words[b]=23; words[b+1]=-31;words[b+2]=head;words[b+3]=tail;
    for(let i=0;i<64;i++)words[b+4+i]=(0x50000000+i)|0;
    words[b+71]=37;
  }
  const cases=[];
  for(const mode of [0,1,2]) for(const [name,x,y] of [['zero',0,0],['negative-zero',0,-0],['horizontal-positive',7,0],['horizontal-negative',-9,0]])
    cases.push({id:mode+'/'+name,mode,x,y,expected:0,head:62,tail:64});
  for(const mode of [0,1,2]) for(const [name,y,expected] of [['positive-fraction',0.25,-120],['negative-fraction',-0.5,120],['reverse-positive',0.125,-120],['reverse-negative',-0.125,120]])
    cases.push({id:mode+'/'+name,mode,x:3,y,expected,head:62,tail:64});
  // Zero cannot consume the reserved button capacity or advance sequence even
  // with overflow already pending. Nonzero retains existing overflow behavior.
  for(const y of [0,-0,0.25,-0.25]) cases.push({id:'full/'+String(y)+(Object.is(y,-0)?'/minus':''),mode:0,x:9,y,expected:y===0?0:y>0?-120:120,head:11,tail:75,full:true});
  cases.push({id:'exited-process',mode:0,x:0,y:-0.25,expected:0,head:62,tail:64,exited:true});
  seed(62,64);
  for(const row of cases) {
    // Fractions in each mode share a ring: test the literal FIFO prefix and
    // reverse ordering rather than resetting between those four events.
    if(!row.id.includes('reverse') && !row.id.includes('negative-fraction'))seed(row.head,row.tail);
    if(row.full)words[b+70]=13;
    r._pointerProcessOwners.set(wasm,{exited:!!row.exited});
    r.wasm=foreignWasm;r.wasmMemory=foreignMemory;
    r._keyboardInputWasm=foreignWasm;r._keyboardInputMemory=foreignMemory;
    const before=Buffer.from(bytes.subarray(base,base+288));
    const tail=words[b+3],nMsg=messages.length,nSig=signals.length,nInv=invalidations.length,nPub=publications.length;
    const expected=Buffer.from(before); order.length=0;
    const e=new dom.Event('wheel',{deltaMode:row.mode,deltaX:row.x,deltaY:row.y,deltaZ:0,
      bubbles:true,cancelable:true,clientX:50,clientY:65,onPrevent:()=>order.push('preventDefault')});
    dom.canvas.dispatchEvent(e);
    const delta=row.expected;
    if(delta) {
      expected.writeInt32LE(expected.readInt32LE(284)+delta,284);
      if(row.full)expected.writeInt32LE(expected.readInt32LE(280)+delta,280);
      else {expected.writeInt32LE(tail+1,12);expected.writeUInt32LE(((9<<28)|(delta&0x0fffffff))>>>0,16+(tail&63)*4);}
    }
    const prefix=row.id+': ';
    check(Buffer.from(bytes.subarray(base,base+288)),expected,prefix+'entire DI region incl capacity FIFO sequence and accumulator');
    check(messages.slice(nMsg),delta?[[0x2345,0x20a,(((delta&65535)<<16)|0x1d)>>>0,5898320]]:[],prefix+'exact WM wheel');
    check(signals.slice(nSig),delta?[2]:[],prefix+'device signal');
    check(invalidations.slice(nInv),delta?[0x2345]:[],prefix+'invalidation');
    check(publications.slice(nPub),delta&&!row.full?[{foreground:true,seq:tail,code:((9<<28)|(delta&0xfffffff))>>>0}]:[],prefix+'published sequence');
    check(order,delta?['preventDefault','signal','send']:['preventDefault'],prefix+'DOM cancellation order');
    check(e.preventCalls,1,prefix+'preventDefault once'); check(e.defaultPrevented,true,prefix+'DOM default cancelled');
    const restores=row.y!==0;
    check(r.wasm=== (restores?wasm:foreignWasm),true,prefix+'process ownership');
    check(r.wasmMemory===(restores?memory:foreignMemory),true,prefix+'process memory ownership');
    check(r._keyboardInputWasm===(restores?wasm:foreignWasm),true,prefix+'keyboard ownership');
    check(r._keyboardInputMemory===(restores?memory:foreignMemory),true,prefix+'keyboard memory ownership');
    check(r._mouseInputOwner===heldOwner,true,prefix+'held button owner identity');
    check(r._foregroundWindow===foreground,true,prefix+'foreground identity');
    check(stable(),stableBefore,prefix+'keyboard button cursor device capacity sequence queue guards');
    check(hash(foreign),foreignHash,prefix+'entire foreign memory guard');
    check(outside(),outsideHash,prefix+'entire outside memory guard');
    result.rows.push({id:row.id,negativeZero:Object.is(row.y,-0),deltaY:row.y,expectedDelta:delta,
      actualDelta:words[b+71]-before.readInt32LE(284),tailBefore:tail,tailAfter:words[b+3],wmCount:messages.length-nMsg});
  }
  result.loaded=Object.keys(require.cache).filter(p=>p.startsWith(root+'/lib/')).map(p=>p.slice(root.length+1)).sort();
  result.status=result.failures.length?'FAIL':'PASS';
  return result;
}
const wheelZeroDeltaResult = runWheelZeroDeltaRegression(require('node:path').resolve(__dirname, '..'));
console.log(JSON.stringify(wheelZeroDeltaResult, null, 2));
assert.equal(wheelZeroDeltaResult.failures.length, 0, 'DOM zero-delta regression');
