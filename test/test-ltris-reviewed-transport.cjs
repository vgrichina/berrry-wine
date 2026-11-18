'use strict';
const assert=require('node:assert/strict');
const {reviewedConnection}=require('../tools/ltris-reviewed-transport.cjs');
let socket,clock=16000,review;
const frames={old:{label:'old',sha256:'oldhash',at:1000,metadata:{readbackCompletedAt:1000}},
  fresh:{label:'fresh',sha256:'freshhash',at:15900,metadata:{readbackCompletedAt:15800}}};
const command=frame=>({review:frame.label,sha256:frame.sha256,observation:'personally reviewed whole frame'});
class Socket {
  constructor(){socket=this;this.sent=[];queueMicrotask(()=>this.onopen());}
  send(body){this.sent.push(JSON.parse(body));if(this.throwSend)throw Error('wire failed');
    if(!this.drop)queueMicrotask(()=>this.onmessage({data:JSON.stringify({...JSON.parse(body),result:{}})}));}
  close(){}
}
async function fixture(){let closed=false;const records=[];
  const scope={async issue(fn){if(closed)throw Error('scope closed');return fn();},async close(){closed=true;}};
  const c=reviewedConnection('fake',scope,{review:()=>review,record:v=>records.push(v),now:()=>clock,WebSocketClass:Socket,timeoutMs:25});
  await c.ready;return {c,records};
}
(async()=>{
  const {c,records}=await fixture();review={command:command(frames.old),frame:frames.old};
  await assert.rejects(c.send('Input.dispatchKeyEvent',{type:'keyDown'}),/NOT_SENT.*stale/);
  assert.equal(socket.sent.length,0);assert.equal(c.closed,false);
  // A matching fallback UP may join; old intent cannot be reused after capture.
  await c.send('Input.dispatchKeyEvent',{type:'keyUp'});
  review={command:command(frames.old),frame:frames.fresh};
  await assert.rejects(c.send('Input.dispatchKeyEvent',{type:'keyDown'}),/NOT_SENT/);
  review={command:command(frames.fresh),frame:frames.fresh};
  await c.send('Input.dispatchKeyEvent',{type:'keyDown'});
  await c.send('Input.dispatchKeyEvent',{type:'keyUp'});
  assert.equal(socket.sent.filter(v=>v.params.type==='keyDown').length,1);
  assert.equal(records.filter(v=>v.state==='NOT_SENT').length,2);c.stop();
  for(const kind of ['throw','timeout','replacement']){
    const {c}=await fixture();review={command:command(frames.fresh),frame:frames.fresh};
    if(kind==='throw')socket.throwSend=true;
    if(kind==='timeout')socket.drop=true;
    if(kind==='replacement')c.seal('owner/document replaced');
    await assert.rejects(c.send('Input.dispatchKeyEvent',{type:'keyDown'}),/UNKNOWN|scope closed/);
    const count=socket.sent.length;await assert.rejects(c.send('Runtime.evaluate'));
    assert.equal(socket.sent.length,count);assert.equal(c.closed,true);c.stop();
  }
  console.log('PASS wire-boundary stale NOT_SENT, joined UP/new intent, timely DOWN; send/timeout/replacement UNKNOWN prohibits replay');
})().catch(e=>{console.error(e);process.exitCode=1;});
