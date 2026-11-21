'use strict';
// BUTTON owns its full client text; USER keeps a bounded nonclient title.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {bootRenderHarness}=require('./render-helper');
const extraWat=String.raw`
 (func (export "text_alloc") (param $n i32) (result i32) (call $heap_alloc (local.get $n)))
 (func (export "text_g2w") (param $p i32) (result i32) (call $g2w (local.get $p)))
 (func (export "text_parent") (result i32)
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
 (func (export "text_child") (param $p i32) (param $style i32) (param $text i32) (result i32)
  (call $ctrl_create_child (local.get $p) (i32.const 1) (i32.const 100)
   (i32.const 20) (i32.const 30) (i32.const 240) (i32.const 100)
   (local.get $style) (local.get $text)))
 (func (export "text_set") (param $h i32) (param $s i32) (result i32)
  (call $control_wndproc_dispatch (local.get $h) (i32.const 12) (i32.const 0) (local.get $s)))
 (func (export "text_get") (param $h i32) (param $s i32) (param $n i32) (result i32)
  (call $control_wndproc_dispatch (local.get $h) (i32.const 13) (local.get $n) (local.get $s)))
 (func (export "text_length") (param $h i32) (result i32)
  (call $control_wndproc_dispatch (local.get $h) (i32.const 14) (i32.const 0) (i32.const 0)))
 (func (export "text_paint") (param $h i32) (call $defwndproc_do_ncpaint (local.get $h)))
 (func (export "text_flags") (param $h i32) (result i32) (call $nc_flags_test (local.get $h)))
 (func (export "text_scan_nc") (result i32)
  (local $h i32)
  (local.set $h (call $nc_flags_scan (i32.const 1)))
  (call $nc_flags_clear (local.get $h) (i32.const 1))
  (local.get $h))
 (func (export "text_show") (param $h i32)
  (drop (call $control_wndproc_dispatch (local.get $h) (i32.const 24) (i32.const 1) (i32.const 0)))
  (drop (call $wnd_set_style (local.get $h)
   (i32.or (call $wnd_get_style (local.get $h)) (i32.const 0x10000000)))))
 (func (export "text_nc_message") (param $h i32)
  (drop (call $control_wndproc_dispatch (local.get $h) (i32.const 133) (i32.const 1) (i32.const 0))))
 (func (export "text_slot") (param $h i32) (result i32) (call $wnd_table_find (local.get $h)))
 (func (export "text_retire") (param $h i32)
  (drop (call $control_wndproc_dispatch (local.get $h) (i32.const 2) (i32.const 0) (i32.const 0)))
  (call $wnd_table_remove (local.get $h))
  (call $host_destroy_window (local.get $h)))
`;
(async()=>{
 const h=await bootRenderHarness({extraWat,width:500,height:300}),e=h.exports,b=new Uint8Array(h.memory.buffer);
 const string=s=>{const p=e.text_alloc(s.length+1);b.set(Buffer.from(s+'\0'),e.text_g2w(p));return p;};
 const read=p=>{let s='';for(;p&&b[p];p++)s+=String.fromCharCode(b[p]);return s;};
 const title=hwnd=>read(e.wnd_lookup_title(hwnd));
 const published=new Map(),publish=h.renderer.setWindowText.bind(h.renderer);h.renderer.setWindowText=(hwnd,text)=>{published.set(hwnd,text);publish(hwnd,text);};
 const old=string('IIII'),next=string('WWWW'),parent=e.text_parent(),dest=e.text_alloc(512);
 const pixels=()=>crypto.createHash('sha256').update(h.renderer.windows[parent]._backCanvas.toBuffer('image/png')).digest('hex');
 const check=(hwnd,s)=>{assert.equal(e.text_length(hwnd),s.length);assert.equal(e.text_get(hwnd,dest,512),s.length);assert.equal(read(e.text_g2w(dest)),s);assert.equal(title(hwnd),s.slice(0,255));assert.equal(published.get(hwnd),s);};
 const plain=e.text_child(parent,0x50000000,old);e.text_paint(parent);
 let before=pixels();assert.equal(e.text_set(plain,next),1);check(plain,'WWWW');assert.equal(pixels(),before,'captionless text does not paint a frame');
 const long='long button '.repeat(30),input=string(long);assert.equal(e.text_set(plain,input),1);b.fill(88,e.text_g2w(input),e.text_g2w(input)+long.length);check(plain,long);
 assert.equal(e.text_get(plain,dest,3),2);assert.equal(read(e.text_g2w(dest)),'lo','bounded public text copy');
 const hidden=e.text_child(parent,0x40c00000,old);before=pixels();assert.equal(e.text_set(hidden,next),1);check(hidden,'WWWW');assert.equal(pixels(),before,'hidden captioned child leaves parent pixels untouched');assert(e.text_flags(hidden)&1,'hidden caption damage retained');
 for(let n=0;n<20&&e.text_scan_nc();n++);assert.equal(e.text_flags(hidden)&1,0,'real NC scan consumes hidden frame damage');
 before=pixels();e.text_show(hidden);assert(e.text_flags(hidden)&1,'show notification re-arms consumed caption damage');assert.equal(pixels(),before,'show notification queues frame work');e.text_nc_message(hidden);assert.notEqual(pixels(),before,'caption-only BUTTON handles its nonclient paint after exposure');
 const visible=e.text_child(parent,0x50c00000,old);e.text_paint(visible);before=pixels();assert.equal(e.text_set(visible,next),1);check(visible,'WWWW');assert.notEqual(pixels(),before,'visible captioned child repaints immediately');
 before=pixels();assert.equal(e.text_set(visible,0),1);check(visible,'');assert.notEqual(pixels(),before,'empty text erases old caption');
 const slot=e.text_slot(visible);e.text_retire(visible);const replacement=e.text_child(parent,0x50c00000,old);assert.equal(e.text_slot(replacement),slot,'WND row actually reused');assert.equal(e.text_set(replacement,next),1);before=pixels();assert.equal(e.text_set(visible,old),0);check(replacement,'WWWW');assert.equal(pixels(),before,'retired handle cannot paint reused row');
 console.log('PASS BUTTON owned/public/title/host text, hidden/child/no-caption/empty/long text and destruction/reuse');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
