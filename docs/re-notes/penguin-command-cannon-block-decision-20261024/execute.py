from setup import *
import base64,zlib
assert time.time()<1792821330
state=subprocess.check_output(['/home/user/.ascii/boat','--no-update','--json','info','bx_rcsfy9bm']);save('box-before.json',json.loads(state));assert json.loads(state)['sandbox']['state']=='idle'
m=json.load(open(OLD/'manifest.json'))
expected=[dict(target=x['target'],bytes=x['bytes'],sha256=x['sha256']) for x in m]
code='''import pathlib,json,hashlib,os,re
H=pathlib.Path('/tmp/penguin-immediate-shot-state-oct24')
m=json.load(open(H/'manifest.json')) if (H/'manifest.json').exists() else MANIFEST
for x in m:
 b=(H/x['target']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['target']
mem=int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
free=os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize
assert mem>=2684354560 and free-57888608>=2982150144
print(json.dumps(dict(files=len(m),bytes=sum(x['bytes'] for x in m),hashesPass=True,memAvailable=mem,free=free,newReserve=1500000,ownedNodePids=[int(p.name) for p in pathlib.Path('/proc').glob('[0-9]*') if (p/'cmdline').exists() and (lambda a:a and pathlib.Path(a[0]).name=='node' and str(H/'runner/test/run.js') in a)((p/'cmdline').read_bytes().decode(errors='replace').split('\\0'))])))
'''
# One compressed manifest transport; metadata only, no restaging of closure.
code=code.replace('MANIFEST','json.loads(__import__("zlib").decompress(__import__("base64").b64decode('+repr(base64.b64encode(zlib.compress(json.dumps(expected).encode())).decode())+')))')
j=py(code);save('fresh-preflight-api.json',j);r=json.loads(j['stdout']);assert r['files']==291 and r['bytes']==15760340 and not r['ownedNodePids']
args=json.load(open(OLD/'cannon-args.json'))
args=[x for x in args if not x.startswith('--trace-at') and not x.startswith('--input=')]
orig=next(x for x in json.load(open(OLD/'cannon-args.json')) if x.startswith('--input='))
schedule=','.join(x for x in orig[len('--input='):].split(',') if ':png:' not in x and ':dump-mem:' not in x)
args+=['--input='+schedule,'--trace-eip-range=0x406d80-0x406f50','--trace-eip-from=39999','--trace-eip-detail','--trace-eip-stream','--trace-eip-dump=0x4130a0:8,0x410110:12,0x413e50:4,0x413f30:4,0x4d0750:32']
save('decision-args.json',args)
s=(OLD/'supervise.py').read_text().replace("name=sys.argv[1];assert name in ['filter','cannon']","name=sys.argv[1];assert name == 'decision'")
s=s.replace("cwd=H/'runner'","cwd=pathlib.Path('/tmp/penguin-immediate-shot-state-oct24/runner')").replace('24*1024**2,24*1024**2','524288,524288')
(H/'supervise.py').write_text(s)
payload={n:(H/n).read_text() for n in ['supervise.py','decision-args.json']}
code='import pathlib,json;h=pathlib.Path('+repr(str(H))+');h.mkdir(exist_ok=False);d=json.loads('+repr(json.dumps(payload))+');[(h/n).write_text(s) for n,s in d.items()];print("own supervisor and args staged; closure reused")'
save('helper-stage-api.json',py(code))
# Complete local admission includes external launcher, full current session and positive SQLite growth.
C=pathlib.Path('/home/user/.codex');baseline=json.load(open(H/'sqlite-baseline.json'))
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
session=list(C.glob('sessions/2026/10/24/*'+os.environ['CODEX_THREAD_ID']+'*'));assert len(session)==1
charges=dict(localOwned=size(H),session=session[0].stat().st_size,launcher=size(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-cannon-block-decision-oct24')),positiveSQLite=sum(max(0,p.stat().st_size-baseline.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),remoteNewAllowance=1500000,transportHistory=2000000,future=16000000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage('/tmp').free
save('preguest-admission.json',dict(charges=charges,peak=peak,cap=67108864,localFree=free,localAfter=free-peak,remote=r,passAdmission=peak<=67108864 and free-peak>=2982150144));assert peak<=67108864 and free-peak>=2982150144
assert not (H/'guest-launch-api.json').exists()
j=remote('python3 '+shlex.quote(str(H/'supervise.py'))+' decision',100);save('guest-launch-api.json',j);print(j['stdout'])
for name in ['output.log','command.json','terminal.json']:
 j=py('import pathlib,base64,json,hashlib,zlib;b=pathlib.Path('+repr(str(H/'decision'/name))+').read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),data=base64.b64encode(zlib.compress(b)).decode())))')
 o=json.loads(j['stdout']);b=zlib.decompress(base64.b64decode(o.pop('data')));assert len(b)==o['bytes'] and sha(b)==o['sha256'];(E/name).write_bytes(b);save('seal-'+name+'.json',o)
print((E/'output.log').read_text()[-15000:])
