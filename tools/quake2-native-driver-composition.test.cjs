'use strict';
// Actual composed command loop, close and input, with Node-only process/CDP
// fixtures. No Chrome, static server, guest, box or network can be started.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),Module=require('node:module');
const assert=require('node:assert/strict'),{once}=require('node:events'),crypto=require('node:crypto');
const composition=require('./quake2-native-driver-composition.cjs');
const input=require('./quake2-native-input.cjs');
const root=path.resolve(__dirname,'..'),retained=path.join(root,composition.consumerPath);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

if(process.env.Q2_NODE_FIXTURE==='preload'){
  const dir=process.env.Q2_FIXTURE_DIR,read=fs.readFileSync,spawn=cp.spawn,load=Module._load;
  const motionModes=['motion-torn','motion-wrong-module','motion-unpublished'];
  const movement=['moveup','space-down-fail','space-up-fail',...motionModes].includes(process.env.Q2_CLOSE_MODE);
  let observed,renderer;
  if(movement){
    observed=require('./quake2-passive-attack.test.cjs').fixture(true);
    class Probe{constructor(){this.inputQueue=[];this.windows={};this.wasm=null;this.mainWasm=null;this._exited=false;}}
    require('../lib/renderer-input').installInputHandlers(Probe);renderer=new Probe();
    observed.s.ids.set(renderer,observed.identity.pageRendererObject);observed.wine.renderer=renderer;
    // Only authored fixture state: the real serialized reader resolves this
    // owner's sparse PTE, never fabricated observation return values.
    const pages=new Uint32Array(observed.memory.buffer,0x1bc00000,0x100000),back=0x08600000;
    Atomics.store(pages,0x9000,back|0x804);
    for(const [i,key,text] of [[0,32,'+moveup'],[1,97,'+moveleft']]){
      observed.put(0x4d6c60+key*4,0x09000000+i*128);
      new Uint8Array(observed.memory.buffer,back+i*128,text.length+1).set(Buffer.from(text+'\0'));
    }
    if(process.env.Q2_CLOSE_MODE==='motion-wrong-module')observed.link.module={};
    if(process.env.Q2_CLOSE_MODE==='motion-unpublished')observed.view.setInt16(0xa9cecc-0x400000+0x12000,8,true);
    if(process.env.Q2_CLOSE_MODE==='motion-torn'){
      const peek=renderer.peekKeyDownState.bind(renderer);let once=false;
      renderer.peekKeyDownState=key=>{if(!once){once=true;require('./quake2-passive-attack.test.cjs').setMotion(observed,{frameNumber:18});}return peek(key);};
    }
  }
  let browser;
  fs.readFileSync=function(file,...args){
    if(file===process.env.QUAKE2_NATIVE_RUN+'/runtime-pins.json')return JSON.stringify({files:composition.compose().references,httpPins:[],commit:'OFFLINE_NODE_ONLY'});
    return read.call(this,file,...args);
  };
  cp.spawn=function(command,args){
    assert.equal(command,'/usr/bin/google-chrome','only real consumer spawn site may be intercepted');
    const profile=args.find(a=>a.startsWith('--user-data-dir=')).slice(16);
    browser=spawn(process.execPath,[__filename,'node-browser',profile],{env:{...process.env,Q2_NODE_FIXTURE:'browser'},stdio:['pipe','pipe','pipe']});
    browser.once('close',(code,signal)=>fs.writeFileSync(dir+'/browser-wait.json',JSON.stringify({code,signal,childClose:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded})));
    fs.writeFileSync(dir+'/browser-pid',String(browser.pid));return browser;
  };
  const png=Buffer.from('offline Node protocol capture, no guest pixels');
  Module._load=function(name,parent,main){
    if(name===root+'/test/static-server.js')return {startStaticServer:async()=>({prependListener(){},address:()=>({port:1}),closeAllConnections(){},close:fn=>fn?.()})};
    if(parent?.filename===retained&&name==='./bound-input.cjs')return {hold:input.hold,createChain:()=>({
      capture:async label=>({png,before:{},after:{},capture:{label,sha256:sha(png),at:new Date().toISOString(),identity:observed?.identity??{fixture:true}}}),
      admit:async(review,dispatch)=>{assert(review.review.trim());return dispatch({live:{identity:observed?.identity??{fixture:true}}});},
      progress:async()=>({physical:'fixture'})
    })};
    return load.call(this,name,parent,main);
  };
  class ProtocolSocket extends EventTarget{
    constructor(){super();this.readyState=1;setImmediate(()=>this.onopen?.());}
    send(text){
      const v=JSON.parse(text);fs.appendFileSync(dir+'/protocol.jsonl',JSON.stringify({at:Date.now(),...v})+'\n');
      if(v.method==='Browser.close'){
        fs.writeFileSync(dir+'/close-at',String(Date.now()));
        if(['normal','drain','combo','partial-input','missing-review','moveup','space-down-fail','space-up-fail',...motionModes].includes(process.env.Q2_CLOSE_MODE))browser.stdin.end('close\n');
        else if(process.env.Q2_CLOSE_MODE==='ack-stall')queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({id:v.id,result:{}})}));
        return; // Actual pending protocol close, never a fabricated ACK.
      }
      if(v.method==='Runtime.evaluate'&&fs.existsSync(dir+'/arm-pending')){
        fs.writeFileSync(dir+'/pending-at',String(Date.now()));setTimeout(()=>browser.kill('SIGKILL'),25);return;
      }
      if(v.method==='Input.dispatchKeyEvent'&&v.params.type==='keyDown'&&v.params.key==='Control'&&process.env.Q2_CLOSE_MODE==='partial-input'){
        queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({id:v.id,error:{message:'injected after native DOWN'}})}));return;
      }
      if(movement&&v.method==='Input.dispatchKeyEvent'){
        const p=v.params;renderer[p.type==='keyDown'?'handleKeyDown':'handleKeyUp'](p.windowsVirtualKeyCode,{code:p.code});
        // Authored fixture publication only. The real reader must carry fresh
        // native bytes through held samples and capture output, not synthesize
        // coordinates from an input key or promote this to game consumption.
        if(p.type==='keyDown')require('./quake2-passive-attack.test.cjs').setMotion(observed,
          {frameNumber:p.code==='Space'?18:19,rawOrigin:[80,-160,240],rawVelocity:[8,-16,24],pmFlags:4});
        fs.appendFileSync(dir+'/renderer.jsonl',JSON.stringify({event:renderer.takeInput(),state:renderer.peekKeyDownState(p.windowsVirtualKeyCode)})+'\n');
        if(p.code==='Space'&&((p.type==='keyDown'&&process.env.Q2_CLOSE_MODE==='space-down-fail')||(p.type==='keyUp'&&process.env.Q2_CLOSE_MODE==='space-up-fail'))){
          queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({id:v.id,error:{message:'injected Space ACK failure after queue'}})}));return;
        }
      }
      let result={};
      if(v.method==='Target.getTargets')result={targetInfos:[{type:'page',targetId:'fixture-page'}]};
      if(v.method==='Target.attachToTarget')result={sessionId:'fixture-session'};
      if(v.method==='Runtime.evaluate')result={result:{value:{apps:[]}}};
      if(observed&&v.method==='Runtime.evaluate'&&v.params.expression.startsWith('(function readPage('))result={result:{value:require('node:vm').runInContext(v.params.expression,observed.context)}};
      queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({id:v.id,result})}));
    }
    close(){this.readyState=3;}
  }
  globalThis.WebSocket=ProtocolSocket;
  const result=composition.compose();
  const start=result.source.indexOf(' // Generated native CDP keyboard preflight');
  const end=result.source.indexOf("await wait(15000);await capture('startup');");
  assert(start>0&&end>start);
  // Fixture replaces only original-game startup with a capture. Real execute,
  // capture, close, transport, review checks and command-loop source remain.
  let source=result.source.slice(0,start)+" await capture('startup');"+result.source.slice(end+"await wait(15000);await capture('startup');".length);
  if(process.env.Q2_CLOSE_MODE==='independent')source=composition.replaceOnce(source,"save('ready.json',{at:new Date().toISOString()});","save('ready.json',{at:new Date().toISOString()});setTimeout(()=>close('offline independent cleanup').catch(e=>{process.exitCode=1;console.error(e);}),50);");
  composition.install(); // Include the real ordinary-key/bound-input hooks.
  const ext=Module._extensions['.cjs']||Module._extensions['.js'];
  Module._extensions['.cjs']=(module,file)=>file===retained?module._compile(source,file):ext(module,file);
}else if(process.env.Q2_NODE_FIXTURE==='browser'){
  const profile=process.argv[3];fs.mkdirSync(profile,{recursive:true});
  fs.writeFileSync(profile+'/DevToolsActivePort','43123\n/devtools/browser/node-fixture\n');
  process.stdout.write('Node fixture publication\n');
  const failsafe=setTimeout(()=>process.exit(9),35000);
  process.stdin.once('data',()=>{
    clearTimeout(failsafe);
    if(process.env.Q2_CLOSE_MODE==='drain'){
      const writer=cp.spawn(process.execPath,['-e','setTimeout(()=>{},21500)'],{stdio:['ignore',process.stdout,process.stderr]});
      fs.writeFileSync(process.env.Q2_FIXTURE_DIR+'/writer-pid',String(writer.pid));
    }
    process.exit(0);
  });
  if(['kill','ack-stall','independent'].includes(process.env.Q2_CLOSE_MODE))process.on('SIGTERM',()=>{});
  else process.on('SIGTERM',()=>{clearTimeout(failsafe);process.exit(0);});
}else if(require.main===module){
  main().catch(e=>{console.error(e);process.exitCode=1;});
}

