'use strict';
// Passive Node boundary only. No CDP work, promise settlement or guest state.
const {performance}=require('node:perf_hooks');
function create({write,now=()=>performance.now(),capacity=64,eventCap=512,schedule=setImmediate}) {
  if(!Number.isInteger(capacity)||capacity<1||capacity>128||!Number.isInteger(eventCap)||eventCap<1||eventCap>1024)throw Error('bounded input observation required');
  const requests=new Map(),events=[];
  let firstTerminal=null,dropped=0,observerErrors=0,firstObserverError=null,sinkFailure=null,sinkLostEvents=0,scheduled=false,emitted=0;
  const safe=fn=>{try{return fn();}catch(error){observerErrors++;firstObserverError??=String(error);}};
  const key=v=>JSON.stringify([v.sessionId??null,v.requestId??v.id]);
  function event(kind,row,extra={}) {
    if(emitted++>=eventCap){dropped++;return;}
    if(events.length>=eventCap){dropped++;return;}
    events.push({kind,nodeMonotonicMs:now(),clock:'Node performance.now',...row,...extra});
    if(!scheduled){scheduled=true;schedule(()=>{scheduled=false;flush();});}
  }
  function status(){return {version:1,firstTerminal,dropped,observerErrors,firstObserverError,sinkFailure,sinkLostEvents,
    browserServiceTime:'UNKNOWN',applicationTime:'UNKNOWN',sendCallbackFailure:'UNKNOWN: WebSocket.send has no callback',
    records:[...requests.values()].map(r=>({...r}))};}
  function flush(){const batch=events.splice(0);try{write({...status(),events:batch});}
    catch(error){sinkLostEvents+=batch.length;sinkFailure??=String(error);}}
  function terminal(reason){safe(()=>{if(firstTerminal)return;firstTerminal={reason:String(reason),nodeMonotonicMs:now()};event('first-terminal',{});});}
  return {
    send(meta,invoke){
      let row;
      safe(()=>{
        if(!meta.method.startsWith('Input.'))return;
        row={requestId:meta.requestId,method:meta.method,sessionId:meta.sessionId??null};
        if(requests.size>=capacity){requests.delete(requests.keys().next().value);dropped++;}
        requests.set(key(row),row);event('socket-send-entry',row);
      });
      try {const result=invoke();if(row)safe(()=>event('socket-send-return',row));return result;}
      catch(error){if(row)safe(()=>event('socket-send-throw',row,{error:String(error)}));throw error;}
    },
    receive(value,pending){safe(()=>{
      const row=requests.get(key(value));if(!row)return;
      row.rawReplyCount=(row.rawReplyCount??0)+1;
      event('raw-matching-reply',row,{pendingPresent:!!pending,late:firstTerminal!==null,
        protocolError:value.error?JSON.stringify(value.error):null});
    });},
    transport(kind){safe(()=>event('socket-'+kind,{}, {matchingRequest:'UNKNOWN'}));},
    terminal,flush,status
  };
}
function integrate(source) {
  const {replaceOnce}=require('./q3-native-driver-composition.cjs');
  source=replaceOnce(source,"const pending=new Map(),workers=new Map(),workerPromises=[];",
    "const pending=new Map(),workers=new Map(),workerPromises=[];const inputWire=require(root+'/tools/q3-input-wire-observation.cjs').create({write:value=>log('input-wire.jsonl',value)});process.once('exit',()=>inputWire.flush());");
  source=replaceOnce(source,"terminalFailure=Error('Q3 terminal UNKNOWN; no replay: '+reason);",
    "terminalFailure=Error('Q3 terminal UNKNOWN; no replay: '+reason);inputWire.terminal(terminalFailure);");
  source=replaceOnce(source,'ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));',
    'const inputWirePayload=JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})});inputWire.send(meta,()=>ws.send(inputWirePayload));');
  source=replaceOnce(source,'const v=JSON.parse(msg.data);screenshotCompletion.receive',
    'const v=JSON.parse(msg.data);inputWire.receive(v,pending.get(v.id));screenshotCompletion.receive');
  source=replaceOnce(source,"()=>{screenshotCompletion.transport(event);", "()=>{inputWire.transport(event);screenshotCompletion.transport(event);");
  return source;
}
function install() {
  const Module=require('node:module'),path=require('node:path');
  const consumer=path.resolve(__dirname,'..',require('./q3-native-driver-composition.cjs').consumerPath);
  if(path.resolve(process.argv[1]||'')!==consumer||process.env.Q3_NATIVE_COMPOSITION!=='1')throw Error('input wire requires actual composed Q3 consumer');
  const extension=Module._extensions['.cjs'];
  Module._extensions['.cjs']=function(module,filename){
    if(filename!==consumer)return extension(module,filename);
    const compile=module._compile;
    module._compile=function(source,name){return compile.call(this,integrate(source),name);};
    try{return extension(module,filename);}finally{module._compile=compile;}
  };
}
module.exports={create,integrate,install};
if(process.env.Q3_INPUT_WIRE==='1')install();
