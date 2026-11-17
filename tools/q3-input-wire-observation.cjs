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
// The Q3 native-composition integrate()/install() hooks were retired with
// the kernel custody layer; redline-native-trace.cjs uses create() only.
module.exports={create};
