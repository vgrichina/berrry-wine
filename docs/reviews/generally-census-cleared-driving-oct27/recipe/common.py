import pathlib,json,hashlib,subprocess,shlex,time,os,shutil,base64
H=pathlib.Path(__file__).parent;R=H.parent/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');M=1048576
PIN='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba';BOX='bx_kx2vf4s8';REMOTE='/tmp/generally-census-cleared-driving-oct27';S=REMOTE+'/runner';O=REMOTE+'/ops'
def save(n,x):(H/n).write_text(json.dumps(x,indent=2))
def sha(b):return hashlib.sha256(b).hexdigest()
def api(label,command,timeout=30,detach=False):
 assert len(command.encode())<=36000
 used=sum(p.stat().st_size for p in H.glob('*.api.stdout'))
 assert used+1048576<8388608
 argv=['/home/user/.ascii/boat','exec',BOX,'--json','--no-update']+(['--detach'] if detach else ['--timeout',str(timeout)])+['--','bash','-lc',command]
 with open(H/(label+'.api.stdout'),'wb') as out,open(H/(label+'.api.stderr'),'wb') as err:q=subprocess.run(argv,stdout=out,stderr=err)
 raw=(H/(label+'.api.stdout')).read_bytes();save(label+'.command.json',dict(argvPrefix=argv[:-1],commandBytes=len(command.encode()),commandSHA256=sha(command.encode()),sha256=sha(json.dumps(argv).encode()),exit=q.returncode,rawBytes=len(raw),recovery='stage-manifest source pins plus stage.py deterministic tar/chunk recipe; API command hash binds actual argv'))
 assert q.returncode==0,(label,'provider exit',q.returncode,(H/(label+'.api.stderr')).read_text()[:1000])
 x=json.loads(raw);assert not x.get('launcherFailed') and not x.get('oomKilled'),x
 if not detach:assert x.get('exitCode')==0,(label,x)
 return x
def py(label,code,**kw):return api(label,'python3 -B -c '+shlex.quote(code),**kw)
def admission(label):
 peers=[]
 for p in pathlib.Path('/proc').iterdir():
  try:
   c=(p/'cmdline').read_bytes().split(b'\0')
   if c and pathlib.Path(os.fsdecode(c[0])).name=='codex' and (b'exec' in c or b'resume' in c):peers.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096))
  except (OSError,ValueError):pass
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 required=sum(max(0,320*M-p['rss']) for p in peers)+512*M+805306368
 used=sum(x.lstat().st_blocks*512 for x in H.parent.rglob('*'));free=shutil.disk_usage(H).free
 q=dict(at=time.time(),peers=peers,MemAvailable=mem,required=required,sharedPoolCountedOnce=512*M,localAllocated=used,localLimit=192*M,reserve=8*M,free=free,passGate=mem>=required and used+8*M<=192*M and free-(192*M-used)>=2982150144)
 save(label+'.json',q);assert q['passGate'],q
