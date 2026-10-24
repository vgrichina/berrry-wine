#!/usr/bin/env node
'use strict';
// Source-level compositor regression: no guest, browser, packages or native build.
const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const { RasterSurface } = require('../lib/surface');
const { createWindowHost } = require('../lib/host-window');
const filename = path.resolve(__dirname, '../lib/renderer.js');
let source = fs.readFileSync(process.env.POPUP_RENDERER_SOURCE || filename, 'utf8');
const mutation = process.env.POPUP_MUTATION;
if (mutation === 'owner-walk') {
  const needle = 'while (cur && cur.isChild && cur.parentHwnd';
  assert(source.includes(needle));
  source = source.replace(needle, 'while (cur && cur.parentHwnd');
} else if (mutation === 'owned-traversal') {
  const needle = '.filter(child => child && child.isChild && child.visible && child.parentHwnd === parent.hwnd)';
  assert(source.includes(needle));
  source = source.replace(needle, '.filter(child => child && child.visible && child.parentHwnd === parent.hwnd)');
}
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(source, filename);
const { Win98Renderer } = mod.exports;
if (mutation === 'no-child-clip') Win98Renderer.prototype._clipRectForChildSurface = () => null;

let assertions = 0;
const failures = [];
function check(name, fn) {
  try { fn(); assertions++; } catch (e) { failures.push(`${name}: ${e.message.slice(0,180)}`); }
}
// Tiny deterministic canvas delegates all pixel blits/clips to the real Surface.
function canvas(w, h, color = '#00000000') {
  const s = new RasterSurface(w, h);
  s.fill(0, 0, w, h, color);
  let pending;
  const draws=[];
  const c = {width: w, height: h, _data: s.data};
  c.draws=draws;
  c.getContext = () => ({
    translate() {},
    save() { s.pushClip({x:0,y:0,w,h}); }, restore() { s.popClip(); },
    beginPath() {}, rect(x,y,w,h) { pending = {x,y,w,h}; },
    clip() { s.popClip(); s.pushClip(pending); },
    clearRect(x,y,w,h) { s.clear(x,y,w,h); },
    drawImage(src, ...a) {
      draws.push(src);
      const q = a.length === 2 ? [0,0,src.width,src.height,...a,src.width,src.height] : a;
      s.blit({width:src.width,height:src.height,data:src._data}, ...q);
    },
  });
  return c;
}
function fixture(ownerState = 'visible') {
  const r = Object.create(Win98Renderer.prototype);
  r.windows = {};
  r.canvas = {width:96,height:72};
  r.surface = new RasterSurface(96,72);
  r.drawWindow = () => {}; // Guest-owned non-client painting is outside this test.
  r._createOffscreen = canvas;
  r._toolbarWidthLimit = () => 0;
  function win(hwnd, x,y,w,h,color,isChild=false,parentHwnd=0) {
    const v = {hwnd,x,y,w,h,style:isChild?0x50000000:0x90000000,
      visible:true,isChild,parentHwnd,zOrder:hwnd,_canonicalOwnSurface:isChild,
      _gdiWriteSeq:10,_backCanvas:canvas(w,h,color)};
    r.windows[hwnd]=v; return v;
  }
  const owner=win(1,10,10,40,35,'#112233');
  const popup=win(2,40,20,35,30,'#334455');
  popup.ownerHwnd=1;
  const unrelated=win(3,78,3,12,12,'#999999');
  const child=win(4,42,22,28,24,'#ee1100',true,2);
  const nested=win(5,65,40,20,20,'#00ee11',true,4);
  const ownerChild=win(6,44,12,18,12,'#1111ee',true,1);
  // Shared child inside the popup must not be harvested into the owner's overlay.
  const shared=win(7,45,25,3,3,'#aaaaaa',true,2);
  shared._canonicalOwnSurface=false;
  r.wasm={exports:{
    wnd_window_screen_x:h=>r.windows[h].x, wnd_window_screen_y:h=>r.windows[h].y,
    wnd_client_screen_x:h=>r.windows[h].x+(h===1?2:0), wnd_client_screen_y:h=>r.windows[h].y+(h===1?4:0),
    get_client_rect_l:()=>0,get_client_rect_t:()=>0,
    get_client_rect_r:h=>r.windows[h].w-(h===1?5:0),get_client_rect_b:h=>r.windows[h].h-(h===1?9:0),
  }};
  for (const v of Object.values(r.windows)) v.wasm=r.wasm;
  const {imports}=createWindowHost({renderer:r},{readStr:()=>'',readStrW:()=>''});
  imports.set_parent(2,1); // Authentic host classification: still WS_POPUP.
  if(ownerState==='hidden')owner.visible=false;
  if(ownerState==='destroyed')delete r.windows[1]; // Stale link must not clip popup.
  return {r,owner,popup,child,nested,ownerChild,unrelated,shared,imports};
}
function rgb(surface,x,y) { return [...surface.data.slice((y*surface.width+x)*4,(y*surface.width+x)*4+3)]; }
for (const state of ['visible','hidden','destroyed']) {
  const {r,owner,popup,child,nested,ownerChild,unrelated}=fixture(state);
  check(`${state} host classification`,()=>assert.equal(popup.isChild,false));
  check(`${state} popup screen origin`,()=>assert.deepStrictEqual(r._windowOriginForComposite(popup),{x:40,y:20}));
  check(`${state} popup root`,()=>assert.equal(r._topLevelWindowFor(popup).hwnd,popup.hwnd));
  check(`${state} child root`,()=>assert.equal(r._topLevelWindowFor(nested).hwnd,popup.hwnd));
  check(`${state} popup bounds`,()=>assert.deepStrictEqual(r._clipRectForChildSurface(popup),{x:40,y:20,w:35,h:30}));
  check(`${state} nested ancestor intersection`,()=>assert.deepStrictEqual(r._clipRectForChildSurface(nested),{x:42,y:22,w:28,h:24}));
  check(`${state} unrelated root`,()=>assert.strictEqual(r._topLevelWindowFor(unrelated),unrelated));
  check(`${state} popup hit outside owner`,()=>assert.strictEqual(r._inputWindowAtPoint(73,48),popup));
  check(`${state} unrelated hit`,()=>assert.strictEqual(r._inputWindowAtPoint(80,5),unrelated));
  // The owner's child pass must not visit a popup subtree. It has its own z slot.
  r._compositeChildSurfaces(owner);
  check(`${state} owner pass excludes popup children`,()=>assert.deepStrictEqual(rgb(r.surface,47,30),[0,0,0]));
  r.surface.clear(0,0,96,72);
  r._compositeChildSurfaces(popup);
  check(`${state} child extends outside owner`,()=>assert.deepStrictEqual(rgb(r.surface,60,30),[238,17,0]));
  check(`${state} nested visible intersection`,()=>assert.deepStrictEqual(rgb(r.surface,67,43),[0,238,17]));
  check(`${state} nested clipped by parent`,()=>assert.deepStrictEqual(rgb(r.surface,72,48),[0,0,0]));
  r.surface.clear(0,0,96,72);
  if (state!=='destroyed') {
    r._compositeChildSurfaces(owner);
    check(`${state} true child inside owner`,()=>assert.deepStrictEqual(rgb(r.surface,46,14),[17,17,238]));
    check(`${state} true child outside owner clipped`,()=>assert.deepStrictEqual(rgb(r.surface,55,14),[0,0,0]));
  }
  check(`${state} shared overlay excludes popup`,()=>assert.deepStrictEqual(r._exclusiveSharedChildRegions(owner),[]));
  check(`${state} shared overlay includes true child`,()=>assert.deepStrictEqual(r._exclusiveSharedChildRegions(popup),[{x:45,y:25,w:3,h:3}]));
  // Postprocess source uses the same hierarchy boundary, with and without stack.
  const source=r._buildExclusivePresentationSource(owner);
  check(`${state} single source excludes popup branch`,()=>assert.deepStrictEqual([...source._data.slice((20*40+37)*4,(20*40+37)*4+3)],[17,34,51]));
  const popupSource=r._buildExclusivePresentationSource(popup);
  check(`${state} single source clips nested child`,()=>assert.deepStrictEqual([...popupSource._data.slice((23*35+32)*4,(23*35+32)*4+3)],[51,68,85]));
  const composite=r._buildExclusivePresentationSource(owner,[owner,popup]);
  check(`${state} stack visits child once`,()=>assert.equal(composite.draws.filter(c=>c===child._backCanvas).length,1));
  // Base owner canvas ends at screen x=50, so inspect overlap at (47,30).
  check(`${state} stack draws popup child once at screen position`,()=>assert.deepStrictEqual([...composite._data.slice((20*40+37)*4,(20*40+37)*4+3)],[238,17,0]));
}
// Canonical screen readback follows the same z-order boundary and child clip.
{
  const {r,child,ownerChild,popup}=fixture();
  for(const v of Object.values(r.windows)) {
    const c=v._backCanvas;
    const bgra=Uint8Array.from(c._data);
    for(let i=0;i<bgra.length;i+=4){[bgra[i],bgra[i+2]]=[bgra[i+2],bgra[i]];}
    c._waCanonicalPresentation={surface:{width:c.width,height:c.height,bpp:32,
      stride:c.width*4,storage:bgra,storageOffset:0,topDown:true}};
  }
  const copy=r._copyCanonicalCanvasToMemory;
  const copies=[];
  r._copyCanonicalCanvasToMemory=function(c,...a) {copies.push(c);return copy.call(this,c,...a);};
  const dest=new Uint8Array(96*72*4);
  check('canonical screen readback',()=>assert.equal(r.composeCanonicalScreenToMemory(dest,0,96,72,96*4),true));
  check('canonical child copied once',()=>assert.equal(copies.filter(c=>c===child._backCanvas).length,1));
  check('canonical popup copied once',()=>assert.equal(copies.filter(c=>c===popup._backCanvas).length,1));
  check('canonical child outside owner',()=>assert.deepStrictEqual([...dest.slice((30*96+60)*4,(30*96+60)*4+3)],[0,17,238]));
  check('client clip excludes owner frame',()=>assert.deepStrictEqual(r._clipRectForChildSurface(ownerChild),{x:12,y:14,w:35,h:26}));
}
// Real drawWindow must not recurse into a non-child dialog and translate it.
{
  const {r,owner,popup,ownerChild}=fixture();
  popup.isDialog=true;
  ownerChild.isDialog=true; ownerChild._canonicalOwnSurface=false;
  r.ctx=canvas(96,72).getContext('2d');
  const visited=[];
  r.drawWindow=function(w){visited.push(w.hwnd);return Win98Renderer.prototype.drawWindow.call(this,w);};
  r.drawWindow(owner);
  check('dialog chrome only traverses real children',()=>assert.deepStrictEqual(visited,[1,6]));
}
// A popup linked only through ownerHwnd never inherits owner bounds either.
{
  const {r,popup}=fixture(); popup.parentHwnd=0;
  check('owner-only popup root',()=>assert.equal(r._topLevelWindowFor(popup).hwnd,popup.hwnd));
  check('owner-only popup clip',()=>assert.deepStrictEqual(r._clipRectForChildSurface(popup),{x:40,y:20,w:35,h:30}));
}
// Fully outside, empty and hidden child cases remain fail-closed.
{
  const {r,child,nested,popup}=fixture();
  child.x=90; child.y=60;
  check('empty ancestor intersection',()=>assert.equal(r._clipRectForChildSurface(nested).empty,true));
  r._compositeChildSurfaces(popup);
  check('empty child does not paint',()=>assert.deepStrictEqual(rgb(r.surface,90,60),[0,0,0]));
  child.visible=false;
  r.surface.clear(0,0,96,72);
  r._compositeChildSurfaces(popup);
  check('hidden child suppresses branch',()=>assert.deepStrictEqual(rgb(r.surface,67,43),[0,0,0]));
}
// Independent review: GPU client offsets must share the true-child clip in
// both postprocessing branches and ordinary composition. No renderer method
// is replaced here: only the window-local layer pixels are synthetic.
for (const mode of ['single', 'stack', 'screen']) {
  const {r,popup,nested}=fixture();
  nested._dxFrameLayer={kind:'gpu',canvas:canvas(20,20,'#123abc')};
  nested.clientRect={x:66,y:42,w:19,h:18};
  let output;
  if (mode==='screen') {
    r._compositeChildSurfaces(popup);
    output=(x,y)=>rgb(r.surface,x,y);
  } else {
    const c=r._buildExclusivePresentationSource(popup,mode==='stack'?[popup]:undefined);
    output=(x,y)=>[...c._data.slice(((y-20)*35+x-40)*4,((y-20)*35+x-40)*4+3)];
  }
  check(`${mode} GPU client offset`,()=>assert.deepStrictEqual(output(65,41),[0,238,17]));
  check(`${mode} GPU visible ancestor intersection`,()=>assert.deepStrictEqual(output(67,43),[18,58,188]));
  check(`${mode} GPU clipped by real parent`,()=>assert.deepStrictEqual(output(72,48),mode==='screen'?[0,0,0]:[51,68,85]));
}
// An empty child clip must neither paint nor leak to a later sibling. This
// also checks the canvas save/restore adapter against the production Surface.
for (const mode of ['single','stack']) {
  const {r,popup,child,unrelated}=fixture();
  child.x=90;child.y=60;
  unrelated.isChild=true;unrelated.parentHwnd=popup.hwnd;
  unrelated.x=71;unrelated.y=24;unrelated._canonicalOwnSurface=true;
  unrelated.zOrder=8;
  const c=r._buildExclusivePresentationSource(popup,mode==='stack'?[popup]:undefined);
  const output=(x,y)=>[...c._data.slice(((y-20)*35+x-40)*4,((y-20)*35+x-40)*4+3)];
  check(`${mode} empty nested clip suppresses pixels`,()=>assert.deepStrictEqual(output(67,43),[51,68,85]));
  check(`${mode} clip restored for later sibling`,()=>assert.deepStrictEqual(output(72,25),[153,153,153]));
}
if(failures.length) {
  console.error(`FAIL ${failures.length} checks (${assertions} passed)`);
  console.error(failures.slice(0,12).join('\n'));
  process.exitCode=1;
} else console.log(`PASS ${assertions} owned-popup/true-child geometry, composition, source and hit checks${mutation?' mutation='+mutation:''}`);
