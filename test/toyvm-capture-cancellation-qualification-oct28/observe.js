// Harness-only observation. Every production call forwards to the original.
window.evidence={events:[],calls:[],runs:[],unbind:[]};
const capture=Element.prototype.setPointerCapture;
Element.prototype.setPointerCapture=function(id){try{const value=capture.call(this,id);evidence.calls.push({name:'setPointerCapture',target:this.id,id,success:true,hasCapture:this.hasPointerCapture(id)});return value;}catch(error){evidence.calls.push({name:'setPointerCapture',target:this.id,id,success:false,error:String(error)});throw error;}};
const observed=new WeakSet();
function observeCurrent(){
const L=ToyVM.require('tools/toyvm/live.js');
if(observed.has(L))return;observed.add(L);
for(const name of ['bindPointer','bindKeyboard']) {
 const original=L[name];L[name]=function(...args){
  evidence.calls.push({name,stack:new Error().stack});if(name==='bindPointer')evidence.binderCanvas=args[0];
  const dispose=original(...args); evidence.unbind.push(dispose);return dispose;
 };
}
const start=L.LiveRun.prototype.start;
L.LiveRun.prototype.start=async function(...args){
 evidence.runs.push(this);return await start.apply(this,args);
};
}
observeCurrent();
// The demo's script onload starts its promise chain before a window load
// observer can see that non-bubbling resource event. Observe assignment itself.
let currentToyVM=window.ToyVM;
Object.defineProperty(window,'ToyVM',{configurable:true,get(){return currentToyVM;},set(value){currentToyVM=value;observeCurrent();}});
for(const type of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture','blur','focus','keydown','keyup','visibilitychange']) {
 window.addEventListener(type,e=>{if(evidence.events.length<500)evidence.events.push({type,target:e.target.id||e.target.nodeName||'window',trusted:e.isTrusted,pointerType:e.pointerType,pointerId:e.pointerId,buttons:e.buttons,x:e.clientX,y:e.clientY,key:e.key,hidden:document.hidden});},true);
}
window.int33=(fn,args={},index=evidence.runs.length-1)=>{
 const r={ax:fn,...args}; const handled=evidence.runs[index].machine.int33({get:n=>r[n]||0,set:(n,v)=>r[n]=v&65535});
 if(!handled)throw Error('INT33 unhandled');return r;
};
window.state=()=>{const r=evidence.runs.at(-1);return {int33:int33(3),mouse:{...r.machine.mouse},held:Array.from(r.machine.heldKeys),inputStopped:r.inputStopped,mode:r.machine.videoMode};};

// Additional off-path observations; wrappers forward original native methods.
window.trace=[];window.lastMouse=null;
window.probe=()=>{const c=evidence.runs.at(-1)?.canvas,id=lastMouse?.id;return {id,pointerType:lastMouse?.pointerType,buttons:lastMouse?.buttons,canvasId:c?.id,sameBinderCanvas:c===evidence.binderCanvas,connected:c?.isConnected,ownerDocument:c?.ownerDocument===document,documentFocus:document.hasFocus(),activeElement:document.activeElement?.id,hasCapture:c&&id!==undefined?c.hasPointerCapture(id):false}};
for(const type of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture','blur','focus'])window.addEventListener(type,e=>{if(e.pointerType==='mouse')lastMouse={id:e.pointerId,pointerType:e.pointerType,buttons:e.buttons};if(trace.length<300){trace.push({phase:'capture',type,trusted:e.isTrusted,target:e.target.id,probe:probe()});queueMicrotask(()=>trace.push({phase:'microtask',type,probe:probe()}));}},true);
const nativeRelease=Element.prototype.releasePointerCapture;
Element.prototype.releasePointerCapture=function(id){trace.push({method:'releasePointerCapture',id,target:this.id,before:this.hasPointerCapture(id),stack:new Error().stack});return nativeRelease.call(this,id)};
