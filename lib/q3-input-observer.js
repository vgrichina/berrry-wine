'use strict';
// Optional page-side observation only. No guest calls, hooks, writes, input,
// protocol requests or acceptance decisions. A host dequeue is not a UI action.
(function(scope) {
function install(o = {}) {
  if (o.enabled !== true) return null;
  const {renderer:r,canvas,document:doc,memory,diBase,owner=()=>true,
    emit=()=>{},now=()=>performance.now(),interval=setInterval,clear=clearInterval,
    limit=4096,durationMs=600000,relative=()=>true} = o;
  if (!r || !canvas || !doc || !memory?.buffer || !Number.isInteger(diBase) || diBase < 0 ||
      diBase % 4 || diBase+288 > memory.buffer.byteLength || !Number.isInteger(limit) ||
      limit<8 || limit>8192 || !Number.isInteger(durationMs) || durationMs<1 || durationMs>1440000)
    throw Error('Q3 input observer bounds');
  const words=new Int32Array(memory.buffer),base=diBase>>>2;
  const shared=typeof SharedArrayBuffer!=='undefined' && memory.buffer instanceof SharedArrayBuffer;
  const load=i=>shared?Atomics.load(words,base+i):words[base+i];
  const copy=v=>v==null?null:JSON.parse(JSON.stringify(v));
  let active=true,sequence=0,binding=null,lastImage=null,timer,lastHead=load(2)>>>0,sinkErrors=0;
  const deadline=now()+durationMs,records=[],restores=[];
  const output=row=>{try{emit(row);}catch{sinkErrors++;}};
  function state() {
    const rect=canvas.getBoundingClientRect(),locked=(doc.pointerLockElement||doc.webkitPointerLockElement)===canvas;
    return {mode:locked?'locked':relative()?'pending-relative':'absolute',focused:doc.activeElement===canvas,
      visibility:doc.visibilityState??null,canvas:{width:canvas.width,height:canvas.height,
        rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}},
      presentation:copy(r._exclusivePresentationViewport),transform:copy(r._exclusiveTransform),
      cursor:{x:r._mouseX??null,y:r._mouseY??null,buttons:r._mouseButtonsMask??0,warp:r._cursorWarpSerial??0},
      reference:copy(r._directInputMousePoints?.get(memory)),queueDepth:r.inputQueue?.length??null,
      di:{dx:load(0),dy:load(1),head:load(2)>>>0,tail:load(3)>>>0,
        overflowX:load(68),overflowY:load(69),overflowZ:load(70),wheel:load(71)}};
  }
  function stop(reason='owner-cancelled') {
    if(!active)return;active=false;clear(timer);
    for(const restore of restores.reverse())restore();
    output({kind:'observer-stop',sequence:++sequence,at:now(),binding:copy(binding),reason,records:records.length,sinkErrors});
  }
  function valid() {
    if(!active)return false;
    if(now()>=deadline){stop('deadline');return false;}
    if(memory.buffer!==words.buffer || !owner()){stop('owner-changed');return false;}
    if(records.length>=limit){stop('record-limit');return false;}
    return true;
  }
  function record(kind,fields={}) {
    if(!valid())return;
    const row={kind,sequence:++sequence,at:now(),binding:copy(binding),...fields};records.push(row);output(row);
  }
  function sample() {
    if(!valid())return;
    const head=load(2)>>>0;
    if(head!==lastHead){const from=lastHead;lastHead=head;record('guest-fifo-drain',{
      from,to:head,count:(head-from)>>>0,payloads:null,
      meaning:'shared production FIFO head advanced; UI consumption UNKNOWN',state:state()});}
  }
  // These are existing renderer calls. Do not read queue slots after reuse or
  // label the present physical map as the state an earlier guest poll saw.
  const methods=['handleMouseMove','handleRelativeMouseMove','handleMouseDown','handleMouseUp',
    'handleKeyDown','handleKeyUp','_queueDirectInputMouseEvent','takeInput'];
  for(const method of methods)if(typeof r[method]!=='function')throw Error('Q3 observer missing '+method);
  for(const method of methods) {
    const original=r[method],descriptor=Object.getOwnPropertyDescriptor(r,method);
    const wrapper=function(...args) {
      // Observation errors never suppress, duplicate or alter production work.
      const safe=fn=>{try{fn();}catch{stop('observation-error');}};
      if(method!=='takeInput')safe(()=>{sample();record('renderer-entry',{method,
        args:method==='_queueDirectInputMouseEvent'?{sameMemory:args[0]===memory,type:args[1],data:args[2]}:
          {first:args[0],second:copy(args[1]),third:copy(args[2])},state:state()});});
      let result;
      try {result=Reflect.apply(original,this,args);return result;}
      finally {safe(()=>{
        if(method==='takeInput') {if(result)record('host-dequeue',{event:copy(result),
          meaning:'production takeInput returned this event to host caller; guest UI decision UNKNOWN',state:state()});}
        else record('renderer-return',{method,state:state()});
        sample();
      });}
    };
    r[method]=wrapper;
    restores.push(()=>{if(r[method]===wrapper){if(descriptor)Object.defineProperty(r,method,descriptor);else delete r[method];}});
  }
  for(const type of ['mousemove','mousedown','mouseup','keydown','keyup','pointerlockchange','pointerlockerror']) {
    const listener=e=>{try{sample();record('dom',{type,trusted:e.isTrusted===true,
      clientX:e.clientX??null,clientY:e.clientY??null,movementX:e.movementX??null,movementY:e.movementY??null,
      button:e.button??null,buttons:e.buttons??null,key:e.key??null,code:e.code??null,
      keyCode:e.keyCode??null,repeat:e.repeat===true,state:state()});}catch{stop('observation-error');}};
    doc.addEventListener(type,listener,true);restores.push(()=>doc.removeEventListener(type,listener,true));
  }
  timer=interval(()=>{try{sample();}catch{stop('observation-error');}},4);timer?.unref?.();
  record('observer-arm',{deadline,limit,pollMs:4,guestHooks:false,guestWrites:false,state:state()});
  return {
    begin(b) {
      if(!valid())throw Error('Q3 observer inactive');
      if(!b || typeof b.id!=='string' || typeof b.label!=='string' ||
          !/^[a-f0-9]{64}$/.test(b.previous?.sha256??'') || !b.previous?.identity)
        throw Error('Q3 command/prior image binding required');
      if(!lastImage || b.previous.sha256!==lastImage.sha256 || b.previous.label!==lastImage.label ||
          JSON.stringify(b.previous.identity)!==JSON.stringify(lastImage.identity))throw Error('Q3 prior image mismatch');
      sample();binding=copy(b);record('command-begin',{state:state()});return {active,deadline,sequence};
    },
    image(c) {
      if(!valid())throw Error('Q3 observer inactive');
      if(!/^[a-f0-9]{64}$/.test(c?.sha256??'')||!c.identity||typeof c.label!=='string')throw Error('Q3 image identity required');
      if(lastImage&&JSON.stringify(c.identity)!==JSON.stringify(lastImage.identity))throw Error('Q3 image owner mismatch');
      if(binding&&c.label!==binding.label)throw Error('Q3 result image command mismatch');
      sample();lastImage=copy(c);record('image-bound',{capture:copy(c),state:state()});return {active,deadline,sequence,sinkErrors,state:state()};
    },
    snapshot(){sample();return {active,deadline,limit,sinkErrors,records:[...records],state:state()};},stop
  };
}
const api={install};if(typeof module==='object'&&module.exports)module.exports=api;else scope.Q3InputObserver=api;
})(globalThis);
