'use strict';
const assert=require('node:assert/strict');
const {withNativeUserChildren}=require('../lib/cli-native-user-windows');
const {captureFailures,createReviewedContexts}=require('../lib/cli-native-scene');

function scene(){
  const w={hwnd:'0x1',generation:'1',processId:1000,threadId:1,live:true,
    visible:true,isChild:false,owner:'0x0',controlClass:999,nativeTextAvailable:false,
    nativeTextUnavailableReason:'negativeTextLength',title:'SECRET',textBytes:'SECRET'};
  return {mainHwnd:w.hwnd,windows:[w],modalHwnd:'0x0',focus:w.hwnd,focusTopLevel:w.hwnd,
    focusWindow:w,capture:'0x0',physicalUp:true,nativeProcess:{pid:1,executable:'SECRET'},
    screen:{w:800,h:600},eip:'0x400000',quit:false};
}
const s=scene(),base=captureFailures(s),detail=captureFailures(s,true);
assert.deepEqual(base,{context:[],controls:['control.unsupportedClass','control.textUnavailable']});
assert.deepEqual(detail.controlDetails,[{hwnd:'0x1',controlClass:999,
  reasons:base.controls,textReason:'negativeTextLength'}]);
assert.deepEqual({context:detail.context,controls:detail.controls},base,'diagnostics do not change refusal');
let encodes=0,writes=0;
assert.throws(()=>createReviewedContexts().capture(()=>s,()=>{encodes++;},()=>{writes++;}),error=>{
  const refusal=JSON.parse(error.message.slice('native capture refused '.length));
  assert.deepEqual(refusal,detail);assert(!error.message.includes('SECRET'));return true;
});
assert.equal(encodes,0);assert.equal(writes,0,'refusal writes no replacement capture');
const changed=scene();changed.focusTopLevel='0x2';
assert(captureFailures(changed,true).context.includes('focus.mainTopLevel'));
assert.deepEqual(captureFailures(changed,true).contextDetails,
  {mainHwnd:'0x1',modalHwnd:'0x0',focus:'0x1',focusTopLevel:'0x2'});
const privateRow=scene();Object.assign(privateRow.windows[0],{
  hwnd:'SECRET',controlClass:'SECRET',nativeTextUnavailableReason:'SECRET'});
assert(!JSON.stringify(captureFailures(privateRow,true)).includes('SECRET'),'unrecognized metadata is not echoed');

// Exercise the real snapshot adapter without guest messages or text reads on
// refusal. The same observed export values retain their precise bounded reason.
function unavailable({cls=999,style=0,p=4,n=-1,missing=false}={}){
  const exports={ctrl_get_class:()=>cls,get_client_rect_wh:()=>0x10001,
    wnd_client_screen_x:()=>0,wnd_client_screen_y:()=>0,wnd_next_child_slot:()=>-1};
  if(!missing)Object.assign(exports,{native_user_text_ptr:()=>p,native_user_text_length:()=>n});
  const root={hwnd:'0x1',live:true,visible:true,isChild:false,generation:'1',style};
  return withNativeUserChildren([root],{windows:{1:{wasm:{exports}}}},
    {buffer:new ArrayBuffer(256)})[0];
}
for(const [options,reason] of [
  [{missing:true},'missingTextExports'],[{cls:2,style:32},'passwordEdit'],
  [{n:-1},'negativeTextLength'],[{n:65537},'textLengthBound'],
  [{p:0,n:1},'nullTextPointer'],[{p:250,n:8},'textSpanOutsideMemory']]){
  const row=unavailable(options);assert.equal(row.nativeTextAvailable,false);
  assert.equal(row.nativeTextUnavailableReason,reason);
}
console.log('PASS native capture refusal identity/reason diagnostics; unchanged refusal and private-text exclusion');