async function until(fn,ms=4000){const end=Date.now()+ms;while(!fn()){assert(Date.now()<end,'fixture deadline');await pause(5);}}
async function inputCases(){
  for(const keys of [['Control','ArrowUp'],['ArrowUp','Control','a'],['ArrowUp','Space'],['ArrowDown','Control'],['ArrowUp','c'],['ArrowUp','ArrowUp']])assert.throws(()=>input.validateCombo(keys,50));
  for(const ms of [0,49,2001,NaN,50.5])assert.throws(()=>input.validateCombo(['ArrowUp','Control'],ms));
  for(const mode of ['normal','down-first','down-second','sample','up-first','slow-sample','late-down']){
    const rows=[];let downs=0,ups=0;
    const send=async(method,p)=>{
      rows.push({at:Date.now(),...p});
      if(p.type==='keyDown'){
        ++downs;if(mode==='late-down')await pause(100);
        if(mode==='down-first'||mode==='down-second'&&downs===2)throw Error('injected DOWN UNKNOWN');
      }else if(++ups===1&&mode==='up-first')throw Error('injected UP UNKNOWN');
    };
    let receipt,error;
    try{receipt=await input.hold({send,session:'native-session',keys:['ArrowUp','Control'],holdMs:50,
      sample:async()=>{if(mode==='sample')throw Error('sample failed');if(mode==='slow-sample')await pause(120);return {};}});}
    catch(e){error=e;receipt=e.holdReceipt;}
    assert.equal(!!error,!['normal','slow-sample'].includes(mode));
    assert.equal(rows.filter(v=>v.type==='keyUp').length,downs,'every attempted DOWN gets physical UP even on failure');
    if(mode==='late-down')assert.equal(downs,1,'timer cannot be followed by second DOWN');
    if(mode==='slow-sample')assert(rows.find(v=>v.type==='keyUp').at-rows[0].at<100,'sample cannot extend hold');
    if(mode==='up-first')assert.equal(receipt.physicalRelease,'UNKNOWN');
    assert.equal(receipt.meaning,'physical host interval; passive counters do not prove DirectInput polls or simulation steps');
  }
}
async function budgetCases(run){
  const t=require('./quake2-native-transport.cjs'),out=path.join(run,'budget-controls');
  fs.mkdirSync(out+'/commands',{recursive:true});const now=Date.now();
  fs.writeFileSync(out+'/execution-window.json',JSON.stringify({browserStop:new Date(now+180000).toISOString()}));
  const timing=t.budget(out,{action:'quit'},50000,now);
  assert.equal(timing.workEnd-now,20000);assert.equal(timing.ackEnd-now,22000);
  assert.equal(timing.cleanupReserveMs,30000);
  assert.throws(()=>t.budget(out,{action:'quit'},50000,now+130000),'immutable cleanup reserve cannot be spent on quit');
  fs.writeFileSync(out+'/commands/0.json',JSON.stringify({id:'forged_cap',action:'quit',timing:{...timing,workMs:30000,workEnd:timing.workEnd+10000}}));
  let dispatches=0;await assert.rejects(t.consume(out,0,async()=>{dispatches++;}),/exact command work cap/);
  assert.equal(dispatches,0);assert(!fs.existsSync(out+'/reply-0.json'));
  const first=fs.readFileSync(out+'/first-failure.json','utf8');
  await assert.rejects(t.request(out,'later_capture',{action:'capture',waitMs:0,label:'later'},50000));
  assert.equal(fs.readFileSync(out+'/first-failure.json','utf8'),first);
}

