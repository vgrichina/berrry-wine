"""Direct Forsaken controller: permanent owner, unique nonces, independent bounded UP.

FORSAKEN_CONTROL_OUT must name this run's append-only evidence directory.
The recovered 20261114 helper deliberately leaves a late ACK terminal. Physical
release timing is established from the endpoint regression's DOWN/UP effects;
release-fired records only a request time and cannot establish physical UP.
"""
import pathlib,json,time,sys,urllib.request,subprocess,os,uuid,hashlib,select,re,urllib.parse
R=pathlib.Path(os.environ.get('FORSAKEN_CONTROL_OUT',pathlib.Path(__file__).resolve().parent))
URL=os.environ.get('FORSAKEN_CONTROL_URL','http://127.0.0.1:8507/ctl')
def save(n,v):
    assert not (R/n).exists(),n
    pending=R/(n+'.pending')
    with pending.open('x') as f:json.dump(v,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
    os.rename(pending,R/n)
def call(c,timeout=10):
    req=urllib.request.Request(URL,data=json.dumps(c).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=timeout) as f:r=json.load(f)
    if not r.get('ok'):raise RuntimeError(r)
    return r['value']
def read(n):return json.loads((R/n).read_text())
def endpoint_identity(info):
    parsed=urllib.parse.urlparse(URL)
    assert parsed.hostname=='127.0.0.1' and parsed.path=='/ctl','direct loopback endpoint only'
    sockets=set()
    for p in pathlib.Path('/proc/'+str(info['pid'])+'/fd').iterdir():
        try:target=str(p.readlink())
        except FileNotFoundError:continue  # A completed HTTP connection closed.
        if target.startswith('socket:'):sockets.add(target)
    inodes=[]
    for row in pathlib.Path('/proc/net/tcp').read_text().splitlines()[1:]:
        fields=row.split()
        if fields[1]=='0100007F:'+format(parsed.port,'04X') and fields[3]=='0A':inodes.append(fields[9])
    assert len(inodes)==1 and 'socket:['+inodes[0]+']' in sockets,'control socket is not exclusively owned by actual native PID'
def opened():
    assert not (R/'terminal-input-failure.json').exists(),'sticky UNKNOWN/closed; no replay'
    assert not (R/'native-wait.json').exists(),'native terminal'
    assert time.time()+2<read('launch.json')['deadline'],'immutable runtime deadline'
    info=read('native-pid.json');s=pathlib.Path('/proc/'+str(info['pid'])+'/stat').read_text()
    assert s[s.rindex(')')+2:].split()[19]==info['startToken'],'native identity changed'
    endpoint_identity(info)
def fail(error,name):
    if not (R/'terminal-input-failure.json').exists():save('terminal-input-failure.json',dict(name=name,error=str(error),noReplay=True,at=time.time()))
def bind():
    try:
        opened()
        # Reserve before HTTP evaluation: save(name, call(bind)) would rebind
        # first and only then notice that the permanent owner file exists.
        assert not (R/'input-owner.json').exists(),'permanent owner already bound; no rebind'
        save('bind-intent.json',dict(at=time.time(),permanent=True))
        save('input-owner.json',call({'action':'guarded-bind'}))
        s=call({'action':'snapshot'})
        save('lease-snapshot.json',{k:s[k] for k in ('mainHwnd','screen')})
    except BaseException as e:fail(e,'bind');raise
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
        assert name.replace('-','').isalnum();opened()
        p=R/(name+'.png');assert not p.exists() and not (R/(name+'.json')).exists(),'capture name collision before observation'
        start=time.time();s=call({'action':'snapshot'});im=call({'cmd':'png:'+str(p)});end=time.time()
        save(name+'.json',dict(at=start,completedAt=end,snapshot=s,image=im,pngSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),target=read('native-pid.json')))
        return str(p)
    except BaseException as e:fail(e,name);raise
