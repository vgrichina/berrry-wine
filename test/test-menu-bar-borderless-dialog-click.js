#!/usr/bin/env node
'use strict';

// A menu bar is non-client area in its own right, and it can live on a
// borderless WS_POPUP *dialog*. Moraff's Jiggler is that shape: its whole
// game menu hangs off a 1305x42 dialog with no caption and no border, which
// the app reparents onto the game window. handleMouseDown's dialog branch
// drops every click outside such a dialog's client rect, so without an
// explicit menu-bar check there the painted bar was unclickable — and the
// generic menu check further down never ran, because it was gated on the
// JS-side `_menuId` mirror that a guest-installed SetMenu never sets.

const assert = require('assert');
const { installInputHandlers } = require('../lib/renderer-input');

class FakeRenderer {}
installInputHandlers(FakeRenderer);

// The strip: WS_POPUP | WS_VISIBLE, no caption, no border. Its client area
// starts 18px down, below the bar — the bar itself is outside it.
const STRIP = 0x10002;
const PARENT = 0x10001;

function makeRenderer({ barCount, takeClick }) {
  const calls = [];
  const wasm = {
    exports: {
      menu_bar_count: hwnd => (hwnd === STRIP ? barCount : 0),
      menu_bar_screen_x: () => 0,
      menu_bar_screen_y: () => 0,
      menu_handle_bar_click: (hwnd, x, y) => {
        calls.push({ hwnd, x, y });
        return takeClick ? 1 : 0;
      },
      menu_open_hwnd: () => 0,
      menu_open_top: () => -1,
      wnd_get_style_export: () => 0x90000000,
      hittest_sync: () => 0,
    },
  };
  const strip = {
    hwnd: STRIP,
    visible: true,
    isDialog: true,
    isChild: false,
    parentHwnd: PARENT,
    style: 0x90000000,
    x: 0, y: 0, w: 1305, h: 42,
    wasm,
  };
  const r = new FakeRenderer();
  r.wasm = wasm;
  r.windows = { [STRIP]: strip };
  r.inputQueue = [];
  r._mapExclusiveInputPoint = (x, y) => ({ x, y, outside: false });
  r._applyCursorClip = (x, y) => ({ x, y });
  r._mouseMaskForButton = () => 1;
  r._inputWindowAtPoint = () => strip;
  r._queueDirectInputMouseButton = () => {};
  r._signalDirectInputDevice = () => {};
  r._setMousePoint = () => {};
  r._modalDialogHwnd = () => 0;
  r._windowRectScreen = w => ({ x: w.x, y: w.y, w: w.w, h: w.h });
  r._computeClientRect = w => {
    w.clientRect = { x: w.x, y: w.y + 18, w: w.w, h: w.h - 18 };
  };
  r._isWindowClass = () => false;
  r._raiseWindowGroup = () => {};
  r._setKeyboardInputOwner = () => {};
  r._hasCaption = () => false;
  r._closeWatDialogFrame = () => {};
  r._beginWindowDrag = () => { throw new Error('a bar click must not start a drag'); };
  r.scheduleRepaint = () => {};
  r.repaint = () => {};
  r._hasMenuBar = w => (wasm.exports.menu_bar_count(w.hwnd) | 0) > 0;
  return { r, calls, strip };
}

// (40, 8) is inside the menu bar and outside the dialog's client rect.
{
  const { r, calls } = makeRenderer({ barCount: 6, takeClick: true });
  r.handleMouseDown(40, 8, 0, {});
  assert.strictEqual(calls.length, 1,
    'a click on the bar of a borderless dialog must reach menu_handle_bar_click');
  assert.deepStrictEqual(calls[0], { hwnd: STRIP, x: 40, y: 8 });
  assert.strictEqual(r._menuMouseCapture, true,
    'taking the bar click must start menu mouse capture');
}

// Negative control: the same window with no menu blob must not consult the
// menu at all, so an ordinary non-client click keeps its existing route.
{
  const { r, calls } = makeRenderer({ barCount: 0, takeClick: true });
  r.handleMouseDown(40, 8, 0, {});
  assert.strictEqual(calls.length, 0,
    'a dialog with no menu must not be asked to open one');
  assert.notStrictEqual(r._menuMouseCapture, true,
    'no menu means no menu capture');
}

// Second control: a menu that declines the point (a click in the empty space
// right of the last item) must fall through rather than swallow the click.
{
  const { r, calls } = makeRenderer({ barCount: 6, takeClick: false });
  r.handleMouseDown(900, 8, 0, {});
  assert.strictEqual(calls.length, 1, 'the menu is still consulted');
  assert.notStrictEqual(r._menuMouseCapture, true,
    'a declined bar click must not capture the mouse');
}

