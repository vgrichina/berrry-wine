#!/usr/bin/env python3
"""Bind a personally selected captured native BUTTON, never its parent frame.

This preflight uses public captured USER metadata only. The existing native
broker still proves the actual actor, generation and dispatch return fence.
No label selection, OCR, solver, or original installer automation lives here.
"""
import hashlib,json,os,pathlib,subprocess,sys,types,signal,uuid,fcntl
ROOT=pathlib.Path(__file__).resolve().parent.parent
LOCAL_REFUSAL=75

def transport_journal(m):
    """An unfinished or non-observational request can never justify recovery."""
    original=m.call
    def record(v):
        with (m.R/'prebind-transport.jsonl').open('a') as f:
            f.write(json.dumps(v)+'\n');f.flush();os.fsync(f.fileno())
    def call(command,*args,**kwargs):
        # bind-intent is durable before the first binding request and forever
        # excludes recovery. Keep this proof's IO off the native input clocks.
        if (m.R/'bind-intent.json').exists():return original(command,*args,**kwargs)
        token=uuid.uuid4().hex
        record(dict(token=token,phase='started',action=command.get('action')))
        result=original(command,*args,**kwargs)
        record(dict(token=token,phase='complete',action=command.get('action')))
        return result
    m.call=call

def unbound_proof(m):
    assert not (m.R/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN'
    for pattern in ('*intent.json','*owner.json','*-release-*','*-up*.json','*-down.json','*-completion.json'):
        assert not list(m.R.glob(pattern)),'prior binding, armed release or side effect'
    rows=[json.loads(s) for s in (m.R/'prebind-transport.jsonl').read_text().splitlines()]
    requests=[json.loads(s) for s in (m.R/'requests.jsonl').read_text().splitlines()]
    assert rows and len(rows)==2*len(requests),'incomplete transport proof'
    for i,request in enumerate(requests):
        a,b=rows[i*2:i*2+2]
        assert a['phase']=='started' and b==dict(a,phase='complete'),'inflight/ambiguous transport'
        assert a['action']==request['action'] and a['action'] in ('native-startup-readiness','native-reviewed-capture')
        assert request['cleanup'] is False
    ready=m.read('startup-ready.json')
    assert ready['ready'] and ready['passive'] and ready['target']==m.identity() and ready['port']==m.PORT
    return dict(target=ready['target'],port=m.PORT,requests=len(requests),
                journalSHA256=hashlib.sha256((m.R/'prebind-transport.jsonl').read_bytes()).hexdigest(),
                requestsSHA256=hashlib.sha256((m.R/'requests.jsonl').read_bytes()).hexdigest())

def local_expiry(m,scene):
    """Only the local pre-bind freshness refusal; never intercept bind errors."""
    # Validate every non-time condition first. Wrong owner, missing pixels,
    # incomplete review and ambiguous IO still take the terminal exception path.
    rr=m.read(scene+'.json');r=m.read(scene+'-review.json')
    assert r['kind'] in ('install','quit') and r['rawCompleteScene'] is True
    assert r['observation'] and r['visibleLabel'] and rr['captureId']
    assert rr['target']==m.identity() and rr['port']==m.PORT
    assert r['pngSHA256']==rr['pngSHA256']==hashlib.sha256((m.R/(scene+'.png')).read_bytes()).hexdigest()
    assert rr['image']['contract']=='native-reviewed-context-v1'
    assert rr['image']['captureId']==rr['captureId']
    assert rr['image']['pngSHA256']==rr['pngSHA256']
    assert rr['at']==rr['image']['startedAt']/1000 and rr['completedAt']==rr['image']['completedAt']/1000
    assert 0<=rr['completedAt']-rr['at']<3 and rr['completedAt']<=r['at']
    assert rr['observationStartedAt']<=rr['at']<rr['completedAt']<rr['observationDeadline']
    assert rr['observationDeadline']==rr['observationStartedAt']+3
    assert rr['snapshot']==rr['image']['snapshot'] and rr['completedAt']>=rr['at']
    p=r['buttonPreflight']
    assert preflight(rr['snapshot'],r['targetHwnd'],p['x'],p['y'],r['visibleLabel'])==p
    now=m.time.time();capture_age=now-rr['at'];review_age=now-r['at']
    assert capture_age>=0 and review_age>=0
    if capture_age<30:return False
    proof=unbound_proof(m)
    m.save('local-prebind-refusal-'+uuid.uuid4().hex+'.json',dict(
        contract='hl2-local-prebind-expiry-v1',scene=scene,at=now,
        captureAgeSeconds=capture_age,reviewAgeSeconds=review_age,**proof,
        captureSHA256=hashlib.sha256((m.R/(scene+'.json')).read_bytes()).hexdigest(),
        noBinding=True,noDispatch=True,newCompleteCaptureAndPersonalReviewRequired=True))
    return True

def verified_local_refusal(run,scene,after):
    """Supervisor accepts only this invocation's exact zero-dispatch receipt."""
    m=types.SimpleNamespace(R=pathlib.Path(run))
    m.read=lambda n:json.loads((m.R/n).read_text())
    rows=[m.read(p.name) for p in m.R.glob('local-prebind-refusal-*.json')]
    rows=[r for r in rows if r.get('scene')==scene and r.get('at',0)>=after]
    if len(rows)!=1:return False
    r=rows[0]
    if r.get('contract')!='hl2-local-prebind-expiry-v1' or r.get('captureAgeSeconds',0)<30:return False
    # Identity is proved again by the actual helper on the next capture, before HTTP.
    m.identity=lambda:r['target'];m.PORT=m.read('launch.json')['rootPort']
    proof=unbound_proof(m)
    return all(r.get(k)==v for k,v in proof.items()) and all(r.get(k) is True for k in
        ('noBinding','noDispatch','newCompleteCaptureAndPersonalReviewRequired')) and \
        r['captureSHA256']==hashlib.sha256((m.R/(scene+'.json')).read_bytes()).hexdigest()

def startup(m):
    m.reserve();target=m.identity();started=m.time.time()
    assert not (m.R/'startup-ready.json').exists(),'startup preflight is single-use'
    assert not (m.R/'input-owner.json').exists(),'startup cannot wait away a later context'
    deadline=min(started+15,m.read('launch.json')['gameplayCutoff']-3)
    polls=0
    while True:
        remaining=deadline-m.time.time();assert remaining>0,'passive startup readiness UNKNOWN'
        reply=m.call(dict(action='native-startup-readiness'),timeout=min(1,remaining));polls+=1
        assert reply['contract']=='native-startup-readiness-v1'
        with (m.R/'startup-polls.jsonl').open('a') as f:
            s=reply['snapshot']
            f.write(json.dumps(dict(at=m.time.time(),ready=reply['ready'],failures=reply['failures'],
                mainHwnd=s['mainHwnd'],modalHwnd=s['modalHwnd'],focus=s['focus'],
                focusTopLevel=s['focusTopLevel'],ordinaryOwner=reply['ordinaryOwner']))+'\n')
        if reply['ready']:
            assert m.identity()==target
            m.save('startup-ready.json',dict(startedAt=started,completedAt=m.time.time(),deadline=deadline,
                polls=polls,target=target,port=m.PORT,passive=True,**reply))
            return
        m.time.sleep(min(.02,max(0,deadline-m.time.time())))

def capture(m,name):
    """Observe a null-focus transition inside the original capture clock.

    No refused capture is retried. Readiness creates no PNG/lease/input and
    never executes guest instructions on behalf of the controller.
    """
    m.reserve();target=m.identity();started=m.time.time();deadline=started+3
    refusals=sorted(m.R.glob('local-prebind-refusal-*.json'))
    refused=None
    if refusals and not (m.R/'input-owner.json').exists():
        unbound_proof(m)
        refusal=max((m.read(p.name) for p in refusals),key=lambda r:r['at'])
        assert name!=refusal['scene'],'new complete capture required'
        assert refusal['captureSHA256']==hashlib.sha256((m.R/(refusal['scene']+'.json')).read_bytes()).hexdigest()
        refused=m.read(refusal['scene']+'.json')
        assert refused['pngSHA256']==hashlib.sha256((m.R/(refusal['scene']+'.png')).read_bytes()).hexdigest()
        assert refused['target']==target and refused['port']==m.PORT
    p=m.R/(name+'.png');assert not p.exists()
    expected=None
    if (m.R/'input-owner.json').exists():
        expected=m.read(m.read('bind-intent.json')['scene']+'.json')['snapshot']
    polls=[]
    while True:
        remaining=deadline-m.time.time();assert remaining>0,'capture readiness UNKNOWN'
        ready=m.call(dict(action='native-startup-readiness'),timeout=remaining)
        assert ready['contract']=='native-startup-readiness-v1'
        snapshot=ready['snapshot']
        if refused:
            old=refused['snapshot']
            assert snapshot['nativeProcess']==old['nativeProcess'] and snapshot['screen']==old['screen']
            assert all(snapshot['focusWindow'][k]==old['focusWindow'][k] for k in ('processId','threadId')),'changed actual owner'
        polls.append(dict(at=m.time.time(),ready=ready['ready'],failures=ready['failures'],
            mainHwnd=snapshot['mainHwnd'],modalHwnd=snapshot['modalHwnd'],focus=snapshot['focus'],
            focusTopLevel=snapshot['focusTopLevel'],ordinaryOwner=ready['ordinaryOwner']))
        with (m.R/(name+'-readiness-polls.jsonl')).open('a') as f:f.write(json.dumps(polls[-1])+'\n')
        if ready['ready']:break
        # Passive admission is diagnosed by the sealed scene module. Still
        # pin it to the actor/process/screen of the one permanent binding.
        assert expected and ready.get('nullFocusTransition'),'non-transient owner/context refusal'
        anchor=next(w for w in snapshot['windows'] if w['hwnd']==
            (snapshot['modalHwnd'] if snapshot['modalHwnd']!='0x0' else snapshot['mainHwnd']))
        assert anchor['processId']==expected['focusWindow']['processId']
        assert anchor['threadId']==expected['focusWindow']['threadId']
        assert snapshot['nativeProcess']==expected['nativeProcess'] and snapshot['screen']==expected['screen']
        m.time.sleep(min(.02,max(0,deadline-m.time.time())))
    m.save(name+'-readiness.json',dict(startedAt=started,deadline=deadline,polls=polls,passive=True))
    remaining=deadline-m.time.time();assert remaining>0,'capture readiness UNKNOWN'
    reply=m.call(dict(action='native-reviewed-capture',path=str(p)),timeout=remaining)
    assert m.time.time()<deadline and reply['contract']=='native-reviewed-context-v1'
    assert target==m.identity()
    if refused:
        assert reply['captureId']!=refused['captureId'],'old capture cannot be reused'
        old=refused['snapshot'];new=reply['snapshot']
        assert new['nativeProcess']==old['nativeProcess'] and new['screen']==old['screen']
        assert all(new['focusWindow'][k]==old['focusWindow'][k] for k in ('processId','threadId')),'changed actual owner'
    m.save(name+'.json',dict(at=reply['startedAt']/1000,completedAt=reply['completedAt']/1000,
        target=target,port=m.PORT,snapshot=reply['snapshot'],image=reply,captureId=reply['captureId'],
        pngSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),observationStartedAt=started,observationDeadline=deadline))
    print(p)

