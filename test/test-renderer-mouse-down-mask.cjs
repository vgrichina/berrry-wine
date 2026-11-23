#!/usr/bin/env node
'use strict';
// Microsoft DOWN / DBLCLK wParam is the current state of ALL buttons and
// Ctrl/Shift, independent of recipient/capture. Expected masks below are
// literal contract examples, never derived from renderer state or helpers.
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-lbuttondown
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-rbuttondown
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-lbuttondblclk
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-rbuttondblclk
const assert = require('node:assert/strict');
const { Win98Renderer } = require('../lib/renderer');
const canvas = { width: 640, height: 480, getContext() {
  return new Proxy({}, { get: (_, name) => name === 'measureText'
    ? () => ({ width: 0 }) : () => {} });
} };
function fixture(route) {
  const r = new Win98Renderer(canvas), sent = [];
  const child = route.includes('child'), target = child ? 101 : 100;
  let capture = 0, modal = 0;
  const wasm = { exports: {
    get_capture_hwnd: () => capture,
    get_authoritative_capture_hwnd: () => capture,
    wnd_top_level: () => 100,
    wnd_mouse_msg_origin_x: h => h === 101 ? 20 : 10,
    wnd_mouse_msg_origin_y: h => h === 101 ? 30 : 10,
    wnd_window_screen_x: h => h === 101 ? 20 : 10,
    wnd_window_screen_y: h => h === 101 ? 30 : 10,
    wnd_screen_w: () => 200, wnd_screen_h: () => 160,
    wnd_child_from_point_deep: () => child ? 101 : 0,
    ctrl_get_class: () => route.endsWith('sync') ? 1 : 0,
    send_message(hwnd, msg, wParam, lParam) { sent.push({ hwnd, msg, wParam, lParam }); },
    modal_dialog_hwnd: () => modal,
  } };
  r.wasm = wasm;
  r.windows[100] = { hwnd:100, visible:true, isChild:false,
    x:10, y:10, w:200, h:160, style:0, zOrder:1, wasm };
  if (route === 'modal') Object.assign(wasm.exports, {
    dialog_route_mouse_screen(hwnd, msg, wParam, x, y) {
      sent.push({hwnd, msg, wParam, lParam:((y-10)<<16)|(x-10)}); return 1;
    },
  });
  if (route === 'edit-top') Object.assign(wasm.exports, {
    get_focus_hwnd: () => 101, ctrl_get_class: h => h === 101 ? 2 : 0,
  });
  return {r, sent, target, child, activate() {
    if (route.startsWith('capture')) capture=target;
    if (route === 'modal') modal=100;
  }};
}
const ls=[16,{code:'ShiftLeft',location:1}], rs=[16,{code:'ShiftRight',location:2}];
const lc=[17,{code:'ControlLeft',location:1}], rc=[17,{code:'ControlRight',location:2}];
const up=([vk,info])=>[-vk,info];
const states = [
  {name:'bare', keys:[], masks:[1,2,3]},
  {name:'generic Shift', keys:[16], masks:[5,6,7]},
  {name:'generic Ctrl', keys:[17], masks:[9,10,11]},
  {name:'generic both', keys:[16,17], masks:[13,14,15]},
  {name:'generic released', keys:[16,17,-16,-17], masks:[1,2,3]},
  {name:'left Shift', keys:[ls], masks:[5,6,7]},
  {name:'right Shift', keys:[rs], masks:[5,6,7]},
  {name:'left Ctrl', keys:[lc], masks:[9,10,11]},
  {name:'right Ctrl', keys:[rc], masks:[9,10,11]},
  {name:'one Shift side released', keys:[ls,rs,up(rs)], masks:[5,6,7]},
  {name:'one Ctrl side released', keys:[lc,rc,up(lc)], masks:[9,10,11]},
  {name:'both sides released', keys:[ls,rs,lc,rc,up(ls),up(rs),up(rc),up(lc)], masks:[1,2,3]},
  {name:'options both', keys:[], opts:{shiftKey:true,ctrlKey:true}, masks:[13,14,15]},
  {name:'options Shift', keys:[], opts:{shiftKey:true}, masks:[5,6,7]},
  {name:'options Ctrl', keys:[], opts:{ctrlKey:true}, masks:[9,10,11]},
  {name:'options Ctrl + physical Shift', keys:[rs], opts:{shiftKey:false,ctrlKey:true}, masks:[13,14,15]},
  {name:'options Shift + physical Ctrl', keys:[lc], opts:{shiftKey:true,ctrlKey:false}, masks:[13,14,15]},
  {name:'false options with physical both', keys:[16,17], opts:{shiftKey:false,ctrlKey:false}, masks:[13,14,15]},
  {name:'Alt only', keys:[18], masks:[1,2,3]},
];
function key(r,spec) {
  const [vk,info]=Array.isArray(spec)?spec:[spec];
  if(vk>0) r.handleKeyDown(vk,info); else r.handleKeyUp(-vk,info);
}
const failures=[]; let count=0;
function check(label,fn) {count++;try{fn();}catch(e){failures.push({label,error:e.message});}}
for(const route of ['ordinary-top','ordinary-child','cached-child',
  'capture-top','capture-child','capture-child-sync','modal','edit-top']) {
  for(const button of [0,2]) for(const doubleClick of [false,true]) {
    // The right-button doubleClick option currently remains WM_RBUTTONDOWN.
    // Preserve that supported behavior; only left has a DBLCLK route.
    if(route==='modal' && button===2) continue;
    for(const history of ['none','opposite held','opposite released','both held']) {
      for(const state of states) check(`${route}/${button}/${doubleClick}/${history}/${state.name}`,()=>{
        const {r,sent,target,child,activate}=fixture(route);
        const other=button===0?2:0;
        const start=route==='cached-child'?[40,60]:[500,400];
        if(history!=='none') {
          r.handleMouseDown(...start,other);
          if(history==='opposite released') r.handleMouseUp(...start,other);
          if(history==='both held') r.handleMouseDown(...start,button);
        }
        if(route==='cached-child' && (history==='opposite held'||history==='both held'))
          assert.equal(r._lastDeepChild.childHwnd,101,'prior real DOWN cached deep child');
        state.keys.forEach(k=>key(r,k));
        activate(); r.inputQueue.length=0; sent.length=0;
        const [x,y]=route.startsWith('capture')?[-5,240]:[80,90];
        r.handleMouseDown(x,y,button,{...state.opts,doubleClick});
        const msg=button===2?0x204:doubleClick?0x203:0x201;
        const events=[...r.inputQueue,...sent].filter(e=>e.msg===msg);
        assert.equal(events.length,1,'exactly one DOWN/DBLCLK');
        const event=events[0];
        assert.equal(event.hwnd,target,'recipient preserved');
        assert.equal(event.lParam>>>0,(((y-(child?30:10))<<16)|((x-(child?20:10))&65535))>>>0,'client coordinates');
        const both=history==='opposite held'||history==='both held';
        assert.equal(event.wParam,state.masks[both?2:button===0?0:1],'documented complete mask');
        assert.equal(r._mouseButtonsMask,both?3:button===0?1:2,'physical state');
        if(event.mouseButtons!==undefined) assert.equal(event.mouseButtons,r._mouseButtonsMask,'queue snapshot');
        assert.equal(sent.length,route.endsWith('sync')||route==='modal'?1:0,'synchronous route');
      });
    }
  }
}
for(const released of [false,true]) check(`EDIT early return/${released}`,()=>{
  const {r}=fixture('ordinary-top');
  Object.assign(r.wasm.exports,{get_focus_hwnd:()=>101,ctrl_get_class:h=>h===101?2:0});
  r.handleKeyDown(16); r.handleKeyDown(17);
  assert.ok(!r._shiftDown&&!r._ctrlDown,'real native EDIT bypasses legacy flags');
  if(released) {r.handleKeyUp(16);r.handleKeyUp(17);}
  r.handleMouseDown(500,400,2); r.inputQueue.length=0;
  r.handleMouseDown(80,90,0);
  assert.equal(r.inputQueue.find(e=>e.msg===0x201).wParam,released?3:15);
});
for(const control of ['no-window','disabled','disabled-child','non-client','menu','modal-outside']) {
  check(control,()=>{
    const {r,sent,activate}=fixture(control==='modal-outside'?'modal':'ordinary-child');
    r.handleMouseDown(500,400,2); activate();
    if(control==='no-window') r.windows={};
    if(control==='disabled'||control==='disabled-child') r.wasm.exports.wnd_get_style_export=
      h=>h===(control==='disabled'?100:101)?0x08000000:0;
    if(control==='non-client') {r.windows[100].hasCaption=true;r.wasm.exports.hittest_sync=()=>2;}
    if(control==='menu') r.wasm.exports.menu_open_hwnd=()=>100;
    r.inputQueue.length=0;sent.length=0;
    r.handleMouseDown(control==='modal-outside'?500:80,90,0);
    const downs=[...r.inputQueue,...sent].filter(e=>[0x201,0x203,0x204].includes(e.msg));
    if(control==='disabled-child') {assert.equal(downs.length,1);assert.equal(downs[0].hwnd,100);assert.equal(downs[0].wParam,3);}
    else assert.equal(downs.length,0,'control consumes client button message');
    assert.equal(r._mouseButtonsMask,3,'physical buttons remain current even when not dispatched');
  });
}
require('node:fs').writeSync(1,JSON.stringify({count,failures},null,2)+'\n');
assert.equal(failures.length,0,`${failures.length}/${count} renderer mouse DOWN cases failed`);
