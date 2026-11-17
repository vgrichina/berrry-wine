'use strict';

const EDIT_VIEWPORT='native-edit-viewport-v1';
function qualifiedEditViewport(w){
  const v=w.nativeEditViewport;
  const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
  return !!(w.controlClass===2&&w.nativeTextAvailable===true&&w.nativeTextComplete===false&&
    w.title===null&&w.textBytes===null&&v?.contract===EDIT_VIEWPORT&&
    v.hwnd===w.hwnd&&v.generation===w.generation&&v.processId===w.processId&&v.threadId===w.threadId&&
    !(w.style&32)&&int(v.documentLength,65537,1048576)&&/^[a-f0-9]{64}$/.test(v.documentSHA256)&&
    int(v.capacity,v.documentLength,2147483646)&&int(v.allocationBytes,v.capacity+1,2147483647)&&
    int(v.width,1,4096)&&int(v.height,8,4096)&&int(v.totalLines,1,v.documentLength+1)&&
    int(v.scrollTop,0,v.totalLines-1)&&int(v.scrollX,0,2147483647)&&
    int(v.cursor,0,v.documentLength)&&int(v.selectionAnchor,0,v.documentLength)&&
    int(v.flags,0,63)&&!(v.flags&2)&&typeof v.wraps==='boolean'&&
    Array.isArray(v.lines)&&v.lines.length===Math.min(v.totalLines-v.scrollTop,Math.ceil((v.height-4)/16))&&
    v.lines.every((line,i)=>int(line.start,0,v.documentLength)&&int(line.length,0,v.documentLength-line.start)&&
      line.y===4+i*16&&typeof line.text==='string'&&line.text.length===line.length&&
      /^[\x01-\xff]*$/.test(line.text)&&!/[\r\n]/.test(line.text)&&
      Buffer.from(line.text,'latin1').toString('hex')===line.textBytes&&
      (!i||line.start>=v.lines[i-1].start+v.lines[i-1].length))&&
    v.lines.reduce((n,line)=>n+line.length,0)<=65536);
}