async function movementCaller(dir,runtime,mode){
  // Actual composed Python launch/request branches and owned Session. Only
  // remote transport is local Node and the launch transport is a live sleeper;
  // all command publication/ACK and the driver's command loop stay real.
  const source=`import ast,hashlib,importlib.util,json,sys,threading,time
from pathlib import Path
root,directory,runtime,mode=map(str,sys.argv[1:])
root=Path(root);directory=Path(directory);runtime=Path(runtime)
spec=importlib.util.spec_from_file_location('client',root/'tools/quake2-native-launch-client.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
original=root/'scratch/runs/20261109-quake2-observed-guard-route-0105/control.py'
task=m.compose_task(original,hashlib.sha256(original.read_bytes()).hexdigest())
task['ROOT']=root;task['REMOTE']=str(root);task['RUN']=str(runtime.relative_to(root));task['R']=directory
(directory/'review').mkdir()
def transport(code,timeout):
 if '--remote-parent' in code:return [sys.executable,'-c','import time;time.sleep(30)']
 tree=ast.parse(code);call=tree.body[1].value
 assert ast.unparse(call.func)=='subprocess.run'
 argv=ast.literal_eval(call.args[0]);assert argv[:2]==['node','-e']
 assert 'tools/quake2-native-transport.cjs' in argv[2]
 return argv
caller=m.Caller(task,directory/'caller',transport)
errors=[]
def launch():
 try:caller.launch()
 except BaseException as e:errors.append(str(e))
thread=threading.Thread(target=launch);thread.start();assert caller.session.started.wait(3)
try:
 previous='startup'
 for key,label in [('Space','space-result'),('a','lateral-result')]:
  capture=(runtime/'original'/(previous+'-capture.json')).read_bytes()
  (directory/'review'/(previous+'-capture.json')).write_bytes(capture)
  try:caller.request(dict(command=dict(id=label,action='key',key=key,holdMs=50,waitMs=0,label=label,reviewRef=previous),review='personally inspected authored offline protocol fixture'))
  except m.TerminalFailure:
   assert mode!='moveup';break
  assert mode=='moveup';previous=label
 if mode=='moveup':caller.request(dict(command=dict(id='movement-quit',action='quit')))
finally:
 receipts=caller.session.close();thread.join(3);assert not thread.is_alive()
 assert all(v['actualWait'] and v['stdioEOF'] for v in receipts)
 (directory/'caller-waits.json').write_text(json.dumps(dict(receipts=receipts,launchErrors=errors,authoredOnly=True)))
`;
  const child=cp.spawn('python3',['-c',source,root,dir,runtime,mode],{stdio:['ignore','pipe','pipe']});
  const output=[[],[]];child.stdout.on('data',b=>output[0].push(b));child.stderr.on('data',b=>output[1].push(b));
  const [code,signal]=await once(child,'close');
  fs.writeFileSync(dir+'/caller.stdout',Buffer.concat(output[0]));fs.writeFileSync(dir+'/caller.stderr',Buffer.concat(output[1]));
  assert.equal(code,0,Buffer.concat(output[1]).toString());assert.equal(signal,null);
}

