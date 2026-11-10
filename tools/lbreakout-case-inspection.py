"""Generate read-only inspection for one LBreakout browser case.

Launcher completion and each stream EOF are separate records. Live log
availability must never mask passive terminal records.
"""
import json


def pause_completion_observer_source():
    """Passive phase-specific trace; original media/module validator stays shared.

    The broad diagnostic's block budget can expire inside surface_gray. Trace
    only keyboard entry/return, then the original handler, then its caller.
    No instruction budget, clock, guest state or handler call is changed.
    """
    return r'''async function installPauseCompletion({e,memory,binding,token,expected,now=()=>Date.now(),emit=()=>{}}){
 if(!token||![8,20].includes(expected))throw Error('completion command binding');
 const v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p>>>0)>>>0;
 const u32=p=>v.getUint32(wa(p),true),u8=p=>v.getUint8(wa(p));
 const {exe,sdl,index,generation,mappingState,keys}=binding;
 const table=e.get_dll_table()>>>0,life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0;
 const records=[],started=now(),deadline=started+2000;
 let phase='keyboard',active=true,down=false,handler=false,display=false,returned=false,frame=null,reason=null;
 const trace=(lo,hi=lo+1)=>e.set_trace_eip_range(1,lo,hi);
 const record=(kind,data={})=>{if(records.length>=64){active=false;reason='record-limit';e.set_trace_eip_range(0,0,0);return;}const r={kind,token,at:now(),...data};records.push(r);emit(r);};
 const valid=()=>{if(e.get_image_base()!==exe||e.get_current_thread_id()!==1||
  v.getUint32(table+index*32,true)!==sdl||v.getUint32(life+index*stride+4,true)!==generation||
  v.getUint32(life+index*stride,true)!==mappingState)throw Error('completion module/owner changed');};
 const stop=r=>{if(!active)return;active=false;reason=r;e.set_trace_eip_range(0,0,0);record('completion-stop',{reason:r});};
 const complete=()=>{if(returned&&display&&u32(exe+0x523b0)===expected&&u8(keys+112)===0){record('guest-complete',{state:expected,releaseState:0});stop('complete');return true;}return false;};
 function boundary(pc=e.get_eip()>>>0){
  if(!active)return;
  try{
   valid();if(now()>=deadline)return stop('deadline');
   const esp=e.get_esp()>>>0;
   if(phase==='keyboard'&&pc===sdl+0x19870){
    const symbol=u32(u32(esp+8)+4);if(symbol!==112)return;
    frame={ret:u32(esp),esp,down:u8(esp+4)};record('sdl-p-entry',{down:frame.down});
    phase='keyboard-return';trace(frame.ret);return;
   }
   if(phase==='keyboard-return'&&pc===frame.ret&&esp===frame.esp+4){
    record('sdl-p-return',{down:frame.down,state:u8(keys+112)});
    if(frame.down){if(u8(keys+112)!==1)throw Error('SDL P down incomplete');down=true;phase='handler';trace(exe+0x1e406,exe+0x1e878);}
    else if(!complete()){phase='keyboard';trace(sdl+0x19870);}
    return;
   }
   if(phase==='handler'&&pc===exe+0x1e406){
    if(u32(esp+4)!==112)return;
    if(!down)throw Error('handler before SDL delivery');
    if(u32(exe+0x523b0)!==(expected===20?8:20))throw Error('unsupported original pause state');
    frame={ret:u32(esp),esp};handler=true;record('pause-handler-entry',{state:u32(exe+0x523b0)});return;
   }
   if(phase==='handler'&&handler&&pc===exe+(expected===20?0x1e7b4:0x1e7ec)){
    if(u32(exe+0x523b0)!==expected)throw Error('original pause transition incomplete');
    display=true;record(expected===20?'pause-display-return':'resume-state-return',{state:expected});
    phase='handler-return';trace(frame.ret);return;
   }
   if(phase==='handler-return'&&pc===frame.ret&&esp===frame.esp+4){
    returned=true;record('pause-handler-return',{state:u32(exe+0x523b0)});
    if(!complete()){phase='keyboard';trace(sdl+0x19870);}return;
   }
  }catch(error){record('completion-error',{error:String(error)});stop('failure');}
 }
 const timer=setTimeout(()=>stop('deadline'),2000);if(timer.unref)timer.unref();
 valid();record('completion-arm',{binding,expected,deadline});trace(sdl+0x19870);
 return {boundary,stop:r=>{clearTimeout(timer);stop(r);},snapshot:()=>({token,binding,expected,deadline,active,reason,phase,records:[...records]})};
}'''


