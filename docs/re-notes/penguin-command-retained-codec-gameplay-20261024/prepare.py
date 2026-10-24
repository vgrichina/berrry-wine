import os,pathlib,json,hashlib,subprocess,time
H=pathlib.Path('/tmp/penguin-retained-codec-oct24'); D='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23'; REV='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
os.environ['GIT_NO_LAZY_FETCH']='1'
def readgit(p):return subprocess.check_output(['git','-C',D,'show',REV+':'+p],timeout=20)
def sha(b):return hashlib.sha256(b).hexdigest()
m=[]
a=json.load(open('/tmp/airstrike-original-bounded-runtime-oct24/repo/docs/re-notes/airstrike-original-bounded-runtime-20261024/historical-harness-manifest.json'))
for x in a['files']:
 b=readgit(x['path']); assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['path'];m.append(dict(x,target='runner/'+x['path'],kind='git'))
old=json.load(open('/tmp/penguin-original-runtime-oct24/admission.json'))
for x in old['manifest']:
 if x['path'].startswith('/'):
  b=pathlib.Path(x['path']).read_bytes();assert sha(b)==x['sha256'];m.append(dict(x,kind='file'))
codec=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22')
for x in json.load(open(codec/'receipt.json'))['files']:
 p=codec/x['path'].removeprefix('runner/');b=p.read_bytes();assert len(b)==x['size'] and sha(b)==x['sha256'];m.append(dict(path=str(p),target=x['path'],bytes=len(b),sha256=sha(b),kind='file'))
sql={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file()}
allow={'localCheckoutGitReport':4*1024**2,'boundedTransportMemoryOrTemp':1024**2,'logsEvidenceBothHosts':6*1024**2,'externalSessionEventsSqlitePositiveAndFuture':20*1024**2,'reserve':8*1024**2,'bootstrapCaptures':200000}
total=sum(x['bytes'] for x in m)+sum(allow.values());free=os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize
j=dict(at=time.time(),manifest=m,remotePayload=sum(x['bytes'] for x in m),allowances=allow,projected=total,cap=64*1024**2,localFree=free,localAfter=free-total,remoteFree=48796590080,remoteAfter=48796590080-total,sqliteBaseline=sql,perFileMax=max(x['bytes'] for x in m),source=D,revision=REV,transfer='one final remote tree; <=1MiB in-memory transport; no local payload or archives',passAdmission=total<=64*1024**2 and free-total>=2982150144)
(H/'admission.json').write_text(json.dumps(j,indent=2));assert j['passAdmission'];print({k:j[k] for k in ['remotePayload','projected','localAfter','passAdmission']})
