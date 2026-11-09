'use strict';
// Per-command causal observations. The deployed mouse helper still owns every
// input, independent release timer, assertion and hold bound.
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const bindingName='__redlineMouseService';
const version='redline-mouse-service-observation-v1';
const install=`(()=>{for(const capture of [true,false])for(const type of ['mousemove','mousedown','mouseup'])addEventListener(type,e=>{const m=globalThis.__redlineMouseMarker;if(!m||m.left--<=0)return;globalThis.${bindingName}(JSON.stringify({id:m.id,type,phase:capture?'capture':'bubble',at:performance.timeOrigin+performance.now(),trusted:e.isTrusted,x:e.clientX,y:e.clientY,buttons:e.buttons}));},capture);})()`;
function create({write,onWriteError=()=>{},now=()=>performance.now(),origin=performance.timeOrigin}){
 let active=null;
 const stamp=()=>origin+now();
 function record(kind,detail={}){if(!active||active.sealed)return;if(active.rows.length<128)active.rows.push({kind,at:stamp(),...detail});else active.dropped++;}
 function flush(reason){if(!active||active.sealed)return;record('seal',{reason});active.sealed=true;
  try{write(active.id,JSON.parse(JSON.stringify(active)));}catch(e){active.writeError=String(e).slice(0,1024);try{onWriteError(active.writeError);}catch{}}
 }
 return {
  begin(command,session){assert(!active||active.sealed,'one mouse command');active={id:command.id,session,holdMs:command.holdMs??(command.action==='drag'?700:150),rows:[],dropped:0,sealed:false,
   clock:'Node performance.timeOrigin + performance.now milliseconds',
   scope:'Browser DOM handling markers are not guest consumption or browser request-arrival timestamps; missing markers leave browser service UNKNOWN'};record('begin');},
  async calibrate(evaluate,command){
   const before=stamp();const browserAt=await evaluate(`(()=>{globalThis.__redlineMouseMarker={id:${JSON.stringify(command.id)},left:64};return performance.timeOrigin+performance.now()})()`);const after=stamp();
   assert(Number.isFinite(browserAt),'browser clock sample required');
   record('clock-bracket',{before,after,browserAt,browserMinusNodeMin:browserAt-after,browserMinusNodeMax:browserAt-before});
  },
  send(meta,params,invoke){
   if(!active||active.sealed||meta.method!=='Input.dispatchMouseEvent'||meta.sessionId!==active.session)return invoke();
   record('socket-send-entry',{requestId:meta.requestId,type:params.type,x:params.x,y:params.y,buttons:params.buttons});
   try{const value=invoke();record('socket-send-return',{requestId:meta.requestId});return value;}
   catch(e){record('socket-send-throw',{requestId:meta.requestId,error:String(e)});throw e;}
  },
  receive(v,at){
   if(!active||active.sealed)return;
   const request=active.rows.find(r=>r.kind==='socket-send-entry'&&r.requestId===v.id);if(!request)return;
   record('raw-reply',{requestId:v.id,receivedAt:at,sessionMatches:v.sessionId===active.session,error:v.error?JSON.stringify(v.error).slice(0,1024):null});
  },
  event(v){
   if(!active||active.sealed||v.method!=='Runtime.bindingCalled'||v.sessionId!==active.session||v.params?.name!==bindingName)return;
   try{const p=JSON.parse(v.params.payload);if(p.id!==active.id)return;
    if(['mousemove','mousedown','mouseup'].includes(p.type)&&['capture','bubble'].includes(p.phase)&&Number.isFinite(p.at))record('browser-handler',{type:p.type,phase:p.phase,browserAt:p.at,trusted:p.trusted===true,x:p.x,y:p.y,buttons:p.buttons});
   }catch{record('invalid-browser-marker');}
  },
  async perform({helper,evaluate,...options}){
   this.begin(options.command,options.session);
   try{await this.calibrate(evaluate,options.command);const proof=await helper.perform({...options,send:async(...args)=>{const type=args[1]?.type;record('helper-send',{type});try{const r=await options.send(...args);record('helper-settled',{type});return r;}catch(e){record('helper-rejected',{type,error:String(e)});throw e;}}});record('helper-returned');flush('helper success');return proof;}
   catch(e){record('helper-failed',{error:String(e),mouseReceipt:e.mouseReceipt??null});flush('helper failure');throw e;}
  },
  terminal(reason){record('terminal',{reason:String(reason).slice(0,1024)});flush('terminal');},
  status(){return active;},
 };
}
function integrate(source){
 const replace=(a,b)=>{assert.equal(source.split(a).length,2,'one mouse service seam: '+a);source=source.replace(a,b);};
 replace('const pending=new Map(),workers=new Map(),workerPromises=[];',"const pending=new Map(),workers=new Map(),workerPromises=[];const mouseService=require(root+'/tools/redline-mouse-service.cjs').create({write:(id,value)=>require(root+'/tools/redline-startup-boundary.cjs').writeDiagnostic(out+'/input-'+id+'-mouse-service.json',value),onWriteError:error=>log('mouse-service-errors.jsonl',{error})});");
 replace('inputWire.send({requestId:n,method,sessionId},frame,()=>ws.send(frame));','inputWire.send({requestId:n,method,sessionId},frame,()=>mouseService.send({requestId:n,method,sessionId},params,()=>ws.send(frame)));');
 replace('inputWire.receive(msg.data,v,pending.get(v.id),receivedAt);','mouseService.receive(v,performance.timeOrigin+receivedAt);mouseService.event(v);inputWire.receive(msg.data,v,pending.get(v.id),receivedAt);');
 replace('firstFailure??=error;closing=true;', 'firstFailure??=error;closing=true;mouseService.terminal(firstFailure);');
 replace("await evaluate(`window.__nativeMouseEvents=[];", "await send('Runtime.addBinding',{name:'"+bindingName+"'},pageSession);await evaluate("+JSON.stringify(install)+");await evaluate(`window.__nativeMouseEvents=[];");
 replace("await require(run+'/native-mouse.cjs').perform({send,", "await mouseService.perform({helper:require(run+'/native-mouse.cjs'),evaluate,send,");
 return source;
}
module.exports={version,create,integrate,bindingName,install};