def pause_completion_preload_source():
    return pause_completion_observer_source() + r'''
(()=>{
 const instantiate=WebAssembly.instantiate;
 WebAssembly.instantiate=async function(source,imports){
  imports.host.log_eip=pc=>globalThis.__lbObserver?.boundary(pc>>>0);
  const r=await instantiate.call(WebAssembly,source,imports);
  globalThis.__lbNative={instance:r.instance||r,memory:imports.host.memory};return r;
 };
 globalThis.__lbArm=async c=>{
  if(globalThis.__lbObserver?.snapshot().active)throw Error('completion already armed');
  if(!globalThis.LBreakoutInputObserver)importScripts('/lib/lbreakout-input-observer.js');
  const media='/binaries/candidates/lbreakout2-251/game/LBREAKOUT/';
  const [exeBytes,sdlBytes]=await Promise.all(['lbreakout2.exe','SDL.dll'].map(async n=>new Uint8Array(await(await fetch(media+n)).arrayBuffer())));
  const {instance,memory}=globalThis.__lbNative,e=instance.exports;
  const validator=await LBreakoutInputObserver.install({enabled:true,exports:e,memory,exeBytes,sdlBytes,durationMs:2000});
  const {binding}=validator.snapshot();validator.stop('validated');
  // Relocation-free instruction anchors from this exact original EXE.
  const bytes=new Uint8Array(memory.buffer),hex=(pc,n)=>Array.from(bytes.subarray(e.guest_to_wasm(pc),e.guest_to_wasm(pc)+n),x=>x.toString(16).padStart(2,'0')).join('');
  for(const [rva,h] of [[0x1e406,'5589e583ec18'],[0x1e7b4,'83c410eb36'],[0x7b2a,'e8c7e40100']])
   if(hex(binding.exe+rva,h.length/2)!==h)throw Error('original pause instruction mismatch');
  globalThis.__lbObserver=await installPauseCompletion({e,memory,binding,...c,emit:r=>console.log('LB_OBSERVER',JSON.stringify(r))});
  return {armed:true,...__lbObserver.snapshot()};
 };
})();
'''


def pause_completion_source(source):
    """Apply to pause_workflow_source output; completion precedes FIRST image."""
    replacements = [
        ("async function armObservation(){const s=await owningWorker();return evaluate('globalThis.__lbArm()',s);}", r'''async function armObservation(c){
 const s=await owningWorker(),token=c.id+'-'+c.phase;
 const arm=await evaluate('globalThis.__lbArm('+JSON.stringify({token,expected:c.expected})+')',s);
 assert(arm.armed&&arm.token===token,'completion arm binding');
 return {session:s,token,expected:c.expected,deadline:arm.deadline,binding:arm.binding};
}
async function completion(a){
 try{
  while(true){
   assert(!terminal,'terminal: completion closed');assert(Date.now()<Math.min(deadline,a.deadline),'guest completion deadline');
   assert.equal(await owningWorker(),a.session,'completion owner binding');
   const r=await evaluate('globalThis.__lbObserver.snapshot()',a.session);
   assert.equal(r.token,a.token,'completion command binding');assert.equal(r.expected,a.expected);
   assert.deepEqual(r.binding,a.binding,'completion module binding');
   if(!r.active){
    assert.equal(r.reason,'complete','guest completion incomplete');save('completion-'+a.token+'.json',r);
    const remaining=Math.min(deadline,a.deadline)-Date.now();assert(remaining>0,'presentation deadline');
    const presented=await evaluate(`new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('presentation deadline')),${remaining});requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve({presented:true})}));})`);
    assert(presented?.presented&&Date.now()<Math.min(deadline,a.deadline),'presentation completion');
    save('presentation-'+a.token+'.json',{token:a.token,presented:true,at:Date.now()});return;
   }
   await wait(10);
  }
 }catch(e){fail(e);throw e;}
}'''),
        ("if(c.observe){save('observer-arm-'+c.id+'.json',await armObservation());}", "let completionArm;\n   if(c.action==='key'&&c.key==='p')completionArm=await armObservation({...c,phase:'pause',expected:20});"),
        ("     const k=require('./input.cjs').key('p'),{text,...release}=k;", "     const a=await armObservation({...c,phase,expected:phase==='resume'?8:20});\n     const k=require('./input.cjs').key('p'),{text,...release}=k;"),
        ("save:r=>save('input-'+c.id+'-'+phase+'.json',r)});", "save:r=>save('input-'+c.id+'-'+phase+'.json',r)});\n     await completion(a);"),
        ("   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});", "   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});\n   if(completionArm)await completion(completionArm);"),
    ]
    for before, _ in replacements:
        if source.count(before) != 1:
            raise ValueError('unsupported completion template: ' + before)
    for before, after in replacements:
        source = source.replace(before, after)
    return source


