'use strict';

const CONTRACT='native-common-controls-v1';
const hex=h=>'0x'+(h>>>0).toString(16);
// These read-only callbacks run synchronously against the selected window's
// native instance. Fence actor, generation and memory on both sides, including
// empty strings/lists; no guest allocations, SendMessage or scratch writes.
function observe(e,h,memory,expectedGeneration) {
  const cls=e.ctrl_get_class(h);
  if(![4,5,9,12].includes(cls))return null;
  const unavailable=()=>({contract:CONTRACT,available:false});
  const buffer=memory.buffer,generation=String(e.wnd_lookup_generation(h));
  const pid=e.get_process_id(),tid=e.get_window_thread(h),proc=e.wnd_get_proc_export(h);
  const stable=()=>memory.buffer===buffer&&e.wnd_lookup_live(h)&&
    String(e.wnd_lookup_generation(h))===generation&&generation===expectedGeneration&&
    e.get_process_id()===pid&&e.get_window_thread(h)===tid&&e.wnd_get_proc_export(h)===proc&&e.ctrl_get_class(h)===cls;
  if(!stable())throw Error('native control identity changed before observation');
  function bytes(p,n){
    if(!Number.isInteger(n)||n<0||n>65536||(n&&!p)||p<0||p+n>buffer.byteLength)
      throw Error('native control text bounds unavailable');
    return Buffer.from(new Uint8Array(buffer,p,n));
  }
  const identity=k=>{
    if(!k)return null;
    if(!e.wnd_lookup_live(k)||e.get_window_thread(k)!==tid)throw Error('native related control unavailable');
    const g=String(e.wnd_lookup_generation(k));
    if(g==='0')throw Error('native related control generation unavailable');
    return {hwnd:hex(k),generation:g};
  };
  function list(k){
    const get=e.native_listbox_get;
    if(!get||get(k,0)!==1)return null;
    const related=identity(k),n=get(k,1),selection=get(k,2),topIndex=get(k,3),p=get(k,4),used=get(k,5);
    if(n<0||n>4096||selection< -1||selection>=n||topIndex<0||topIndex>Math.max(0,n-1))return null;
    const raw=bytes(p,used),items=[];let at=0;
    for(let i=0;i<n;i++){
      const end=raw.indexOf(0,at);if(end<at)return null;
      const selected=e.native_listbox_selected(k,i);if(selected!==0&&selected!==1)return null;
      const text=raw.subarray(at,end);items.push({text:text.toString('latin1'),textBytes:text.toString('hex'),selected:!!selected});at=end+1;
    }
    if(at!==used||get(k,0)!==1||JSON.stringify(identity(k))!==JSON.stringify(related))return null;
    return {identity:related,count:n,selection,topIndex,items};
  }
  let state=null;
  if(cls===4)state=list(h);
  if(cls===5&&e.native_combobox_get?.(h,0)===1){
    const get=f=>e.native_combobox_get(h,f),selection=get(1),dropped=get(2),variant=get(3);
    const lb=get(4),edit=get(5),popup=get(6),text=bytes(get(7),get(8)),items=list(lb);
    if(items&&selection>=-1&&selection<items.count&&[0,1].includes(dropped)&&[1,2,3].includes(variant))
      state={selection,dropped:!!dropped,variant,list:items,edit:identity(edit),popup:identity(popup),text:text.toString('latin1'),textBytes:text.toString('hex')};
  }
  if(cls===9){
    const owner=e.native_combo_popup_owner?.(h)>>>0;
    if(owner)state={combo:identity(owner)};
  }
  if(cls===12&&e.native_common_frame?.(h)===1)state={kind:'file',owner:identity(e.wnd_get_owner(h))};
  if(!stable())throw Error('native control retired during observation');
  return state?{contract:CONTRACT,available:true,state}:unavailable();
}
function qualified(w){
  const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
  const identity=v=>!!(v&&/^0x[0-9a-f]+$/.test(v.hwnd)&&v.hwnd!=='0x0'&&/^[1-9][0-9]*$/.test(v.generation));
  const optional=v=>v===null||identity(v);
  const text=v=>typeof v?.text==='string'&&typeof v.textBytes==='string'&&v.text.length<=65536&&
    Buffer.from(v.text,'latin1').toString('hex')===v.textBytes&&/^[\x00-\xff]*$/.test(v.text);
  const list=v=>!!(v&&identity(v.identity)&&integer(v.count,0,4096)&&integer(v.selection,-1,v.count-1)&&
    integer(v.topIndex,0,Math.max(0,v.count-1))&&Array.isArray(v.items)&&v.items.length===v.count&&
    v.items.every(item=>text(item)&&typeof item.selected==='boolean')&&
    v.items.reduce((n,item)=>n+item.text.length+1,0)<=65536);
  if(!([4,5,9,12].includes(w.controlClass)&&w.live&&w.generation&&w.generation!=='0'&&
    w.processId&&w.threadId&&w.commonControl?.contract===CONTRACT&&w.commonControl.available===true))return false;
  const s=w.commonControl.state;if(!s)return false;
  if(w.controlClass===4)return list(s)&&s.identity.hwnd===w.hwnd&&s.identity.generation===w.generation;
  if(w.controlClass===5)return list(s.list)&&integer(s.selection,-1,s.list.count-1)&&
    typeof s.dropped==='boolean'&&integer(s.variant,1,3)&&optional(s.edit)&&optional(s.popup)&&text(s);
  if(w.controlClass===9)return identity(s.combo);
  return s.kind==='file'&&optional(s.owner)&&(s.owner?.hwnd||'0x0')===w.owner;
}
module.exports={observe,qualified,CONTRACT};
