'use strict';
// Host upload may be deferred until after native MessageBox painting. Exercise
// the real upload and compositor, including the opposite (later present) order.
const assert=require('node:assert/strict');
const {createCanvas}=require('../lib/canvas-compat');
const {Win98Renderer}=require('../lib/renderer');
const {createHostImports}=require('../lib/host-imports');
const regions=require('../lib/region-map.generated.js');
const width=64,height=48,slot=3,bits=0x20000;
const memory=new ArrayBuffer(128*1024*1024),dv=new DataView(memory);
const entry=regions.BASE.DX_OBJECTS+slot*32;
dv.setUint32(entry,2,true);dv.setUint16(entry+12,width,true);dv.setUint16(entry+14,height,true);
dv.setUint16(entry+16,32,true);dv.setUint16(entry+18,width*4,true);dv.setUint32(entry+20,bits,true);dv.setUint32(entry+28,1,true);
new Uint32Array(memory,bits,width*height).fill(0x00aa0000);
const canvas=(w,h,color)=>{const c=createCanvas(w,h);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,w,h);return c;};
const renderer=new Win98Renderer(createCanvas(width,height));renderer.singleAppMode=true;renderer.lazyPresentation=true;
renderer.drawWindow=()=>{};renderer.updateTaskbar=()=>{};
const nativeExports={get_main_hwnd:()=>1,get_dx_exclusive_hwnd:()=>1,dialogbox_hwnd:()=>2,modal_dialog_hwnd:()=>0,
 wnd_window_screen_x:h=>renderer.windows[h].x,wnd_window_screen_y:h=>renderer.windows[h].y};
const wasm={exports:nativeExports};renderer.wasm=wasm;
const game=renderer.windows[1]={hwnd:1,x:0,y:0,w:width,h:height,visible:true,isChild:false,zOrder:1,wasm,style:0x90000000,
 _backCanvas:canvas(width,height,'black'),_gdiWriteSeq:renderer.nextSurfaceWriteSeq()};
const {host,gdi}=createHostImports({getMemory:()=>memory,exports:nativeExports,renderer});
// The native frame finishes now. Its host upload waits until the capture.
host.dx_trace(5,slot,0,0,0);
const dialog=renderer.windows[2]={hwnd:2,x:8,y:6,w:40,h:30,visible:true,isChild:false,isDialog:true,ownerHwnd:1,zOrder:2,wasm,style:0x90000000,
 _backCanvas:canvas(40,30,'#00bb00'),_gdiWriteSeq:renderer.nextSurfaceWriteSeq()};
const child=renderer.windows[3]={hwnd:3,x:12,y:10,w:8,h:6,visible:true,isChild:true,parentHwnd:2,zOrder:3,wasm,style:0x50000000,
 _canonicalOwnSurface:true,_backCanvas:canvas(8,6,'#00cccc'),_gdiWriteSeq:renderer.nextSurfaceWriteSeq()};
function frame(expected,button,message){renderer.repaint();for(const c of [renderer.canvas,renderer._exclusivePresentationSource]){
 assert(c);const rgb=(x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data].slice(0,3);
 assert.deepEqual(rgb(2,2),[170,0,0],message+' primary');assert.deepEqual(rgb(30,25),expected,message+' modal');assert.deepEqual(rgb(14,12),button,message+' child');}}
assert.equal(gdi.presentBestDxOffscreen(true),1);
frame([0,187,0],[0,204,204],'deferred earlier primary preserves later native dialog');
host.dx_trace(5,slot,0,0,0);assert.equal(gdi.presentBestDxOffscreen(true),1);
frame([170,0,0],[170,0,0],'later real primary covers earlier native dialog');
dialog._gdiWriteSeq=child._gdiWriteSeq=renderer.nextSurfaceWriteSeq();
frame([0,187,0],[0,204,204],'later native repaint remains visible');
// A retained-Lock upload without a pending native present remains a new write.
assert.equal(gdi.presentBestDxOffscreen(true),1);
frame([170,0,0],[170,0,0],'unfenced retained CPU upload still covers older GDI');
console.log('PASS deferred native primary vs owned dialog/child order, later present, native repaint, retained CPU write');
