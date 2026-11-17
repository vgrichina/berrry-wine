'use strict';

const CONTRACT='native-progress-v1';
// Actual native getters only. Missing/uninitialized/subclassed/retired controls
// remain unavailable; zero is a valid value for every data field.
function observe(e,h,expectedGeneration=null) {
  if(e.ctrl_get_class(h)!==17)return null;
  const get=e.native_progress_get;
  if(!get || get(h,0)!==1)return {contract:CONTRACT,available:false};
  const generation=String(e.wnd_lookup_generation(h));
  if(expectedGeneration!==null && generation!==expectedGeneration)
    throw Error('native ProgressBar generation changed before observation');
  const values=[1,2,3,4].map(field=>get(h,field));
  if(get(h,0)!==1 || !e.wnd_lookup_live(h) || String(e.wnd_lookup_generation(h))!==generation)
    throw Error('native ProgressBar retired during observation');
  return {contract:CONTRACT,available:true,min:values[0],max:values[1],pos:values[2],step:values[3]};
}
function qualified(w) {
  const p=w?.progress;
  const int=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
  return !!(w?.controlClass===17 && w.live && w.generation && w.generation!=='0' &&
    w.processId && w.threadId && p?.contract===CONTRACT && p.available===true &&
    [p.min,p.max,p.pos,p.step].every(int) && p.min<=p.max && p.pos>=p.min && p.pos<=p.max);
}
function supported(w) {
  return w.nativeTextAvailable!==false &&
    ([0,1,2,3,16].includes(w.controlClass) || qualified(w));
}
// Only the four observational values may change under a stable reviewed input
// target. Every caption, style, geometry, HWND generation, actor and hierarchy
// field remains in the comparison. Never discard arbitrary ProgressBar fields.
function inputMetadata(w) {
  if(w.controlClass!==17 || !qualified(w))return w;
  const {min,max,pos,step,...identity}=w.progress;
  return {...w,progress:identity};
}
module.exports={CONTRACT,observe,qualified,supported,inputMetadata};
