#!/usr/bin/env python3
"""Real OS/native USER completion and fail-closed invocation/wait contract.

No original media. The only delayed request is test-side post-UP observation:
the native fixture genuinely exits/closes HTTP before that request is attempted.
"""
import importlib.util,json,os,pathlib,signal,socket,subprocess,sys,time,uuid
ROOT=pathlib.Path(__file__).resolve().parent.parent
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/file)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def supervisor(run,exe,port,worker=False):
    m=module('runtime','tools/vb5cce-original-runtime.py');m.RUN=run;m.install_shutdown_handlers()
    w=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/vb5cce-original-runtime.py'),'watchdog',str(time.time()+15)],
        env=dict(os.environ,DELPHI5_RUN=str(run)),stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    p=None
    try:
        while not (run/'watchdog-armed.json').exists():assert w.poll() is None;time.sleep(.005)
        with (run/'native.stdout.log').open('xb') as out,(run/'native.stderr.log').open('xb') as err:
            invocation=str(uuid.uuid4())
            argv=['node','test/test-vb5-normal-exit-native.cjs',str(run)] if worker else ['node','test/run.js','--exe='+str(exe),'--no-build','--threads','--real-ticks',
                '--native-exit-receipt='+str(run/'native-exit.json'),'--native-invocation-token='+invocation,
                '--control='+str(port),'--screen=800x600','--png-canvas','--max-seconds=20',
                '--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks']
            p=subprocess.Popen(argv,cwd=ROOT,stdout=out,stderr=err,start_new_session=True)
            info=m.native_identity(p);info['invocationToken']=invocation
            m.save('native-pid.json',info);m.save('current-native-pid.json',info)
            m.wait_native(p,run,info,timeout=18)
    finally:
        if p and not (run/'native-wait.json').exists():m.terminate_owned(p)
        m.save('pipeline-closed.json',dict(at=time.time()))
        m.join_watchdog(w)
        m.save('release.json',dict(nativeOutputClosed=out.closed and err.closed))
