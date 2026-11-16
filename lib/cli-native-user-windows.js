'use strict';

// Native USER children often paint into their parent's canvas and consequently
// have no renderer.windows entry. Include their actual public control metadata
// in every capture and consume-time snapshot. Never send a guest message here.
function withNativeUserChildren(windows, renderer, memory) {
  const rows=new Map(windows.map(w=>[w.hwnd,w]));
  const hex=h=>'0x'+(h>>>0).toString(16);
  const bytes=new Uint8Array(memory.buffer);
  function text(e,h,style) {
    const cls=e.ctrl_get_class(h)>>>0;
    if(!e.native_user_text_ptr || !e.native_user_text_length || (cls===2 && (style&32)))
      return {nativeTextAvailable:false};
    const p=e.native_user_text_ptr(h)>>>0,n=e.native_user_text_length(h);
    if(n<0 || n>65536 || (n && !p) || p+n>bytes.length)
      return {nativeTextAvailable:false};
    const raw=Buffer.from(bytes.subarray(p,p+n));
    const edit=cls===2?{cursor:e.get_edit_cursor(h),selectionAnchor:e.get_edit_sel_start(h),flags:e.get_edit_flags(h)}:null;
    return {nativeTextAvailable:true,title:raw.toString('latin1'),textBytes:raw.toString('hex'),edit};
  }
  function visit(e,h,parentVisible,seen) {
    if(seen.has(h))throw Error('cyclic native USER child hierarchy');
    seen.add(h);
    const original=rows.get(hex(h));
    if(original)Object.assign(original,text(e,h,original.style));
    let start=0;
    for(let count=0;count<65536;count++){
      const slot=e.wnd_next_child_slot(h,start);
      if(slot===-1)return;
      if(slot<start)throw Error('invalid native USER child enumeration');
      start=slot+1;
      const child=e.wnd_slot_hwnd(slot)>>>0;
      if(!child || !e.wnd_lookup_live(child))throw Error('native USER child retired during snapshot');
      const style=e.wnd_get_style_export(child)>>>0,visible=parentVisible&&!!(style&0x10000000);
      const screenX=e.wnd_window_screen_x(child)|0,screenY=e.wnd_window_screen_y(child)|0;
      const row={hwnd:hex(child),x:screenX,y:screenY,w:e.wnd_screen_w(child)|0,h:e.wnd_screen_h(child)|0,
        visible,isChild:!!(style&0x40000000),live:true,generation:String(e.wnd_lookup_generation(child)),
        processId:e.get_process_id()>>>0,threadId:e.get_window_thread(child)>>>0,
        owner:hex(e.wnd_get_owner(child)),parent:hex(e.wnd_get_parent(child)),style,
        controlClass:e.ctrl_get_class(child)>>>0,controlId:e.ctrl_get_id(child)>>>0,
        buttonFlags:e.ctrl_get_class(child)===1?e.button_get_flags(child)>>>0:null,screenX,screenY,
        ...text(e,child,style)};
      rows.set(row.hwnd,row);
      visit(e,child,visible,seen);
    }
    throw Error('native USER child enumeration exceeded bound');
  }
  for(const root of windows.filter(w=>!w.isChild&&w.live)){
    const h=parseInt(root.hwnd,16),e=(renderer.windows[h]?.wasm||renderer.wasm)?.exports;
    if(!e?.wnd_next_child_slot)throw Error('native USER child enumeration unavailable');
    visit(e,h,root.visible,new Set());
  }
  return [...rows.values()];
}
module.exports={withNativeUserChildren};
