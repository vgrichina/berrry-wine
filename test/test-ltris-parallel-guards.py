"""Current native PE + immutable CLI, with fault injection only in fixtures.

No original process is launched by this file. Every wire operation is retained
by the same control adapter used for manual input and independent release.
"""
import pathlib,os,sys,subprocess,json,time,socket,importlib.util,hashlib,signal
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
RUN=pathlib.Path(os.environ.get('LTRIS_RUN_ROOT', ROOT/'scratch/runs/20261116-ltris-parallel-native-line-clear')).resolve()
HEAD=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
fixture=json.loads(subprocess.check_output(['node','test/test-ltris-parallel-native-runtime.cjs','--prepare'],cwd=ROOT))
def waitfile(p,timeout=15):
    end=time.monotonic()+timeout
    while not p.exists():
        assert time.monotonic()<end,'missing '+str(p);time.sleep(.02)
    return json.loads(p.read_text())
def load():
    s=importlib.util.spec_from_file_location('manual',ROOT/'tools/ltris-parallel-control.py')
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def observer_loss():
    out=RUN/'fixture-observer-loss';out.mkdir()
    native=json.loads(subprocess.check_output(['node','test/test-ltris-parallel-native-runtime.cjs','--prepare','--variant=missing-health'],cwd=ROOT))
    child=subprocess.Popen([sys.executable,'-B','tools/ltris-parallel-native-runtime.py',str(out),'12',
        'node','test/run.js','--exe='+native['file'],'--no-build','--threads','--real-ticks',
        '--screen=1024x768','--max-seconds=12','--max-batches=10000000',
        '--quiet-api','--quiet-blocks','--no-close'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    waitfile(out/'native-pid.json')
    # Terminate only the actual observer, as a lost tool parent does. The
    # original native deadline and prearmed independent watchdog stay fixed.
    os.kill(child.pid,signal.SIGTERM)
    a,b=child.communicate(timeout=35)
    (out/'outer-wait.json').write_text(json.dumps(dict(pid=child.pid,exit=child.returncode,
        actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))+'\n')
    assert child.returncode==0,(a,b)
    for name in ['native-wait.json','watchdog-wait.json','supervisor-child-wait.json']:
        receipt=waitfile(out/name)
        assert receipt['exit']==0 and receipt['actualWait'] and receipt['stdoutEOF'] and receipt['stderrEOF'],receipt
    assert waitfile(out/'supervisor-child-wait.json')['interruptions'][0]['signal']==signal.SIGTERM
    assert not (out/'watchdog-fired.json').exists()
    (out/'qualification.json').write_text(json.dumps(dict(observerTermSurvived=True,
        actualChildWaitsAndEOF=True,original=False,nativeQuit=False,deadlineUnchanged=True))+'\n')
def worker_module():
    out=RUN/'fixture-worker-module';out.mkdir()
    native=json.loads(subprocess.check_output(['node','test/test-ltris-parallel-native-runtime.cjs','--prepare','--variant=threaded'],cwd=ROOT))
    child=subprocess.Popen([sys.executable,'-B','tools/ltris-parallel-native-runtime.py',str(out),'12',
        'node','test/run.js','--exe='+native['file'],'--no-build','--threads','--real-ticks',
        '--screen=1024x768','--max-seconds=12','--max-batches=10000000',
        '--quiet-api','--quiet-blocks','--no-close'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    a,b=child.communicate(timeout=35)
    (out/'outer-wait.json').write_text(json.dumps(dict(pid=child.pid,exit=child.returncode,
        actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))+'\n')
    assert child.returncode==0,(a,b)
    events=[json.loads(p.read_text()) for p in out.glob('module-event-*.json')]
    expected=waitfile(out/'sealed-inputs.json')['wasmSHA256']
    assert all(e['sha256']==expected for e in events)
    assert any(e['kind']=='receive-compiled-module' and e['threadId']>0 for e in events),events
    assert any(e['kind']=='instantiate-compiled-module' and e['threadId']>0 for e in events),events
    (out/'qualification.json').write_text(json.dumps(dict(realWorkerModuleTransport=True,
        moduleSHA256=expected,original=False,nativeQuit=False))+'\n')
def missing_health():
    out=RUN/'fixture-missing-native-health';out.mkdir()
    native=json.loads(subprocess.check_output(['node','test/test-ltris-parallel-native-runtime.cjs','--prepare','--variant=missing-health'],cwd=ROOT))
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    child=subprocess.Popen([sys.executable,'-B','tools/ltris-parallel-native-runtime.py',str(out),'12',
        'node','test/run.js','--exe='+native['file'],'--no-build','--threads','--real-ticks',
        '--screen=1024x768','--max-seconds=12','--max-batches=10000000','--control='+str(port),'--quiet-api','--quiet-blocks','--no-close'],
        cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    waitfile(out/'native-pid.json')
    os.environ.update(FORSAKEN_CONTROL_OUT=str(out),FORSAKEN_CONTROL_URL='http://127.0.0.1:'+str(port)+'/ctl',LTRIS_CONTROL_HEAD=HEAD)
    m=load();end=time.monotonic()+3
    while True:
        try:s=m.call(dict(action='snapshot'));break
        except RuntimeError as e:
            assert 'ConnectionRefusedError' in str(e) and time.monotonic()<end;time.sleep(.03)
    assert s['mainHwnd']=='0x0' and not s['windows'],s
    try:m.c.bind()
    except RuntimeError as e:assert 'unavailable' in str(e)
    else:raise AssertionError('missing native USER accepted')
    assert m.c.read('terminal-input-failure.json')['noReplay']
    count=len(list(out.glob('http-*.json')))
    try:m.c.capture('forbidden')
    except AssertionError as e:assert 'sticky' in str(e)
    else:raise AssertionError('closed endpoint accepted capture')
    assert count==len(list(out.glob('http-*.json')))
    a,b=child.communicate(timeout=18)
    m.save('outer-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
    assert child.returncode==0
    m.save('qualification.json',dict(missingNativeHealthRefused=True,down=0,laterRequestsAfterClosure=0,original=False))
def case(kind):
    out=RUN/(os.environ.get('LTRIS_GUARD_TAG','fixture-guard-v3')+'-'+kind);out.mkdir()
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    args=[sys.executable,'-B','tools/ltris-parallel-native-runtime.py',str(out),'240',
          'node','test/run.js','--exe='+fixture['file'],'--no-build','--threads','--real-ticks',
          '--screen=1024x768','--max-seconds=240','--max-batches=10000000','--control='+str(port),
          '--quiet-api','--quiet-blocks','--no-close']
    child=subprocess.Popen(args,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    waitfile(out/'native-pid.json')
    os.environ.update(FORSAKEN_CONTROL_OUT=str(out),FORSAKEN_CONTROL_URL='http://127.0.0.1:'+str(port)+'/ctl',LTRIS_CONTROL_HEAD=HEAD)
    m=load();c=m.c
    end=time.monotonic()+12
    # Fixture readiness is bounded; failed observations are all recorded. No
    # owner is inferred from a PID or a renderer object alone.
    while True:
        try:
            s=m.call({'action':'snapshot'})
            if s['mainHwnd']!='0x0' and s['physicalUp']:break
        except (ConnectionError,OSError):pass
        except RuntimeError as e:
            if 'ConnectionRefusedError' not in str(e):raise
        assert time.monotonic()<end,'native fixture readiness';time.sleep(.03)
    m.call(dict(action='eval',code="""(() => {
for(const [name,kind] of [['handleKeyDown','DOWN'],['handleKeyUp','UP']]) {
 const fn=renderer[name];renderer[name]=function(key){const value=fn.call(this,key);
 console.log('LTRIS_FIXTURE_EFFECT '+JSON.stringify({kind,key,at:Date.now()}));return value;};
} return true;})()"""))
    # Exact fresh authored scene binding, synthetic test review clearly named.
    c.capture('scene');scene=c.read('scene.json')
    owner=m.call(dict(action='guarded-bind',reviewedScene=dict(route='native-scene-v1',snapshot=scene['snapshot'],pngSHA256=scene['pngSHA256'])))
    c.save('input-owner.json',owner);c.save('lease-snapshot.json',{k:scene['snapshot'][k] for k in ('mainHwnd','screen')})
    c.save('scene-review.json',dict(at=time.time(),pngSHA256=scene['pngSHA256'],observation='Synthetic fixture review on actual native current screenshot'))
    os.environ['LTRIS_REVIEW']='scene';c.call=m.safe_call
    real=m.call
    def fault(command,timeout=3):
        if command.get('action')=='guarded-input':
            command=json.loads(json.dumps(command));guard=command['guard']
            if kind=='wrong-owner':guard['owner']='wrong'
            if kind=='wrong-epoch':guard['epoch']+=1
            if kind=='wrong-identity':guard['identity']='wrong'
            if kind=='process-generation':guard['intent']['nativeProcess']['pid']+=1
            if kind=='thread-generation':guard['intent']['focusWindow']['threadId']+=1
            if kind=='window-generation':guard['intent']['windows'][0]['generation']='99999'
            if kind=='expired':guard['deadline']=int(time.time()*1000)-1
            if kind=='replayed-nonce':guard['nonce']='existing'
        result=real(command,timeout)
        if command.get('action')=='guarded-input':
            if kind=='late-ack':time.sleep(.2)
            if kind=='parent-stall':time.sleep(2.1)
            if kind=='unknown':result={**result,'state':'UNKNOWN'}
        return result
    if kind=='replayed-nonce':
        # An actual positive expiry tombstone owns this nonce permanently.
        reply=m.call(dict(action='guarded-input',cmd='keydown:38',guard={**owner,'nonce':'existing','reviewed':True,'deadline':int(time.time()*1000)-1,'intent':scene['snapshot']}))
        assert reply['state']=='CANCELLED' and reply['consumed'] is False
    m.call=fault
    caught=None
    try:
        result=c.pulse('gesture',['keydown:27'],80 if kind=='late-ack' else 120,'scene','Synthetic fixture intent through actual native transport',maxSceneAge=5)
        assert kind=='expired' and result.startswith('NOT_SENT'),result
    except BaseException as e:caught=repr(e)
    if kind=='expired':
        assert caught is None and c.read('gesture-rejection.json')['positivelyUnsent'] is True
        assert not (out/'terminal-input-failure.json').exists()
    else:
        assert caught and c.read('terminal-input-failure.json')['noReplay']
        count=len(list(out.glob('http-*.json')))
        try:c.capture('forbidden')
        except AssertionError as e:assert 'sticky' in str(e)
        else:raise AssertionError('closed endpoint allowed new request')
        assert count==len(list(out.glob('http-*.json'))),'later HTTP after closure'
    # After a terminal input failure use only process identity and signals;
    # no status/eval/quit/capture HTTP is sent to the closed endpoint.
    info=c.read('native-pid.json');st=pathlib.Path('/proc/'+str(info['pid'])+'/stat').read_text()
    assert st[st.rindex(')')+2:].split()[19]==info['startToken'];os.killpg(info['pid'],signal.SIGTERM)
    stdout,stderr=child.communicate(timeout=10)
    m.save('outer-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=stdout.decode(),stderr=stderr.decode()))
    native=waitfile(out/'native-wait.json');watch=waitfile(out/'watchdog-wait.json')
    assert native['actualWait'] and native['stdoutEOF'] and native['stderrEOF'] and watch['exit']==0
    physical=[json.loads(line.split('LTRIS_FIXTURE_EFFECT ',1)[1]) for line in
              (out/'native.stdout.log').read_text().splitlines() if 'LTRIS_FIXTURE_EFFECT ' in line]
    down=[e for e in physical if e['kind']=='DOWN'];up=[e for e in physical if e['kind']=='UP']
    if kind in ('late-ack','unknown','parent-stall'):
        assert len(down)==1 and len(up)==1,physical
        hold=up[0]['at']-down[0]['at'];assert hold<=1750,(kind,hold)
    else:assert not down,(kind,physical)
    result=dict(kind=kind,pass_=True,nativeFixture=True,original=False,exception=caught,physical=physical,laterRequestsAfterClosure=0)
    m.save('qualification.json',result);print(json.dumps(result),flush=True)
    return result

def sdl_route():
    out=RUN/os.environ.get('LTRIS_SDL_TAG','fixture-sdl-route');out.mkdir()
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
    f=json.loads(subprocess.check_output(['node','test/test-ltris-sdl-latency.cjs'],cwd=ROOT))
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    game=ROOT/'test/binaries/candidates/ltris-128/game/LTRIS'
    env=dict(os.environ,LTRIS_OWNED_CONTROL_SHA256=hashlib.sha256((ROOT/'lib/control-server.js').read_bytes()).hexdigest(),LTRIS_MODULE_PATH=os.environ.get('LTRIS_MODULE_PATH',str(ROOT/'build/wine-assembly.wasm')),WINE_PUBLIC_INPUT_TRACE=str(out/'input.ndjson'),WINE_CONTROL_PHASE_TRACE=str(out/'http-phases.json'))
    args=['python3','-B','tools/ltris-parallel-native-runtime.py',str(out),'240','node','test/run.js','--exe='+f['file'],'--no-build','--threads','--real-ticks','--screen=1024x768','--max-seconds=240','--max-batches=10000000','--control='+str(port),'--quiet-api','--quiet-blocks','--no-close']
    for n in ['SDL.dll','libgcc_s_sjlj-1.dll','libwinpthread-1.dll']:args+=['--dll-seed='+str(game/n)]
    args+=['--dll-seed='+str(ROOT/'test/binaries/dlls/msvcrt.dll')]
    p=subprocess.Popen(args,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    def save(n,v):(out/n).write_text(json.dumps(v,indent=2)+'\n')
    save('fixture.json',dict(fixture=f,head=head,args=args,original=False,SDL=hashlib.sha256((game/'SDL.dll').read_bytes()).hexdigest()))
    error=None
    try:
     while not (out/'native-pid.json').exists():assert p.poll() is None;time.sleep(.02)
     os.environ.update(FORSAKEN_CONTROL_OUT=str(out),FORSAKEN_CONTROL_URL='http://127.0.0.1:'+str(port)+'/ctl',LTRIS_CONTROL_HEAD=head,LTRIS_CONTROL_PHASES='1')
     spec=importlib.util.spec_from_file_location('manual',ROOT/'tools/ltris-parallel-control.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);c=m.c
     until=time.monotonic()+10
     while True:
      try:
       s=m.call(dict(action='snapshot'))
       if s['mainHwnd']!='0x0' and s['physicalUp']:break
      except Exception as e:
       if 'ConnectionRefusedError' not in str(e):raise
      assert time.monotonic()<until;time.sleep(.05)
     time.sleep(.4)
     c.capture('menu');c.save('menu-review.json',dict(at=time.time(),pngSHA256=c.read('menu.json')['pngSHA256'],observation='Authored SDL controls fixture complete surface',submittedScene=True))
     rr=c.read('menu.json');owner=m.call(dict(action='guarded-bind',reviewedScene=dict(route='native-scene-v1',snapshot=rr['snapshot'],pngSHA256=rr['pngSHA256'])))
     c.save('input-owner.json',owner);c.save('lease-snapshot.json',{k:rr['snapshot'][k] for k in ('mainHwnd','screen')})
     for name,cmd,review in [('controls','mousedown:180:317','menu'),('player1','mousedown:180:302','controls'),('escape','keydown:27','player1')]:
      os.environ['LTRIS_REVIEW']=review
      c.save(review+'-review.json' if name!='controls' else 'menu-manual-review.json',dict(at=time.time(),pngSHA256=c.read(review+'.json')['pngSHA256'],observation='Authored SDL complete route synthetic review'))
      c.call=m.safe_call
      result=c.pulse(name,[cmd],120,review,'Authored SDL Controls Player1 route',maxSceneAge=30,final=name=='escape')
      print(name,result,flush=True)
    except BaseException as e:
     error=repr(e);save('failure.json',dict(error=error));print(error,flush=True)
    finally:
     if p.poll() is None and error:
      info=json.loads((out/'native-pid.json').read_text());stat=pathlib.Path('/proc/'+str(info['pid'])+'/stat').read_text();assert stat[stat.rindex(')')+2:].split()[19]==info['startToken'];os.killpg(info['pid'],signal.SIGTERM);save('host-cleanup.json',dict(signal=15,nativeQuit=False))
     a,b=p.communicate(timeout=30);save('outer-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
     print('done',p.returncode,error,flush=True)
    assert error is None,error
    assert p.returncode==0
    for name in ['native-wait.json','watchdog-wait.json','supervisor-child-wait.json']:
        wait=json.loads((out/name).read_text())
        assert wait['exit']==0 and wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF'],wait
    assert '[Exit] code=0' in (out/'native.stdout.log').read_text()
    assert not (out/'host-cleanup.json').exists() and not (out/'watchdog-fired.json').exists()
    # Public rendered fixture consequences, never original game state.
    pixels=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),{PNG}=require('pngjs'); console.log(JSON.stringify(process.argv.slice(1).map(p=>{const v=PNG.sync.read(fs.readFileSync(p)),i=(200*v.width+400)*4;return Array.from(v.data.slice(i,i+4));})))",*[str(out/(n+'.png')) for n in ['menu','controls','player1']]],cwd=ROOT))
    assert len(set(map(tuple,pixels)))==3,pixels
    receipts=[json.loads((out/(n+'-receipt.json')).read_text()) for n in ['controls','player1','escape']]
    assert all(r['consumed'] and r['receiptBoundary']=='native-input-return' and r['nativeMessage']['consumption']=='owner-user-return' for r in receipts)
    http=[json.loads(f.read_text()) for f in out.glob('http-*.json')]
    timings=[dict(command=v['command'],milliseconds=1000*(v['completedAt']-v['at']),limit=v['limitSeconds']) for v in http if v.get('command',{}).get('action')=='guarded-input']
    assert len(timings)==3 and all(t['limit']==.5 and t['milliseconds']<500 for t in timings),timings
    save('qualification.json',dict(pass_=True,original=False,nativeQuit=True,SDLConsumer=True,nativeReturnProof=True,renderedPixels=pixels,timings=timings,latencyFailureReproduced=False))

if __name__=='__main__':
    if '--sdl-route' in sys.argv:
        sdl_route();raise SystemExit(0)
    if '--worker-module' in sys.argv:
        worker_module();raise SystemExit(0)
    if '--observer-loss' in sys.argv:
        observer_loss();raise SystemExit(0)
    if '--missing-health' in sys.argv:
        missing_health();raise SystemExit(0)
    kinds=sys.argv[1:] or ['wrong-owner','wrong-epoch','wrong-identity','process-generation','thread-generation',
                          'window-generation','expired','replayed-nonce','late-ack','unknown','parent-stall']
    results=[case(k) for k in kinds]
    (RUN/'current-native-guards.json').write_text(json.dumps(results,indent=2)+'\n')
