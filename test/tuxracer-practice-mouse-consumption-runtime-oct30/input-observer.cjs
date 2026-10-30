'use strict';
// Read-only observer of original production renderer calls; each forwards once.
const fs=require('fs'),path=require('path');
const {Win98Renderer}=require(path.resolve(process.cwd(),'lib/renderer'));
let renderer;const events=[];
function state(r){return {x:r._mouseX,y:r._mouseY,buttons:r._mouseButtonsMask,canvas:r.canvas&&{width:r.canvas.width,height:r.canvas.height},queue:(r.inputQueue||[]).slice(-12).map(x=>({msg:x.msg,hwnd:x.hwnd,wParam:x.wParam,lParam:x.lParam})),windows:Object.values(r.windows||{}).slice(0,6).map(w=>({hwnd:w.hwnd,clientRect:w.clientRect,x:w.x,y:w.y,width:w.width,height:w.height}))};}
for(const name of ['handleMouseMove','handleMouseDown','handleMouseUp']){
 const original=Win98Renderer.prototype[name];if(typeof original!=='function')throw Error(name);
 Win98Renderer.prototype[name]=function(...args){renderer=this;const before=state(this);const value=original.apply(this,args);if(events.length<32)events.push({name,args,at:Date.now(),before,after:state(this)});return value;};
}
globalThis.__mouseBoundarySnapshot=()=>({observationOnly:true,events,latest:renderer?state(renderer):null});
process.on('exit',()=>fs.writeFileSync(path.join(__dirname,'mouse-boundary.json'),JSON.stringify(globalThis.__mouseBoundarySnapshot())+'\n'));
