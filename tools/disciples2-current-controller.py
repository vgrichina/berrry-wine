"""Manual Disciples II control, recovered from tested helper 54508b765ea1499c.

The fixed Quit reserve is enforced before arm and again before every edge.
There is no gameplay delivery loop or automatic Quit sequence.
"""
import pathlib,json,time,sys,urllib.request,subprocess,os,uuid,hashlib,select,re,urllib.parse
R=pathlib.Path(os.environ.get('DISCIPLES2_CONTROL_OUT',pathlib.Path(__file__).resolve().parent))
URL=os.environ.get('DISCIPLES2_CONTROL_URL','http://127.0.0.1:8444/ctl')
def save(n,v):
    assert not (R/n).exists(),n
    pending=R/(n+'.pending')
    with pending.open('x') as f:json.dump(v,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
    os.rename(pending,R/n)
def call(c,timeout=3):
    req=urllib.request.Request(URL,data=json.dumps(c).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=timeout) as f:r=json.load(f)
    if not r.get('ok'):raise RuntimeError(r)
    return r['value']
def read(n):return json.loads((R/n).read_text())
class ReserveRejected(Exception):pass
QUIT_ROUTES={'options':'keydown:27','leave-quest':None,'confirm-leave':None,'main-quit':None,'confirm-quit':None}
def reserve():
    launch=read('launch.json')
    assert launch['gameplayCutoff']==launch['deadline']-180,'immutable 180-second reserve missing'
    assert launch['at']<launch['gameplayCutoff'],'reserve must be recorded before original'
    return launch['gameplayCutoff']
def capture_phase():
    # Captures remain available for personally reviewing the ordinary Quit
    # route, but crossing the cutoff can never reopen gameplay.
    cutoff=reserve()
    if time.time()>=cutoff and not (R/'quit-phase.json').exists():
        save('quit-phase.json',dict(at=time.time(),cutoff=cutoff,irreversible=True))
    return cutoff
def bind(review=None):
    try:
        opened();reserve();assert not (R/'bind-intent.json').exists(),'permanent binding attempt; no rebind'
        assert not (R/'input-owner.json').exists(),'permanent owner; no rebind'
        command={'action':'guarded-bind'}
        if read('launch.json').get('nativeScene'):
            assert review,'original binding requires a personally reviewed complete scene'
            rr=read(review+'.json');personal=read(review+'-review.json')
            assert 0<=time.time()-rr['at']<30 and 0<=time.time()-personal['at']<30,'binding review expired'
            assert personal['pngSHA256']==rr['pngSHA256']==hashlib.sha256((R/(review+'.png')).read_bytes()).hexdigest()
            command['reviewedScene']=dict(route='native-scene-v1',snapshot=rr['snapshot'],pngSHA256=rr['pngSHA256'])
        save('bind-intent.json',dict(at=time.time(),permanent=True,review=review))
        save('input-owner.json',call(command));s=call({'action':'snapshot'})
        save('lease-snapshot.json',{k:s[k] for k in ('mainHwnd','screen')})
    except BaseException as e:fail(e,'bind');raise

def policy(intent,keys,review=None,route=None,operationEnd=None):
    cutoff=capture_phase()
    if time.time()>=cutoff or intent=='quit':
        if not (R/'quit-phase.json').exists():
            save('quit-phase.json',dict(at=time.time(),cutoff=cutoff,irreversible=True))
    assert intent in ('gameplay','quit'),'explicit gameplay or quit intent required'
    if intent=='quit':
        if route not in QUIT_ROUTES or (QUIT_ROUTES[route] is not None and keys!=[QUIT_ROUTES[route]]):
            raise ReserveRejected('only personally reviewed ordinary native Quit-route intents')
        if review is not None and read(review+'-review.json').get('quitRoute')!=route:
            raise ReserveRejected('fresh personal review must explicitly bind this Quit route')
    elif (R/'quit-phase.json').exists() or (operationEnd is not None and operationEnd>=cutoff):
        raise ReserveRejected('gameplay cutoff: preserve Quit reserve before arm/DOWN')
    return cutoff
def endpoint_identity(info):
    parsed=urllib.parse.urlparse(URL)
    assert parsed.hostname=='127.0.0.1' and parsed.path=='/ctl','direct loopback endpoint only'
    sockets=set()
    for p in pathlib.Path('/proc/'+str(info['pid'])+'/fd').iterdir():
        try:target=str(p.readlink())
        except FileNotFoundError:continue
        if target.startswith('socket:'):sockets.add(target)
    inodes=[r.split()[9] for r in pathlib.Path('/proc/net/tcp').read_text().splitlines()[1:]
            if r.split()[1]=='0100007F:'+format(parsed.port,'04X') and r.split()[3]=='0A']
    assert len(inodes)==1 and 'socket:['+inodes[0]+']' in sockets,'endpoint must belong to native owner'
def opened():
    assert not (R/'terminal-input-failure.json').exists(),'sticky UNKNOWN/closed; no replay'
    assert not (R/'terminal-owner-exited.json').exists(),'native owner exited; no replay'
    assert not (R/'native-wait.json').exists(),'native terminal'
    assert time.time()+2<read('launch.json')['deadline'],'immutable runtime deadline'
    info=read('native-pid.json');s=pathlib.Path('/proc/'+str(info['pid'])+'/stat').read_text()
    assert s[s.rindex(')')+2:].split()[19]==info['startToken'],'native identity changed'
    endpoint_identity(info)
def fail(error,name):
    if (R/'terminal-owner-exited.json').exists():return
    if not (R/'terminal-input-failure.json').exists():save('terminal-input-failure.json',dict(name=name,error=str(error),noReplay=True,at=time.time()))
def lease():
    opened();o=read('input-owner.json');s=call({'action':'snapshot'})
    assert not s['quit'] and s['eip']!='0x0','native owner unavailable'
    assert {k:s[k] for k in ('mainHwnd','screen')}==read('lease-snapshot.json'),'window/canvas lease changed'
    if (R/'last-intent.json').exists():
        for n in read('last-intent.json')['nonces']:
            r=call({'action':'guarded-status','nonce':n})
            assert r['owner']==o['owner'] and r['epoch']==o['epoch'],'guard ownership changed'
            assert r['state']!='UNKNOWN','sticky guard UNKNOWN'
            assert r['state'] in ('CONSUMED','CANCELLED') and r['consumed'],'prior intent unresolved'
            assert r['reason'] in (None,'immutable deadline expired','independent release'),'guard owner revoked'
    return o,s
def capture(name):
    try:
        assert name.replace('-','').isalnum();capture_phase();opened()
        p=R/(name+'.png');assert not p.exists()
        start=time.time();s=call({'action':'snapshot'},3);capture_phase();im=call({'cmd':'png:'+str(p)},max(.01,3-(time.time()-start)));end=time.time()
        assert end-start<=3,'3000ms whole-scene observation exceeded'
        save(name+'.json',dict(at=start,completedAt=end,snapshot=s,image=im,pngSHA256=hashlib.sha256(p.read_bytes()).hexdigest()))
        return str(p)
    except BaseException as e:fail(e,name);raise
def exited_owner(expected):
    """A successful actual harness wait, not a guest exit-code or physical UP claim."""
    try:
        info=read('native-pid.json');wait=read('native-wait.json')
    except (FileNotFoundError,ValueError):
        return None
    if any(info.get(k)!=expected.get(k) or wait.get(k)!=expected.get(k) for k in ('pid','startToken')):
        return None
    if not isinstance(expected.get('startToken'),str) or not expected['startToken']:
        return None
    if not all(wait.get(k) is True for k in ('actualWait','stdoutEOF','stderrEOF')):
        return None
    if wait.get('exit')!=0 or wait.get('drainErrors')!=[] or wait.get('at',0)<info['at']:
        return None
    return wait

def release(name,owner,deadline,final=False):
    target=read('native-pid.json')
    print(json.dumps(dict(armed=True,pid=os.getpid(),deadline=deadline,owner=owner,target=target,at=time.time())),flush=True)
    # Already armed at the immutable fallback. A consumed ACK can only shorten it.
    due=deadline; source='fallback'
    while time.time()<due:
        schedule=R/(name+'-release-at.json')
        if schedule.exists():
            v=read(schedule.name);due=min(due,v['at']);source='consumed-pulse'
        time.sleep(min(.005,max(0,due-time.time())))
    save(name+'-release-fired.json',dict(at=time.time(),due=due,source=source,fallback=deadline))
    try:save(name+'-up.json',dict(state='ACK',reply=call({'action':'guarded-release','owner':owner},.25),at=time.time()))
    except Exception as e:
        # A reviewed final choice can retire the native before the finite UP.
        # Port closure alone never proves that. Preserve failed/signal waits
        # and unresolved DOWN as UNKNOWN, without replay or a fabricated ACK.
        if final and (R/(name+'-down.json')).exists():
            down=read(name+'-down.json')
            if down and all(r.get('state')=='CONSUMED' and r.get('consumed') and r.get('owner')==owner for r in down):
                end=deadline
                while time.time()<end:
                    wait=exited_owner(target)
                    if wait is not None:
                        save(name+'-up.json',dict(state='OWNER_EXITED',physicalUpACK=False,
                             nativeWait=wait,target=target,error=str(e),at=time.time()))
                        return
                    time.sleep(.01)
        save(name+'-up.json',dict(state='UNKNOWN',error=str(e),at=time.time()));raise
def pulse(name,keys,ms,review,description,final=False,intent='gameplay',route=None):
    assert name.replace('-','').isalnum() and 40<=ms<=1000
    assert len(keys)==1 and re.fullmatch(r'(?:keydown:(?:13|27|32|37|38|39|40|78|89)|(?:mousedown|mousemove):[0-9]{1,4}:[0-9]{1,4})',keys[0])
    if keys[0].startswith(('mousedown:','mousemove:')):
        _,x,y=keys[0].split(':');assert 0<=int(x)<1024 and 0<=int(y)<712
    assert description.strip(),'personal scene review required'
    policy(intent,keys,review,route)
    try:
        owner,before=lease();rr=read(review+'.json');reviewed=read(review+'-review.json')
        native=read('launch.json').get('nativeScene',False)
        if native:
            assert before['physicalUp'] and before['capture']=='0x0','native physical UP required before intention'
            assert rr['snapshot']['physicalUp'] and rr['snapshot']['capture']=='0x0','review must precede any held input'
        assert 0<=time.time()-reviewed['at']<30,'personal review age expired'
        assert reviewed['pngSHA256']==rr['pngSHA256'],'review binding changed'
        assert hashlib.sha256((R/(review+'.png')).read_bytes()).hexdigest()==rr['pngSHA256'],'review image changed'
        assert not list(R.glob(review+'-used-by-*')),'capture already reserved; fresh review required'
        nonces=[str(uuid.uuid4()) for k in keys]
        record=dict(name=name,keys=keys,ms=ms,review=review,reviewSHA256=rr['pngSHA256'],description=description,nonces=nonces,createdAt=time.time(),intent=intent,quitRoute=route)
        save(name+'-intent.json',record);save(review+'-used-by-'+name,dict(intent=name))
        age=time.time()-rr['at']
        if not 0<=age<30:
            save(name+'-rejection.json',dict(state='NOT_SENT',lease='VALID',reason='review expired before DOWN/arm',age=age,nonces=nonces,at=time.time()))
            return 'NOT_SENT: review expired; fresh capture + review + NEW intent required'
        deadline=min(time.time()+3.0,rr['at']+30.0)
        intentDeadline=dict(deadline=deadline,pulseMilliseconds=ms,operationWindowSeconds=3.0,confirmMilliseconds=500,physicalUpMilliseconds=1750)
        save(name+'-operation.json',intentDeadline)
        assert deadline+2<read('launch.json')['deadline'],'operation exceeds fixed runtime'
        policy(intent,keys,review,route,deadline)
        releaseCap=time.time()+1.5
        save(name+'-release-cap.json',dict(at=releaseCap,beforeFirstDown=True))
        child=subprocess.Popen([sys.executable,'-B',__file__,'release',name,owner['owner'],str(releaseCap),*(['final'] if final else [])],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        sent=False
        try:
            ready,_,_=select.select([child.stdout],[],[],1.5);assert ready,'independent release child arm deadline'
            armed=json.loads(child.stdout.readline());assert armed['armed'];save(name+'-armed.json',armed)
            assert time.time()<deadline,'operation deadline before DOWN'
            if time.time()-rr['at']>=30 or time.time()-reviewed['at']>=30:
                save(name+'-rejection.json',dict(state='NOT_SENT',lease='VALID',reason='review expired after arm before DOWN',nonces=nonces,at=time.time()))
                return 'NOT_SENT: review expired after arm; fresh capture + NEW intent required'
            receipts=[]
            for key,nonce in zip(keys,nonces):
                assert time.time()-rr['at']<30 and time.time()-reviewed['at']<30,'capture/review expired before edge'
                cutoff=policy(intent,keys,review,route)
                sent=True
                guard={**owner,'nonce':nonce,'reviewed':True,'deadline':int(min(deadline,releaseCap,cutoff if intent=='gameplay' else deadline)*1000)}
                if native:guard['intent']=rr['snapshot']
                sentAt=time.time()
                receipt=call({'action':'guarded-input','cmd':key,'guard':guard},.5)
                returnedAt=time.time()
                assert returnedAt-sentAt<=.5,'500ms confirmation exceeded'
                receipts.append(receipt)
                if receipt.get('consumedAt'):
                    save(name+'-release-at.json',dict(at=receipt['consumedAt']/1000+ms/1000,immutableOperationDeadline=deadline))
                save(name+'-receipt.json',receipt)
                assert receipt['state']=='CONSUMED' and receipt['consumed'],receipt
            save(name+'-down.json',receipts)
            releaseAt=max(x['consumedAt'] for x in receipts)/1000+ms/1000
            assert releaseAt<deadline,'finite pulse cannot fit original operation deadline'
            assert returnedAt<releaseAt,'late ACK; independent UP retained; no replay'
        finally:
            out,err=child.communicate(timeout=15)
            save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
            assert child.returncode==0,'independent release failed; stop'
        up=read(name+'-up.json')
        if final and up['state']=='OWNER_EXITED':
            assert up['target']==armed['target']==read('native-pid.json'),'terminal native identity changed'
            assert up['nativeWait']==exited_owner(armed['target']),'actual normal native wait/EOF required'
            assert up['at']<deadline and all(up['at']-r['consumedAt']/1000<=1.75 for r in receipts),'terminal evidence exceeded two-second bound'
            save('terminal-owner-exited.json',dict(name=name,owner=owner,nonces=nonces,
                 target=armed['target'],nativeWait=up['nativeWait'],physicalUpACK=False,
                 nativeQuitClaim=False,noReplay=True,at=time.time()))
            save(name+'-final-choice.json',dict(nativeQuitClaim=False,ownerExited=True,physicalUpACK=False))
            return 'Native owner exited with actual wait and both EOFs; physical UP unacknowledged'
        assert up['state']=='ACK' and up['at']<deadline,'independent UP not acknowledged in window'
        assert all(up['at']-r['consumedAt']/1000<=1.75 for r in receipts),'1750ms physical UP exceeded'
        # Append-only link instead of overwriting old intent records.
        old=R/'last-intent.json'
        if old.exists():old.unlink()
        save('last-intent.json',dict(nonces=nonces))
        if final:
            save(name+'-final-choice.json',dict(nativeQuitClaim=False,awaitActualNativeWait=True));return 'Final reviewed choice submitted; await actual native wait'
        save(name+'-complete.json',dict(at=time.time(),confirmationMs=(returnedAt-sentAt)*1000,physicalUpMs=max(up['at']-r['consumedAt']/1000 for r in receipts)*1000,observationBoundMs=3000))
        return 'CONSUMED with independent physical UP; take a fresh complete capture for next intent'
    except ReserveRejected:raise
    except BaseException as e:fail(e,name);raise
if __name__=='__main__':
    if sys.argv[1]=='review':
        rr=read(sys.argv[2]+'.json');save(sys.argv[2]+'-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],observation=sys.argv[3],quitRoute=sys.argv[4] if len(sys.argv)>4 else None));print('personal review recorded')
    elif sys.argv[1]=='capture':print(capture(sys.argv[2]))
    elif sys.argv[1]=='bind':
        bind(sys.argv[2] if len(sys.argv)>2 else None)
    elif sys.argv[1]=='release':release(sys.argv[2],sys.argv[3],float(sys.argv[4]),len(sys.argv)>5 and sys.argv[5]=='final')
    elif sys.argv[1] in ('pulse','quit-pulse'):
        quitIntent=sys.argv[1]=='quit-pulse'
        print(pulse(sys.argv[2],[sys.argv[3]],int(sys.argv[4]),sys.argv[5],sys.argv[6],len(sys.argv)>8 and sys.argv[8]=='final',intent='quit' if quitIntent else 'gameplay',route=sys.argv[7] if quitIntent else None))