// Native USER children often paint into their parent's canvas and consequently
// have no renderer.windows entry. Include their actual public control metadata
// in every capture and consume-time snapshot. Never send a guest message here.
function withNativeUserChildren(windows, renderer, memory) {
  const rows=new Map(windows.map(w=>[w.hwnd,w]));
  const hex=h=>'0x'+(h>>>0).toString(16);
  const bytes=new Uint8Array(memory.buffer);
  function geometry(e,h){
    const wh=e.get_client_rect_wh(h)>>>0;
    return {nativeClientRect:{screenX:e.wnd_client_screen_x(h)|0,screenY:e.wnd_client_screen_y(h)|0,
      w:wh&65535,h:wh>>>16}};
  }
  function progress(e,h,generation){
    return {progress:require('./cli-native-progress').observe(e,h,generation),
      commonControl:require('./cli-native-common-controls').observe(e,h,memory,generation)};
  }
  function text(e,h,style) {
    const cls=e.ctrl_get_class(h)>>>0;
    if(!e.native_user_text_ptr || !e.native_user_text_length)
      return {nativeTextAvailable:false,nativeTextUnavailableReason:'missingTextExports'};
    if(cls===2 && (style&32))
      return {nativeTextAvailable:false,nativeTextUnavailableReason:'passwordEdit'};
    const p=e.native_user_text_ptr(h)>>>0,n=e.native_user_text_length(h);
    const validLength=Number.isInteger(n)&&n>=-0x80000000&&n<=0x7fffffff;
    if(cls===2&&validLength&&n>65536&&e.native_edit_viewport){
      const buffer=memory.buffer,generation=String(e.wnd_lookup_generation(h));
      const pid=e.get_process_id(),tid=e.get_window_thread(h),proc=e.wnd_get_proc_export(h);
      let status=null;
      const fail=()=>({nativeTextAvailable:false,nativeTextUnavailableReason:'nativeEditViewportUnavailable',
        nativeEditViewportDiagnostic:{status}});
      const stable=()=>memory.buffer===buffer&&e.wnd_lookup_live(h)&&
        String(e.wnd_lookup_generation(h))===generation&&e.ctrl_get_class(h)===2&&
        e.get_process_id()===pid&&e.get_window_thread(h)===tid&&e.wnd_get_proc_export(h)===proc&&
        (e.wnd_get_style_export(h)>>>0)===style&&e.native_user_text_ptr(h)>>>0===p&&e.native_user_text_length(h)===n;
      if(!stable())return fail();
      status=e.native_edit_viewport(h,0,0);
      if(status!==1||!p||p+n>=bytes.length)return fail();
      const get=(f,i=0)=>e.native_edit_viewport(h,f,i);
      const v={contract:EDIT_VIEWPORT,hwnd:hex(h),generation,processId:pid,threadId:tid,
        documentLength:n,allocationBytes:get(1),capacity:get(2),scrollTop:get(3),scrollX:get(4),
        totalLines:get(5),width:get(6),height:get(7),wraps:!!get(8),
        cursor:e.get_edit_cursor(h),selectionAnchor:e.get_edit_sel_start(h),flags:e.get_edit_flags(h),lines:[]};
      if(n>1048576||v.height<8||v.height>4096||v.width<1||v.width>4096||
        v.scrollTop<0||v.scrollTop>=v.totalLines||bytes[p+n]!==0)return fail();
      const document=bytes.subarray(p,p+n);
      // A length with an interior NUL disagrees with the public string contract.
      // Hash the ENTIRE validated document to fence off-screen replacements.
      if(document.includes(0))return fail();
      v.documentSHA256=require('node:crypto').createHash('sha256').update(document).digest('hex');
      const count=Math.min(v.totalLines-v.scrollTop,Math.ceil((v.height-4)/16));let work=0;
      for(let i=0;i<count;i++){
        const start=get(9,i),length=get(10,i);work+=length;
        if(start<0||length<0||start+length>n||work>65536)return fail();
        const raw=Buffer.from(document.subarray(start,start+length));
        v.lines.push({start,length,y:4+i*16,text:raw.toString('latin1'),textBytes:raw.toString('hex')});
      }
      if(!stable()||get(3)!==v.scrollTop||get(4)!==v.scrollX||
        e.get_edit_cursor(h)!==v.cursor||e.get_edit_sel_start(h)!==v.selectionAnchor||e.get_edit_flags(h)!==v.flags)return fail();
      const observation={nativeTextAvailable:true,nativeTextComplete:false,title:null,textBytes:null,nativeEditViewport:v};
      if(!qualifiedEditViewport({...observation,hwnd:hex(h),generation,processId:pid,threadId:tid,style,controlClass:2}))return fail();
      return observation;
    }
    const reason=!validLength?'invalidTextLength':n<0?'negativeTextLength':n>65536?'textLengthBound':
      n&&!p?'nullTextPointer':p+n>bytes.length?'textSpanOutsideMemory':null;
    // Numeric provenance only. A refused span is never read, decoded, hashed,
    // or used as a valid length. Password controls return before either export.
    if(reason)return {nativeTextAvailable:false,nativeTextUnavailableReason:reason,
      nativeTextDiagnostic:{reportedLength:validLength?n:null,pointer:p,memoryBytes:bytes.length,
        spanInBounds:validLength&&n>=0&&(!n||p!==0)&&p+n<=bytes.length}};
    const raw=Buffer.from(bytes.subarray(p,p+n));
    const edit=cls===2?{cursor:e.get_edit_cursor(h),selectionAnchor:e.get_edit_sel_start(h),flags:e.get_edit_flags(h)}:null;
    return {nativeTextAvailable:true,title:raw.toString('latin1'),textBytes:raw.toString('hex'),edit};
  }
  function visit(e,h,parentVisible,seen) {
    if(seen.has(h))throw Error('cyclic native USER child hierarchy');
    seen.add(h);
    const original=rows.get(hex(h));
    if(original)Object.assign(original,text(e,h,original.style),geometry(e,h),progress(e,h,original.generation));
    let start=0;
    for(let count=0;count<65536;count++){
      const slot=e.wnd_next_child_slot(h,start);
      if(slot===-1)return;
      if(slot<start)throw Error('invalid native USER child enumeration');
      start=slot+1;
      const child=e.wnd_slot_hwnd(slot)>>>0;
      if(!child || !e.wnd_lookup_live(child))throw Error('native USER child retired during snapshot');
      const style=e.wnd_get_style_export(child)>>>0,visible=parentVisible&&!!(style&0x10000000);
      const generation=String(e.wnd_lookup_generation(child));
      const screenX=e.wnd_window_screen_x(child)|0,screenY=e.wnd_window_screen_y(child)|0;
      const row={hwnd:hex(child),x:screenX,y:screenY,w:e.wnd_screen_w(child)|0,h:e.wnd_screen_h(child)|0,
        visible,isChild:!!(style&0x40000000),live:true,generation,
        processId:e.get_process_id()>>>0,threadId:e.get_window_thread(child)>>>0,
        owner:hex(e.wnd_get_owner(child)),parent:hex(e.wnd_get_parent(child)),style,
        controlClass:e.ctrl_get_class(child)>>>0,controlId:e.ctrl_get_id(child)>>>0,
        buttonFlags:e.ctrl_get_class(child)===1?e.button_get_flags(child)>>>0:null,screenX,screenY,
        ...text(e,child,style),...geometry(e,child),...progress(e,child,generation)};
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
// Resolve the actual executing actor, not a renderer shadow instance's globals.
function nativeDialogBoxIdentity(instance,threadManager){
  const instances=new Set([instance]);
  for(const actor of threadManager?.threads.values()||[])
    if(actor.state==='active'&&actor.instance)instances.add(actor.instance);
  const rows=[];
  const hex=n=>'0x'+Number(n).toString(16);
  for(const i of instances){
    const f=i.exports.native_dialogbox_identity;
    if(!f||!f(0))continue;
    const row={hwnd:hex(f(0)),generation:String(f(1)),processId:Number(f(2)),threadId:Number(f(3)),
      owner:hex(f(4)),callback:hex(f(5)),returnSite:hex(f(6))};
    const nested=i.exports.native_nested_messagebox_identity;
    if(nested?.(0)){
      row.nestedMessageBox={hwnd:hex(nested(0)),generation:String(nested(1)),
        owner:row.hwnd,ownerGeneration:String(nested(2)),processId:row.processId,threadId:row.threadId,returnSite:hex(nested(3))};
      if(!nested(0))throw Error('native nested MessageBox invocation retired during snapshot');
    }
    if(!f(0))throw Error('native DialogBox invocation retired during snapshot');
    rows.push(row);
  }
  if(rows.length>1)throw Error('ambiguous native DialogBox actors');
  return rows[0]||null;
}
function captureNativeButton(event,intent,snapshot,instance,threadManager){
  if(event.action!=='mousedown')return null;
  const menu=captureNativeMenu(event,intent,snapshot,instance,threadManager);
  if(menu)return menu;
  if(!intent?.review?.targetHwnd)return null;
  const target=snapshot.windows.find(w=>w.hwnd===intent.review.targetHwnd);
  if(!target?.live||!target.visible||target.controlClass!==1||(target.style&(1<<27)))return null;
  try{require('./cli-native-pointer-coordinates').containsPointer(snapshot,target,event);}catch{return null;}
  const actors=new Set([instance]);
  for(const actor of threadManager?.threads.values()||[])if(actor.state==='active'&&actor.instance)actors.add(actor.instance);
  const candidates=[];const h=parseInt(target.hwnd,16);
  for(const i of actors){const e=i.exports;
    if(e.get_current_thread_id()!==target.threadId||e.get_process_id()!==target.processId||!e.native_button_receipt)continue;
    if(!e.wnd_lookup_live(h)||String(e.wnd_lookup_generation(h))!==target.generation||
       (e.wnd_get_proc_export(h)>>>16)!==0xffff)continue;
    candidates.push({e,sequence:e.native_button_receipt(0),target:{...target}});
  }
  return candidates.length===1?candidates[0]:null;
}
function confirmNativeButton(fence,event){
  if(event.action!=='mousedown')return null;
  if(fence.kind==='menu')return confirmNativeMenu(fence,event);
  const {e,sequence,target}=fence,f=e.native_button_receipt;
  // This sequence only advances AFTER the real native BUTTON dispatch returns.
  // No advance, multiple dispatches, foreign actors, stale generations and
  // unrelated native controls cannot acknowledge the pending finite intent.
  if(e.get_current_thread_id()!==target.threadId||e.get_process_id()!==target.processId||
     !f(8)||!f(9)||f(0)!==sequence+1n||String(f(1))!==target.generation||Number(f(2))!==parseInt(target.hwnd,16)||
     Number(f(3))!==target.processId||Number(f(4))!==target.threadId||Number(f(5))!==parseInt(target.parent,16)||
     Number(f(6))!==0x201||!(Number(f(7))&1)||f(0)!==sequence+1n)return null;
  return {hwnd:Number(f(2)),msg:0x201,wParam:Number(f(7)),parent:Number(f(5)),
    generation:target.generation,processId:target.processId,threadId:target.threadId,nativeSequence:String(f(0))};
}
module.exports={withNativeUserChildren,nativeDialogBoxIdentity,captureNativeButton,confirmNativeButton,qualifiedEditViewport};

// Menus consume physical DOWN synchronously in WAT USER tracking. They do not
// dequeue a client WM_LBUTTONDOWN. Fence the exact native return, rather than
// treating an opened menu or any host handler return as evidence of delivery.
function captureNativeMenu(event,intent,snapshot,instance,threadManager){
  const actors=new Set([instance]);
  for(const actor of threadManager?.threads.values()||[])if(actor.state==='active'&&actor.instance)actors.add(actor.instance);
  const candidates=[];
  let point;try{point=require('./cli-native-pointer-coordinates').nativePoint(snapshot.pointerMapping,event.x,event.y);}catch{return null;}
  for(const i of actors){const e=i.exports;
    if(!e.native_menu_pointer_receipt)continue;
    const open=e.menu_open_hwnd()>>>0;
    for(const target of snapshot.windows){
      const h=parseInt(target.hwnd,16);
      if(!target.live||!target.visible||target.isChild||(target.style&(1<<27))||
        (intent?.review?.targetHwnd&&intent.review.targetHwnd!==target.hwnd)||
        e.get_process_id()!==target.processId||e.get_window_thread(h)!==target.threadId||
        !e.wnd_lookup_live(h)||String(e.wnd_lookup_generation(h))!==target.generation)continue;
      const kind=!open&&e.menu_hittest_bar(h,e.menu_bar_screen_x(h),e.menu_bar_screen_y(h),point.x,point.y)>=0?1:0;
      if(kind)candidates.push({kind:'menu',route:kind,e,point,sequence:e.native_menu_pointer_receipt(0),target:{...target}});
    }
  }
  return candidates.length===1?candidates[0]:null;
}
function confirmNativeMenu(fence,event){
  const {e,sequence,target,route,point}=fence,f=e.native_menu_pointer_receipt,h=parseInt(target.hwnd,16);
  if(event.action!=='mousedown'||e.get_process_id()!==target.processId||e.get_window_thread(h)!==target.threadId||
    !e.wnd_lookup_live(h)||String(e.wnd_lookup_generation(h))!==target.generation||
    f(0)!==sequence+1n||String(f(1))!==target.generation||Number(f(2))!==h||
    Number(f(3))!==target.processId||Number(f(4))!==target.threadId||Number(f(5))!==(point.x>>>0)||
    Number(f(6))!==(point.y>>>0)||Number(f(7))!==route||f(0)!==sequence+1n)return null;
  return {receiptBoundary:'native-menu-pointer-return',kind:'menu-pointer',hwnd:h,
    generation:target.generation,processId:target.processId,threadId:target.threadId,
    screenX:point.x,screenY:point.y,route:route===1?'bar':'open',nativeSequence:String(f(0))};
}
