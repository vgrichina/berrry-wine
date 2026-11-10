'use strict';
// Opt-in, read-only observations of the production DOM/renderer/DI boundary.
// A FIFO head advance proves a drain, never a guest menu decision or hit.
(function(scope) {
function install(o = {}) {
  if (!o.enabled) return null;
  const {canvas, renderer:r, memory, diBase, emit = () => {},
    now = () => performance.now(), interval = setInterval,
    clear = clearInterval, limit = 8192, durationMs = 1440000} = o;
  if (!canvas || !r || !memory?.buffer || !Number.isInteger(diBase) || diBase < 0 ||
      diBase + 288 > memory.buffer.byteLength || !Number.isInteger(limit) || limit < 8 || limit > 16384 ||
      !Number.isInteger(durationMs) || durationMs < 1 || durationMs > 1440000)
    throw Error('Nox observer bounds');
  const words = new Int32Array(memory.buffer), base = diBase >>> 2;
  const shared = typeof SharedArrayBuffer !== 'undefined' && memory.buffer instanceof SharedArrayBuffer;
  const load = i => shared ? Atomics.load(words, base + i) : words[base + i];
  let active = true, sequence = 0, binding = null, lastHead = load(2) >>> 0;
  const started = now(), deadline = started + durationMs, records = [], restores = [];
  const clone = v => v == null ? null : JSON.parse(JSON.stringify(v));
  function state() {
    const rect = canvas.getBoundingClientRect();
    return {locked:(o.document.pointerLockElement || o.document.webkitPointerLockElement) === canvas,
      canvas:{width:canvas.width,height:canvas.height,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}},
      transform:clone(r._exclusiveTransform),viewport:clone(r._exclusivePresentationViewport),
      cursor:{x:r._mouseX ?? null,y:r._mouseY ?? null,buttons:r._mouseButtonsMask ?? null},
      reference:clone(r._directInputMousePoints?.get(memory)),
      di:{base:diBase,dx:load(0),dy:load(1),head:load(2)>>>0,tail:load(3)>>>0,
        overflowX:load(68),overflowY:load(69),overflowZ:load(70),wheel:load(71)}};
  }
  function stop(reason) {
    if (!active) return;
    active = false; clear(timer);
    for (const restore of restores.reverse()) restore();
    emit({kind:'observer-stop',sequence:++sequence,at:now(),binding:clone(binding),reason,records:records.length});
  }
  function record(kind, fields = {}) {
    if (!active) return;
    if (now() >= deadline) { stop('deadline'); return; }
    if (records.length >= limit) { stop('record-limit'); return; }
    const row = {kind,sequence:++sequence,at:now(),binding:clone(binding),...fields};
    records.push(row); emit(row);
  }
  function sample() {
    if (!active) return;
    if (now() >= deadline) { stop('deadline'); return; }
    if (memory.buffer !== words.buffer) { stop('memory-changed'); return; }
    const head = load(2) >>> 0, count = (head - lastHead) >>> 0;
    if (count) {
      // Queue slots may already have been reused. Never label their current
      // contents as consumed payloads. Delivery records own the original words.
      record('guest-drain',{fromHead:lastHead,toHead:head,count,
        payloads:null,meaning:'production FIFO head advanced; guest decision unobserved',state:state()});
      lastHead = head;
    }
  }
  const timer = interval(sample, 4);
  if (timer?.unref) timer.unref();
  for (const method of ['handleMouseMove','handleRelativeMouseMove','handleMouseDown','handleMouseUp','_queueDirectInputMouseEvent']) {
    const original = r[method];
    if (typeof original !== 'function') { stop('missing-production-method'); throw Error('Nox observer missing '+method); }
    const own = Object.getOwnPropertyDescriptor(r,method);
    const wrapper = function(...args) {
      if (!active) return original.apply(this,args);
      sample();
      const before = state();
      const observed = method === '_queueDirectInputMouseEvent'
        ? {sameMemory:args[0]===memory,type:args[1],data:args[2]}
        : {x:args[0],y:args[1],options:clone(args[2])};
      record('renderer-entry',{method,args:observed,state:before});
      try { return original.apply(this,args); }
      finally {
        record('renderer-return',{method,args:observed,state:state()});sample();
      }
    };
    r[method] = wrapper;
    restores.push(() => { if (r[method] === wrapper) { if (own) Object.defineProperty(r,method,own); else delete r[method]; } });
  }
  for (const type of ['mousemove','mousedown','mouseup','pointerlockchange','pointerlockerror']) {
    const listener = e => {
      sample();record('dom',{type,trusted:e.isTrusted===true,clientX:e.clientX??null,clientY:e.clientY??null,
        movementX:e.movementX??null,movementY:e.movementY??null,button:e.button??null,buttons:e.buttons??null,state:state()});
    };
    o.document.addEventListener(type,listener,true);
    restores.push(() => o.document.removeEventListener(type,listener,true));
  }
  record('observer-arm',{deadline,limit,readOnlyGuestMemory:true,pollMs:4,state:state()});
  return {
    begin(b) {
      if (!active) throw Error('Nox observer stopped');
      if (!b || typeof b.id !== 'string' || typeof b.label !== 'string' || !b.previous?.sha256 || !b.previous?.identity)
        throw Error('Nox observer requires command and prior image binding');
      sample();binding=clone(b);record('command-begin',{state:state()});
    },
    image(capture) {
      sample();record('image-bound',{capture:clone(capture),state:state()});
    },
    snapshot() { sample(); return {active,deadline,limit,records:[...records],state:state()}; },
    stop
  };
}
const api={install};
if(typeof module==='object'&&module.exports)module.exports=api;else scope.NoxPointerObserver=api;
})(globalThis);
