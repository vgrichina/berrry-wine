#!/usr/bin/env python3
"""Local Caesar III qualification; one original only after exact Git proof.

The game clock begins after compilation, sealed inheritance and authored USER
controls. No old endpoint, save, source checkout or media copy is used.
"""
import fcntl, hashlib, json, os, pathlib, select, signal, socket, subprocess, sys, threading, time, types, uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
RUN = pathlib.Path(os.environ.get('CAESAR3_RUN', ROOT/'scratch/runs/20261117-caesar3-current-native-assignment2-food'))
NATIVE_SECONDS, WATCHDOG_SECONDS, QUIT_RESERVE = 2400, 2420, 240

def sha(body): return hashlib.sha256(body).hexdigest()
def save(name, value):
    target = RUN/name
    pending = target.with_name(target.name+'.'+str(os.getpid())+'.pending')
    with pending.open('x') as f:
        json.dump(value, f, indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    os.link(pending, target); pending.unlink()
def git(*args): return subprocess.check_output(['git', *args], cwd=ROOT)
def published_module(name, revision):
    m = types.ModuleType(name.replace('/', '_'))
    m.__file__ = str(ROOT/name)
    exec(compile(git('show', revision+':'+name), m.__file__, 'exec'), m.__dict__)
    return m
def free_disk():
    s = os.statvfs('/home'); assert s.f_bavail*s.f_frsize > 1500000000
def token(pid):
    s = pathlib.Path(f'/proc/{pid}/stat').read_text()
    return s[s.rindex(')')+2:].split()[19]
def watchdog(deadline):
    save('watchdog-armed.json', dict(pid=os.getpid(), independent=True, deadline=deadline, at=time.time()))
    while time.time() < deadline:
        if (RUN/'native-wait.json').exists():
            save('watchdog-exit.json', dict(reason='actual native wait', at=time.time())); return
        time.sleep(.02)
    p = json.loads((RUN/'native-pid.json').read_text())
    sent = []
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            if token(p['pid']) == p['startToken']:
                os.killpg(p['pid'], sig); sent.append(int(sig))
        except (FileNotFoundError, ProcessLookupError): pass
        if sig == signal.SIGTERM: time.sleep(3)
    save('watchdog-exit.json', dict(reason='immutable deadline', signals=sent, at=time.time()))
def media_inventory():
    media = ROOT/'test/binaries/candidates/caesar-3-demo/installed'
    return [dict(path=str(p.relative_to(ROOT)), size=p.stat().st_size, sha256=sha(p.read_bytes()))
            for p in sorted(media.rglob('*')) if p.is_file()]

def original(env, source, module):
    free_disk()
    pins = media_inventory()
    assert next(p['sha256'] for p in pins if p['path'].endswith('/c3.exe')) == 'd7c73f21d3837b1fc465a6035f4fea6ab5a7eddf62907c72c4dd076a5193d236'
    save('media.json', dict(files=pins, recursive=True, beforeNativeClock=True, at=time.time()))
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
    start = time.time(); deadline = start+NATIVE_SECONDS
    invocation = str(uuid.uuid4())
    args = ['node', 'test/run.js', '--app=caesar3_demo', '--no-build', '--threads', '--real-ticks',
            '--native-exit-receipt='+str(RUN/'native-exit.json'), '--native-invocation-token='+invocation,
            '--screen=800x600', '--control='+str(port), '--max-seconds='+str(NATIVE_SECONDS),
            '--max-batches=1000000000', '--stuck-after=0', '--quiet-api', '--quiet-blocks', '--png-canvas']
    save('launch.json', dict(at=start, deadline=deadline, gameplayCutoff=deadline-QUIT_RESERVE,
         reserveSeconds=QUIT_RESERVE, rootPort=port, args=args, nativeSeconds=NATIVE_SECONDS,
         watchdogSeconds=WATCHDOG_SECONDS, nativeScene=True, bindingContract='native-reviewed-context-v1',
         inputPolicy=dict(confirmationMs=500, physicalUpMs=1750, observationMs=3000,
                          gameFreshnessSeconds=5, menuFreshnessSeconds=30)))
    w = subprocess.Popen([sys.executable, '-B', __file__, 'watchdog', str(start+WATCHDOG_SECONDS)],
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    p = None; cleanup = False
    try:
        while not (RUN/'watchdog-armed.json').exists():
            assert w.poll() is None; time.sleep(.01)
        p = subprocess.Popen(args, cwd=ROOT, env=env, pass_fds=(source, module),
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        info = dict(pid=p.pid, startToken=token(p.pid), port=port, invocationToken=invocation,
                    bootId=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip())
        save('native-pid.json', info)
        ends = {}; threads = []
        def drain(pipe, name):
            with (RUN/('native.'+name+'.log')).open('xb') as f:
                while b := pipe.read(65536): f.write(b); f.flush()
            ends[name] = True
        for name in ('stdout', 'stderr'):
            t = threading.Thread(target=drain, args=(getattr(p, name), name)); t.start(); threads.append(t)
        while p.poll() is None:
            if (RUN/'PERMANENT-UNKNOWN.json').exists() or (RUN/'stop-native.json').exists():
                cleanup = True
                save('native-cancellation.json', dict(at=time.time(), nativeQuit=False,
                     reason='permanent UNKNOWN' if (RUN/'PERMANENT-UNKNOWN.json').exists() else 'explicit host cleanup'))
                os.killpg(p.pid, signal.SIGTERM); break
            time.sleep(.02)
        try: rc = p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL); rc = p.wait()
        for t in threads: t.join()
        save('native-wait.json', dict(**info, exit=rc, actualWait=True, stdoutEOF=ends.get('stdout', False),
              stderrEOF=ends.get('stderr', False), atWait=time.time(), atWaitMono=time.monotonic(),
              disposition='normal' if rc==0 and not cleanup else 'cleanup', hostCleanup=cleanup))
    finally:
        if p is not None and p.poll() is None:
            os.killpg(p.pid, signal.SIGTERM); p.wait()
        if not (RUN/'native-wait.json').exists():
            save('native-wait.json', dict(actualWait=p is not None, exit=None if p is None else p.returncode, failedStartup=True))
        a, b = w.communicate(timeout=10)
        save('watchdog-wait.json', dict(pid=w.pid, exit=w.returncode, actualWait=True,
                                      stdoutEOF=True, stderrEOF=True, stdout=a.decode(), stderr=b.decode()))
    assert media_inventory() == pins, 'recursive media paths, sizes or hashes changed'
    save('media-after.json', dict(unchanged=True, files=len(pins)))
def controller():
    """One personally reviewed intent, with an independently forked UP.

    Reuse the published controller's identity, immutable review and release
    implementation from the recorded Git object, without reading foreign WIP.
    A completed frame is an observation for the next personal review, never
    automatic proof of a game objective or permission for another input.
    """
    inputs=json.loads((RUN/'runtime-inputs.json').read_text())
    m=published_module('tools/vb5cce-reviewed-control.py', inputs['gitSHA'])
    m.R=RUN; m.PORT=json.loads((RUN/'launch.json').read_text())['rootPort']
    def sourcecheck():
        assert sha(pathlib.Path(__file__).read_bytes())==inputs['sources']['tools/caesar3-current-native.py']
    m.sourcecheck=sourcecheck
    mode=sys.argv[2]
    if mode=='capture': return m.capture(sys.argv[3])
    if mode=='review': return m.review(*sys.argv[3:8])
    if mode=='bind': return m.bind(sys.argv[3])
    assert mode=='intent'
    name,scene,x,y,kind=sys.argv[3:8];x=int(x);y=int(y)
    child=None
    try:
        launch=m.reserve(kind=='quit'); rr,r=m.reviewed(scene)
        assert kind in ('install','game','quit') and r['kind']==kind
        if kind!='quit': assert not (RUN/'quit-phase.json').exists() and time.time()+3<launch['gameplayCutoff']
        owner=m.read('input-owner.json'); start=time.time(); nonce=str(uuid.uuid4())
        invocation=dict(rr['target']); assert invocation==m.identity() and m.same_live_invocation(invocation)
        save(name+'-intent.json',dict(scene=scene,x=x,y=y,kind=kind,nonce=nonce,at=start,
             confirmationDeadline=start+.5,physicalUpDeadline=start+1.75,observationDeadline=start+3))
        child=m.ArmedRelease(name,owner['owner'],start+1.4)
        ready,_,_=select.select([child.stdout],[],[],.15); assert ready,'independent release not prearmed'
        arm=json.loads(child.stdout.readline());save(name+'-release-arm.json',arm);assert arm['armed']
        command=f'keydown:{y}' if x==-1 else f'mousedown:{x}:{y}'
        guard={**owner,'nonce':nonce,'reviewed':True,'intent':dict(review=m.native_review(rr,r)),
               'deadline':int(min(start+.5,min(rr['at'],r['at'])+(5 if kind=='game' else 30))*1000)}
        m.reserve(kind=='quit');assert time.time()<start+.5
        receipt=m.call(dict(action='guarded-input',cmd=command,guard=guard),timeout=max(.001,start+.5-time.time()))
        save(name+'-down.json',dict(at=time.time(),receipt=receipt))
        assert time.time()<start+.5 and receipt['state']=='CONSUMED' and receipt['consumed'],'confirmation UNKNOWN'
        assert receipt.get('receiptBoundary') in ('native-input-return','native-button-dispatch-return')
        if receipt['receiptBoundary']=='native-input-return':
            proof=receipt['nativeMessage']
            assert proof['consumption']=='owner-user-return' and proof['nonce']==nonce and proof['token']>0
            assert proof['apiKind'] in (1,2,3) and proof['threadId']>0
        assert all(receipt.get(k)==guard[k] for k in ('owner','epoch','nonce','deadline'))
        assert start*1000<=receipt['consumedAt']<guard['deadline']
        save(name+'-up-at.json',dict(at=receipt['consumedAt']/1000+.1))
        a,b=child.communicate(timeout=max(.001,start+1.75-time.time()))
        save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,
             stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
        up=m.read(name+'-up.json');assert child.returncode==0 and up['physicalUpACK'] and up['at']<start+1.75
        assert up['reply']['owner']==owner['owner'] and receipt['consumedAt']/1000<=up['sentAt']<=up['at']
        if kind=='quit':
            while m.normal_exit(invocation,up['monotonic'],start) is None:
                assert time.time()<start+3;time.sleep(.005)
            save(name+'-native-quit.json',dict(proven=True,nativeWait=m.read('native-wait.json'),nativeExit=m.read('native-exit.json')))
        else:
            at=time.time(); image=RUN/(name+'-observed.png')
            reply=m.call(dict(action='native-reviewed-capture',path=str(image)),timeout=max(.001,start+3-time.time()))
            assert time.time()<start+3 and reply['contract']=='native-reviewed-context-v1'
            save(name+'-observed.json',dict(at=reply['startedAt']/1000,completedAt=reply['completedAt']/1000,
                 target=invocation,port=m.PORT,snapshot=reply['snapshot'],image=reply,captureId=reply['captureId'],
                 pngSHA256=sha(image.read_bytes()),captureRequestedAt=at,semanticOutcome='awaiting personal review'))
        save(name+'-completion.json',dict(at=time.time(),elapsedMs=(time.time()-start)*1000,
             limitsMs=dict(confirmation=500,physicalUp=1750,aggregate=3000),automaticObjectiveClaim=False))
        assert time.time()<start+3
    except BaseException as e:
        try:
            if child:
                try:a,b=child.communicate(timeout=2)
                except subprocess.TimeoutExpired:child.kill();a,b=child.communicate()
                if not (RUN/(name+'-release-wait.json')).exists():
                    save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,
                         stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
        finally:m.fail(name,e)
        raise
def run():
    RUN.mkdir(parents=True, exist_ok=True); free_disk()
    requested = '--original' in sys.argv
    diagnostic = '--consumer-diagnostic' in sys.argv
    working = '--working-qualification' in sys.argv
    baseline = '--consumer-baseline' in sys.argv
    assert not baseline or (working and diagnostic), 'baseline is authored working diagnosis only'
    assert not (requested and working), 'original requires published Git-only helpers'
    assert not (requested and diagnostic), 'consumer diagnosis never authorizes an original'
    revision = git('rev-parse', 'HEAD').decode().strip()
    # The imported supervisor body comes from Git, never the shared worktree.
    helper = published_module('tools/vb5cce-original-runtime.py', revision)
    helper.ROOT, helper.RUN, helper.HEAD = ROOT, RUN, revision
    helper.OWN_SOURCES = ('tools/caesar3-current-native.py', 'test/test-caesar3-current-native.cjs', 'test/run.js',
        'src/13-exports.wat','src/01-header.wat','src/09a-handlers.wat','src/09a5-handlers-window.wat',
        'src/09a5b-handlers-window-late.wat','src/09a2-handlers-console.wat',
        'lib/host-window.js','lib/guest-rpc.js','lib/cli-guarded-input.js','lib/host-import-sigs.generated.json')
    if baseline: helper.OWN_SOURCES = ('test/test-caesar3-current-native.cjs',)
    if not working:
        assert git('show', revision+':tools/caesar3-current-native.py') == pathlib.Path(__file__).read_bytes()
    def qualify(env, files, source, module, **unused):
        if diagnostic:
            if baseline: env['C3_HOST_BOUNDARY_BASELINE']='1'
            helper.checked('consumer-diagnostic', ['node', 'test/test-caesar3-current-native.cjs',
                           '--consumer-diagnostic', str(RUN/'consumer')], env, (source, module))
            save('diagnostic-completion.json', dict(completed=True, contractPassed=json.loads((RUN/'consumer/diagnostic.json').read_text())['contractPassed'],
                 safeForOriginal=False, originalStarted=False, gitSHA=revision,
                 moduleSHA256=env['DISCIPLES2_MODULE_SHA256'], at=time.time()))
            return
        # Native controls invoke only sealed JS. No mutable external Python
        # controller or original-game startup test is launched as a fixture.
        helper.checked('authored-native', ['node', 'test/test-caesar3-current-native.cjs', str(RUN/'authored')], env, (source, module))
        save('qualification.json', dict(passed=True, gitSHA=revision, originalStarted=False,
             moduleSHA256=env['DISCIPLES2_MODULE_SHA256'], at=time.time()))
        if requested: original(env, source, module)
    helper.qualify = qualify
    # Its --original option is intentionally not forwarded: this wrapper owns
    # the single Caesar invocation, media identity and fixed native deadline.
    previous = sys.argv[:]; sys.argv = [__file__]
    if working: sys.argv += ['--working-qualification']
    success = False
    try: helper.run(); success = True
    finally:
        for fd in list(helper.OWN_FDS): helper.close_owned(fd)
        save('runtime-release.json', dict(success=success, descriptorsClosed=True, at=time.time(), box=None))
        sys.argv = previous
if __name__ == '__main__':
    if len(sys.argv)>1 and sys.argv[1]=='watchdog': watchdog(float(sys.argv[2]))
    elif len(sys.argv)>1 and sys.argv[1]=='control': controller()
    else: run()
