'use strict';
// No guest: production parser, handlers, step bookkeeping and key branches,
// with an explicitly fake renderer and one deterministic batch scheduler.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert');
const source=fs.readFileSync(process.argv[2],'utf8'),mode=process.argv[3]||'normal';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(source),'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809');
const extracts=[];
function cut(name,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);const text=source.slice(a,b);extracts.push({name,start:a,end:b,bytes:Buffer.byteLength(text),sha256:sha(text)});return text;}
const parser=cut('parseInputEntries','  const parseInputEntries = (entries) => {','\n  if (INPUT_SPEC)');
const state=cut('step bookkeeping','  const liveOutstanding = new Map();','  const controlSafeValue =');
const safe=cut('safe/snapshot','  const controlSafeValue =','  const controlEval =');
const handler=cut('handleControlCommand','  const handleControlCommand = (cmdIn) => {','\n  const control =');
const keys=cut('key actions',"      } else if (ev.action === 'keydown' && renderer && renderer.handleKeyDown) {","      } else if ((ev.action === 'di-keydown'");
const body=`
 const scheduledInput=[],logs=[],tickState={batch:12};let stopped=false,signalExitWake;
 const CONTROL_FROZEN_START=true,batchClock={getTickMsPerBatch:()=>16};
 const instance={exports:{get_eip:()=>1,get_focus_hwnd:()=>65537,get_main_hwnd:()=>65537}};
 let videoRecorder=null;const EXE_PATH='fixture',APP_ID='airstrike',path=require('path');
 const renderer={windows:{65537:{hwnd:65537,visible:true,title:'Airstrike FAKE'}},canvas:{width:800,height:600},handleKeyDown:()=>{},handleKeyUp:()=>{}};
 ${parser}\n${state}\n${safe}
 const controlPng=filename=>{const data=Buffer.from('FAKE IMAGE NOT PNG');fs.writeFileSync(filename,data);return {path:filename,bytes:data.length,batch:tickState.batch};};
 ${handler}
 return {handleControlCommand, snapshot:controlSnapshot, async batch(){
  await waitForControlBatch();const batch=tickState.batch;
  while(scheduledInput.length&&scheduledInput[0].batch<=batch){const ev=scheduledInput.shift();
    if(false){${keys}\n}}
  for(const line of logs)if(mode!=='missing-log')console.log(line);logs.length=0;
  tickState.batch++;finishPreviousControlBatch();
 }};`;
const engine=new Function('require','fs','mode',body)(require,fs,mode);
console.error('production handler fixture, NO guest');
console.log('production handler fixture stdout diagnostic');
fs.writeFileSync(process.env.AIRSTRIKE_EXTRACTION_RECEIPT,JSON.stringify({sourceSHA256:sha(source),extracts},null,2));
let chain=Promise.resolve();
require('readline').createInterface({input:process.stdin}).on('line',line=>{
 chain=chain.then(async()=>{const cmd=JSON.parse(line);let value;
  try {
   const pending=engine.handleControlCommand(cmd);
   if(cmd.action==='step'){
    if(mode==='terminal'){process.exitCode=7;process.stdin.destroy();return;}
    if(mode==='timeout')return new Promise(()=>{});
    await engine.batch();
   }
   value=await pending;
   if(mode==='partial'&&cmd.action==='step')value.ran=0;
   if(mode==='stale'&&cmd.action==='snapshot'&&value.batch>12)value.frozen.credits=1;
   const id=mode==='wrong-id'&&cmd.action==='step'?'stale-step':cmd.id;
   console.log('[ctl] '+JSON.stringify({id,ok:true,value}));
  }catch(e){console.log('[ctl] '+JSON.stringify({id:cmd.id,ok:false,error:e.message}));}
 });
});
