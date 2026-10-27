import os,sys,json,pathlib,importlib.util,fcntl,shutil,time
sys.dont_write_bytecode = True
P=pathlib.Path('/tmp/gta2-untyped-api-return-observer-repair-oct27')
spec=importlib.util.spec_from_file_location('supervisor','/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
label,kind,*cmd=sys.argv[1:]
receipt=P/'ops'/label
assert not receipt.with_suffix('.json').exists()
os.environ['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['GIT_CONFIG_NOSYSTEM']='1'
os.environ['GIT_CONFIG_COUNT']='2';os.environ['GIT_CONFIG_KEY_0']='gc.auto';os.environ['GIT_CONFIG_VALUE_0']='0';os.environ['GIT_CONFIG_KEY_1']='maintenance.auto';os.environ['GIT_CONFIG_VALUE_1']='false'
out=str(receipt)+'.stdout';err=str(receipt)+'.stderr'
cap=(256 if kind=='git' else 768 if kind=='node' else 128)*1024**2
def allocated(root):
 return sum(p.lstat().st_blocks*512 for p in [root,*root.rglob('*')] if not p.is_symlink()) if root.exists() else 0
def check():
 total=sum(pathlib.Path(f).stat().st_size if pathlib.Path(f).exists() else 0 for f in (out,err))
 if total>2*1024**2:return 'operation output limit'
 if sum(p.stat().st_size for p in (P/'ops').glob('*.stdout'))+sum(p.stat().st_size for p in (P/'ops').glob('*.stderr'))>1024**2:return 'cumulative output limit'
 if allocated(P)+64*1024**2+8*1024**2>256*1024**2:return 'task disk growth/reserve limit'
 if shutil.disk_usage(P).free-3*256*1024**2<2982150144:return 'disk floor'
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 clients=[]
 for pid in (162478,163998,178243):
  try:clients.append(int(pathlib.Path(f'/proc/{pid}/statm').read_text().split()[1])*4096)
  except FileNotFoundError:clients.append(0)
 # MemAvailable already excludes actual resident pages: reserve remaining growth only.
 rows=s.snapshot(); owned={os.getpid()}
 for _ in range(16):
  extra={pid for pid,row in rows.items() if row['ppid'] in owned}
  if extra.issubset(owned):break
  owned.update(extra)
 current_child=sum(row['rss'] for pid,row in rows.items() if pid in owned)
 required=sum(max(0,320*1024**2-rss) for rss in clients)+805306368+max(0,cap-current_child)
 if mem<required:return 'remaining aggregate RAM growth'
 return None
failure=check()
if failure:raise SystemExit(failure)
lock=None
if kind=='git':
 lock=open('/tmp/wine-ops-production-git.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
r=s.supervise([sys.executable,str(P/'ops/child.py'),out,err,kind,*cmd],rss_limit=cap,cpu_limit=90,wall_limit=120,check=check)
r['command']=cmd;r['kind']=kind;r['output']=r['output'].decode(errors='replace');r['at']=time.time()
receipt.with_suffix('.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({k:r[k] for k in ('exit','stopReason','peakRSS','cleanupComplete')}))
for f in (out,err):
 data=pathlib.Path(f).read_bytes() if pathlib.Path(f).exists() else b''
 print(pathlib.Path(f).name+': '+data[:min(3500,8192//2)].decode(errors='replace'))
raise SystemExit(1 if r['stopReason'] else r['exit'] or 0)
