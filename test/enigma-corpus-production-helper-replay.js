'use strict';
// OFFLINE host replay only. No WebAssembly API, guest execution or native load.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const [donor,out]=process.argv.slice(2);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pins={
  'message-completion-owner.js':'5feb6cd914a7c93e58b719107887960783883d78af6c18ce7a45e79e1f077f0c',
  'message-boundary-trace.js':'0ca2cca343cf1b0c14e12c1e3c6dfa518abba78ffef41c095b681f59e4449379',
};
for(const [name,pin] of Object.entries(pins))assert.equal(sha(fs.readFileSync(path.join(donor,'ops',name))),pin);
const {createMessageCompletionOwner}=require(path.join(donor,'ops/message-completion-owner.js'));
const {createMessageBoundaryTrace}=require(path.join(donor,'ops/message-boundary-trace.js'));
const remote=path.join(donor,'repo/docs/reviews/enigma-retained-canonical-native-msg-qualification-oct26/remote');
function replay(c,group,omit=false){
  const MSG=0x405000,buffer=new ArrayBuffer(256),dv=new DataView(buffer),logs=[];
  c.state.msg.forEach((v,i)=>dv.setUint32(i*4,v>>>0,true));
  const e={get_eax:()=>c.state.eax,get_esp:()=>c.state.esp,get_eip:()=>c.state.eip,
    get_current_thread_id:()=>1,get_yield_flag:()=>0,get_yield_reason:()=>c.state.yieldReason};
  const trace=createMessageBoundaryTrace({enabled:true,logs,snapshot:()=>({batch:0}),
    getContext:()=>({exports:e,memory:{buffer},translate:addr=>addr-MSG})});
  trace.qualifyCompletion();trace.arm(true);
  const details=[];
  const owner=createMessageCompletionOwner({enabled:()=>true,observe:d=>{details.push(d);trace.completed(d);},gap:()=>assert.fail('unexpected owner gap')});
  for(let i=0;i<c.calls.length;i++){
    const [name,...args]=c.calls[i];
    if(!(omit&&name==='message_complete')){
      const returned=owner.imports[name](...args);
      if(name==='message_begin')assert.equal(returned,args[3]===MSG+64?2:1,'actual owner token');
      if(name==='message_resume')assert.equal(returned,1,'actual continuation token');
    }
    if(i===1&&(group==='hooks-thread'||c.kind==='park')){
      assert.equal(details.length,0,'no completion at suspended/parked boundary');
      assert.equal(trace.wrapPostHandler(()=>17)(),17,'legacy return');
      assert.equal(details.length,0,'post-handler is not completion');
    }
  }
  const records=logs.map(l=>JSON.parse(l.slice(19))).filter(r=>r.kind==='message-completion');
  assert.deepEqual(records,c.records,'actual production owner/trace agrees with retained observations');
  return records.length;
}
const groups=[];let records=0,omissions=0;
for(const b of ['tail','compat'])for(const g of ['core','hooks-thread','hardware','unrelated']){
  const file=b+(g==='core'?'':'-'+g)+'-result.json';
  const j=JSON.parse(fs.readFileSync(path.join(remote,file)));
  for(const c of j.cases)records+=replay(c.on,g);
  if(g==='core'){replay(j.omissionControl.actual,g,true);omissions++;}
  groups.push({backend:b,group:g,pairs:j.cases.length,inputSHA:sha(fs.readFileSync(path.join(remote,file)))});
  fs.writeFileSync(out,JSON.stringify({mode:'OFFLINE_HOST_REPLAY_ONLY',groups,records,omissions,
    productionRunnerQualified:false,nativeExecuted:false,helperPins:pins},null,2)+'\n');
}
console.log(JSON.stringify({mode:'OFFLINE_HOST_REPLAY_ONLY',pairs:120,records,omissions,groups:groups.length}));