def preflight(snapshot,target,x,y,label):
    rows=snapshot['windows'];matches=[w for w in rows if w['hwnd']==target]
    assert len(matches)==1,'target must be one captured native control'
    button=matches[0]
    assert button['controlClass']==1 and button['isChild'],'target must be native BUTTON, not frame'
    assert button['live'] and button['visible'] and not button['style']&0x08000000,'unavailable BUTTON'
    assert button['generation'] not in ('0','',None) and button['nativeTextAvailable']
    assert button['title']==label,'reviewed visible caption differs'
    assert button['processId']==snapshot['focusWindow']['processId']
    assert button['threadId']==snapshot['focusWindow']['threadId'],'wrong actual owner'
    top=snapshot['modalHwnd'] if snapshot['modalHwnd']!='0x0' else snapshot['mainHwnd']
    assert snapshot['focusTopLevel']==top and snapshot['physicalUp'] and snapshot['capture']=='0x0'
    chain=[];row=button
    while row['hwnd']!=top:
        assert row['hwnd'] not in chain and row['live'] and row['visible'],'invalid captured ancestry'
        assert row['processId']==button['processId'] and row['threadId']==button['threadId']
        chain.append(row['hwnd'])
        parents=[w for w in rows if w['hwnd']==row['parent']];assert len(parents)==1
        row=parents[0]
    assert row['live'] and row['visible'] and not row['isChild']
    mapping=snapshot['pointerMapping']
    assert all(mapping.get(k) is None for k in ('transform','viewport','clip')),'unsupported presentation mapping'
    assert mapping['canvas']==snapshot['screen']
    assert type(x) is int and type(y) is int
    assert 0<=x<snapshot['screen']['w'] and 0<=y<snapshot['screen']['h']
    assert button['screenX']<=x<button['screenX']+button['w']
    assert button['screenY']<=y<button['screenY']+button['h'],'pointer outside actual BUTTON'
    return dict(targetHwnd=target,generation=button['generation'],processId=button['processId'],
                threadId=button['threadId'],parent=button['parent'],top=top,chain=chain,
                x=x,y=y,nativeDispatchFenceRequired=True)

