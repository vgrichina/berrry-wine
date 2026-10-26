import os,sys,pathlib,json,resource,subprocess,time,hashlib,shutil,signal,ctypes
H=pathlib.Path('/tmp/gl-launch-controls-independent-accept-oct26'); R=pathlib.Path('/home/user/wine-assembly'); S=pathlib.Path('/tmp/gl-browser-launch-control-repair-oct26/source')
os.environ.update(PYTHONDONTWRITEBYTECODE='1',NODE_PATH='/tmp/wa-local-runtime-deps/node_modules',CHROME='/usr/bin/google-chrome',TMPDIR=str(H/'tmp'),GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',GIT_CONFIG_COUNT='2',GIT_CONFIG_KEY_0='gc.auto',GIT_CONFIG_VALUE_0='0',GIT_CONFIG_KEY_1='maintenance.auto',GIT_CONFIG_VALUE_1='false')
name=sys.argv[1]; cmd=sys.argv[2:]
# Admission includes actual clients already consumed in MemAvailable: reserve only their unconsumed allocation.
procs=[]
for p in pathlib.Path('/proc').iterdir():
 try:
  args=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(); rss=int((p/'statm').read_text().split()[1])*4096
  if '/bin/codex exec --profile wine-worker ' in args and args.startswith('/opt/'): procs.append(dict(pid=int(p.name),rss=rss,args=args[:180]))
 except (OSError,ValueError,IndexError): pass
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
required= (256+768+1792+64*max(0,len(procs)-1))*1048576+sum(max(0,268435456-p['rss']) for p in procs)
roots=[H,R/'scratch/usage-watch/gl-launch-controls-independent-accept-oct26']
roots+=list(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ.get('CODEX_THREAD_ID','NONE')+'*'))
walfile=H/'ops/wal-baseline.json'
if not walfile.exists(): walfile.write_text(json.dumps({str(p):p.stat().st_blocks*512 for p in pathlib.Path('/home/user/.codex').glob('*-wal')}))
wal=json.loads(walfile.read_text())
def disk():
 total=sum(sum(q.lstat().st_blocks*512 for q in ([p]+list(p.rglob('*')) if p.is_dir() else [p]) if q.exists() and not q.is_symlink()) for p in roots)
 total+=sum(max(0,pathlib.Path(p).stat().st_blocks*512-n) for p,n in wal.items() if pathlib.Path(p).exists())
 return total+8*1048576+4*1048576
ad=dict(memAvailable=mem,requiredIncremental=required,clients=procs,diskProjected=disk()+4*1048576,hostProjectedFree=shutil.disk_usage(H).free-16*1048576,roots=list(map(str,roots)),limits=dict(RSS=268435456,CPU=90,wall=120,file=25165824,output=2097152,excerpt=8192,GitDATA=536870912,NodeDATA='inherited',NodeAS='inherited'),mountArgv=None,mountValidation='N/A local readonly paths, no guest or mount')
(H/'ops'/f'{name}-admission.json').write_text(json.dumps(ad,indent=2))
assert mem>=required,ad
assert ad['diskProjected']<=64*1048576 and ad['hostProjectedFree']>=2982150144,ad
# Validate exact source inputs before execution, no duplicate source tree.
inputs=json.load(open(R/'scratch/usage-watch/gl-launch-controls-independent-accept-oct26-inputs.json'))
for f in inputs['files']: assert hashlib.sha256((S/f['path']).read_bytes()).hexdigest()==f['sha256']
(H/'ops/inputs.json').write_text(json.dumps(inputs,indent=2))
def limits():
 for k,n in [(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,25165824)]:
  a,b=resource.getrlimit(k);resource.setrlimit(k,(min(a,n) if a>=0 else n,min(b,n) if b>=0 else n))
# Independent enclosing physical monitor. Test descendant stays within this process group.
assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
p=subprocess.Popen(cmd,cwd=S,env=os.environ,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=limits,start_new_session=True)
os.set_blocking(p.stdout.fileno(),False); out=bytearray(); peak=0; start=time.monotonic(); reason=None; identities={}; cpu={}
while True:
 try: out.extend(os.read(p.stdout.fileno(),65536))
 except BlockingIOError: pass
 rows={}
 for q in pathlib.Path('/proc').iterdir():
  try:
   raw=(q/'stat').read_text(); f=raw[raw.rindex(')')+2:].split(); rows[int(q.name)]=(int(f[1]),f[19],max(0,int(f[21]))*4096,sum(int(f[i]) for i in (11,12,13,14))/os.sysconf('SC_CLK_TCK'))
  except (OSError,ValueError,IndexError): pass
 selected={pid:r for pid,r in rows.items() if pid==p.pid or (pid,r[1]) in identities or r[0]==os.getpid()}
 changed=True
 while changed:
  changed=False
  for pid,r in rows.items():
   if pid not in selected and r[0] in selected: selected[pid]=r; changed=True
 for pid,r in selected.items(): identities[(pid,r[1])]=r;cpu[(pid,r[1])]=max(cpu.get((pid,r[1]),0),r[3])
 rss=sum(r[2] for r in selected.values())+rows.get(os.getpid(),(0,0,0,0))[2]
 peak=max(peak,rss)
 if sum(cpu.values())>90 or rss>268435456 or len(out)>2097152 or time.monotonic()-start>120 or disk()>64*1048576:
  reason='outer resource gate';os.killpg(p.pid,signal.SIGKILL)
 if p.poll() is not None: break
 time.sleep(.005)
while True:
 data=p.stdout.read()
 if not data: break
 out.extend(data)
(H/'ops'/f'{name}.log').write_bytes(out[:2097152]); rec=dict(argv=cmd,exit=p.returncode,stopReason=reason,peakRSS=peak,cpuSeconds=sum(cpu.values()),owned=[list(k) for k in identities],wall=time.monotonic()-start,outputBytes=len(out));(H/'ops'/f'{name}.json').write_text(json.dumps(rec,indent=2));print(json.dumps(rec));print(out[:8192].decode(errors='replace'))
sys.exit(1 if reason else p.returncode)