def pause_workflow_source(source):
    """Extend the actual bound browser caller with ordinary local-game P input.

    Original EXE cc1fd5c3: handle_default_key 0x41e474 tests SDLK_p;
    0x41e75c..0x41e7ef toggles local states 8 and 20. No guest calls/writes.
    A play command attests that its reviewed image visibly showed pause.
    Pair this caller with pause_completion_preload_source().
    """
    replacements = [
        ("['capture','click','key','quit']", "['capture','click','key','play','quit']"),
        ("'Enter','Space'].includes(c.key)", "'Enter','Space','p'].includes(c.key)"),
        ("   await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});", """   if(c.action==='play'){
    assert.equal(c.pauseConfirmed,latest.label,'reviewed visible pause required');
    assert(['ArrowLeft','ArrowRight','Space'].includes(c.key),'supported play key');
    assert(Number.isInteger(c.holdMs)&&c.holdMs>=0&&c.holdMs<=300,'short play hold');
    assert(Number.isInteger(c.playMs)&&c.playMs>=c.holdMs&&c.playMs<=500,'short play interval');
    const toggle=async phase=>{
     assert(!terminal,'terminal: no later pause input');
     const k=require('./input.cjs').key('p'),{text,...release}=k;
     await pulse({down:()=>send('Input.dispatchKeyEvent',{type:'keyDown',...k},pageSession),up:()=>send('Input.dispatchKeyEvent',{type:'keyUp',...release},pageSession),deadline,onFailure:fail,holdMs:80,save:r=>save('input-'+c.id+'-'+phase+'.json',r)});
    };
    await toggle('resume');
    assert(!terminal,'terminal: no later play input');
    await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs,save:r=>save('input-'+c.id+'-pulse.json',r)});
    await wait(c.playMs-c.holdMs);
    await toggle('pause');
   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});"""),
    ]
    # Check the complete template before changing any of it. Drift is offline.
    for before, _ in replacements:
        if source.count(before) != 1:
            raise ValueError('unsupported bound browser template: ' + before)
    for before, after in replacements:
        source = source.replace(before, after)
    return pause_completion_source(source)


def owning_worker_source():
    """Select the module-bound process owner, allowing real secondary threads."""
    return """async function owningWorker(){
 const live=await chain.readLive();
 const owner=workers.get(live.worker.sessionId);
 assert(owner&&!owner.closed&&owner.url.includes('guest-worker'),'live bound owning guest Worker');
 assert.equal(owner.targetId,live.identity.workerTarget,'bound owning Worker target');
 return live.worker.sessionId;
}"""


def inspection_source(root, run, case):
    if case not in ('fixture', 'original'):
        raise ValueError('unsupported LBreakout case')
    return '''import json,pathlib
p=pathlib.Path(%s)/%s
out=p/%s
log=p/(%s+'.log')
markers=['first-browser-failure.json','first-failure.json','cleanup.json','chrome-exit.json']
terminal={n:json.loads((out/n).read_text()) for n in markers if (out/n).exists()}
wait=p/(('fixture-launcher' if %s=='fixture' else 'launcher')+'-wait.json')
if wait.exists():terminal['launcherWait']=json.loads(wait.read_text())
for stream in ['stdout','stderr']:
 eof=wait.with_name(wait.name.replace('-wait.json','-'+stream+'-eof.json'))
 if eof.exists():terminal[stream+'EOF']=json.loads(eof.read_text())
print(json.dumps(dict(case=%s,files=sorted(f.name for f in out.iterdir()) if out.exists() else [],latest=json.loads((out/'latest.json').read_text()) if (out/'latest.json').exists() else None,terminal=terminal,logPath=str(log),logAvailable=log.exists(),output=log.read_text()[-4000:] if log.exists() else None)))
''' % tuple(json.dumps(v) for v in (root, run, case, case, case, case))


