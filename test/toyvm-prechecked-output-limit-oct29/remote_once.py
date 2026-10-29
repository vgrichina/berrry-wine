import os,sys,json,pathlib,subprocess,time,resource,hashlib,base64,signal
R=pathlib.Path('/tmp/tvdt');REPO=R/'repo';W=R/'w'
resource.setrlimit(resource.RLIMIT_DATA,(128*1048576,resource.getrlimit(resource.RLIMIT_DATA)[1]))
resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1048576,12*1048576))
def snap():
    rows={}
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit():continue
        try:
            s=(p/'stat').read_text().rsplit(')',1)[1].split();rows[int(p.name)]=dict(pid=int(p.name),ppid=int(s[1]),start=s[19],rss=int(s[21])*os.sysconf('SC_PAGE_SIZE'))
        except (OSError,ValueError,IndexError):pass
    return rows
def run(argv,*,cwd):
    lexical=pathlib.Path(os.path.abspath(cwd))
    if not lexical.is_relative_to(R):raise ValueError('outside owned root')
    canonical=lexical.resolve(strict=True)
    if not canonical.is_relative_to(R):raise ValueError('symlink escape')
    return subprocess.Popen(argv,cwd=canonical,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
d=json.loads((R/'dispatch.json').read_text())
for p,pin in d['sourcePins'].items():assert hashlib.sha256((REPO/p).read_bytes()).hexdigest()==pin['sha256']
assert len(str(W/'status.sock').encode())==23
assert pathlib.Path('/usr/bin/python3').is_file() and os.access('/usr/bin/python3',os.X_OK)
assert hashlib.sha256((R/'cancellation.json').read_bytes()).hexdigest()==d['originalCancellationReceiptPin']['sha256']
v=os.statvfs(R);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
assert v.f_bavail*v.f_frsize>3225419776 and mem>512*1048576
W.mkdir();assert not any(W.iterdir())
code='import os\nfor i in range(8):\n os.write(1,b"X"*256)\n'
argv=['/usr/bin/python3','-B',str(REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(R/'cancellation.json'),'--work',str(W),'--live-limit','4096','--write-limit','4096','--file-limit','4096','--rss-limit',str(128*1048576),'--cpu-limit','2','--wall-limit','5','--output-limit','1024','--','/usr/bin/python3','-B','-c',code]
pre=dict(at=time.time(),argv=argv,python=str(pathlib.Path('/usr/bin/python3').resolve()),pythonSHA256=hashlib.sha256(pathlib.Path('/usr/bin/python3').read_bytes()).hexdigest(),socketBytes=23,mountArgv=[],mountFiles=[],guestMountParserInvoked=False,sourcePins=d['sourcePins'],freeBytes=v.f_bavail*v.f_frsize,MemAvailable=mem,limits={str(k):list(resource.getrlimit(k)) for k in [resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]})
(R/'preflight.json').write_text(json.dumps(pre))
q=run(argv,cwd=REPO);start=time.monotonic();out=bytearray();err=bytearray();owned={};external=None;peak=0
for s in [q.stdout,q.stderr]:os.set_blocking(s.fileno(),False)
while True:
    rows=snap();selected={q.pid};old=set()
    while old!=selected:
        old=set(selected);selected.update(pid for pid,row in rows.items() if row['ppid'] in selected)
    for pid in selected:
        if pid in rows:owned[(pid,rows[pid]['start'])]=rows[pid]
    parent=rows.get(os.getpid(),{}).get('rss',0);rss=parent+sum(rows.get(pid,{}).get('rss',0) for pid in selected);peak=max(peak,rss)
    for s,b in [(q.stdout,out),(q.stderr,err)]:
        try:b.extend(os.read(s.fileno(),65536))
        except BlockingIOError:pass
    if time.monotonic()-start>8:external='8 second external safety guard'
    if parent>128*1048576 or rss>512*1048576:external='physical RSS safety guard'
    if len(out)+len(err)>2*1048576:external='capture safety guard'
    if external:
        for pid in selected:
            try:os.kill(pid,signal.SIGKILL)
            except ProcessLookupError:pass
        q.wait(timeout=1);break
    if q.poll() is not None:
        out.extend(q.stdout.read() or b'');err.extend(q.stderr.read() or b'');break
    time.sleep(.005)
(R/'cli.stdout').write_bytes(out);(R/'cli.stderr').write_bytes(err)
try:report=json.loads(out)
except Exception:report={}
br=report.get('backendReceipt',{})
for pid,identity in br.get('owned',[]):
    owned.setdefault((pid,str(identity)),dict(pid=pid,start=str(identity),source='authoritative backend'))
rows=snap();remaining=[row for (pid,start),row in owned.items() if pid in rows and rows[pid]['start']==start]
mounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(W/'domain') in x]
output=base64.b64decode(br.get('output',{}).get('data',''))
final=dict(task=d['task'],candidate=d['candidate'],cliExit=q.returncode,cliReport=report,capturedOutputBytes=len(output),stopReason=br.get('stopReason'),supervisorTruncated=len(output)==1024,externalSafetyAction=external,observedIdentities=list(owned.values()),remainingIdentities=remaining,remainingMounts=mounts,peakOuterGroupRSS=peak,wallSeconds=time.monotonic()-start,acceptance=q.returncode!=0 and report.get('accepted') is False and br.get('stopReason')=='output limit' and len(output)==1024 and report.get('cleanupComplete') is True and not remaining and not mounts and external is None,limitations=['Only observed output gate qualified; full resource/gameplay acceptance unknown','Browser allowance unchanged: CPU35.353183 wall101.495550694 capture1'])
(R/'runtime-receipt.json').write_text(json.dumps(final,indent=2))
bundle={p.name:base64.b64encode(p.read_bytes()).decode() for p in [R/'runtime-receipt.json',R/'preflight.json',R/'cli.stdout',R/'cli.stderr']}
print(json.dumps(bundle))
