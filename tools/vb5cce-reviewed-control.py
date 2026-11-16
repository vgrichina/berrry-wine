#!/usr/bin/env python3
"""Personal complete-scene reviews and single finite ordinary UI intents.

One permanent binding. UNKNOWN closes all later requests. An independently
prearmed release may finish its original cleanup. No replay, rebind or solver.
"""
import hashlib, json, multiprocessing, os, pathlib, select, subprocess, sys, time, traceback, urllib.request, uuid
R=pathlib.Path(os.environ.get('DELPHI5_RUN',pathlib.Path(__file__).resolve().parent.parent/'scratch/runs/20261116-vb5cce-reviewed-context-install-ide'))
PORT=int(os.environ.get('DELPHI5_PORT','45761'))
def read(n):return json.loads((R/n).read_text())
def save(n,v):
    target=R/n;pending=target.with_name(target.name+'.'+str(os.getpid())+'.pending')
    with pending.open('x') as f:json.dump(v,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
    # Publish a complete file without overwriting any earlier record.
    os.link(pending,target);pending.unlink()
def fail(name,e):
    if not (R/'PERMANENT-UNKNOWN.json').exists():save('PERMANENT-UNKNOWN.json',dict(name=name,error=str(e),at=time.time(),noLaterRequests=True))
def sourcecheck():
    pins=read('runtime-inputs.json')['sources']
    root=pathlib.Path(__file__).resolve().parent.parent
    # Executed core is sealed; only mutable owned helpers need fresh IO.
    for n in ('tools/vb5cce-reviewed-control.py','test/test-vb5cce-original-current.cjs'):
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
    if PORT!=read('launch.json').get('rootPort',45761):
        rows=[json.loads(p.read_text()) for p in (R/'children').glob('*-wait.json')]
        rows=[row for row in rows if row['pid']==int(os.environ['DELPHI5_CHILD_PID'])]
        assert len(rows)==1 and not rows[0]['actualWait'];info=dict(pid=rows[0]['pid'],startToken=os.environ['DELPHI5_CHILD_TOKEN'])
    s=pathlib.Path(f"/proc/{info['pid']}/stat").read_text();assert s[s.rindex(')')+2:].split()[19]==info['startToken']
    sockets=set()
    for p in pathlib.Path(f"/proc/{info['pid']}/fd").iterdir():
        try:sockets.add(str(p.readlink()))
        except FileNotFoundError:pass
    rows=[x.split() for x in pathlib.Path('/proc/net/tcp').read_text().splitlines()[1:]]
    owned=[x[9] for x in rows if x[1]=='0100007F:'+format(PORT,'04X') and x[3]=='0A']
    assert len(owned)==1 and 'socket:['+owned[0]+']' in sockets
    return info
def call(command,timeout=1,cleanup=False):
    assert not (R/'PERMANENT-UNKNOWN.json').exists(),'permanent UNKNOWN; no later requests'
    identity()
    with (R/'requests.jsonl').open('a') as log:
        log.write(json.dumps(dict(at=time.time(),action=command.get('action'),cleanup=cleanup))+'\n')
    req=urllib.request.Request(f'http://127.0.0.1:{PORT}/ctl',data=json.dumps(command).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=timeout) as f:r=json.load(f)
    assert r.get('ok'),r
    return r['value']
def capture(name):
    try:
        reserve();target=identity();at=time.time()
        p=R/(name+'.png');assert not p.exists()
        reply=call(dict(action='native-reviewed-capture',path=str(p)),timeout=3)
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
def review(scene,description,label,kind,target):
    rr=read(scene+'.json')
    assert hashlib.sha256((R/(scene+'.png')).read_bytes()).hexdigest()==rr['pngSHA256']
    save(scene+'-review.json',dict(at=time.time(),rawCompleteScene=True,observation=description,
         visibleLabel=label,kind=kind,targetHwnd=target,pngSHA256=rr['pngSHA256']))
def reviewed(scene):
    rr=read(scene+'.json');r=read(scene+'-review.json')
    freshness=5 if r['kind']=='game' else 30
    assert 0<=time.time()-rr['at']<freshness and 0<=time.time()-r['at']<freshness
    assert rr['target']==identity() and rr['port']==PORT and r['rawCompleteScene'] and r['observation'] and r['visibleLabel']
    assert r['pngSHA256']==rr['pngSHA256']==hashlib.sha256((R/(scene+'.png')).read_bytes()).hexdigest()
    return rr,r
def native_review(rr,r):
    return dict(contract='native-reviewed-context-v1',captureId=rr['captureId'],pngSHA256=rr['pngSHA256'],
        reviewed=True,reviewedAt=r['at']*1000,scope='game' if r['kind']=='game' else 'menu',targetHwnd=r['targetHwnd'])
def bind(scene):
    try:
        reserve();assert not (R/'input-owner.json').exists()
        rr,r=reviewed(scene)
        save('bind-intent.json',dict(scene=scene,at=time.time(),permanent=True))
        reply=call(dict(action='guarded-bind',reviewedScene=native_review(rr,r)))
        save('input-owner.json',reply)
    except BaseException as e:fail('bind',e);raise
def release(name,owner,due):
    print(json.dumps(dict(armed=True,pid=os.getpid(),due=due)),flush=True)
    while time.time()<due:
        p=R/(name+'-up-at.json')
        if p.exists():
            try:due=min(due,read(p.name)['at'])
            except (OSError,ValueError,KeyError):pass # Original finite fallback remains armed.

        time.sleep(min(.003,max(0,due-time.time())))
    try:
        sent=time.time();reply=call(dict(action='guarded-release',owner=owner),timeout=.2,cleanup=True)
        save(name+'-up.json',dict(at=time.time(),sentAt=sent,reply=reply,physicalUpACK=reply.get('released') is True))
    except BaseException as e:save(name+'-up.json',dict(at=time.time(),error=str(e),physicalUpACK=False));raise
def release_process(name,owner,due,stdout_read,stdout_write,stderr_read,stderr_write):
    os.close(stdout_read);os.close(stderr_read)
    os.dup2(stdout_write,1);os.dup2(stderr_write,2)
    os.close(stdout_write);os.close(stderr_write)
    try:release(name,owner,due)
    except BaseException:
        traceback.print_exc();sys.stderr.flush();raise SystemExit(1)
class ArmedRelease:
    """Independent forked process: no second Python import/startup on DOWN's path.

    Keep actual join and pipe EOF evidence, with the same absolute deadlines.
    The controller is single-threaded and has closed all earlier HTTP requests.
    """
    def __init__(self,name,owner,due):
        out_r,out_w=os.pipe();err_r,err_w=os.pipe()
        sys.stdout.flush();sys.stderr.flush()
        self.process=multiprocessing.get_context('fork').Process(target=release_process,
            args=(name,owner,due,out_r,out_w,err_r,err_w))
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
def intent(name,scene,x,y,kind):
    child=None
    try:
        launch=reserve(kind=='quit');rr,r=reviewed(scene)
        assert kind in ('install','game','quit') and r['kind']==kind
        if kind!='quit':assert not (R/'quit-phase.json').exists() and time.time()+3<launch['gameplayCutoff']
        assert not (R/'PERMANENT-UNKNOWN.json').exists()
        owner=read('input-owner.json');nonce=str(uuid.uuid4());start=time.time()
        # The retained personally reviewed full image is immutable. Native
        # verification checks every public semantic control, not repaint bytes.
        command=f'keydown:{y}' if x==-1 else f'mousedown:{x}:{y}'
        save(name+'-intent.json',dict(scene=scene,x=x,y=y,kind=kind,owner=owner,nonce=nonce,
             at=start,confirmationDeadline=start+.5,physicalUpDeadline=start+1.75,observationDeadline=start+3))
        child=ArmedRelease(name,owner['owner'],start+1.4)
        ready,_,_=select.select([child.stdout],[],[],.15);assert ready,'release was not prearmed'
        arm=json.loads(child.stdout.readline());save(name+'-release-arm.json',arm);assert arm['armed']
        reserve(kind=='quit');assert time.time()<start+.5
        receipt=call(dict(action='guarded-input',cmd=command,guard={**owner,'nonce':nonce,
             'reviewed':True,'intent':dict(review=native_review(rr,r)),
             'deadline':int(min(start+.5,min(rr['at'],r['at'])+(5 if kind=='game' else 30))*1000)}),timeout=max(.001,start+.5-time.time()))
        save(name+'-down.json',dict(at=time.time(),receipt=receipt))
        assert time.time()<start+.5 and receipt['state']=='CONSUMED' and receipt['consumed'],'confirmation UNKNOWN'
        assert all(receipt.get(k)==v for k,v in dict(owner=owner['owner'],epoch=owner['epoch'],nonce=nonce).items())
        assert 0<receipt['consumedAt']<min((start+.5)*1000,(min(rr['at'],r['at'])+(5 if kind=='game' else 30))*1000),'late consumption'
        save(name+'-up-at.json',dict(at=receipt['consumedAt']/1000+.1))
        out,err=child.communicate(timeout=max(.001,start+1.75-time.time()))
        save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
        up=read(name+'-up.json');assert child.returncode==0 and up['physicalUpACK'] and up['at']<start+1.75
        # Acknowledgement proves input consumption only. Observe a later scene.
        # Observe the actual transition immediately. There is no minimum
        # completion delay: 3000ms bounds the entire intent and its evidence.
        while True:
            assert time.time()<start+3,'aggregate observation UNKNOWN'
            waited=R/'native-wait.json'
            if waited.exists():
                native=read('native-wait.json');assert kind=='quit' and native['actualWait'] and native['exit']==0
                save(name+'-observation.json',dict(at=time.time(),nativeWait=native,noPostExitRequest=True))
                break
            if kind=='quit':
                time.sleep(.005);continue # Quit is proved by parent wait, never a request to a retiring endpoint.
            if not pathlib.Path(f"/proc/{read('native-pid.json')['pid']}").exists():
                time.sleep(.005);continue # Parent still drains pipes/publishes its actual wait.
            after=call(dict(action='snapshot'),timeout=max(.001,start+3-time.time()))
            if kind!='quit' and after['physicalUp'] and context(after)!=context(rr['snapshot']):
                save(name+'-observation.json',dict(at=time.time(),snapshot=after));break
            time.sleep(.005)
        assert time.time()<start+3
        save(name+'-completion.json',dict(at=time.time(),elapsedMs=(time.time()-start)*1000,limitsMs=dict(confirmation=500,physicalUp=1750,aggregate=3000)))
        assert time.time()<start+3
        print(json.dumps(dict(completedAt=time.time(),elapsedMs=(time.time()-start)*1000,
              durableEvidencePublished=True,aggregateGuardPassed=True)),flush=True)
        assert time.time()<start+3
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
if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='capture':capture(sys.argv[2])
    elif mode=='review':review(*sys.argv[2:7])
    elif mode=='bind':bind(sys.argv[2])
    elif mode=='intent':intent(sys.argv[2],sys.argv[3],int(sys.argv[4]),int(sys.argv[5]),sys.argv[6])
    elif mode=='release':release(sys.argv[2],sys.argv[3],float(sys.argv[4]))