def launcher_source(root, run, case, command, env=None, deadline_from_lifecycle=False):
    """One parent owns wait and two independent pipe drains; publish atomically."""
    if case not in ('fixture', 'original'):
        raise ValueError('unsupported LBreakout case')
    prefix = 'fixture-launcher' if case == 'fixture' else 'launcher'
    return '''import json,os,pathlib,subprocess,threading,time
root=pathlib.Path(%r);run=root/%r
case=%r;prefix=%r

def put(name,value):
 p=run/name;tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(value));tmp.replace(p)
env=dict(os.environ,**%r)
if %r:env['BROWSER_DEADLINE']=str(json.loads((run/'lifecycle.json').read_text())['browserDeadline'])
p=subprocess.Popen(%r,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
put(prefix+'.json',dict(pid=p.pid,parentPid=os.getpid()))
def drain(stream,suffix):
 with (run/(case+('-stderr' if suffix=='stderr' else '')+'.log')).open('wb') as out:
  while True:
   b=stream.read(65536)
   if not b:break
   out.write(b)
 put(prefix+'-'+suffix+'-eof.json',dict(pid=p.pid,eof=True,stream=suffix,at=time.time()))
threads=[threading.Thread(target=drain,args=(stream,name)) for stream,name in [(p.stdout,'stdout'),(p.stderr,'stderr')]]
for t in threads:t.start()
code=p.wait()
put(prefix+'-wait.json',dict(pid=p.pid,code=code,actualWait=True,at=time.time()))
for t in threads:t.join()
''' % (root, run, case, prefix, env or {}, deadline_from_lifecycle, command)


def handoff_source(root, run, original_source, close_command=None, timeout=15):
    """Actual close -> bounded parent completion/EOF -> one original creation.

    A close ACK or cleanup marker alone cannot release the launch. Missing
    publication is pending until the deadline; a negative record is terminal.
    """
    if not 0 < timeout <= 60:
        raise ValueError('bounded parent completion timeout required')
    return '''import json,pathlib,subprocess,time,sys
root=pathlib.Path(%r);run=root/%r
close_command=%r
if close_command is not None:
 subprocess.run(close_command,cwd=root,check=True,timeout=%r)
due=time.monotonic()+%r
while True:
 for name in ['first-browser-failure.json','first-failure.json']:
  if (run/'fixture'/name).exists():raise RuntimeError('terminal fixture '+name)
 cleanup=run/'fixture/cleanup.json'
 if cleanup.exists():
  value=json.loads(cleanup.read_text())
  if value.get('closed') is False or value.get('code',0) not in (0,None):raise RuntimeError('failed fixture cleanup')
 wait=run/'fixture-launcher-wait.json'
 if wait.exists():
  value=json.loads(wait.read_text())
  if value.get('actualWait') is not True or value.get('code')!=0:raise RuntimeError('failed fixture actual parent wait')
  ready=cleanup.exists()
  for stream in ['stdout','stderr']:
   eof=run/('fixture-launcher-'+stream+'-eof.json')
   if not eof.exists():ready=False;continue
   record=json.loads(eof.read_text())
   if record.get('eof') is not True or record.get('stream')!=stream or record.get('pid')!=value.get('pid'):raise RuntimeError('invalid fixture separate EOF '+stream)
  if ready:break
 if time.monotonic()>=due:raise TimeoutError('fixture parent completion/separate EOF unpublished')
 time.sleep(.02)
# This is the sole creation point, reached only after actual wait and both EOFs.
p=subprocess.Popen([sys.executable,'-c',%r],cwd=root,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
(run/'original-parent.json').write_text(json.dumps(dict(pid=p.pid,fixtureWait=value,stdoutEOF=True,stderrEOF=True)))
print(json.dumps(dict(parentPid=p.pid,fixtureParentCompleted=True,separateEOF=True)))
''' % (root, run, close_command, timeout, timeout, original_source)



def original_workflow_source(root, run, command, close_command=None, timeout=15):
    """Compose the real original launcher without text substitution of env keys."""
    parent = launcher_source(root, run, 'original', command,
                             {'CASE_TAG': 'original'}, deadline_from_lifecycle=True)
    return handoff_source(root, run, parent, close_command, timeout)
