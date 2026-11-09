'use strict';
// Opt-in passive observation of the actual composed Q2 socket and startup.
// Reuse the bounded Q3 recorder; never settle a request or await diagnostics.
const {performance}=require('node:perf_hooks');
function create({write,now=()=>performance.now(),...options}) {
  const holds=[],inputs=new Map();let stage='transport setup',pendingAtTerminal=null;
  const key=v=>JSON.stringify([v.sessionId??null,v.requestId]);
  const wire=require('./q3-input-wire-observation.cjs').create({...options,now,
    write:value=>write({...value,stage,pendingAtTerminal,holds:holds.map(row=>({...row})),
      events:value.events.map(row=>({...row,...inputs.get(key(row))})),
      clockAnchor:{nodeMonotonicMs:anchor,unixMs:wall},
      sourceMeaning:'Node socket boundary; CDP replies do not prove application consumption'})});
  const anchor=now(),wall=Date.now();
  const defer=()=>setImmediate(()=>wire.flush());
  return {...wire,
    send(meta,invoke){
      // Identity and direction only; no payload strings or guest state.
      if(meta.method.startsWith('Input.')){
        if(inputs.size===64)inputs.delete(inputs.keys().next().value);
        inputs.set(key(meta),{inputType:meta.type??null,key:meta.key??null});
      }
      return wire.send(meta,invoke);
    },
    stage(value){stage=value;defer();},
    terminal(reason,pending){
      if(!pendingAtTerminal)pendingAtTerminal=[...pending].map(([requestId,p])=>({requestId,method:p.method,sessionId:p.sessionId??null}));
      wire.terminal(reason);
    },
    async hold(invoke,keys,holdMs){
      const row={keys,holdMs,stage,entryMonotonicMs:now(),boundOrigin:'UNKNOWN until actual helper receipt'};
      if(holds.length===16)holds.shift();holds.push(row);defer();
      try {const value=await invoke();row.receipt=value;return value;}
      catch(error){row.error=String(error);row.receipt=error.holdReceipt??null;throw error;}
      finally {row.finishedMonotonicMs=now();if(row.receipt)row.boundOrigin=row.receipt.started;defer();}
    }
  };
}
function references(){
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  return ['tools/quake2-input-wire-observation.cjs','tools/q3-input-wire-observation.cjs'].map(file=>{
    const bytes=fs.readFileSync(path.resolve(__dirname,'..',file));
    return {path:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
  });
}
function integrate(source){
  const {replaceOnce}=require('./quake2-native-driver-composition.cjs');
  source=replaceOnce(source,'for(const p of pins.files){',
    `for(const ref of ${JSON.stringify(references())})assert(pins.files.some(p=>p.path===ref.path&&p.sha256===ref.sha256&&p.size===ref.size),'staged Q2 wire provider required: '+ref.path);for(const p of pins.files){`);
  source=replaceOnce(source,'const pending=new Map(),workers=new Map(),workerPromises=[];',
    "const pending=new Map(),workers=new Map(),workerPromises=[];const inputWireSources=pins.files.filter(p=>['tools/quake2-input-wire-observation.cjs','tools/q3-input-wire-observation.cjs','tools/quake2-native-input.cjs','tools/quake2-native-driver-composition.cjs','scratch/runs/20261109-quake2-observed-guard-route-0105/browser-run.cjs'].includes(p.path));const inputWire=require(root+'/tools/quake2-input-wire-observation.cjs').create({write:value=>log('input-wire.jsonl',{...value,sourceIdentities:inputWireSources})});process.once('exit',()=>inputWire.flush());");
  source=replaceOnce(source,"terminalFailure=Error('Q2 terminal UNKNOWN; no replay: '+reason);",
    "terminalFailure=Error('Q2 terminal UNKNOWN; no replay: '+reason);inputWire.terminal(terminalFailure,pending);");
  source=replaceOnce(source,'pending.set(n,{resolve,reject,timer});','pending.set(n,{resolve,reject,timer,method,sessionId});');
  source=replaceOnce(source,'ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));',
    'const inputWirePayload=JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})});inputWire.send({requestId:n,method,sessionId,type:params.type,key:params.key},()=>ws.send(inputWirePayload));');
  source=replaceOnce(source,'const v=JSON.parse(msg.data);if(v.id)',
    'const v=JSON.parse(msg.data);inputWire.receive(v,pending.get(v.id));if(v.id)');
  source=replaceOnce(source,"()=>{if(!closing)observeTerminal('CDP '+event);}",
    "()=>{inputWire.transport(event);if(!closing)observeTerminal('CDP '+event);}");
  source=replaceOnce(source,' // Generated native CDP keyboard preflight',
    " inputWire.stage('about:blank keyboard preflight; before app selection');\n // Generated native CDP keyboard preflight");
  source=replaceOnce(source,"await require('./ordinary-keys.cjs').hold(send,pageSession,key,50);",
    "await inputWire.hold(()=>require('./ordinary-keys.cjs').hold(send,pageSession,key,50),[key],50);");
  source=replaceOnce(source,"await require('./ordinary-keys.cjs').hold(send,pageSession,'Enter',100);",
    "await inputWire.hold(()=>require('./ordinary-keys.cjs').hold(send,pageSession,'Enter',100),['Enter'],100);");
  source=replaceOnce(source,"await require('./ordinary-keys.cjs').combo(send,pageSession,['ArrowUp',steer],50);",
    "await inputWire.hold(()=>require('./ordinary-keys.cjs').combo(send,pageSession,['ArrowUp',steer],50),['ArrowUp',steer],50);");
  source=replaceOnce(source,"await send('Page.addScriptToEvaluateOnNewDocument'",
    "inputWire.stage('app selection and owning load');await send('Page.addScriptToEvaluateOnNewDocument'");
  source=replaceOnce(source,"save('ready.json',{at:new Date().toISOString()});",
    "inputWire.stage('READY; numbered command loop');save('ready.json',{at:new Date().toISOString()});");
  return source;
}
function install(){
  const Module=require('node:module'),path=require('node:path');
  const consumer=path.resolve(__dirname,'..',require('./quake2-native-driver-composition.cjs').consumerPath);
  if(path.resolve(process.argv[1]||'')!==consumer||process.env.QUAKE2_NATIVE_COMPOSITION!=='1')throw Error('Q2 wire requires actual composed consumer');
  const extension=Module._extensions['.cjs'];
  Module._extensions['.cjs']=function(module,file){
    if(file!==consumer)return extension(module,file);
    const compile=module._compile;module._compile=function(source,name){return compile.call(this,integrate(source),name);};
    try{return extension(module,file);}finally{module._compile=compile;}
  };
}
module.exports={create,integrate,install,references};
if(process.env.Q2_INPUT_WIRE==='1')install();
