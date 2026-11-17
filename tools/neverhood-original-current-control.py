#!/usr/bin/env python3
"""Personal complete-scene reviews and single finite ordinary UI intents.

One permanent binding. UNKNOWN closes all later requests. Only proved local
image expiry before dispatch permits explicit fresh capture and review. An
independently prearmed release may finish its original cleanup. No replay.
"""
import hashlib, json, multiprocessing, os, pathlib, select, subprocess, sys, time, traceback, urllib.request, uuid
R=pathlib.Path(os.environ['NEVERHOOD_CURRENT_RUN'])
PORT=int(os.environ['NEVERHOOD_CURRENT_PORT'])
ROOT_PORT=lambda:read('launch.json').get('rootPort',45761)
def owner_file():return 'child-input-owner.json' if (R/'child-target.json').exists() and PORT==read('child-target.json')['port'] else 'input-owner.json'
def startup_file():return 'child-startup-ready.json' if owner_file()=='child-input-owner.json' else 'startup-ready.json'
def read(n):return json.loads((R/n).read_text())
def save(n,v):
    target=R/n;pending=target.with_name(target.name+'.'+str(os.getpid())+'.pending')
    with pending.open('x') as f:json.dump(v,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
    # Publish a complete file without overwriting any earlier record.
    os.link(pending,target);pending.unlink()
def fail(name,e):
    if not (R/'PERMANENT-UNKNOWN.json').exists():save('PERMANENT-UNKNOWN.json',dict(name=name,error=str(e),at=time.time(),noLaterRequests=True))
class RefusedBeforeDispatch(Exception):
    """Only an expired local image, before any publication by this operation."""
    pass
def latest_refusal():
    return max((read(p.name)['at'] for p in R.glob('*-refused.json')),default=0)
def publication_state():
    names={p.name for pattern in ('*-intent.json','*-release-arm.json','*-child-arm.json') for p in R.glob(pattern)}
    for name in names:
        if name in ('bind-intent.json','child-bind-intent.json'):
            assert (R/('input-owner.json' if name=='bind-intent.json' else 'child-input-owner.json')).exists(),'pending bind intent'
        else:
            suffix=next(s for s in ('-release-arm.json','-child-arm.json','-intent.json') if name.endswith(s))
            assert (R/(name[:-len(suffix)]+'-completion.json')).exists(),'pending intent/arm'
    ledger=R/'requests.jsonl'
    return (ledger.read_bytes() if ledger.exists() else b'',sorted(names))
def local_operation():
    assert not (R/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; no later requests'
    return dict(nonce=str(uuid.uuid4()),publication=publication_state())
def refuse_expired(scene,rr,operation):
    assert operation is not None and publication_state()==operation['publication'],'publication prevents local refusal'
    assert not (R/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; no recovery'
    record=dict(outcome='REFUSED_BEFORE_DISPATCH',reason='LOCAL_IMAGE_EXPIRED',at=time.time(),
        scene=scene,captureId=rr['captureId'],pngSHA256=rr['pngSHA256'],invalidatedNonce=operation['nonce'],
        reviewInvalidated=True,zeroTransport=True,zeroActionIntentArmPublication=True,
        recovery='explicit fresh native whole-image capture and new personal review only')
    save(scene+'-refused.json',record)
    raise RefusedBeforeDispatch(json.dumps(record))
def sourcecheck():
    manifest=read('runtime-inputs.json')
    root=pathlib.Path(__file__).resolve().parent.parent
    pins={row['path']:row['sha256'] for row in manifest['sources']}
    for n in ('tools/neverhood-original-current-control.py','tools/neverhood-original-current-runtime.py'):
        assert hashlib.sha256((root/n).read_bytes()).hexdigest()==pins[n], 'owned source changed: '+n

def reserve(quit=False):
    assert not (R/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; no later requests'
    sourcecheck()
    launch=read('launch.json');assert launch['gameplayCutoff']==launch['deadline']-launch['reserveSeconds']
    if time.time()>=launch['gameplayCutoff'] or quit:
        if not (R/'quit-phase.json').exists():save('quit-phase.json',dict(at=time.time(),irreversible=True))
    assert time.time()+3<launch['deadline']
    return launch
def identity():
    info=read('native-pid.json')
    if PORT!=ROOT_PORT():
        target=read('child-target.json')
        assert target['authenticatedBeforeDeadline'] and target['port']==PORT
        directory=pathlib.Path(target['arm']).parent
        assert not (directory/'failure.json').exists(),'child lifecycle failed'
        assert not (directory/'child-dead.json').exists() and not (directory/'child-wait.json').exists(),'child already dead'
        info=target['child']
    return listener_identity(info,PORT)
def listener_identity(info,port):
    s=pathlib.Path(f"/proc/{info['pid']}/stat").read_text();assert s[s.rindex(')')+2:].split()[19]==info['startToken']
    assert s[s.rindex(')')+2:].split()[0] not in ('Z','X'),'dead process'
    if info.get('bootId'):assert pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip()==info['bootId']
    # Read TCP before FDs: a newly listening socket can enter both between
    # reads. The qualified ownership check must not reverse that ordering.
    rows=[x.split() for x in pathlib.Path('/proc/net/tcp').read_text().splitlines()[1:]]
    owned=[x[9] for x in rows if x[1]=='0100007F:'+format(port,'04X') and x[3]=='0A']
    sockets=set()
    for p in pathlib.Path(f"/proc/{info['pid']}/fd").iterdir():
        try:sockets.add(str(p.readlink()))
        except FileNotFoundError:pass
    assert len(owned)==1 and 'socket:['+owned[0]+']' in sockets
    return info
def call(command,timeout=1,cleanup=False,target=None,port=None):
    assert not (R/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; no later requests'
    if target is None:identity();port=PORT
    else:listener_identity(target,port)
    with (R/'requests.jsonl').open('a') as log:
        log.write(json.dumps(dict(at=time.time(),action=command.get('action'),port=port,cleanup=cleanup))+'\n')
    req=urllib.request.Request(f'http://127.0.0.1:{port}/ctl',data=json.dumps(command).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=timeout) as f:r=json.load(f)
    assert r.get('ok'),r
    return r['value']
def startup():
    """Passive public USER/ordinary actor readiness, before any capture clock."""
    try:
        launch=reserve();target=identity()
        assert not (R/owner_file()).exists(),'startup cannot rebind an input owner'
        if (R/startup_file()).exists():
            assert read(startup_file())['target']==target
            return
        started=time.time();deadline=min(started+30,launch['gameplayCutoff'])
        polls=0
        while True:
            remaining=deadline-time.time();assert remaining>0,'startup readiness UNKNOWN'
            reply=call(dict(action='native-startup-readiness'),timeout=min(1,remaining));polls+=1
            assert reply['contract']=='native-startup-readiness-v1'
            with (R/'startup-polls.jsonl').open('a') as log:
                log.write(json.dumps(dict(at=time.time(),ready=reply['ready'],failures=reply['failures']))+'\n')
            if reply['ready']:
                assert not reply['failures'] and reply['ordinaryOwner']['healthy'] and reply['ordinaryOwner']['actorContext']
                assert time.time()<deadline
                save(startup_file(),dict(startedAt=started,completedAt=time.time(),deadline=deadline,
                    target=target,port=PORT,polls=polls,native=reply,separateFromCapture=True))
                return
            time.sleep(min(.01,max(0,deadline-time.time())))
    except BaseException as e:fail('startup',e);raise
def capture(name):
    try:
        reserve()
        if not (R/owner_file()).exists():startup()
        target=identity();at=time.time()
        p=R/(name+'.png');assert not p.exists()
        while True:
            remaining=at+3-time.time();assert remaining>0,'initial presentation UNKNOWN'
            reply=call(dict(action='native-presentation-capture',path=str(p)),timeout=remaining)
            if reply.get('contract')!='native-presentation-pending-v1':break
            assert reply['pending']
            time.sleep(min(.005,max(0,at+3-time.time())))
        assert time.time()-at<3
        assert reply['contract']=='native-reviewed-context-v1'
        save(name+'.json',dict(at=reply['startedAt']/1000,completedAt=reply['completedAt']/1000,
            target=target,port=PORT,snapshot=reply['snapshot'],image=reply,captureId=reply['captureId'],
            pngSHA256=hashlib.sha256(p.read_bytes()).hexdigest()))
        print(p)
    except BaseException as e:fail(name,e);raise
def context(s):
    return {k:s[k] for k in ('mainHwnd','windows','modalHwnd','focus','focusTopLevel','focusWindow',
                            'capture','physicalUp','nativeProcess','nativeMessageBox','screen')}
def presented(s,actor=None):
    # DialogBox publishes its HWND before WM_INITDIALOG/ShowWindow finishes.
    # A changed USER graph is not yet a presented scene. Only defer observation;
    # never relax native capture validation or extend the original 3000ms bound.
    modal=s['modalHwnd']
    if modal=='0x0':return True
    matches=[w for w in s['windows'] if w['hwnd']==modal]
    if len(matches)!=1:return False
    w=matches[0]
    return (w['live'] and w['visible'] and not w['isChild'] and
        (actor is None or all(w[k]==actor[k] for k in ('processId','threadId'))))
def button(rr,r):
    s=rr['snapshot']
    matches=[w for w in s['windows'] if w['hwnd']==r['targetHwnd']]
    assert len(matches)==1,'unique actual target required'
    w=matches[0]
    assert w['live'] and w['visible'] and w['generation'] and w['processId'] and w['threadId']
    assert s['physicalUp'] and s['capture']=='0x0','capture or held physical input'
    if r['kind']!='game' or w.get('isChild'):
        assert w.get('isChild') and w.get('controlClass')==1,'actual BUTTON child required'
        assert not (w['style']&0x08000000),'disabled BUTTON'
        assert w.get('nativeTextAvailable') is True and w.get('textBytes') is not None
        assert w['title'].replace('&','').strip()==r['visibleLabel'].replace('&','').strip(),'BUTTON label differs'
        assert w['parent']!='0x0' and w.get('buttonFlags') is not None
    return w
def review(scene,description,label,kind,target):
    assert not (R/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; no later review'
    assert not (R/(scene+'-refused.json')).exists(),'capture and review invalidated'
    rr=read(scene+'.json')
    assert rr['at']>latest_refusal(),'fresh native capture required before a new review'
    assert hashlib.sha256((R/(scene+'.png')).read_bytes()).hexdigest()==rr['pngSHA256']
    record=dict(at=time.time(),rawCompleteScene=True,observation=description,
         visibleLabel=label,kind=kind,targetHwnd=target,pngSHA256=rr['pngSHA256'])
    button(rr,record)
    save(scene+'-review.json',record)
def reviewed(scene,operation=None,kind=None,point=None):
    assert not (R/(scene+'-refused.json')).exists(),'capture and review invalidated'
    rr=read(scene+'.json');r=read(scene+'-review.json')
    freshness=15 if r['kind']=='game' else 30
    assert rr['target']==identity() and rr['port']==PORT and r['rawCompleteScene'] and r['observation'] and r['visibleLabel']
    assert r['pngSHA256']==rr['pngSHA256']==hashlib.sha256((R/(scene+'.png')).read_bytes()).hexdigest()
    w=button(rr,r)
    if kind is not None:assert r['kind']==kind,'review kind differs'
    if point is not None and point[0]!=-1:
        x,y=point
        assert w['x']<=x<w['x']+w['w'] and w['y']<=y<w['y']+w['h'],'point outside reviewed target'
    latest=latest_refusal()
    if latest:
        assert rr['at']>latest and r['at']>=rr['completedAt'],'fresh capture and new review required'
    age=time.time()-rr['at'];review_age=time.time()-r['at']
    assert age>=0 and review_age>=0,'invalid image/review clock'
    if age>=freshness:refuse_expired(scene,rr,operation)
    assert review_age<freshness,'review expired'
    return rr,r
def native_review(rr,r):
    return dict(contract='native-reviewed-context-v1',captureId=rr['captureId'],pngSHA256=rr['pngSHA256'],
        reviewed=True,reviewedAt=r['at']*1000,scope='game' if r['kind']=='game' else 'menu',targetHwnd=r['targetHwnd'])
def bind(scene):
    try:
        operation=local_operation()
        reserve();assert not (R/owner_file()).exists()
        rr,r=reviewed(scene,operation)
        save('bind-intent.json' if PORT==ROOT_PORT() else 'child-bind-intent.json',dict(scene=scene,at=time.time(),permanent=True))
        reply=call(dict(action='guarded-bind',reviewedScene=native_review(rr,r)))
        save(owner_file(),reply)
    except RefusedBeforeDispatch:raise
    except BaseException as e:fail('bind',e);raise
def release(name,owner,due,deadline=None):
    assert not (R/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; no later requests'
    latest=latest_refusal()
    if latest:assert read(name+'-intent.json')['at']>latest,'fresh reviewed intent required before release'
    deadline=due+.35 if deadline is None else deadline
    print(json.dumps(dict(armed=True,pid=os.getpid(),due=due)),flush=True)
    while time.time()<due:
        p=R/(name+'-up-at.json')
        if p.exists():
            try:due=min(due,read(p.name)['at'])
            except (OSError,ValueError,KeyError):pass # Original finite fallback remains armed.

        time.sleep(min(.003,max(0,due-time.time())))
    try:
        sent=time.time();remaining=deadline-sent;assert remaining>0,'physical UP deadline'
        reply=call(dict(action='guarded-release',owner=owner),timeout=remaining,cleanup=True)
        assert time.time()<deadline,'physical UP deadline'
        save(name+'-up.json',dict(at=time.time(),sentAt=sent,monotonic=time.monotonic(),reply=reply,physicalUpACK=reply.get('released') is True))
    except BaseException as e:save(name+'-up.json',dict(at=time.time(),error=str(e),physicalUpACK=False));raise
def release_process(name,owner,due,deadline,stdout_read,stdout_write,stderr_read,stderr_write):
    os.close(stdout_read);os.close(stderr_read)
    os.dup2(stdout_write,1);os.dup2(stderr_write,2)
    os.close(stdout_write);os.close(stderr_write)
    try:release(name,owner,due,deadline)
    except BaseException:
        traceback.print_exc();sys.stderr.flush();raise SystemExit(1)
class ArmedRelease:
    """Independent forked process: no second Python import/startup on DOWN's path.

    Keep actual join and pipe EOF evidence, with the same absolute deadlines.
    The controller is single-threaded and has closed all earlier HTTP requests.
    """
    def __init__(self,name,owner,due,deadline):
        out_r,out_w=os.pipe();err_r,err_w=os.pipe()
        sys.stdout.flush();sys.stderr.flush()
        self.process=multiprocessing.get_context('fork').Process(target=release_process,
            args=(name,owner,due,deadline,out_r,out_w,err_r,err_w))
        self.process.start();self.pid=self.process.pid;self.returncode=None;self.result=None
        os.close(out_w);os.close(err_w)
        self.stdout=os.fdopen(out_r,'rb',buffering=0);self.stderr=os.fdopen(err_r,'rb',buffering=0)
    def communicate(self,timeout=None):
        if self.result is not None:return self.result
        self.process.join(timeout)
        if self.process.is_alive():raise subprocess.TimeoutExpired('independent physical release',timeout)
        self.returncode=self.process.exitcode
        self.result=(self.stdout.read(),self.stderr.read())
        self.stdout.close();self.stderr.close();self.process.close()
        return self.result
    def kill(self):self.process.kill()
def child_records(arm):
    assert not (R/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; no later observation'
    directory=pathlib.Path(arm['directory'])
    assert json.loads((directory/'armed.json').read_text())==arm
    assert not (directory/'failure.json').exists(),'child lifecycle failed'
    assert not (directory/'child-dead.json').exists() and not (directory/'child-wait.json').exists(),'child already dead'
    parent=json.loads((directory/'parent-exit.json').read_text()) if (directory/'parent-exit.json').exists() else None
    if parent:
        assert parent['token']==arm['token'] and parent['parent']==arm['parent'] and parent['exitCode']==0,'parent failure'
    if not all((directory/n).exists() for n in ('spawned.json','ready.json')):return None
    spawned=json.loads((directory/'spawned.json').read_text());ready=json.loads((directory/'ready.json').read_text())
    for row in (spawned,ready):
        assert row['contract']==arm['contract'] and row['token']==arm['token'] and row['parent']==arm['parent']
        assert row['guestExe']==arm['guestExe'] and arm['armedAt']<=row['at']<arm['deadline'],'late/wrong child'
    assert spawned['inputs']==arm['inputs']
    assert ready['child']==spawned['child'] and ready['child']['pid']!=arm['parent']['pid']
    assert ready['port']==arm['port']
    assert ready['inputs']==dict(arm['inputs'],executableSHA256=arm['executableSHA256']),'child source/module mismatch'
    listener_identity(ready['child'],ready['port'])
    return ready,parent
def observe_child(name,arm,start):
    while True:
        assert time.time()<start+3,'child observation UNKNOWN'
        records=child_records(arm)
        if not records:time.sleep(.003);continue
        ready,parent=records
        reply=call(dict(action='native-child-attest',token=arm['token'],nonce=arm['nonce']),
            timeout=max(.001,start+3-time.time()),target=ready['child'],port=ready['port'])
        assert reply['contract']==arm['contract'] and reply['token']==arm['token'] and reply['nonce']==arm['nonce']
        assert reply['child']==ready['child'] and reply['inputs']==ready['inputs']
        native=reply['readiness'];s=native['snapshot']
        assert s['nativeProcess']==dict(pid=ready['child']['pid'],executable=arm['guestExe'])
        if not native['ready']:
            time.sleep(.003);continue
        assert not native['failures'] and native['ordinaryOwner']['healthy'] and native['ordinaryOwner']['actorContext'],'wrong child actor'
        if parent is None:time.sleep(.003);continue
        image=R/(name+'-after.png')
        cap=call(dict(action='native-presentation-capture',path=str(image)),
            timeout=max(.001,start+3-time.time()),target=ready['child'],port=ready['port'])
        if cap.get('contract')=='native-presentation-pending-v1':
            assert cap['pending'];time.sleep(.003);continue
        assert cap['contract']=='native-reviewed-context-v1' and cap['snapshot']['physicalUp']
        assert cap['snapshot']['nativeProcess']==s['nativeProcess']
        assert time.time()<start+3
        child_records(arm) # A child/parent failure during capture is terminal too.
        digest=hashlib.sha256(image.read_bytes()).hexdigest()
        save('child-target.json',dict(contract=arm['contract'],child=ready['child'],port=ready['port'],
             inputs=ready['inputs'],authenticatedBeforeDeadline=True,at=time.time(),deadline=start+3,
             arm=str(pathlib.Path(arm['directory'])/'armed.json'),token=arm['token'],parentExit=parent))
        save(name+'-after.json',dict(at=cap['startedAt']/1000,completedAt=cap['completedAt']/1000,
             target=ready['child'],port=ready['port'],snapshot=cap['snapshot'],image=cap,captureId=cap['captureId'],pngSHA256=digest))
        save(name+'-observation.json',dict(at=time.time(),authenticatedChild=True,child=ready,
             parentExit=parent,attestation=reply,image=cap,pngSHA256=digest,noPostInputParentSnapshot=True))
        return
def intent(name,scene,x,y,kind,handoff=None):
    child=None
    try:
        operation=local_operation()
        launch=reserve(kind=='quit')
        assert kind in ('install','game','quit')
        if kind!='quit':assert not (R/'quit-phase.json').exists() and time.time()+3<launch['gameplayCutoff']
        assert not (R/'PERMANENT-UNKNOWN.json').exists()
        owner=read(owner_file())
        rr,r=reviewed(scene,operation,kind,(x,y))
        nonce=operation['nonce'];start=time.time()
        # The retained personally reviewed full image is immutable. Native
        # verification checks every public semantic control, not repaint bytes.
        w=button(rr,r)
        if x!=-1:assert w['x']<=x<w['x']+w['w'] and w['y']<=y<w['y']+w['h'],'point outside reviewed target'
        command=f'keydown:{y}' if x==-1 else f'mousedown:{x}:{y}'
        save(name+'-intent.json',dict(scene=scene,x=x,y=y,kind=kind,owner=owner,nonce=nonce,
             at=start,confirmationDeadline=start+.5,physicalUpDeadline=start+1.75,observationDeadline=start+3))
        child=ArmedRelease(name,owner['owner'],start+1.4,start+1.75)
        ready,_,_=select.select([child.stdout],[],[],.15);assert ready,'release was not prearmed'
        arm=json.loads(child.stdout.readline());save(name+'-release-arm.json',arm);assert arm['armed']
        if handoff:
            assert PORT==ROOT_PORT() and not (R/'child-target.json').exists(),'one ordinary launcher handoff only'
            guestExe,exeHash=handoff
            handoff=call(dict(action='native-child-arm',**{k:owner[k] for k in ('owner','epoch','identity')},
                reviewedScene=native_review(rr,r),nonce=nonce,deadline=int((start+3)*1000),
                releaseDeadline=int((start+1.75)*1000),directory=str(R/(name+'-child-lifecycle')),
                guestExe=guestExe,executableSHA256=exeHash,port=launch['childPort']),timeout=max(.001,start+.5-time.time()))
            save(name+'-child-arm.json',handoff)
        reserve(kind=='quit');assert time.time()<start+.5
        receipt=call(dict(action='guarded-input',cmd=command,guard={**owner,'nonce':nonce,
             'reviewed':True,'intent':dict(review=native_review(rr,r)),
             'deadline':int(min(start+.5,min(rr['at'],r['at'])+(15 if kind=='game' else 30))*1000)}),timeout=max(.001,start+.5-time.time()))
        save(name+'-down.json',dict(at=time.time(),receipt=receipt))
        assert time.time()<start+.5 and receipt['state']=='CONSUMED' and receipt['consumed'],'confirmation UNKNOWN'
        assert all(receipt.get(k)==v for k,v in dict(owner=owner['owner'],epoch=owner['epoch'],nonce=nonce).items())
        assert start*1000<=receipt['consumedAt']<min((start+.5)*1000,(min(rr['at'],r['at'])+(15 if kind=='game' else 30))*1000),'late consumption'
        if receipt.get('receiptBoundary')=='native-button-dispatch-return':
            native=receipt['nativeMessage']
            assert native['hwnd']==int(w['hwnd'],16) and str(native['generation'])==str(w['generation'])
            assert native['processId']==w['processId'] and native['threadId']==w['threadId']
        save(name+'-up-at.json',dict(at=receipt['consumedAt']/1000+.1))
        out,err=child.communicate(timeout=max(.001,start+1.75-time.time()))
        save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
        up=read(name+'-up.json');assert child.returncode==0 and up['physicalUpACK'] and up['at']<start+1.75
        assert up['reply'].get('owner')==owner['owner'] and receipt['consumedAt']/1000<=up['sentAt']<=up['at']
        if handoff:
            observe_child(name,handoff,start)
        # Acknowledgement proves input consumption only. Observe a later scene.
        # Observe the actual transition immediately. There is no minimum
        # completion delay: 3000ms bounds the entire intent and its evidence.
        while not handoff:
            assert time.time()<start+3,'aggregate observation UNKNOWN'
            if PORT!=ROOT_PORT() and kind=='quit':
                target=read('child-target.json');directory=pathlib.Path(target['arm']).parent
                assert not (directory/'failure.json').exists(),'child native failure'
                if (directory/'child-wait.json').exists():
                    wait=json.loads((directory/'child-wait.json').read_text())
                    guest=json.loads((directory/'child-exit.json').read_text())
                    rows=[json.loads(p.read_text()) for p in (R/'children').glob('*-wait.json')]
                    rows=[r for r in rows if r['pid']==target['child']['pid']]
                    assert wait['child']==target['child'] and wait['exit']==0 and wait['signal'] is None
                    assert all(wait[k] for k in ('actualWait','stdoutEOF','stderrEOF'))
                    assert guest['child']==target['child'] and guest['token']==target['token'] and guest['exitCode']==0
                    assert up['monotonic']<=guest['atExitMono']
                    if len(rows)==1 and all(rows[0].get(k) for k in ('actualWait','stdoutEOF','stderrEOF','closed')):
                        assert rows[0]['exit']==0 and rows[0]['signal'] is None
                        save(name+'-observation.json',dict(at=time.time(),nativeChildWait=rows[0],nativeChildExit=guest,noPostExitRequest=True));break
                time.sleep(.005);continue
            waited=R/'native-wait.json'
            if waited.exists():
                native=read('native-wait.json');assert kind=='quit' and native['actualWait'] and native['exit']==0
                info=read('native-pid.json')
                if info.get('invocationToken'):
                    guest=read('native-exit.json')
                    assert not (R/'native-exit.json.cancelled').exists()
                    assert guest['contract']=='native-process-exit-v1' and guest['exitCode']==0
                    assert all(guest[k]==info[k]==native[k] for k in ('pid','startToken','invocationToken','bootId'))
                    assert up['monotonic']<=guest['atExitMono']<=native['atWaitMono']
                save(name+'-observation.json',dict(at=time.time(),nativeWait=native,noPostExitRequest=True))
                break
            if kind=='quit':
                time.sleep(.005);continue # Quit is proved by parent wait, never a request to a retiring endpoint.
            if not pathlib.Path(f"/proc/{read('native-pid.json')['pid']}").exists():
                time.sleep(.005);continue # Parent still drains pipes/publishes its actual wait.
            after=call(dict(action='snapshot'),timeout=max(.001,start+3-time.time()))
            if after['physicalUp'] and not presented(after,w):
                if not (R/(name+'-pending-presentation.json')).exists():
                    save(name+'-pending-presentation.json',dict(at=time.time(),snapshot=after,originalObservationDeadline=start+3))
                time.sleep(.005);continue
            if after['physicalUp'] and (kind=='game' or context(after)!=context(rr['snapshot'])):
                image=R/(name+'-after.png')
                cap=call(dict(action='native-presentation-capture',path=str(image)),timeout=max(.001,start+3-time.time()))
                if cap.get('contract')=='native-presentation-pending-v1':
                    assert cap['pending']
                    if not (R/(name+'-atomic-pending.json')).exists():
                        save(name+'-atomic-pending.json',dict(at=time.time(),reply=cap,originalObservationDeadline=start+3))
                    time.sleep(.005);continue
                assert cap['contract']=='native-reviewed-context-v1' and cap['snapshot']['physicalUp']
                save(name+'-observation.json',dict(at=time.time(),snapshot=after,image=cap,pngSHA256=hashlib.sha256(image.read_bytes()).hexdigest()));break
            time.sleep(.005)
        assert time.time()<start+3
        save(name+'-completion.json',dict(at=time.time(),elapsedMs=(time.time()-start)*1000,limitsMs=dict(confirmation=500,physicalUp=1750,aggregate=3000)))
        assert time.time()<start+3
        print(json.dumps(dict(completedAt=time.time(),elapsedMs=(time.time()-start)*1000,
              durableEvidencePublished=True,aggregateGuardPassed=True)),flush=True)
        assert time.time()<start+3
    except RefusedBeforeDispatch:raise
    except BaseException as e:
        try:
            if child:
                try:out,err=child.communicate(timeout=2)
                except subprocess.TimeoutExpired:
                    child.kill();out,err=child.communicate()
                if not (R/(name+'-release-wait.json')).exists():save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
        finally:
            # Drain the prearmed finite physical release BEFORE publishing the
            # terminal latch. Once UNKNOWN is visible even cleanup cannot request.
            fail(name,e)
        raise
def main():
    mode=sys.argv[1]
    if mode=='startup':startup()
    elif mode=='capture':capture(sys.argv[2])
    elif mode=='review':review(*sys.argv[2:7])
    elif mode=='bind':bind(sys.argv[2])
    elif mode=='intent':intent(sys.argv[2],sys.argv[3],int(sys.argv[4]),int(sys.argv[5]),sys.argv[6])
    elif mode=='review-intent':
        scene,description,label,kind,target,name,x,y=sys.argv[2:10]
        review(scene,description,label,kind,target)
        if not (R/owner_file()).exists():bind(scene)
        intent(name,scene,int(x),int(y),kind)
    elif mode=='play-handoff':
        scene,description,label,kind,target,name,x,y,guestExe,exeHash=sys.argv[2:12]
        review(scene,description,label,kind,target)
        if not (R/owner_file()).exists():bind(scene)
        intent(name,scene,int(x),int(y),kind,(guestExe,exeHash))
    elif mode=='release':release(sys.argv[2],sys.argv[3],float(sys.argv[4]))

if __name__=='__main__':
    try:main()
    except RefusedBeforeDispatch as e:
        print(str(e),flush=True)
        raise SystemExit(3)

