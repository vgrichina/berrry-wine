'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {bootRenderHarness}=require('./render-helper');
const extraWat=String.raw`
 (func (export "caption_alloc") (param $n i32) (result i32) (call $heap_alloc (local.get $n)))
 (func (export "caption_g2w") (param $p i32) (result i32) (call $g2w (local.get $p)))
 (func (export "caption_parent") (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_BUILTIN))
  (drop (call $wnd_set_style (local.get $h) (i32.const 0x10000000)))
  (call $host_register_dialog_frame (local.get $h) (i32.const 0) (i32.const 0)
   (i32.const 500) (i32.const 300) (i32.const 0))
  (call $defwndproc_do_nccalcsize (local.get $h))
  (drop (call $host_erase_background (local.get $h) (i32.const 16)))
  (local.get $h))
 (func (export "caption_child") (param $p i32) (param $style i32) (param $text i32) (result i32)
  (call $ctrl_create_child (local.get $p) (i32.const 3) (i32.const 100)
   (i32.const 20) (i32.const 30) (i32.const 240) (i32.const 100)
   (local.get $style) (local.get $text)))
 (func (export "caption_text") (param $h i32) (param $s i32) (result i32)
  (call $control_wndproc_dispatch (local.get $h) (i32.const 12) (i32.const 0) (local.get $s)))
 (func (export "caption_paint") (param $h i32) (call $defwndproc_do_ncpaint (local.get $h)))
 (func (export "caption_flags") (param $h i32) (result i32) (call $nc_flags_test (local.get $h)))
 (func (export "caption_slot") (param $h i32) (result i32) (call $wnd_table_find (local.get $h)))
 (func (export "caption_retire") (param $h i32)
  (drop (call $control_wndproc_dispatch (local.get $h) (i32.const 2) (i32.const 0) (i32.const 0)))
  (call $wnd_table_remove (local.get $h))
  (call $host_destroy_window (local.get $h)))
`;
(async()=>{
 const h=await bootRenderHarness({extraWat,width:500,height:300}),e=h.exports,b=new Uint8Array(h.memory.buffer);
 const string=s=>{const p=e.caption_alloc(s.length+1),wa=e.caption_g2w(p);b.set(Buffer.from(s+'\0'),wa);return p;};
 const title=hwnd=>{let p=e.wnd_lookup_title(hwnd),s='';if(p)for(;b[p];p++)s+=String.fromCharCode(b[p]);return s;};
 const published=new Map(),publish=h.renderer.setWindowText.bind(h.renderer);h.renderer.setWindowText=(hwnd,text)=>{published.set(hwnd,text);publish(hwnd,text);};
 const old=string('IIII'),next=string('WWWW'),parent=e.caption_parent();
 const pixels=()=>crypto.createHash('sha256').update(h.renderer.windows[parent]._backCanvas.toBuffer('image/png')).digest('hex');
 const plain=e.caption_child(parent,0x50000000,old);e.caption_paint(parent);
 let before=pixels();assert.equal(e.caption_text(plain,next),1);assert.equal(title(plain),'WWWW');assert.equal(pixels(),before,'captionless text invalidation does not paint a frame');
 const long='long title '.repeat(30);assert.equal(e.caption_text(plain,string(long)),1);assert.equal(published.get(plain),long,'host publication preserves text beyond the NC storage limit');assert.equal(title(plain),long.slice(0,255));
 const hidden=e.caption_child(parent,0x40c00000,old);before=pixels();assert.equal(e.caption_text(hidden,next),1);assert.equal(title(hidden),'WWWW');assert.equal(pixels(),before,'hidden captioned child leaves parent pixels untouched');assert(e.caption_flags(hidden)&1,'hidden caption damage retained');
 const visible=e.caption_child(parent,0x50c00000,old);e.caption_paint(visible);before=pixels();assert.equal(e.caption_text(visible,next),1);assert.equal(title(visible),'WWWW');assert.notEqual(pixels(),before,'visible captioned child repaints immediately');
 before=pixels();assert.equal(e.caption_text(visible,0),1);assert.equal(title(visible),'');assert.notEqual(pixels(),before,'empty title erases old glyphs');
 const slot=e.caption_slot(visible);e.caption_retire(visible);const replacement=e.caption_child(parent,0x50c00000,old);assert.equal(e.caption_slot(replacement),slot,'WND row actually reused');assert.equal(e.caption_text(replacement,next),1);before=pixels();assert.equal(e.caption_text(visible,old),0,'retired handle cannot process text');assert.equal(title(replacement),'WWWW');assert.equal(pixels(),before,'retired message cannot paint reused row');
 console.log('PASS STATIC caption child/hidden/captionless/empty/retired/reused state and pixels');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
