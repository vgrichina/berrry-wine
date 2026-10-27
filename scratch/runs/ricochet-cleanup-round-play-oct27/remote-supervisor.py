import pathlib,os,sys,json,time,resource,hashlib,subprocess,importlib.util,shutil
H=pathlib.Path(__file__).parent;mode=sys.argv[1];E=H/mode;E.mkdir(exist_ok=True)
env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC','NODE_PATH':str(H/'runner/node_modules')}
os.environ.clear();os.environ.update(env)
p=H/'trusted-supervisor.py';assert hashlib.sha256(p.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
s=importlib.util.spec_from_file_location('trusted',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
start=time.monotonic()
def check():
 files=[p for p in H.rglob('*') if p.is_file()];allocated=sum(p.stat().st_blocks*512 for p in files);streams=sum(p.stat().st_size for p in E.glob('*.stdout'))+sum(p.stat().st_size for p in E.glob('*.stderr'));pngs=list((H/'serial').glob('*.png')) if (H/'serial').exists() else []
 if streams>2097152:return 'combined-output'
 if len(pngs)>6 or sum(p.stat().st_size for p in pngs)>12582912 or any(p.stat().st_size>2097152 for p in pngs):return 'capture-budget'
 if allocated>268435456 or shutil.disk_usage(H).free-max(0,268435456-allocated)<2982150144:return 'remote-disk'
 if int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024<805306368:return 'host-memory'
 if time.time()>=1793092500:return 'guest-cutoff'
 return None
assert not check();assert resource.getrlimit(resource.RLIMIT_AS)==(-1,-1) and resource.getrlimit(resource.RLIMIT_DATA)==(-1,-1)
r=m.supervise([sys.executable,'-S',str(H/'remote-child.py'),mode],rss_limit=3221225472,cpu_limit=90,wall_limit=120,output_limit=2097152,check=check)
r['output']=r['output'].decode('utf8','replace');r.update(box='bx_e9mecsag',boxState='RUNNING',shutdownOwner='coordinator',at=time.time(),elapsed=time.monotonic()-start)
(E/'supervision.json').write_text(json.dumps(r,indent=2))