def release(name,owner,deadline):
    print(json.dumps(dict(armed=True,pid=os.getpid(),deadline=deadline,owner=owner,at=time.time())),flush=True)
    # Already armed at the immutable fallback. A consumed ACK can only shorten it.
    due=deadline; source='fallback'
    while time.time()<due:
        cap=R/(name+'-release-cap.json')
        if cap.exists():due=min(due,read(cap.name)['at'])
        schedule=R/(name+'-release-at.json')
        if schedule.exists():
            v=read(schedule.name);due=min(due,v['at']);source='consumed-pulse'
        time.sleep(min(.005,max(0,due-time.time())))
    save(name+'-release-fired.json',dict(at=time.time(),due=due,source=source,fallback=deadline))
    try:save(name+'-up.json',dict(state='ACK',reply=call({'action':'guarded-release','owner':owner}),at=time.time()))
    except Exception as e:save(name+'-up.json',dict(state='UNKNOWN',error=str(e),at=time.time()));raise
def pulse(name,keys,ms,review,description,final=False,maxSceneAge=30):
    assert maxSceneAge in (5,30),'only bounded menu or aimed scene windows'
    if any(k in ('keydown:65','keydown:90','keydown:17','keydown:32','keydown:18') for k in keys):
        maxSceneAge=5  # Combat never inherits the menu's thirty-second window.
    assert name.replace('-','').isalnum() and 40<=ms<=2000
    # Reserve output names before arming or sending any edge. A prior action's
    # UP acknowledgement can otherwise collide with a later capture name.
    for suffix in ['.json','.png','-intent.json','-up.json','-midpress.json','-midpress.png']:
        assert not (R/(name+suffix)).exists(),'output name collision before intent/DOWN: '+name+suffix
    assert 1<=len(keys)<=2 and len(set(keys))==len(keys) and all(re.fullmatch(r'(?:keydown:(?:13|17|18|19|27|32|37|38|39|40|65|78|80|89|90)|(?:mousedown|mousemove):[0-9]{1,4}:[0-9]{1,4})',key) for key in keys)
    if keys[0].startswith(('mousedown:','mousemove:')):
        _,x,y=keys[0].split(':');assert 0<=int(x)<1024 and 0<=int(y)<712
    assert description.strip(),'personal scene review required'
    try:
        owner,before=lease();rr=read(review+'.json');reviewed=read(review+'-review.json')
        assert 0<=time.time()-reviewed['at']<30,'personal review age expired'
        assert reviewed['pngSHA256']==rr['pngSHA256'],'review binding changed'
        assert hashlib.sha256((R/(review+'.png')).read_bytes()).hexdigest()==rr['pngSHA256'],'review image changed'
        assert rr['target']==read('native-pid.json'),'capture native identity changed'
        assert not list(R.glob(review+'-used-by-*')),'capture already reserved; fresh review required'
        nonces=[str(uuid.uuid4()) for k in keys]
        intent=dict(name=name,keys=keys,ms=ms,review=review,reviewSHA256=rr['pngSHA256'],description=description,nonces=nonces,createdAt=time.time())
        save(name+'-intent.json',intent);save(review+'-used-by-'+name,dict(intent=name))
        age=time.time()-rr['at']
        if not 0<=age<maxSceneAge:
            save(name+'-rejection.json',dict(state='NOT_SENT',lease='VALID',reason='review expired before DOWN/arm',age=age,nonces=nonces,at=time.time()))
            return 'NOT_SENT: review expired; fresh capture + review + NEW intent required'
        deadline=min(time.time()+6.0,rr['at']+30.0)
        required=.5+len(keys)*1.0+ms/1000+.25
        if deadline-time.time()<required:
            save(name+'-rejection.json',dict(state='NOT_SENT',positivelyUnsent=True,reason='insufficient complete operation window',at=time.time()))
            return 'NOT_SENT: insufficient complete operation window'
        intentDeadline=dict(deadline=deadline,pulseMilliseconds=ms,operationWindowSeconds=6.0)
        save(name+'-operation.json',intentDeadline)
        assert deadline+2<read('launch.json')['deadline'],'operation exceeds fixed runtime'
        child=subprocess.Popen([sys.executable,'-B',__file__,'release',name,owner['owner'],str(deadline)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        sent=False
        try:
            ready,_,_=select.select([child.stdout],[],[],1.5);assert ready,'independent release child arm deadline'
            armed=json.loads(child.stdout.readline());assert armed['armed'];save(name+'-armed.json',armed)
            assert deadline-time.time()>=len(keys)*1.0+ms/1000+.25,'complete operation window after arm before DOWN'
            if time.time()-rr['at']>=maxSceneAge or time.time()-reviewed['at']>=30:
                save(name+'-rejection.json',dict(state='NOT_SENT',lease='VALID',reason='review expired after arm before DOWN',nonces=nonces,at=time.time()))
                return 'NOT_SENT: review expired after arm; fresh capture + NEW intent required'
            # Persist an independent absolute cap BEFORE the first DOWN.
            capAt=time.time()+2.0
            save(name+'-release-cap.json',dict(at=capAt,beforeFirstDown=True,maximumHoldMilliseconds=2000))
            receipts=[]
            for key,nonce in zip(keys,nonces):
                assert time.time()-rr['at']<maxSceneAge and time.time()-reviewed['at']<30,'capture/review expired before edge'
                sent=True
                receipt=call({'action':'guarded-input','cmd':key,'guard':{**owner,'nonce':nonce,'reviewed':True,'deadline':int(min(deadline,capAt)*1000)}},timeout=1.0)
                returnedAt=time.time()
                save(name+'-ack-timing-'+str(len(receipts))+'.json',dict(returnedAt=returnedAt,consumedAt=receipt.get('consumedAt'),transportAndHandlerMilliseconds=(returnedAt*1000-receipt['consumedAt']) if receipt.get('consumedAt') else None))
                receipts.append(receipt)
                save(name+('-receipt.json' if len(keys)==1 else '-receipt-'+str(keys.index(key))+'.json'),receipt)
                assert receipt['state']=='CONSUMED' and receipt['consumed'],receipt
            save(name+'-down.json',receipts)
            releaseAt=min(x['consumedAt'] for x in receipts)/1000+ms/1000
            # A known late ACK must shorten UP before any refusal can unwind.
            save(name+'-release-at.json',dict(at=releaseAt,immutableOperationDeadline=deadline))
            assert releaseAt+.25<deadline,'finite pulse cannot fit original operation deadline'
            assert time.time()<releaseAt,'ACK arrived too late for complete pulse'
            if ms>=1500:
                time.sleep(.15)
                capture(name+'-midpress')
        finally:
            out,err=child.communicate(timeout=15)
            save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
            assert child.returncode==0,'independent release failed; stop'
        up=read(name+'-up.json');assert up['state']=='ACK' and up['at']<deadline,'release ACK exceeded operation window'
        assert all(up['at']-r['consumedAt']/1000<=2.0 for r in receipts),'physical release completion exceeded two-second hold bound'
        # Append-only link instead of overwriting old intent records.
        old=R/'last-intent.json'
        if old.exists():old.unlink()
        save('last-intent.json',dict(nonces=nonces))
        if final:
            save(name+'-final-choice.json',dict(nativeQuitClaim=False,awaitActualNativeWait=True));return 'Final reviewed choice submitted; await actual native wait'
        b=call({'action':'snapshot'});end=time.monotonic()+10
        while time.monotonic()<end:
            a=call({'action':'snapshot'})
            if a['batch']>b['batch']:break
            time.sleep(.02)
        else:raise RuntimeError('no postrelease progress')
        save(name+'-progress.json',dict(before=before,afterRelease=b,postProgress=a,at=time.time()))
        return capture(name)
    except BaseException as e:fail(e,name);raise
if __name__=='__main__':
    if sys.argv[1]=='review':
        rr=read(sys.argv[2]+'.json');save(sys.argv[2]+'-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],observation=sys.argv[3]));print('personal review recorded')
    elif sys.argv[1]=='capture':print(capture(sys.argv[2]))
    elif sys.argv[1]=='bind':
        bind()
    elif sys.argv[1]=='release':release(sys.argv[2],sys.argv[3],float(sys.argv[4]))
    elif sys.argv[1] in ('pulse','aim'):print(pulse(sys.argv[2],sys.argv[3].split(','),int(sys.argv[4]),sys.argv[5],sys.argv[6],len(sys.argv)>7 and sys.argv[7]=='final',5 if sys.argv[1]=='aim' else 30))
