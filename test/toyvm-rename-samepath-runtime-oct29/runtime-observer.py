import os,sys,time,json,pathlib,hashlib,subprocess,resource,signal,ctypes,base64
ROOT=pathlib.Path('/tmp/tvrs');REPO=ROOT/'repo';WORK=ROOT/'w'
soft,hard=resource.getrlimit(resource.RLIMIT_DATA)
assert hard==resource.RLIM_INFINITY or hard>=128*1048576
resource.setrlimit(resource.RLIMIT_DATA,(128*1048576,hard));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1048576,12*1048576))
assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0

def rows():
 result={}
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   raw=(p/'stat').read_text();s=raw[raw.rindex(')')+2:].split();cmd=(p/'cmdline').read_bytes()
   result[int(p.name)]=dict(pid=int(p.name),start=s[19],ppid=int(s[1]),state=s[0],rss=max(0,int(s[21]))*os.sysconf('SC_PAGE_SIZE'),cmdSHA256=hashlib.sha256(cmd).hexdigest(),cmd=cmd.replace(b'\0',b' ').decode(errors='replace')[:400])
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
 for rel,pin in d['sourcePins'].items():
  b=(REPO/rel).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'];pins[rel]=pin
 receipt=ROOT/'cancellation.json';b=receipt.read_bytes();assert len(b)==d['originalCancellationReceiptPin']['bytes'] and hashlib.sha256(b).hexdigest()==d['originalCancellationReceiptPin']['sha256']
 sock=os.fsencode(WORK/'status.sock');assert len(sock)<108 and b'\0' not in sock
 assert not WORK.exists();WORK.mkdir()
 assert os.access('/usr/bin/python3',os.X_OK) and os.access('/usr/bin/fusermount3',os.X_OK) and pathlib.Path('/dev/fuse').exists()
 executablePins={x:dict(realpath=os.path.realpath(x),sha256=hashlib.sha256(pathlib.Path(x).read_bytes()).hexdigest(),bytes=pathlib.Path(x).stat().st_size) for x in ['/usr/bin/python3','/usr/bin/fusermount3']}
 fixture=(ROOT/'fixture.py').read_text()
 argv=['/usr/bin/python3','-B',str(REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(receipt),'--work',str(WORK),'--live-limit','12288','--write-limit','65536','--file-limit','8192','--rss-limit','134217728','--cpu-limit','2','--wall-limit','5','--output-limit','4096','--','/usr/bin/python3','-B','-c',fixture]
 st=os.statvfs(ROOT);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 assert st.f_bavail*st.f_frsize>=3200253952+24*1048576 and mem>=2147483648
 (ROOT/'prelaunch.json').write_text(json.dumps(dict(pins=pins,executablePins=executablePins,argv=argv,socketBytes=len(sock),socketNoNUL=True,MemAvailable=mem,free=st.f_bavail*st.f_frsize,inheritedDATA=list(resource.getrlimit(resource.RLIMIT_DATA)))))
 stdout=ROOT/'cli.stdout';stderr=ROOT/'cli.stderr';start=time.monotonic();owned={};samples=[];safety=None
 with stdout.open('wb') as o,stderr.open('wb') as e:
  p=run(argv,cwd=REPO,stdout=o,stderr=e,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
  while True:
   allrows=rows();selected={pid:r for pid,r in allrows.items() if pid==p.pid or (pid,r['start']) in owned}
   while True:
    before=len(selected)
    for pid,r in allrows.items():
     if r['ppid'] in selected:selected[pid]=r
    if len(selected)==before:break
   for r in selected.values():owned[(r['pid'],r['start'])]=r
   samples.append(dict(t=time.monotonic()-start,rows=list(selected.values())))
   if p.poll() is not None:break
   if time.monotonic()-start>8:safety='external 8-second guard'
   if sum(r['rss'] for r in selected.values())>512*1048576:safety='external groupRSS guard'
   if allrows.get(os.getpid(),{}).get('rss',0)>128*1048576:safety='external parentRSS guard'
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
 out=stdout.read_text();err=stderr.read_text();report=json.loads(out) if out.strip() else {};br=report.get('backendReceipt',{});fs=br.get('filesystem',{})
 final=rows();identities=[]
 for (pid,startid),r in owned.items():
  now=final.get(pid);identities.append(dict(**r,absentOrReused=now is None or now['start']!=startid,finalState=now['state'] if now and now['start']==startid else None))
 mounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(WORK/'domain') in x]
 payload=base64.b64decode(br.get('output',{}).get('data','')).decode(errors='replace')
 sourceAfter={rel:hashlib.sha256((REPO/rel).read_bytes()).hexdigest() for rel in pins}
 identityCheck=bool(br.get('owned') and {tuple(x) for x in br['owned']}<=set(owned))
 gate=bool(safety is None and rc==0 and report.get('accepted') is True and br.get('stopReason') is None and fs.get('failure') is None and fs.get('live')==12288 and fs.get('peak')==12288 and fs.get('written')==0 and fs.get('openHandles')==0 and fs.get('inodes')==3 and 'rename-samepath-preserved' in payload and json.loads(payload).get('nodesPreserved') is True and len(set(json.loads(payload).get('directoryInodes',{}).values()))==2 and br.get('cleanupComplete') is True and report.get('cleanupComplete') is True and not mounts and identities and all(x['absentOrReused'] for x in identities) and identityCheck and all(sourceAfter[k]==v['sha256'] for k,v in pins.items()))
 result=dict(task=d['task'],candidate=d['candidate'],pins=pins,productionInvocations=1,argv=argv,fixtureSHA256=hashlib.sha256(fixture.encode()).hexdigest(),cliExit=rc,cliStdout=out,cliStderr=err,report=report,safetyCleanup=safety,observedIdentities=identities,samples=samples,remainingMounts=mounts,elapsed=time.monotonic()-start,fixtureOutput=payload,executablePins=executablePins,sourceAfter=sourceAfter,productionOwnedIdentityCheck=identityCheck,socketBytes=len(sock),gatePASS=gate)
 (ROOT/'result.json').write_text(json.dumps(result,sort_keys=True));print(json.dumps(result,sort_keys=True))
try:main()
except BaseException as e:
 result=dict(blocker=type(e).__name__+': '+str(e),gatePASS=False);(ROOT/'result.json').write_text(json.dumps(result));print(json.dumps(result));raise
