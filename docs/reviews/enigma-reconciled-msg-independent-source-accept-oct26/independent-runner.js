'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const [out,root]=process.argv.slice(2),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const runner=read('test/run.js');
assert.equal(sha(runner),'55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e');
function section(a,b){const i=runner.indexOf(a),j=runner.indexOf(b,i);assert(i>=0&&j>i);return runner.slice(i,j);}
const install=section('  // BEGIN message-boundary installation:','  // END message-boundary installation');
const qualify=section('  ctx.exports = instance.exports;','  // Quiet runs silence');
const loader=section('  const { entry } = stageAndLoadPe(','  applyVirtualAllocTop(');
const req=require('module').createRequire(path.join(root,'test/run.js'));
const {createMessageBoundaryTrace}=req('./message-boundary-trace');
// Execute the actual CLI boolean assignment with the actual hasFlag definition.
const flag=runner.split('\n').find(l=>l.startsWith('const hasFlag ='));
assert(flag);
const declaration=runner.split('\n').find(l=>l.startsWith('const TRACE_MESSAGE_BOUNDARY ='));
function cli(args){return new Function('args',flag+'\n'+declaration+'\nreturn TRACE_MESSAGE_BOUNDARY;')(args);}
assert.equal(cli([]),false);assert.equal(cli(['--trace-message-boundary']),true);
assert.equal(cli(['--trace-message-boundary=false']),false);
let cases=0;const rejected=[];
function exercise({enabled=true,text=install,qualification=qualify,mutation=null}={}){
  const memory={buffer:new ArrayBuffer(1024)},dv=new DataView(memory.buffer),logs=[],events=[];
  for(let i=0;i<7;i++)dv.setUint32(256+4*i,100+i,true);
  const original=function(x){assert.equal(this.tag,17);return x+11;};
  const h={log_api_exit:original},ctx={};let setter=0;
  const instance={exports:{get_image_base:()=>0,get_eax:()=>123,get_esp:()=>16,get_eip:()=>32,get_current_thread_id:()=>1,get_yield_flag:()=>1,get_yield_reason:()=>1,
    set_message_completion(n){setter=n;events.push('setter');}}};
  const stageAndLoadPe=(e,b)=>{assert.equal(e,instance.exports);assert.equal(b,memory.buffer);assert.equal(setter,enabled?1:0);events.push('earliest-loader');return {entry:1};};
  const body='const tickState={batch:9};\n'+text+'\n'+qualification+'\n'+loader+'\nreturn {trace:messageBoundaryTrace,owner:messageCompletionOwner};';
  const {trace,owner}=new Function('require','createMessageBoundaryTrace','TRACE_MESSAGE_BOUNDARY','logs','memory','instance','translateGuest','h','ctx','stageAndLoadPe','exeBytes',body)(req,createMessageBoundaryTrace,enabled,logs,memory,instance,x=>x,h,ctx,stageAndLoadPe,new Uint8Array(0));
  if(mutation)mutation(h);
  assert.equal(owner.status().backingBytes,6144);
  assert.equal(trace.status().armed,false,'boot defaults off');
  assert.equal(h.message_begin(1,1,100,256,0,0,0,0),0,'boot initializer does not allocate');
  assert.equal(h.log_api_exit.call({tag:17},7),18,'legacy callback result/this');
  if(!enabled){assert.equal(h.log_api_exit,original);trace.arm(true);assert.equal(trace.status().armed,false);assert.equal(h.message_begin(1,1,100,256,0,0,0,0),0);assert.equal(setter,0);assert.deepEqual(logs,[]);cases++;return;}
  assert.deepEqual(events,['setter','earliest-loader']);
  assert.equal(trace.status().canonicalRuntimeQualified,false);
  trace.arm(true);
  const count=()=>logs.filter(l=>l.includes('"kind":"message-completion"')).length;
  const t=h.message_begin(1,7,100,256,22,33,44,0);assert(t>0);
  h.message_park(t);h.message_complete(t,88);assert.equal(count(),0,'parked is not completed');
  assert.equal(h.message_begin(1,7,100,256,22,33,44,0),t,'exact retry owns same invocation');
  h.message_bind(t,1,500);h.message_complete(t,99);assert.equal(count(),0,'bound callback pending');
  assert.equal(h.message_resume(2,500),0,'wrong callback kind');
  assert.equal(h.message_resume(1,501),0,'wrong callback context');
  assert.equal(h.message_resume(1,500),t,'only invocation callback resumes');
  h.message_complete(t,1);h.message_complete(t,1);h.message_complete(t+900,1);
  assert.equal(count(),1,'single actual installed observer completion');
  const r=JSON.parse(logs.find(l=>l.includes('"kind":"message-completion"')).slice('[message-boundary] '.length));
  assert.equal(r.invocation,t);assert.equal(r.thread,7);assert.equal(r.entryESP,100);assert.equal(r.msgPointer,256);
  assert.equal(r.msg.hwnd,100);assert.equal(r.msg.message,101);assert.equal(r.msg.pointY,106);assert.equal(r.correlation,'invocation-owned');
  trace.arm(false);assert.equal(h.message_begin(1,7,100,256,0,0,0,0),0);
  assert.equal(count(),1);cases++;
}
exercise({enabled:cli([])});exercise({enabled:cli(['--trace-message-boundary'])});
for(const [name,options] of [
 ['owner-import-installation',{text:install.replace('  Object.assign(h, messageCompletionOwner.imports);','')}],
 ['observer-wire',{text:install.replace('observe: detail => messageBoundaryTrace.completed(detail),','observe: detail => {},')}],
 ['arming-control',{text:install.replace('TRACE_MESSAGE_BOUNDARY && messageBoundaryTrace.status().armed && !messageBoundaryTrace.status().saturated','TRACE_MESSAGE_BOUNDARY')}],
 ['disabled-default',{enabled:false,text:install.replace('enabled: TRACE_MESSAGE_BOUNDARY, logs,','enabled: true, logs,')}],
 ['completion-qualification',{qualification:qualify.replace('    messageBoundaryTrace.qualifyCompletion();','')}],
 ['setter',{qualification:qualify.replace('    instance.exports.set_message_completion(1);','')}],
 ['park-control',{mutation:h=>h.message_park=()=>{}}],
 ['bind-control',{mutation:h=>h.message_bind=()=>{}}],
 ['resume-context-control',{mutation:h=>{const orig=h.message_resume;h.message_resume=()=>orig(1,500);}}],
]){assert.throws(()=>exercise(options),undefined,name);rejected.push({name,rejected:true});}
fs.writeFileSync(out+'/independent-runner-result.json',JSON.stringify({pass:true,candidate:'425755ee5ee9be0734c7aca187521100f5487674',runnerSHA256:sha(runner),excerpts:{install:sha(install),qualify:sha(qualify),loader:sha(loader),cli:sha(flag+'\n'+declaration)},cases,omissions:rejected,method:'Exact pinned runner statements and actual CLI flag definition; real production helper/owner via production require; substituted host loader, no guest/module execution',compiled:false,canonicalRuntimeQualified:false},null,2)+'\n');
console.log('PASS independent production CLI/default/initializer/installed-owner contract and '+rejected.length+' rejecting omissions');
