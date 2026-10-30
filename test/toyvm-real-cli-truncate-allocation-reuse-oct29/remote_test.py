import os,sys,time,json,pathlib,hashlib,subprocess,resource,signal,ctypes
ROOT=pathlib.Path('/tmp/tvtrunc');REPO=ROOT/'repo';WORK=ROOT/'w';WORK.mkdir(exist_ok=True)
resource.setrlimit(resource.RLIMIT_DATA,(128*1048576,resource.getrlimit(resource.RLIMIT_DATA)[1]));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1048576,12*1048576))
ctypes.CDLL(None).prctl(36,1,0,0,0)
def rows():
 result={}
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   raw=(p/'stat').read_text();s=raw[raw.rindex(')')+2:].split();result[int(p.name)]=dict(pid=int(p.name),start=s[19],ppid=int(s[1]),state=s[0],cpu=(int(s[11])+int(s[12]))/os.sysconf('SC_CLK_TCK'),rss=int(s[21])*os.sysconf('SC_PAGE_SIZE'),wchan=(p/'wchan').read_text().strip(),cmdSHA256=hashlib.sha256((p/'cmdline').read_bytes()).hexdigest(),stdoutLink=os.readlink(p/'fd/1'),cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')[:400])
  except (FileNotFoundError,ProcessLookupError,PermissionError):pass
 return result
def run(argv,*,cwd,**kw):
 lexical=pathlib.Path(os.path.abspath(cwd))
 if not lexical.is_relative_to(ROOT):raise ValueError('outside task before existence')
 resolved=lexical.resolve(strict=True)
 if not resolved.is_relative_to(ROOT):raise ValueError('escape')
 return subprocess.Popen(argv,cwd=resolved,preexec_fn=lambda:resource.setrlimit(resource.RLIMIT_DATA,(128*1048576,128*1048576)),**kw)
def main():
 d=json.loads((ROOT/'dispatch.json').read_text());pins={}
 for relative,pin in d['sourcePins'].items():
  b=(REPO/relative).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'];pins[relative]=pin
 receipt=ROOT/'cancellation.json';assert hashlib.sha256(receipt.read_bytes()).hexdigest()==d['originalCancellationReceiptPin']['sha256']
 assert len(str(WORK/'status.sock').encode())==26
 assert os.access('/usr/bin/python3',os.X_OK) and os.access('/usr/bin/fusermount3',os.X_OK) and pathlib.Path('/dev/fuse').exists()
 st=os.statvfs(ROOT);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 assert st.f_bavail*st.f_frsize>24*1048576 and mem>512*1048576
 fixture=(ROOT/'fixture.py').read_text()
 argv=['/usr/bin/python3','-B',str(REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(receipt),'--work',str(WORK),'--live-limit','32768','--write-limit','65536','--file-limit','16384','--rss-limit','134217728','--cpu-limit','2','--wall-limit','5','--output-limit','4096','--','/usr/bin/python3','-B','-c',fixture]
 stdout=ROOT/'cli.stdout';stderr=ROOT/'cli.stderr';start=time.monotonic();owned={};samples=[];safety=None
 with stdout.open('wb') as o,stderr.open('wb') as e:
  p=run(argv,cwd=REPO,stdout=o,stderr=e,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
  while True:
   allrows=rows();selected={pid:r for pid,r in allrows.items() if pid==p.pid or (pid,r['start']) in owned};changed=True
   while changed:
    changed=False
    for pid,r in allrows.items():
     if pid not in selected and r['ppid'] in selected:selected[pid]=r;changed=True
   for r in selected.values():owned[(r['pid'],r['start'])]=r
   samples.append(dict(t=time.monotonic()-start,rows=list(selected.values())))
   if p.poll() is not None:break
   if time.monotonic()-start>8:safety='external 8-second guard'
   if sum(r['rss'] for r in selected.values())>512*1048576:safety='external groupRSS guard'
   if stdout.stat().st_size+stderr.stat().st_size>2*1048576:safety='external capture guard'
   if safety:
    for r in selected.values():
     try:
      fd=os.pidfd_open(r['pid']);now=rows().get(r['pid'])
      if now and now['start']==r['start']:signal.pidfd_send_signal(fd,signal.SIGKILL)
      os.close(fd)
     except ProcessLookupError:pass
    break
   time.sleep(.005)
  rc=p.wait(timeout=3)
 if safety:
  deadline=time.monotonic()+2
  while time.monotonic()<deadline:
   try:
    pid,_=os.waitpid(-1,os.WNOHANG)
    if pid==0:time.sleep(.01)
   except ChildProcessError:break
 out=stdout.read_text();err=stderr.read_text();backend=json.loads(out) if out.strip() else None
 finalrows=rows();identities=[]
 for identity,r in owned.items():
  now=finalrows.get(r['pid']);identities.append(dict(**r,absentOrReused=now is None or now['start']!=r['start'],finalState=now['state'] if now and now['start']==r['start'] else None))
 remainingMounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(WORK/'domain') in x]
 br=backend.get('backendReceipt',{}) if backend else {}
 outcome=dict(task=d['task'],candidate=d['candidate'],pins=pins,argv=argv,fixtureSHA256=hashlib.sha256(fixture.encode()).hexdigest(),cliExit=rc,cliStdout=out,cliStderr=err,report=backend,safetyCleanup=safety,observedIdentities=identities,samples=samples,remainingMounts=remainingMounts,elapsed=time.monotonic()-start,mountArgv=[],guestMountParserInvoked=False,admission=dict(f_bavail=st.f_bavail,blockSize=st.f_frsize,MemAvailable=mem),executable=dict(path='/usr/bin/python3',realpath=os.path.realpath('/usr/bin/python3'),sha256=hashlib.sha256(pathlib.Path('/usr/bin/python3').read_bytes()).hexdigest()))
 fs=br.get('filesystem',{});import base64
 payload=base64.b64decode(br.get('output',{}).get('data','')).decode(errors='replace')
 expected=dict(writeA=16384,truncateA=0,AStillLinked=1,writeB=16384,BSize=16384,closedA=True,closedB=True)
 outcome['fixtureOutput']=payload
 outcome['fixtureAssertions']=json.loads(payload) if payload else None
 outcome['gatePASS']=bool(safety is None and rc==0 and backend and backend['accepted'] is True and br.get('stopReason') is None and fs.get('failure') is None and fs.get('openHandles')==0 and fs.get('live')==28672 and fs.get('peak')==28672 and fs.get('written')==32768 and br.get('wallSeconds',99)<5 and br.get('cpuSeconds',99)<2 and outcome['fixtureAssertions']==expected and br.get('cleanupComplete') is True and backend.get('cleanupComplete') is True and not remainingMounts and identities and all(x['absentOrReused'] for x in identities))
 (ROOT/'result.json').write_text(json.dumps(outcome,sort_keys=True));print(json.dumps(outcome,sort_keys=True))
try:main()
except BaseException as e:
 result=dict(blocker=type(e).__name__+': '+str(e),gatePASS=False);(ROOT/'result.json').write_text(json.dumps(result));print(json.dumps(result));raise
