import pathlib,json,time,sys,urllib.request,subprocess,os,uuid,hashlib,select
# Admission reserves are bounds, not extra scene time. Actual startup/ACK
# latency is checked again; exceeding a bound after arm closes the controller.
ARM_SECONDS=.5
ACK_SECONDS=.5
RELEASE_SECONDS=.25
R=pathlib.Path(os.environ.get('SUPERTUX_CONTROL_OUT',pathlib.Path(__file__).resolve().parent))
URL=os.environ.get('SUPERTUX_CONTROL_URL','http://127.0.0.1:8465/ctl')
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
def opened():
    assert not (R/'terminal-input-failure.json').exists(),'sticky UNKNOWN/closed; no replay'
    assert not (R/'native-wait.json').exists(),'native terminal'
    assert time.time()+2<read('launch.json')['deadline'],'immutable runtime deadline'
    info=read('native-pid.json');s=pathlib.Path('/proc/'+str(info['pid'])+'/stat').read_text()
    assert s[s.rindex(')')+2:].split()[19]==info['startToken'],'native identity changed'
def fail(error,name):
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
        assert name.replace('-','').isalnum();opened()
        p=R/(name+'.png');assert not p.exists()
        start=time.time();s=call({'action':'snapshot'});im=call({'cmd':'png:'+str(p)});end=time.time()
        save(name+'.json',dict(at=start,completedAt=end,snapshot=s,image=im,pngSHA256=hashlib.sha256(p.read_bytes()).hexdigest()))
        return str(p)
    except BaseException as e:fail(e,name);raise
def release(name,owner,deadline):
    print(json.dumps(dict(armed=True,pid=os.getpid(),deadline=deadline,owner=owner,at=time.time())),flush=True)
    # Already armed at the immutable fallback. A consumed ACK can only shorten it.
    due=deadline; source='fallback'
    while time.time()<due:
        schedule=R/(name+'-release-at.json')
        if schedule.exists():
            v=read(schedule.name);due=min(due,v['at']);source='consumed-pulse'
        time.sleep(min(.005,max(0,due-time.time())))
    save(name+'-release-fired.json',dict(at=time.time(),due=due,source=source,fallback=deadline))
    try:save(name+'-up.json',dict(state='ACK',reply=call({'action':'guarded-release','owner':owner}),at=time.time()))
    except Exception as e:save(name+'-up.json',dict(state='UNKNOWN',error=str(e),at=time.time()));raise
def pulse(name,keys,ms,review,description,final=False):
    assert name.replace('-','').isalnum() and 40<=ms<=1000
    assert 1<=len(keys)<=3 and len(set(keys))==len(keys) and all(k in (13,27,32,37,38,39,40,17) for k in keys)
    assert description.strip(),'personal scene review required'
    try:
        owner,before=lease();rr=read(review+'.json')
        assert hashlib.sha256((R/(review+'.png')).read_bytes()).hexdigest()==rr['pngSHA256'],'review image changed'
        assert not list(R.glob(review+'-used-by-*')),'capture already reserved; fresh review required'
        nonces=[str(uuid.uuid4()) for k in keys]
        intent=dict(name=name,keys=keys,ms=ms,review=review,reviewSHA256=rr['pngSHA256'],description=description,nonces=nonces,createdAt=time.time())
        save(name+'-intent.json',intent);save(review+'-used-by-'+name,dict(intent=name))
        age=time.time()-rr['at']
        if not 0<=age<12:
            save(name+'-rejection.json',dict(state='NOT_SENT',lease='VALID',positivelyUnsent=True,reason='review expired before DOWN/arm',age=age,nonces=nonces,at=time.time()))
            return 'NOT_SENT: review expired; fresh capture + review + NEW intent required'
        deadline=min(time.time()+4.0,rr['at']+12.0)
        required=ARM_SECONDS+len(keys)*ACK_SECONDS+ms/1000+RELEASE_SECONDS
        intentDeadline=dict(deadline=deadline,pulseMilliseconds=ms,operationWindowSeconds=4.0,
                            armSeconds=ARM_SECONDS,ackSecondsPerKey=ACK_SECONDS,
                            releaseSeconds=RELEASE_SECONDS,requiredSeconds=required)
        save(name+'-operation.json',intentDeadline)
        remaining=deadline-time.time()
        if remaining<required:
            save(name+'-rejection.json',dict(state='NOT_SENT',lease='VALID',
                reason='insufficient complete window before arm',positivelyUnsent=True,
                remainingSeconds=remaining,requiredSeconds=required,nonces=nonces,at=time.time()))
            return 'NOT_SENT: insufficient complete window; fresh capture + review + NEW intent required'
        assert deadline+2<read('launch.json')['deadline'],'operation exceeds fixed runtime'
        child=subprocess.Popen([sys.executable,'-B',__file__,'release',name,owner['owner'],str(deadline)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        sent=False
        try:
            # ACK parsing and all post-arm checks belong inside the wait/failure
            # scope: even a failed ACK must leave an actual release-child wait.
            assert select.select([child.stdout],[],[],max(0,deadline-time.time()))[0],'independent arm ACK deadline'
            armed=json.loads(child.stdout.readline());assert armed['armed'];save(name+'-armed.json',armed)
            assert deadline-time.time()>=len(keys)*ACK_SECONDS+ms/1000+RELEASE_SECONDS,'insufficient complete window after arm before DOWN'
            assert 0<=time.time()-rr['at']<12,'review expired after arm before DOWN'
            receipts=[]
            for index,(key,nonce) in enumerate(zip(keys,nonces)):
                assert deadline-time.time()>=(len(keys)-index)*ACK_SECONDS+ms/1000+RELEASE_SECONDS,'insufficient complete window before DOWN'
                sent=True
                receipt=call({'action':'guarded-input','cmd':'keydown:'+str(key),'guard':{**owner,'nonce':nonce,'reviewed':True,'deadline':int(deadline*1000)}},timeout=ACK_SECONDS)
                receipts.append(receipt)
                save(name+'-receipt-'+str(key)+'.json',receipt)
                assert receipt['state']=='CONSUMED' and receipt['consumed'],receipt
            save(name+'-down.json',receipts)
            releaseAt=max(x['consumedAt'] for x in receipts)/1000+ms/1000
            assert releaseAt+RELEASE_SECONDS<deadline,'finite pulse cannot fit original operation deadline'
            assert time.time()<releaseAt,'ACK arrived too late for complete pulse'
            save(name+'-release-at.json',dict(at=releaseAt,immutableOperationDeadline=deadline))
        finally:
            out,err=child.communicate(timeout=15)
            save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
            assert child.returncode==0,'independent release failed; stop'
        up=read(name+'-up.json')
        assert up['state']=='ACK' and up['at']<deadline,'release ACK exceeded complete operation window'
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
        time.sleep(.3);return capture(name)
    except BaseException as e:fail(e,name);raise
if __name__=='__main__':
    if sys.argv[1]=='capture':print(capture(sys.argv[2]))
    elif sys.argv[1]=='bind':
        opened();save('input-owner.json',call({'action':'guarded-bind'}));s=call({'action':'snapshot'});save('lease-snapshot.json',{k:s[k] for k in ('mainHwnd','screen')})
    elif sys.argv[1]=='release':release(sys.argv[2],sys.argv[3],float(sys.argv[4]))
    elif sys.argv[1]=='pulse':print(pulse(sys.argv[2],[int(k) for k in sys.argv[3].split(',')],int(sys.argv[4]),sys.argv[5],sys.argv[6],len(sys.argv)>7 and sys.argv[7]=='final'))