async function scenario(run,mode){
  const dir=path.join(run,mode),runtime=path.join(dir,'runtime'),out=runtime+'/original';fs.mkdirSync(runtime,{recursive:true});
  const logs=[fs.openSync(dir+'/driver.stdout','wx'),fs.openSync(dir+'/driver.stderr','wx')];
  const supervisor=`import ctypes,subprocess,sys,os,json,signal,time
assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
p=subprocess.Popen(json.loads(sys.argv[1]),start_new_session=True)
deadline=time.monotonic()+32
reaped=[]
try: status=p.wait(timeout=32)
except subprocess.TimeoutExpired:
 os.killpg(p.pid,signal.SIGKILL);status=p.wait()
while True:
 try:
  pid,st=os.waitpid(-1,os.WNOHANG)
  if pid:reaped.append(dict(pid=pid,status=st,actualWait=True))
  elif time.monotonic()>=deadline:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   time.sleep(.01)
  else:time.sleep(.01)
 except ChildProcessError:break
open(sys.argv[2],'w').write(json.dumps(dict(driverPID=p.pid,driverActualWait=status,adopted=reaped)))
sys.exit(status if status>=0 else 128-status)
`;
  const child=cp.spawn('python3',['-c',supervisor,JSON.stringify([process.execPath,'--require',__filename,retained]),dir+'/supervisor-waits.json'],{cwd:root,env:{...process.env,
    Q2_NODE_FIXTURE:'preload',Q2_FIXTURE_DIR:dir,Q2_CLOSE_MODE:mode,QUAKE2_NATIVE_RUN:runtime,BROWSER_DEADLINE:String(Date.now()+180000)},stdio:['ignore',...logs]});
  logs.forEach(fd=>fs.closeSync(fd));
  const completed=once(child,'close');let writer,writerDone;
  const watchdog=setTimeout(()=>{child.kill('SIGKILL');try{process.kill(Number(fs.readFileSync(dir+'/browser-pid')),'SIGKILL');}catch{}writer?.kill('SIGKILL');},33000);
  try{
    await until(()=>fs.existsSync(out+'/ready.json')||child.exitCode!==null);
    assert.equal(child.exitCode,null,fs.readFileSync(dir+'/driver.stderr','utf8'));
    const transport=require('./quake2-native-transport.cjs');
    const began=Date.now();
    if(['motion-torn','motion-wrong-module','motion-unpublished'].includes(mode)){
      const startup=JSON.parse(fs.readFileSync(out+'/startup-binding.json')).after.attackInput;
      assert.equal(startup.playerMotion?.status,'UNKNOWN','actual composed reader must reject '+mode);
      assert.equal(startup.playerMotion.origin,undefined);
      const ack=await transport.request(out,'motion-control-quit',{action:'quit'},50000);
      const [code,signal]=await completed;assert.equal(code,0);assert.equal(ack.ok,true);
      fs.writeFileSync(dir+'/result.json',JSON.stringify({code,signal,startup,authoredOnly:true}));
      console.log(mode,'PASS actual composed capture rejects motion without usable coordinates');return;
    }
    if(['moveup','space-down-fail','space-up-fail'].includes(mode)){
      await movementCaller(dir,runtime,mode);
      const [code,signal]=await completed;assert.equal(code,mode==='moveup'?0:1);
      const events=fs.readFileSync(dir+'/protocol.jsonl','utf8').trim().split('\n').map(JSON.parse).filter(v=>v.method==='Input.dispatchKeyEvent').map(v=>v.params);
      assert.deepEqual(events.map(v=>[v.type,v.key,v.code,v.windowsVirtualKeyCode]),mode==='moveup'?
        [['keyDown',' ','Space',32],['keyUp',' ','Space',32],['keyDown','a','KeyA',65],['keyUp','a','KeyA',65]]:
        [['keyDown',' ','Space',32],['keyUp',' ','Space',32]]);
      const delivered=fs.readFileSync(dir+'/renderer.jsonl','utf8').trim().split('\n').map(JSON.parse);
      assert.deepEqual(delivered.slice(0,2).map(v=>[v.event.msg,v.event.wParam,v.event.lParam>>>0,v.state]),[[0x100,32,1|(0x39<<16),0x8000],[0x101,32,(0xc0000001|(0x39<<16))>>>0,0]]);
      const startup=JSON.parse(fs.readFileSync(out+'/startup-binding.json')).after.attackInput;
      assert.equal(startup.status,'SNAPSHOT');assert.equal(startup.bindings.find(v=>v.key===32).text,'+moveup');assert.equal(startup.bindings.find(v=>v.key===97).text,'+moveleft');
      assert.equal(startup.playerMotion?.status,'SNAPSHOT','regression: composed capture previously omitted native motion');
      assert.deepEqual(startup.playerMotion.origin,[-4096,-1.125,4095.875]);
      assert.deepEqual(startup.playerMotion.velocity,[-100.125,200,0.875]);assert.equal(startup.playerMotion.pmFlags,0x45);
      assert.equal(startup.weaponEffect,'UNKNOWN');assert.match(startup.consumption,/UNKNOWN/);
      const hold=JSON.parse(fs.readFileSync(out+'/input-space-result-'+(mode==='moveup'?'hold':'hold-unknown')+'.json'));
      assert.equal(hold.physicalRelease,mode==='space-up-fail'?'UNKNOWN':'ACK');
      if(mode==='moveup'){
        assert(hold.samples.length);for(const sample of hold.samples){assert.equal(sample.attackInput.status,'SNAPSHOT');assert.equal(sample.attackInput.memoryIdentity,startup.memoryIdentity);assert.equal(sample.attackInput.bindings.find(v=>v.key===97).text,'+moveleft');assert.equal(sample.attackInput.physical.find(v=>v.key===32).state,0x8000);
          assert.equal(sample.attackInput.playerMotion?.status,'SNAPSHOT');assert.equal(sample.attackInput.playerMotion.frameNumber,18);
          assert.deepEqual(sample.attackInput.playerMotion.origin,[10,-20,30]);assert.deepEqual(sample.attackInput.playerMotion.velocity,[1,-2,3]);assert.equal(sample.attackInput.playerMotion.pmFlags,4);
        }
        const after=JSON.parse(fs.readFileSync(out+'/lateral-result-binding.json')).after.attackInput;
        assert.equal(after.memoryIdentity,startup.memoryIdentity);assert.equal(after.playerMotion.frameNumber,19);
      }else{assert(!fs.existsSync(out+'/commands/1.json'));assert(fs.existsSync(out+'/first-transport-failure.json'));}
      fs.writeFileSync(dir+'/result.json',JSON.stringify({code,signal,actualClose:true,events,delivered,authoredOnly:true}));
      console.log(mode,'PASS actual composed Python caller / numbered Node transport / driver / serialized owning sparse reader / renderer Space and a, balanced release, UNKNOWN consumption');return;
    }
    if(mode==='independent'){
      const [code,signal]=await completed;assert.equal(code,1);
      const receipt=JSON.parse(fs.readFileSync(out+'/browser-drain-unknown.json')).receipt;
      assert.equal(receipt.capMs,30000);assert.equal(receipt.normal,false);
      assert(receipt.signals.some(v=>v.signal==='SIGTERM')&&receipt.signals.some(v=>v.signal==='SIGKILL'));
      assert(receipt.elapsedMs>=25000&&receipt.elapsedMs<31000);
      assert(!fs.existsSync(out+'/cleanup.json'));
      fs.writeFileSync(dir+'/result.json',JSON.stringify({code,signal,actualClose:true,receipt}));
      console.log(mode,'PASS actual composed independent 30s close cap; TERM/KILL UNKNOWN');return;
    }
    if(mode==='combo'||mode==='partial-input'||mode==='missing-review'){
      const capture=JSON.parse(fs.readFileSync(out+'/startup-capture.json'));
      if(mode!=='missing-review')transport.publish(out+'/startup-review.json',{...capture,review:'personally inspected Crouch Here fixture',reviewedAt:new Date().toISOString()});
      const comboAck=await transport.request(out,'crouch_choice',{action:'combo',keys:['ArrowUp','Control'],holdMs:50,waitMs:0,label:'crouch-result',reviewRef:'startup'},50000).then(value=>({value}),error=>({error:String(error)}));
      const events=fs.readFileSync(dir+'/protocol.jsonl','utf8').trim().split('\n').map(JSON.parse).filter(v=>v.method==='Input.dispatchKeyEvent');
      if(mode==='missing-review')assert.equal(events.length,0);
      else{
        assert.deepEqual(events.map(v=>[v.params.type,v.params.key]),[['keyDown','ArrowUp'],['keyDown','Control'],['keyUp','Control'],['keyUp','ArrowUp']]);
        assert.equal(events[1].params.code,'ControlLeft');assert.equal(events[1].params.windowsVirtualKeyCode,17);
      }
      if(mode==='combo')assert.equal(comboAck.value?.ok,true);
      else{
        assert(comboAck.error);const [code,signal]=await completed;assert.equal(code,1);
        const first=fs.readFileSync(out+'/first-transport-failure.json','utf8');
        await assert.rejects(transport.request(out,'later_crouch',{action:'combo',keys:['ArrowUp','Control'],holdMs:50,waitMs:0,label:'later'},50000));
        assert.equal(fs.readFileSync(out+'/first-transport-failure.json','utf8'),first);
        assert(!fs.existsSync(out+'/commands/1.json'));assert(!fs.existsSync(out+'/reply-0.json'));
        if(mode==='partial-input')assert.equal(JSON.parse(fs.readFileSync(out+'/input-crouch_choice-hold-unknown.json')).physicalRelease,'ACK');
        fs.writeFileSync(dir+'/result.json',JSON.stringify({code,signal,actualClose:true,comboAck,events}));
        console.log(mode,'PASS composed reviewed input/release and sticky failure');return;
      }
    }
    if(mode==='pending-capture')fs.writeFileSync(dir+'/arm-pending','1');
    const command=mode==='pending-capture'||mode==='terminal-wait'?{action:'capture',label:'cancelled',waitMs:mode==='terminal-wait'?10000:0}:{action:'quit'};
    const request=transport.request(out,'fixture_command',command,50000).then(value=>({value}),error=>({error:String(error)}));
    if(mode==='terminal-wait'){await until(()=>fs.existsSync(out+'/consumed-fixture_command'));process.kill(Number(fs.readFileSync(dir+'/browser-pid')),'SIGKILL');}
    const ack=await request;
    const [code,signal]=await completed;
    const elapsed=Date.now()-began;
    if(mode==='normal'||mode==='combo'){
      assert.equal(code,0);assert.equal(ack.value?.ok,true);
      const receipt=JSON.parse(fs.readFileSync(out+'/browser-terminal.json'));
      assert(receipt.normal&&receipt.drained&&receipt.capMs<20000,'quit close is nested inside command work');
      assert(elapsed<20000);
    }else{
      assert.equal(code,1);assert(ack.error);assert(!fs.existsSync(out+'/reply-0.json'));
      const first=fs.readFileSync(out+'/first-transport-failure.json','utf8');
      for(const action of ['capture','key','combo','quit'])await assert.rejects(transport.request(out,'later_'+action,{action,key:'ArrowUp',keys:['ArrowUp','Control'],holdMs:50,waitMs:0,label:'later'},50000));
      assert.equal(fs.readFileSync(out+'/first-transport-failure.json','utf8'),first);
      assert(!fs.existsSync(out+'/commands/1.json'));
      if(['pending-capture','terminal-wait'].includes(mode)){
        assert(elapsed<2000,'pending composed work cancels promptly');assert(!fs.existsSync(out+'/cancelled.png'));
      }else{
        const failed=JSON.parse(fs.readFileSync(out+'/browser-drain-unknown.json'));
        assert.equal(failed.receipt.normal,false);assert(failed.receipt.capMs<20000);
        assert(elapsed<23000,'quit must not acquire an additional 30s cleanup window');
        if(mode==='drain'){assert.equal(failed.receipt.drained,false);assert.equal(failed.receipt.terminal.code,0);}
        else {assert(failed.receipt.signals.some(v=>v.signal==='SIGTERM'));if(['kill','ack-stall'].includes(mode))assert(failed.receipt.signals.some(v=>v.signal==='SIGKILL'));}
      }
    }
    const browserPID=Number(fs.readFileSync(dir+'/browser-pid'));await until(()=>{try{process.kill(browserPID,0);return false;}catch(e){return e.code==='ESRCH';}});
    if(mode==='drain')assert(JSON.parse(fs.readFileSync(dir+'/supervisor-waits.json')).adopted.some(v=>v.pid===Number(fs.readFileSync(dir+'/writer-pid'))&&v.actualWait));
    if(writer){const [status,term]=await writerDone;fs.writeFileSync(dir+'/writer-wait.json',JSON.stringify({pid:writer.pid,status,signal:term,actualClose:true}));}
    fs.writeFileSync(dir+'/result.json',JSON.stringify({code,signal,actualClose:true,elapsedMs:elapsed,ack,remoteCustody:'UNKNOWN; Node-only process/protocol fixture'}));
    console.log(mode,'PASS actual composed quit/close or terminal cancellation',elapsed+'ms');
  }finally{
    clearTimeout(watchdog);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await completed;
    if(writer){if(writer.exitCode===null&&writer.signalCode===null)writer.kill('SIGKILL');await writerDone;}
  }
}
async function main(){
  const run=path.resolve(process.argv[2]);fs.mkdirSync(run,{recursive:true});
  const result=composition.compose();
  assert(result.source.includes("WINE_QUAKE2_LOAD_OBSERVATION=true;window.WINE_QUAKE2_NATIVE_WRITE_OBSERVATION=true;"));
  const gateStart=' // The ordinary DLL-loader call is parked';
  const gateEnd=" save('launch.json'";
  assert.equal(result.source.slice(result.source.indexOf(gateStart),result.source.indexOf(gateEnd)),result.retainedSource.slice(result.retainedSource.indexOf(gateStart),result.retainedSource.indexOf(gateEnd)),'strict startup and CPU observation unchanged');
  fs.writeFileSync(run+'/providers.json',JSON.stringify(result.references));
  await budgetCases(run);console.log('command20s / ACK22s / cleanup30s budget and tampered cap rejection PASS');
  await inputCases();console.log('native crouch-forward allowlist, partial DOWN, sample, UP failure, late DOWN and independent release PASS');
  for(const mode of (process.env.Q2_COMPOSITION_MODES?.split(',')??['moveup','motion-torn','motion-wrong-module','motion-unpublished','space-down-fail','space-up-fail','normal','combo','partial-input','missing-review','term','kill','ack-stall','drain','pending-capture','terminal-wait','independent']))await scenario(run,mode);
}