console.log('PASS  menu bar on a borderless WS_POPUP dialog takes its own clicks');

// Explicit browser menu receipts use the native tracker return, never a
// fabricated client DOWN. These are JS guard controls, not physical input.
function guardedMenu({consumer='menu-tracker',action='open',trust=true,mutate=()=>{}}={}) {
  const {createBrowserNativeInput}=require('../lib/browser-native-input');
  const {r,strip}=makeRenderer({barCount:1,takeClick:true});
  strip.isDialog=false;strip.parentHwnd=0;strip.processId=7;
  r._hitTestDeepChild=()=>null;r.wasm.exports.get_focus_hwnd=()=>strip.hwnd;
  r.canvas={width:1305,height:200,getBoundingClientRect:()=>({left:0,top:0,right:1305,bottom:200,width:1305,height:200})};
  r._clientOriginScreen=()=>({x:0,y:18});r.peekKeyDownState=()=>!!r._mouseButtonsMask;
  let open=action==='select'?strip.hwnd:0;
  const words=[0n,1n,BigInt(strip.hwnd),7n,1n,40n,8n,1n,0n];
  r.wasm.exports.native_menu_pointer_receipt=i=>words[i];
  r.wasm.exports.menu_open_hwnd=()=>open;
  const handle=()=>{words[0]++;words[7]=action==='open'?1n:2n;words[8]=action==='select'?100n:0n;
    open=action==='open'?strip.hwnd:0;mutate(words,r);return 1;};
  r.wasm.exports.menu_handle_bar_click=handle;r.wasm.exports.menu_handle_mouse_open=handle;
  const gps={endpoint:{},presenter:{layer:{canvas:{}}}};
  const wine={renderer:r,instance:r.wasm,memory:{buffer:new ArrayBuffer(128)},_wasmModule:{},
    _processObject:{},running:true,processId:7,guestWorker:{link:{slot:0,worker:{},endpointIdentity:17}},
    hostCtx:{getGlGpsBridge:()=>gps}};
  const g=createBrowserNativeInput(wine,{trusted:()=>trust}),scene=[1,7,strip.hwnd,strip.hwnd,0,0,1,0,1,0];
  g.withActor(0,'check_input',()=>g.observe(scene));const binding=g.bind();
  g.prepare({owner:binding.owner,nonce:'menu',kind:'mouse',code:1,button:0,x:40,y:8,
    ...(consumer==='client'?{}:{consumer}),menuAction:action,commandId:100,reviewed:true,reviewedAt:Date.now(),imageSHA256:'a'.repeat(64)});
  r.handleMouseDown(40,8,0,{});return {g,r,words};
}
for(const action of ['open','select']) {
  const {g,r}=guardedMenu({action}),receipt=g.status('menu');
  assert.strictEqual(receipt.state,'MENU_HANDLED');assert.strictEqual(receipt.consumed,false);
  assert.strictEqual(receipt.nativeMessage,null);assert.strictEqual(receipt.token,0);
  assert.strictEqual(receipt.receiptBoundary,'synchronous-wat-menu-tracker-return');
  assert.strictEqual(receipt.menuReceipt.action,action);assert.strictEqual(receipt.physicalUp,null);
  assert.deepStrictEqual(r.inputQueue,[]);
  r.handleMouseUp(40,8,0,{});assert.strictEqual(g.status('menu').physicalUp.trusted,true);
  g.close();assert.strictEqual(g.status('menu').state,'MENU_HANDLED');
}
// The default client contract still refuses a synchronously handled menu.
assert.strictEqual(guardedMenu({consumer:'client'}).g.status('menu').state,'UNKNOWN');
for(const mutate of [w=>w[0]++,w=>w[1]++,w=>w[2]++,w=>w[3]++,w=>w[4]++,w=>w[5]++,w=>w[6]++,
  w=>w[7]=3n,w=>w[8]=101n]) {
  const {g,r}=guardedMenu({action:'select',mutate});assert.strictEqual(g.status('menu').state,'UNKNOWN');
  const n=r.inputQueue.length;r.handleMouseDown(40,8,0,{});assert.strictEqual(r.inputQueue.length,n);
}
assert.strictEqual(guardedMenu({trust:false}).g.status('menu').state,'PREPARED');
{
  const {g,r}=guardedMenu({mutate:(w,r)=>r.inputQueue.push({msg:0x201,wParam:1,lParam:0})});
  assert.strictEqual(g.status('menu').state,'UNKNOWN');assert.deepStrictEqual(r.inputQueue,[]);
}
console.log('PASS  distinct menu open/selection return; cancellation, wrong command/identity/point/sequence and untrusted negatives');