def controller(run,port,kind,mode):
    m=module('control','tools/vb5cce-reviewed-control.py');m.R=run;m.PORT=port
    due=time.time()+10
    while True:
        try:
            s=m.call(dict(action='snapshot'))
            if s['modalHwnd']!='0x0':break
        except (OSError,AssertionError):pass
        assert time.time()<due;time.sleep(.01)
    m.capture('scene');s=m.read('scene.json')['snapshot']
    b=next(w for w in s['windows'] if w['controlClass']==1 and w['controlId']==2)
    m.review('scene','Automated authored native USER contract fixture; no original personal review claim','Cancel',kind,b['hwnd'])
    m.bind('scene')
    if mode=='cancelled':m.call(dict(action='frozen',mode='on'))
    original=m.call
    def delayed_snapshot(command,**kwargs):
        if mode=='early' and command['action']=='guarded-input':
            result=original(command,**kwargs)
            os.killpg(m.read('native-pid.json')['pid'],signal.SIGTERM)
            return result
        if command['action']=='snapshot':
            if mode=='transport-live':
                original(dict(action='eval',code='control.close();true'))
                assert m.same_live_invocation(m.read('native-pid.json'))
                return original(command,**kwargs)
            if mode=='signal':os.killpg(m.read('native-pid.json')['pid'],signal.SIGTERM)
            # Genuine endpoint exit race; no fabricated reply or wait.
            end=time.time()+1.5
            while not (run/'native-wait.json').exists() and time.time()<end:time.sleep(.005)
            if mode in ('missing-wait','wrong-pid','stale-token','late-wait'):
                actual=m.read('native-wait.json');m.save('actual-native-wait.json',actual)
                (run/'native-wait.json').unlink()
                if mode=='wrong-pid':m.save('native-wait.json',dict(actual,pid=os.getpid()))
                if mode=='stale-token':m.save('native-wait.json',dict(actual,startToken='reused'))
                if mode=='late-wait':
                    time.sleep(3.05);m.save('native-wait.json',actual)
        return original(command,**kwargs)
    m.call=delayed_snapshot
    m.intent('press','scene',b['x']+b['w']//2,b['y']+b['h']//2,kind)
def contracts(run):
    m=module('control','tools/vb5cce-reviewed-control.py');m.R=run;run.mkdir()
    rt=module('runtime','tools/vb5cce-original-runtime.py')
    # Two real OS children: unrelated child stays alive through every refusal.
    p=subprocess.Popen(['sleep','20'],start_new_session=True);sibling=subprocess.Popen(['sleep','1'],start_new_session=True)
    cases=[]
    try:
        info=rt.native_identity(p);assert m.same_live_invocation(info)
        for field,value in [('startToken','reused'),('bootId','other-boot'),('invocationToken',None)]:
            bad=dict(info,**{field:value})
            try:m.same_live_invocation(bad)
            except AssertionError:cases.append(field)
            else:raise AssertionError(field)
        start=time.time();live=time.monotonic();os.killpg(p.pid,signal.SIGTERM)
        rc=p.wait();assert rc==-signal.SIGTERM and not m.same_live_invocation(info)
        base=dict(**info,actualWait=True,exit=0,disposition='normal',atWait=time.time(),atWaitMono=time.monotonic())
        target=run/'native-wait.json'
        assert m.normal_exit(info,live,start) is None;cases.append('missing-wait-not-EOF')
        for field,value in [('pid',sibling.pid),('startToken','reused'),('invocationToken','late-other'),
                ('actualWait',False),('exit',7),('exit',-11),('signal',15),('disposition','cleanup'),
                ('atWaitMono',live-1),('atWait',start-1)]:
            target.write_text(json.dumps(dict(base,**{field:value})))
            try:m.normal_exit(info,live,start)
            except AssertionError:cases.append(field+'='+str(value))
            else:raise AssertionError(field)
        target.write_text(json.dumps(base))
        (run/'native-exit.json').write_text(json.dumps(dict(**info,contract='native-process-exit-v1',exitCode=0,atExitMono=live)))
        assert m.normal_exit(info,live,start)==base
        for field,value in [('exitCode',7),('pid',sibling.pid),('invocationToken','late-other'),('atExitMono',live-1)]:
            (run/'native-exit.json').write_text(json.dumps(dict(**info,contract='native-process-exit-v1',exitCode=0,atExitMono=live,**{})|{field:value}))
            try:m.normal_exit(info,live,start)
            except AssertionError:cases.append('guest-'+field+'='+str(value))
            else:raise AssertionError('native exit '+field)
        m.save('PERMANENT-UNKNOWN.json',dict(reason='cancelled/early-exit/transport-loss terminal latch'))
        for op in [lambda:m.normal_exit(info,live,start),lambda:m.call(dict(action='snapshot'))]:
            try:op()
            except AssertionError:pass
            else:raise AssertionError('late callback revived UNKNOWN')
        assert sibling.poll() is None
        cases.append('UNKNOWN-no-late-callback-or-request');cases.append('no-sibling-kill')
    finally:
        if p.poll() is None:os.killpg(p.pid,signal.SIGTERM)
        p.wait();assert sibling.wait(timeout=3)==0 # No signal to the sibling, even in cleanup.
    (run/'results.json').write_text(json.dumps(dict(passed=True,cases=cases,actualWaits=[p.returncode,sibling.returncode]),indent=2)+'\n')
def main(run):
    run.mkdir(parents=True,exist_ok=True)
    contracts(run/'contracts')
    fixtures=run/'fixtures'
    subprocess.run(['node','test/test-vb5-normal-exit-native.cjs',str(fixtures),'--generate'],cwd=ROOT,check=True)
    results=[]
    for mode,kind in [('normal','install'),('normal','game'),('normal','quit'),('nonzero','install'),('crash','install'),
            ('early','install'),('signal','install'),('transport-live','install'),('missing-wait','install'),
            ('wrong-pid','install'),('stale-token','install'),('late-wait','install'),('cancelled','install')]:
        target=run/(mode+'-'+kind);target.mkdir()
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        at=time.time();(target/'launch.json').write_text(json.dumps(dict(deadline=at+240,gameplayCutoff=at+60,reserveSeconds=180,rootPort=port)))
        sources={n:module('h','tools/vb5cce-reviewed-control.py').hashlib.sha256((ROOT/n).read_bytes()).hexdigest()
            for n in ['tools/vb5cce-reviewed-control.py','test/test-vb5cce-original-current.cjs']}
        (target/'runtime-inputs.json').write_text(json.dumps(dict(sources=sources)))
        fixture_mode=mode if mode in ('normal','nonzero','crash','early') else 'live' if mode in ('transport-live','cancelled') else 'normal'
        outer=subprocess.Popen([sys.executable,'-B',__file__,'--supervisor',str(target),str(fixtures/(fixture_mode+'.exe')),str(port)],
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        ctl=None
        try:
            ctl=subprocess.Popen([sys.executable,'-B',__file__,'--controller',str(target),str(port),kind,mode],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            a,b=ctl.communicate(timeout=15)
            (target/'controller.stdout.log').write_bytes(a);(target/'controller.stderr.log').write_bytes(b)
            assert (ctl.returncode==0)==(mode=='normal'),b.decode()
            if mode=='normal':
                observation=json.loads((target/'press-observation.json').read_text());assert observation['outcome']=='process-exited'
                assert not (target/'PERMANENT-UNKNOWN.json').exists()
            else:
                assert (target/'PERMANENT-UNKNOWN.json').exists();assert not (target/'press-completion.json').exists()
        finally:
            if ctl and ctl.poll() is None:ctl.kill();ctl.communicate()
            a,b=outer.communicate(timeout=22)
            (target/'outer.stdout.log').write_bytes(a);(target/'outer.stderr.log').write_bytes(b)
        assert outer.returncode==0,b.decode()
        actual=target/'actual-native-wait.json'
        native=json.loads((actual if actual.exists() else target/'native-wait.json').read_text());watch=json.loads((target/'watchdog-wait.json').read_text())
        assert native['actualWait'] and watch['actualWait'] and watch['stdoutEOF'] and watch['stderrEOF'] and watch['exit']==0
        assert json.loads((target/'release.json').read_text())['nativeOutputClosed']
        results.append(dict(mode=mode,kind=kind,native=native,watchdog=watch,controllerExit=ctl.returncode,
            actualControllerWait=True,controllerBothPipeEOF=True,outerExit=outer.returncode,actualOuterWait=True,outerBothPipeEOF=True))
    (run/'results.json').write_text(json.dumps(dict(passed=True,cases=results),indent=2)+'\n')
    worker=run/'worker';worker.mkdir()
    p=subprocess.Popen([sys.executable,'-B',__file__,'--worker-supervisor',str(worker)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    a,b=p.communicate(timeout=25)
    (worker/'outer.stdout.log').write_bytes(a);(worker/'outer.stderr.log').write_bytes(b)
    assert p.returncode==0,b.decode()
    (worker/'outer-wait.json').write_text(json.dumps(dict(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True)))
    print('PASS normal install/game/quit actual process-exit completion; nonzero/crash UNKNOWN; retained identity/late callbacks/no sibling kills')
if __name__=='__main__':
    if sys.argv[1]=='--supervisor':supervisor(pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3]),int(sys.argv[4]))
    elif sys.argv[1]=='--worker-supervisor':supervisor(pathlib.Path(sys.argv[2]),None,0,worker=True)
    elif sys.argv[1]=='--controller':controller(pathlib.Path(sys.argv[2]),int(sys.argv[3]),sys.argv[4],sys.argv[5])
    else:main(pathlib.Path(sys.argv[1]).resolve())
