'use strict';

const CONTRACT='native-progress-v1';
const STORAGE='native-progress-storage-v1';
const hex=h=>'0x'+(h>>>0).toString(16);
// Strict virtual-native getters, or explicitly identified retained storage.
// Neither path sends a guest message or claims to replace guest painting.
function observe(e,h,expectedGeneration=null) {
  if(e.ctrl_get_class(h)!==17)return null;
  const get=e.native_progress_get;
  if(!get || get(h,0)!==1)return storage(e,h,expectedGeneration);
  const generation=String(e.wnd_lookup_generation(h));
  if(expectedGeneration!==null && generation!==expectedGeneration)
    throw Error('native ProgressBar generation changed before observation');
  const values=[1,2,3,4].map(field=>get(h,field));
  if(get(h,0)!==1 || !e.wnd_lookup_live(h) || String(e.wnd_lookup_generation(h))!==generation)
    throw Error('native ProgressBar retired during observation');
  return {contract:CONTRACT,available:true,min:values[0],max:values[1],pos:values[2],step:values[3]};
}
function storage(e,h,expectedGeneration){
  const get=e.native_progress_storage_get;
  if(!get)return {contract:CONTRACT,available:false};
  const status=get(h,0),generation=String(e.wnd_lookup_generation(h));
  const pid=e.get_process_id(),tid=e.get_window_thread(h),proc=e.wnd_get_proc_export(h)>>>0,
    style=e.wnd_get_style_export(h)>>>0,parent=e.wnd_get_parent(h)>>>0;
  const pg=String(e.wnd_lookup_generation(parent));
  const diagnostic={status,procedure:hex(proc),style,generation,parent:hex(parent),parentGeneration:pg};
  const fail=()=>({contract:STORAGE,available:false,diagnostic});
  if(expectedGeneration!==null&&generation!==expectedGeneration)throw Error('native ProgressBar generation changed before storage observation');
  if(status!==1||!parent||!e.wnd_lookup_live(parent)||pg==='0'||e.get_window_thread(parent)!==tid)return fail();
  const stable=()=>e.wnd_lookup_live(h)&&String(e.wnd_lookup_generation(h))===generation&&
    e.ctrl_get_class(h)===17&&e.get_process_id()===pid&&e.get_window_thread(h)===tid&&
    (e.wnd_get_proc_export(h)>>>0)===proc&&(e.wnd_get_style_export(h)>>>0)===style&&
    (e.wnd_get_parent(h)>>>0)===parent&&e.wnd_lookup_live(parent)&&
    String(e.wnd_lookup_generation(parent))===pg&&e.get_window_thread(parent)===tid;
  if(!stable())throw Error('native ProgressBar storage identity changed before observation');
  const values=[1,2,3,4].map(f=>get(h,f));
  if(get(h,0)!==1||(get(h,5)>>>0)!==proc||!stable())throw Error('native ProgressBar storage identity retired during observation');
  return {contract:STORAGE,available:true,min:values[0],max:values[1],pos:values[2],step:values[3],
    procedure:hex(proc),paintOwner:[0xfffe0001,0xffff0002].includes(proc)?'native':'guest-subclass',
    identity:{hwnd:hex(h),generation,processId:pid,threadId:tid,style,parent:hex(parent),parentGeneration:pg}};
}
function qualified(w) {
  const p=w?.progress;
  const int=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
  return !!(w?.controlClass===17 && w.live && w.generation && w.generation!=='0' &&
    w.processId && w.threadId && [CONTRACT,STORAGE].includes(p?.contract) && p.available===true &&
    (p.contract!==STORAGE || (p.identity?.hwnd===w.hwnd&&p.identity.generation===w.generation&&
      p.identity.processId===w.processId&&p.identity.threadId===w.threadId&&p.identity.style===w.style&&
      p.identity.parent===w.parent&&/^[1-9][0-9]*$/.test(p.identity.parentGeneration)&&
      /^0x[0-9a-f]+$/.test(p.procedure)&&
      (p.paintOwner==='native'?[0xfffe0001,0xffff0002].includes(parseInt(p.procedure,16)):
       p.paintOwner==='guest-subclass'&&parseInt(p.procedure,16)>0&&parseInt(p.procedure,16)<0xfffe0000))) &&
    [p.min,p.max,p.pos,p.step].every(int) && p.min<=p.max && p.pos>=p.min && p.pos<=p.max);
}
function supported(w) {
  return w.nativeTextAvailable!==false &&
    ([0,1,2,3,16].includes(w.controlClass) || qualified(w));
}
// Bounded public discriminants survive a refused capture. No captions, guest
// memory spans or guessed default values are exposed by this diagnostic.
function refusalDiagnostic(w){
  const p=w.progress,d=p?.diagnostic||{},i=p?.identity||{},int=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647?n:null;
  return {contract:[CONTRACT,STORAGE].includes(p?.contract)?p.contract:null,available:p?.available===true,
    status:int(d.status),generation:/^[0-9]+$/.test(w.generation)?w.generation:null,live:w.live===true,
    style:Number.isInteger(w.style)&&w.style>=0&&w.style<=0xffffffff?w.style:null,
    procedure:/^0x[0-9a-f]{1,8}$/.test(p?.procedure||d.procedure)?(p?.procedure||d.procedure):null,
    parent:/^0x[0-9a-f]{1,8}$/.test(w.parent)?w.parent:null,
    parentGeneration:/^[0-9]+$/.test(i.parentGeneration||d.parentGeneration)?(i.parentGeneration||d.parentGeneration):null,
    min:int(p?.min),max:int(p?.max),pos:int(p?.pos),step:int(p?.step),
    rangeValid:[p?.min,p?.max,p?.pos].every(n=>int(n)!==null)?p.min<=p.max&&p.pos>=p.min&&p.pos<=p.max:null};
}
// Only the four observational values may change under a stable reviewed input
// target. Every caption, style, geometry, HWND generation, actor and hierarchy
// field remains in the comparison. Never discard arbitrary ProgressBar fields.
function inputMetadata(w) {
  if(w.controlClass!==17 || !qualified(w))return w;
  const {min,max,pos,step,...identity}=w.progress;
  return {...w,progress:identity};
}
module.exports={CONTRACT,STORAGE,observe,qualified,supported,inputMetadata,refusalDiagnostic};
