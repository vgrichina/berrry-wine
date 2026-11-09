'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),z=require('node:zlib'),vm=require('node:vm');
const assert=require('node:assert/strict'),{once}=require('node:events');
const composition=require('./quake2-native-driver-composition.cjs'),wire=require('./quake2-input-wire-observation.cjs');
const root=path.resolve(__dirname,'..'),consumer=path.join(root,composition.consumerPath);
const prior=root+'/scratch/runs/20261109-quake2-complete-command-native-1100';
const run=path.resolve(process.env.Q2_WIRE_TEST_RUN||'scratch/runs/20261109-quake2-startup-hold-cause-1115/controls');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const read=p=>JSON.parse(fs.readFileSync(p));
const rows=p=>z.gunzipSync(fs.readFileSync(p)).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
if(process.env.Q2_WIRE_FIXTURE==='1'&&process.env.Q2_NODE_FIXTURE==='preload'){
  // Existing inert process/server seams; restore the actual generated startup
  // preflight that the older command-loop fixture intentionally removed.
  require(prior+'/health-preload.cjs');
  const compose=composition.compose;
  composition.compose=()=>{const result=compose();return {...result,references:[...result.references,...wire.references()]};};
  require('./quake2-native-driver-composition.test.cjs');
  const Module=require('node:module'),extension=Module._extensions['.cjs'];
  Module._extensions['.cjs']=function(module,file){
    if(file!==consumer)return extension(module,file);
    let source=composition.compose().source;
    if(process.env.Q2_WIRE_ENABLED==='1')source=wire.integrate(source);
    const start=source.indexOf("await send('Page.addScriptToEvaluateOnNewDocument'");
    const end=source.indexOf("await wait(15000);await capture('startup');");
    assert(start>0&&end>start);
    // No app, DLL loader or guest may run. All preceding generated native
    // keyboard/type/combo controls and the later actual command loop remain.
    source=source.slice(0,start)+"await capture('startup');"+source.slice(end+"await wait(15000);await capture('startup');".length);
    return module._compile(source,file);
  };
  if(process.env.Q2_WIRE_MODE==='sink-fail'){
    const create=wire.create;let failed=false;
    wire.create=opts=>create({...opts,write:value=>{if(!failed){failed=true;throw Error('FIRST diagnostic sink failure');}opts.write(value);}});
  }
  const Socket=globalThis.WebSocket,dir=process.env.Q2_FIXTURE_DIR;
  const listeners={},context={};context.window=context;context.Set=Set;
  context.addEventListener=(type,fn)=>(listeners[type]??=[]).push(fn);vm.createContext(context);
  globalThis.WebSocket=class extends Socket{
    set onmessage(fn){this.handler=fn;}
    get onmessage(){return msg=>{const v=JSON.parse(msg.data);if(v.id&&this.sessions?.has(v.id)&&v.sessionId===undefined)v.sessionId=this.sessions.get(v.id);this.handler?.({data:JSON.stringify(v)});};}
    send(data,...args){
      const v=JSON.parse(data),mode=process.env.Q2_WIRE_MODE;
      fs.appendFileSync(dir+'/wire-protocol.jsonl',JSON.stringify({at:Date.now(),...v})+'\n');
      assert.equal(args.length,0);this.sessions??=new Map();if(v.sessionId)this.sessions.set(v.id,v.sessionId);
      const reply=(result={},error)=>this.onmessage?.({data:JSON.stringify({id:v.id,sessionId:v.sessionId,result,error})});
      if(v.method==='Runtime.evaluate'){
        const e=v.params.expression;
        if(/^(window\.(keyProof|typeProof|comboProof)=|keyProof$|typeProof$|\(\{events:comboProof)/.test(e)){
          const value=vm.runInContext(e,context);queueMicrotask(()=>reply({result:{value}}));return;
        }
      }
      if(v.method==='Input.dispatchKeyEvent'){
        const p=v.params;this.firstDown??=p.type==='keyDown'?v.id:undefined;
        const first=v.id===this.firstDown;
        if(first&&mode==='sync-throw')throw Error('inert synchronous socket throw');
        if(first&&['socket-error','late-raw','stalled-down'].includes(mode)){
          setTimeout(()=>this.dispatchEvent(new Event('error')),mode==='stalled-down'?150:5);
          if(mode==='late-raw')setTimeout(()=>{this.onmessage?.({data:JSON.stringify({id:v.id,sessionId:'wrong-session',result:{}})});reply();},20);
          return;
        }
        if(first&&mode==='protocol-fail'){queueMicrotask(()=>reply({}, {message:'inert DOWN protocol failure'}));return;}
        if(p.type==='keyUp'&&mode==='up-fail'){queueMicrotask(()=>reply({}, {message:'inert UP protocol failure'}));return;}
        for(const type of [p.type==='keyDown'?'keydown':'keyup',...(p.text?['keypress']:[])])for(const fn of listeners[type]??[])fn({type,key:p.key,isTrusted:true});
        if(first&&mode==='delayed-down'){setTimeout(()=>reply(),90);return;}
        queueMicrotask(()=>reply());return;
      }
      return super.send(data,...args);
    }
  };
}else if(require.main===module){main().catch(e=>{console.error(e);process.exitCode=1;});}
async function until(fn){const end=Date.now()+6000;while(!fn()){assert(Date.now()<end,'inert fixture deadline');await wait(5);}}
async function main(){
  fs.mkdirSync(run,{recursive:true});
  const source=composition.compose().source,observed=wire.integrate(source);
  new vm.Script(require('node:module').wrap(observed));
  assert(observed.indexOf('inputWire.receive(v,pending.get(v.id))')<observed.indexOf('if(v.id){const p=pending.get(v.id);if(!p)return;'));
  // Exercise the actual production opt-in preload and provider refusal before
  // its inert DRIVER_PREFLIGHT exit; no service seams or launches are needed.
  for(const mode of ['valid','missing','changed']){
    const dir=run+'/preflight-'+mode;fs.mkdirSync(dir,{recursive:true});
    const refs=[...composition.compose().references,...wire.references()];
    if(mode==='missing')refs.pop();if(mode==='changed')refs.at(-1).sha256='0'.repeat(64);
    fs.writeFileSync(dir+'/runtime-pins.json',JSON.stringify({files:refs,httpPins:[]}));
    const result=cp.spawnSync(process.execPath,['--require',path.join(__dirname,'quake2-native-driver-composition.cjs'),
      '--require',path.join(__dirname,'quake2-input-wire-observation.cjs'),consumer],{cwd:root,encoding:'utf8',timeout:5000,
      env:{...process.env,QUAKE2_NATIVE_RUN:dir,QUAKE2_NATIVE_COMPOSITION:'1',Q2_INPUT_WIRE:'1',DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+150000)}});
    assert.equal(result.status,mode==='valid'?0:1);assert.equal(result.signal,null);
    if(mode!=='valid')assert.match(result.stderr,/staged Q2 wire provider required/);
    fs.writeFileSync(dir+'/result.json',JSON.stringify({status:result.status,stdout:result.stdout,stderr:result.stderr}));
  }
  for(const mode of ['normal','sync-throw','protocol-fail','socket-error','delayed-down','stalled-down','late-raw','up-fail']){
    const old=await scenario(mode,false),fresh=await scenario(mode,true);
    assert.deepEqual(fresh.input,old.input,'observation preserves actual startup input sequence');
    assert.equal(fresh.code,old.code);
  }
  await scenario('sink-fail',true);
  console.log('PASS 3 actual opt-in provider preflights; 8 actual generated startup old-missing/new-observed pairs plus sink failure; unchanged bounds, independent release, first terminal, pending/raw late/session controls; OFFLINE inert services only');
}
async function scenario(mode,enabled){
  const dir=path.join(run,(enabled?'new-':'old-')+mode);fs.mkdirSync(dir,{recursive:true});
  const staged=dir+'/staged';fs.mkdirSync(staged,{recursive:true});
  let child;
  fs.writeFileSync(dir+'/watchdog-armed.json',JSON.stringify({armedAt:Date.now(),deadlineMs:12000,scope:'separate inert driver process; no runtime allocation'}));
  const guard=setTimeout(()=>{child?.kill('SIGKILL');try{process.kill(Number(fs.readFileSync(dir+'/browser-pid')),'SIGKILL');}catch{}},12000);
  child=cp.spawn(process.execPath,['--require',__filename,consumer],{cwd:root,env:{...process.env,
    Q2_WIRE_FIXTURE:'1',Q2_NODE_FIXTURE:'preload',Q2_FIXTURE_DIR:dir,Q2_CLOSE_MODE:'normal',Q2_WIRE_MODE:mode,
    QUAKE2_NATIVE_RUN:staged,QUAKE2_NATIVE_COMPOSITION:'',Q2_INPUT_WIRE:'',Q2_WIRE_ENABLED:enabled?'1':'',BROWSER_DEADLINE:String(Date.now()+150000)},stdio:['ignore','pipe','pipe']});
  const logs=require('./native-command-log.cjs').createLogs(dir);logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
  const done=once(child,'close');
  const success=['normal','sink-fail'].includes(mode),out=staged+'/original';
  try{
    await until(()=>fs.existsSync(out+'/ready.json')||child.exitCode!==null);
    if(success){assert.equal(child.exitCode,null);assert(read(out+'/native-key-preflight.json').passed);assert(read(out+'/native-type-preflight.json').passed);assert(read(out+'/native-combo-preflight.json').passed);
      assert((await require('./quake2-native-transport.cjs').request(out,'quit',{action:'quit'},1)).ok);
    }
    const [code,signal]=await done;await logs.drainStreams();logs.close();assert.equal(signal,null);assert.equal(code,success?0:1);
    const protocol=fs.readFileSync(dir+'/wire-protocol.jsonl','utf8').trim().split('\n').map(JSON.parse);
    const input=protocol.filter(v=>v.method==='Input.dispatchKeyEvent').map(v=>v.params);
    if(!success){assert(!fs.existsSync(out+'/ready.json'));assert(input.some(v=>v.type==='keyUp'),'independent release attempted');assert(!fs.existsSync(out+'/native-key-preflight.json'));}
    const browser=read(dir+'/browser-wait.json');assert.equal(browser.code,0);assert(browser.stdoutEOF&&browser.stderrEOF);
    if(enabled){
      const snapshots=rows(out+'/input-wire.jsonl.gz'),events=snapshots.flatMap(v=>v.events),holds=snapshots.at(-1).holds;
      assert(events.some(v=>v.kind==='socket-send-entry'&&v.sessionId==='fixture-session'));
      assert(events.some(v=>v.kind==='socket-send-entry'&&v.inputType==='keyDown'&&v.key==='ArrowUp'));
      assert(events.some(v=>v.kind==='socket-send-entry'&&v.inputType==='keyUp'&&v.key==='ArrowUp'));
      assert(events.some(v=>v.kind===(mode==='sync-throw'?'socket-send-throw':'socket-send-return')));
      assert(holds[0].receipt);assert.equal(holds[0].boundOrigin,holds[0].receipt.started);assert.equal(holds[0].holdMs,50);
      assert(holds[0].receipt.releaseAt-holds[0].receipt.started<200,'no widened release interval');
      assert(snapshots.every(v=>v.applicationTime==='UNKNOWN'&&v.browserServiceTime==='UNKNOWN'));
      if(!success)assert.equal(events.filter(v=>v.kind==='first-terminal').length,1);
      if(mode==='stalled-down')assert(snapshots.some(v=>v.pendingAtTerminal?.some(p=>p.method==='Input.dispatchKeyEvent')));
      if(mode==='delayed-down')assert.match(holds[0].error,/input delivery exceeded physical hold/);
      if(mode==='late-raw'){
        assert(events.some(v=>v.kind==='raw-matching-reply'&&v.late&&!v.pendingPresent));
        assert.equal(events.filter(v=>v.kind==='raw-matching-reply'&&v.requestId===events.find(v=>v.kind==='socket-send-entry').requestId).length,1,'wrong session never correlated');
      }
      if(mode==='normal')assert(events.some(v=>v.kind==='raw-matching-reply'&&v.pendingPresent&&!v.late));
      if(mode==='sink-fail')assert(snapshots.every(v=>/FIRST diagnostic sink failure/.test(v.sinkFailure)));
    }else assert(!fs.existsSync(out+'/input-wire.jsonl.gz'));
    const result={mode,enabled,code,input,browser,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded};
    fs.writeFileSync(dir+'/result.json',JSON.stringify(result));return result;
  }finally{clearTimeout(guard);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await done;}
}