def receipt_clock_body(body):
    """Charge native confirmation through response arrival, before durable IO.

    The borrowed Git blob stays pinned. This single explicit adaptation leaves
    consumption, independent UP, aggregate and permanent UNKNOWN checks intact.
    """
    before=b"""        save(name+'-down.json',dict(at=time.time(),receipt=receipt))
        assert time.time()<start+.5 and receipt['state']=='CONSUMED' and receipt['consumed'],'confirmation UNKNOWN'
"""
    after=b"""        confirmation_at=time.time()
        save(name+'-down.json',dict(at=confirmation_at,receipt=receipt))
        assert confirmation_at<start+.5 and receipt['state']=='CONSUMED' and receipt['consumed'],'confirmation UNKNOWN'
"""
    assert body.count(before)==1,'pinned receipt clock adaptation no longer matches'
    return body.replace(before,after)

def controller():
    run=pathlib.Path(os.environ['DELPHI5_RUN']);pins=json.loads((run/'runtime-inputs.json').read_text())
    helper_name='tools/vb5cce-reviewed-control.py'
    body=subprocess.check_output(['git','show',pins['gitSHA']+':'+helper_name],cwd=ROOT)
    assert hashlib.sha256(body).hexdigest()==pins['sources'][helper_name]
    m=types.ModuleType('hl2_pinned_control');m.__file__=str(ROOT/helper_name)
    exec(compile(receipt_clock_body(body),m.__file__,'exec'),m.__dict__)
    def sourcecheck():
        # The borrowed controller above was compiled from this exact Git blob,
        # not imported from its concurrently leased mutable checkout path.
        assert hashlib.sha256(body).hexdigest()==pins['sources'][helper_name]
        assert hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()==pins['sources']['tools/halflife2-reviewed-next.py']
    m.sourcecheck=sourcecheck
    # An exclusive operation lock prevents a capture/refusal proof racing a bind.
    lock=(m.R/'controller-operation.lock').open('a')
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    transport_journal(m)
    reviewed=m.reviewed
    def checked(scene):
        rr,r=reviewed(scene)
        p=r['buttonPreflight']
        assert preflight(rr['snapshot'],r['targetHwnd'],p['x'],p['y'],r['visibleLabel'])==p
        return rr,r
    m.reviewed=checked
    mode=sys.argv[1]
    def cancelled(signum,frame):
        raise SystemExit(128+signum)
    # Unwind through intent's existing independent-release drain on TERM/INT.
    for sig in (signal.SIGTERM,signal.SIGINT):signal.signal(sig,cancelled)
    try:
        if mode=='startup':startup(m)
        elif mode=='capture':
            ready=m.read('startup-ready.json')
            assert ready['ready'] and ready['passive'] and ready['target']==m.identity() and ready['port']==m.PORT
            capture(m,sys.argv[2])
        elif mode=='review':
            scene,description,label,kind,target,x,y=sys.argv[2:9]
            assert kind in ('install','quit')
            rr=m.read(scene+'.json');assert m.hashlib.sha256((m.R/(scene+'.png')).read_bytes()).hexdigest()==rr['pngSHA256']
            p=preflight(rr['snapshot'],target,int(x),int(y),label)
            m.save(scene+'-review.json',dict(at=m.time.time(),rawCompleteScene=True,observation=description,
                 visibleLabel=label,kind=kind,targetHwnd=target,pngSHA256=rr['pngSHA256'],buttonPreflight=p))
        elif mode=='bind':
            m.reserve()
            if local_expiry(m,sys.argv[2]):return LOCAL_REFUSAL
            m.bind(sys.argv[2])
        elif mode=='intent':
            name,scene,x,y,kind=sys.argv[2:7];rr,r=checked(scene)
            assert (int(x),int(y))==(r['buttonPreflight']['x'],r['buttonPreflight']['y'])
            m.intent(name,scene,int(x),int(y),kind)
        else:raise AssertionError('unsupported finite control operation')
    except BaseException as e:m.fail('hl2-button-preflight',e);raise

if __name__=='__main__':sys.exit(controller())
