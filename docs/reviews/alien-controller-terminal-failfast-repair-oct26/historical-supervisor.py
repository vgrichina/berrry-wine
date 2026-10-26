import os,sys,pathlib,subprocess,resource,time,json,signal,shutil,ctypes
ctypes.CDLL(None).prctl(36,1,0,0,0)
H=pathlib.Path(__file__).parent;OP=sys.argv[1];E=H/OP;CUTOFF=1793058420
a=json.loads((H/(OP+'-args.json')).read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def scan():
 rows={}
 for q in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   s=(q/'stat').read_text();parts=s[s.rfind(')')+2:].split();rows[int(q.name)]=dict(ppid=int(parts[1]),state=parts[0],start=parts[19],cpu=(int(parts[11])+int(parts[12]))/os.sysconf('SC_CLK_TCK'),rss=int(parts[21])*os.sysconf('SC_PAGE_SIZE'))
  except (OSError,ValueError,IndexError):pass
 return rows
def mem():return int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
assert time.time()<CUTOFF and mem()>=3758096384 and shutil.disk_usage('/tmp').free-201326592>=2982150144
E.mkdir(exist_ok=True)
assert not (E/'command.json').exists()
if OP=='guest':
 with (H/'guest-invocation-once').open('x') as f:f.write(str(time.time()))
with (E/'output.log').open('wb') as f:
 p=subprocess.Popen(a,cwd=H/'runner',env=env,preexec_fn=limits,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 os.set_blocking(p.stdout.fileno(),False);start=time.monotonic();known={};peak=0;cpuPeak=0;n=0;reason='natural'
 (E/'command.json').write_text(json.dumps(dict(argv=a,pid=p.pid,pgid=p.pid,at=time.time(),memAvailable=mem(),limits=dict(cpuTree=90,wallGuest=120,file=25165824,output=2097152,rssTree=3221225472,heapOldSpaceMiB=2048),environment={k:v for k,v in env.items() if k.startswith(('NODE','WINE','ENIGMA','MAELSTROM'))})))
 try:
  while p.poll() is None:
   rows=scan();owners={p.pid,os.getpid()}
   owners.update(pid for pid,s in known.items() if pid in rows and rows[pid]['start']==s['start'])
   for _ in range(len(rows)):
    added={pid for pid,s in rows.items() if s['ppid'] in owners}-owners
    if not added:break
    owners.update(added)
   known.update({pid:rows[pid] for pid in owners if pid in rows})
   live={pid:s for pid,s in rows.items() if pid in known and known[pid]['start']==s['start'] and s['state']!='Z'}
   rss=sum(s['rss'] for s in live.values());cpu=sum(s['cpu'] for s in known.values());peak=max(peak,rss);cpuPeak=max(cpuPeak,cpu)
   try:b=os.read(p.stdout.fileno(),8192)
   except BlockingIOError:b=b''
   if b:
    if n+len(b)>2097152:reason='task-allocation-output-limit';break
    f.write(b);f.flush();n+=len(b)
   if rss>3221225472:reason='rss-tree-limit';break
   if cpu>=90:reason='cpu-tree-limit';break
   if sum(x.lstat().st_blocks*512 for x in [H,*H.rglob('*')])>268435456-8*2**20:reason='remote-allocation';break
   if mem()<805306368 or shutil.disk_usage('/tmp').free<2982150144:reason='host-floor';break
   if time.monotonic()-start>=(118 if OP=='guest' else 25) or time.time()>=CUTOFF:reason='guest-wall-or-cutoff';break
   if (E/'stop').exists():reason='owned-stop';break
   time.sleep(.03)
 finally:
  for sig in [signal.SIGTERM,signal.SIGKILL]:
   rows=scan()
   for pid,s in known.items():
    if pid in rows and rows[pid]['start']==s['start'] and rows[pid]['state']!='Z':
     try:
      if pid!=os.getpid():os.kill(pid,sig)
     except ProcessLookupError:pass
   try:os.killpg(p.pid,sig)
   except ProcessLookupError:pass
   try:p.wait(timeout=.5)
   except subprocess.TimeoutExpired:pass
  p.wait(timeout=1)
  try:
   while b:=os.read(p.stdout.fileno(),8192):
    keep=b[:max(0,2097152-n)];f.write(keep);n+=len(keep)
  except BlockingIOError:pass
 rows=scan();remaining=[pid for pid,s in known.items() if pid in rows and rows[pid]['start']==s['start'] and rows[pid]['state']!='Z' and pid!=os.getpid()]
 (E/'terminal.json').write_text(json.dumps(dict(reason=reason,returncode=p.returncode,elapsed=time.monotonic()-start,peakTreeRSS=peak,peakTreeCPU=cpuPeak,outputBytes=n,identities=known,remainingOwnedLive=remaining,box='bx_nfacjvy7',boxState='RUNNING',shutdownOwner='coordinator')))
