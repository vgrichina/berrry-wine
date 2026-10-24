import pathlib,json,os,shutil,subprocess,hashlib,re
H=pathlib.Path(__file__).parent; O=pathlib.Path('/tmp/maelstrom-tree-mounted-runtime-oct24'); C=pathlib.Path('/home/user/.codex')
session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*')); launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-poststart-phase-capture-oct24')
size=lambda p:sum(f.stat().st_size for f in p.rglob('*') if f.is_file()) if p.exists() else 0
m=json.load(open(O/'manifest.json'));sql={str(f):f.stat().st_size for f in C.glob('*.sqlite*') if f.is_file()};(H/'sqlite-baseline.json').write_text(json.dumps(sql))
charges=dict(remoteClosure=sum(x['bytes'] for x in m),remoteHelpersEvidence=1500000,checkoutGit=4000000,localHelpersEvidence=3000000,transferOverlap=1000000,sessionFull=session.stat().st_size,launcherFull=size(launcher),sqlitePositive=0,externalFuture=16000000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
j=dict(charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,remoteFree=48797409280,remoteAfter=48797409280-peak,session=str(session),launcher=str(launcher),sourceMemAvailable=mem,perFileMax=max(x['bytes'] for x in m),standingManifest=str(O/'manifest.json'),capturePrior=150000,standingTools=[])
for name in ['git','python3','node']:
 p=pathlib.Path(shutil.which(name)).resolve();j['standingTools'].append(dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
j['passAdmission']=peak<=67108864 and free-peak>=2982150144 and mem>=805306368 and j['perFileMax']<=25165824
(H/'admission.json').write_text(json.dumps(j,indent=2));assert j['passAdmission'];print(peak,free,mem)
for name in ['work.py','stage.py','capture.cjs','preflight.py','supervise.py','validate-tree.cjs','collect.py']:
 s=(O/name).read_text().replace(str(O),str(H)).replace('bx_7y65jhum','bx_wc4mkcn9').replace('1792826940','1792829290').replace('latest start07:29UTC','latest start08:08:10UTC').replace('shutdown07:35UTC','shutdown08:15UTC').replace('2026-10-24T07:42:18.192Z','2026-10-24T08:20:57.580Z')
 if name=='collect.py':s=s.replace('total=75000','total=150000').replace('prior=75000,collected=total-75000','prior=150000,collected=total-150000')
 (H/name).write_text(s)
(H/'manifest.json').write_text(json.dumps(m,indent=2))
a=json.load(open(O/'guest-args.json'));a=[s.replace(str(O),str(H)) for s in a]
delta=json.load(open('/tmp/maelstrom-poststart-state-cause-oct24/repo/docs/re-notes/maelstrom-poststart-state-cause-20261024/capture-delta.json'))['argvDelta']
keys=[s.split('=')[0] for s in delta];a=[s for s in a if s.split('=')[0] not in keys];a += [s.replace('OWN',str(H/'guest')) for s in delta]
assert len(a)==len(set(a));(H/'guest-args.json').write_text(json.dumps(a,indent=2))
(H/'capture-delta.json').write_text(json.dumps(delta,indent=2))
