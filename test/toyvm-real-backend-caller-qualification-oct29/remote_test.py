"""One fresh Boat: unmodified production CLI, positive first, then quota control.

Run only after source/receipt staging and remote admission. No browser entrypoint.
"""
import os,sys,pathlib,json,resource,subprocess,selectors,signal,time,datetime,hashlib
ROOT=pathlib.Path('/tmp/toyvm-real-backend-caller-qualification-oct29').resolve()
REPO=ROOT/'repo'
M=1024**2
def cwd_check(cwd):
    p=pathlib.Path(cwd).resolve(strict=True)
    if not p.is_dir() or not p.is_relative_to(ROOT):raise ValueError('outside task cwd')
    return p
def limits():
    for k,v in [(resource.RLIMIT_DATA,128*M),(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,12*M),(resource.RLIMIT_CORE,0)]:resource.setrlimit(k,(v,v))
def rows():
    d={}
    for p in pathlib.Path('/proc').iterdir():
        if p.name.isdigit():
            try:
                s=(p/'stat').read_text().rsplit(')',1)[1].split();d[int(p.name)]=(int(s[1]),int(s[21])*4096,(int(s[11])+int(s[12]))/100,s[19])
            except (OSError,ValueError,IndexError):pass
    return d
def run(argv,*,cwd):
    cwd=cwd_check(cwd);s=os.statvfs(ROOT)
    mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    admission=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),device=os.stat(ROOT).st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,aggregate=24*M,projection=24*M,requiredBytes=3225419776,MemAvailable=mem)
    if s.f_bavail*s.f_frsize-24*M<3225419776 or mem<2147483648:raise RuntimeError('remote admission failure '+json.dumps(admission))
    start=time.monotonic();peak=0;seen={};reason=None;data=[bytearray(),bytearray()]
    p=subprocess.Popen(argv,cwd=cwd,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
    sel=selectors.DefaultSelector()
    for i,f in enumerate([p.stdout,p.stderr]):os.set_blocking(f.fileno(),False);sel.register(f,selectors.EVENT_READ,i)
    try:
        while sel.get_map() or p.poll() is None:
            d=rows();ids={p.pid};prev=set()
            while ids!=prev:prev=set(ids);ids.update(k for k,v in d.items() if v[0] in ids)
            selected={k:d[k] for k in ids if k in d};seen.update({k:v[3] for k,v in selected.items()})
            rss=sum(v[1] for v in selected.values());peak=max(peak,rss)
            if rss>512*M or any(v[1]>128*M for v in selected.values()):reason='physical RSS cap'
            if sum(v[2] for v in selected.values())>90:reason='group CPU cap'
            if time.monotonic()-start>120:reason='wall cap'
            if reason:break
            for key,_ in sel.select(.02):
                b=os.read(key.fileobj.fileno(),8192)
                if not b:sel.unregister(key.fileobj);continue
                if sum(map(len,data))+len(b)>2*M:reason='capture cap';break
                data[key.data].extend(b)
            if reason:break
    finally:
        current=rows()
        for pid,identity in seen.items():
            if pid in current and current[pid][3]==identity:
                try:signal.pidfd_send_signal(fd:=os.pidfd_open(pid),signal.SIGKILL);os.close(fd)
                except ProcessLookupError:pass
        try:os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        p.wait();sel.close()
    current=rows();remaining=[k for k,v in seen.items() if k in current and current[k][3]==v]
    return dict(argv=argv,cwd=str(cwd),exit=p.returncode,stdout=data[0].decode(),stderr=data[1].decode(),reason=reason,peakGroupRSS=peak,wall=time.monotonic()-start,remainingOwnedProcesses=remaining,admission=admission)
def main():
    resource.setrlimit(resource.RLIMIT_DATA,(128*M,resource.getrlimit(resource.RLIMIT_DATA)[1]))
    receipt=dict(location=dict(cwd=os.getcwd(),root=str(ROOT),pid=os.getpid()),cases=[],mountArgv=[],intendedMountFiles=[],browserExecuted=False,browserAllowanceRemaining=dict(cpuSeconds=35.353183,wallSeconds=101.495550694,captures=1))
    for name,cwd in [('shared','/home/user'),('outside','/tmp')]:
        try:run(['/usr/bin/false'],cwd=cwd)
        except ValueError:pass
        else:raise AssertionError('cwd negative failed '+name)
    try:run(['/usr/bin/false'])
    except TypeError:pass
    else:raise AssertionError('omitted cwd accepted')
    receipt['sentinel']=run(['/usr/bin/pwd'],cwd=ROOT)
    assert receipt['sentinel']['stdout'].strip()==str(ROOT)
    d=json.loads((ROOT/'dispatch.json').read_text())
    for path,pin in d['sourcePins'].items():
        b=(REPO/path).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
    assert hashlib.sha256((ROOT/'cancellation-receipt.json').read_bytes()).hexdigest()==d['originalCancellationReceiptPin']['sha256']
    receipt['sourcePins']=d['sourcePins'];receipt['receiptPin']=d['originalCancellationReceiptPin']
    for name,write_limit in [('positive',65536),('quota-rejection',8)]:
        if datetime.datetime.now(datetime.timezone.utc)>=datetime.datetime(2026,10,29,3,18,tzinfo=datetime.timezone.utc):raise RuntimeError('runtime cutoff')
        work=ROOT/name;work.mkdir();assert not list(work.iterdir())
        domain=str(work/'domain');target=domain+'/tiny,fixture.txt'
        code='import os; p='+repr(target)+'; f=open(p,"wb"); f.write(bytes(range(20))); f.close(); os.unlink(p); print("fixture completed")'
        argv=[sys.executable,'-B',str(REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(ROOT/'cancellation-receipt.json'),'--work',str(work),'--live-limit','32768','--write-limit',str(write_limit),'--file-limit','16384','--rss-limit',str(128*M),'--cpu-limit','30','--wall-limit','30','--output-limit','65536','--',sys.executable,'-B','-c',code]
        mount=dict(argv=['/usr/bin/fusermount3','-o','rw,nosuid,nodev,fsname=toyvm-accounting,subtype=toyvm-accounting','--',domain],root=domain,children=[target],freshEmptyWork=True)
        r=run(argv,cwd=ROOT);r['mountConfiguration']=mount
        r['remainingMounts']=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work) in x]
        receipt['cases'].append(r)
        (ROOT/'result.json').write_text(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
        report=json.loads(r['stdout'])
        if name=='positive' and (r['exit']!=0 or not report['accepted']):
            receipt['outcome']='STOP: first positive correctness/capability failure';break
        if name=='quota-rejection':
            assert r['exit']==1 and not report['accepted'] and report.get('backendReceipt',{}).get('filesystem',{}).get('failure') is not None
            receipt['outcome']='positive accepted; real quota failure rejected'
    (ROOT/'result.json').write_text(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
    print(json.dumps(receipt,sort_keys=True))
if __name__=='__main__':main()
