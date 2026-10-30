'use strict';
// Serialize into the retained production runner's controlEval lexical scope.
// Addresses come from the exact pinned SDL.dll GetMouseState machine code.
function sampleSDL() {
 const m=Object.entries(mods).find(([n])=>/sdl(?:\.dll)?$/i.test(n));
 if(!m)throw Error('SDL module absent');
 const mod=m[1],base=mod.loadAddr>>>0;
 if((mod.origBase>>>0)!==0x10000000)throw Error('unexpected SDL original base');
 function bytes(rva,n){
  let start;
  for(let i=0;i<n;i++){
   const p=g2w((base+rva+i)>>>0);
   if(!Number.isInteger(p)||p<256||p>=memory.buffer.byteLength||(i&&p!==start+i))throw Error('unmapped/noncontiguous SDL range');
   if(!i)start=p;
  }
  return Array.from(new Uint8Array(memory.buffer,start,n));
 }
 const code='8b44240485c074090fbf0da04f031089088b44240885c074090fbf15a44f03108910a0b04f0310c3';
 if(bytes(106784,code.length/2).map(x=>x.toString(16).padStart(2,'0')).join('')!==code)throw Error('SDL GetMouseState code mismatch');
 const s16=r=>{const b=bytes(r,2),u=b[0]+b[1]*256;return u>=32768?u-65536:u;};
 return {module:m[0],loadAddr:base,origBase:mod.origBase,getMouseStateRVA:106784,
  verifiedGetter:true,x:s16(0x34fa0),y:s16(0x34fa4),buttons:bytes(0x34fb0,1)[0],
  relativeX:s16(0x34fa8),relativeY:s16(0x34fac),batch:tickState.batch,
  host:{x:renderer._mouseX,y:renderer._mouseY,buttons:renderer._mouseButtonsMask},
  scope:'read-only post-batch snapshot; does not prove callback execution'};
}
module.exports={sampleSDL};
