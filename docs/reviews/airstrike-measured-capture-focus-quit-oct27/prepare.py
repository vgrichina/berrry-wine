import pathlib,json,hashlib,tarfile,time,shutil,math
import run as c
H,R=c.H,c.R
D=pathlib.Path('/tmp/airstrike-portable-fixtures-accepted-main-integration-oct27/repo')
assert hashlib.sha256((D.parent/'ops/receipt-manifest.json').read_bytes()).hexdigest()=='63b146fe860bfb21603f1eba79df4de27f164ce3023e2dc80e74c6008a0a00c9'
assert hashlib.sha256(pathlib.Path('/tmp/airstrike-published-portable-focus-quit-oct27/ops/receipt-manifest.json').read_bytes()).hexdigest()=='7f120fb6686d7b72f357ce857feb6bc843390add468d29d8de9e65ee36ab028a'
rows=json.loads((H/'runtime-map.json').read_text())['files'];pins=[]
with tarfile.open('/tmp/airstrike-accepted-dispatch-quit-oct27/ops/git-sources.tar') as t:
 for x in rows:
  b=(D/x['source']).read_bytes() if x.get('gitRevision')=='097f3b2904d833ca8fb152e686032c156c16e39a' else t.extractfile(x['source']).read() if x['kind']=='git' else pathlib.Path(x['source']).read_bytes()
  assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['target']
  pins.append(dict(target=x['target'],bytes=len(b),sha256=x['sha256']))
c.dump('all-runtime-pins.json',dict(files=len(pins),bytes=sum(x['bytes'] for x in pins),pins=pins,readOnlyTar='/tmp/airstrike-accepted-dispatch-quit-oct27/ops/git-sources.tar'))
b=pathlib.Path('/tmp/airstrike-accepted-focus-menu-quit-api-oct27/ops/abi-preload-relocated.cjs').read_bytes().replace(b'/home/user/airstrike-menu-quit-oct27',str(H.parent).encode()).replace(b"/evidence'",b"/ops'")
(H/'abi-preload.cjs').write_bytes(b)
branch='task/airstrike-measured-capture-focus-quit-oct27';g=R/'.git'
for p in ('objects/info','refs/heads/task','info'):(g/p).mkdir(parents=True,exist_ok=True)
(g/'objects/info/alternates').write_text(str(D/'.git/objects')+'\n'+(D/'.git/objects/info/alternates').read_text())
(g/'config').write_text('[core]\n repositoryformatversion = 0\n bare = false\n sparseCheckout = true\n[user]\n name = Wine Ops Worker\n email = wine-ops@local\n[gc]\n auto = 0\n[maintenance]\n auto = false\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n')
(g/'HEAD').write_text('ref: refs/heads/'+branch+'\n');(g/'refs/heads'/branch).write_text('097f3b2904d833ca8fb152e686032c156c16e39a\n');(g/'info/sparse-checkout').write_text('/docs/reviews/airstrike-measured-capture-focus-quit-oct27/\n')
sz=144804;chunk=5700;responses=math.ceil(sz/chunk);envelope=700
latencies=[json.loads((H/('latency-'+str(i)+'.json')).read_text())['seconds'] for i in range(3)]
# Transfer all24 for preservation; only10 reviewed originals are time-critical.
wire=24*(4*math.ceil(sz/3)+responses*envelope)+256*1024+1048576
seconds=10*responses*max(latencies)/2+10*6+10+10
c.dump('capture-plan.json',dict(authorizedCaptures=24,minimum=18,withGameplay=20,observedLosslessBytes=sz,observedSHA256='a0d213dfefdda68876792c1819711dd3c470dfece91b0d9280f6462ce01aee61',chunkBytes=chunk,rawResponseCap=8192,envelopePerResponseProjected=envelope,responsesPerFrame=responses,wireAll24Projected=wire,wireLimit=8388608,cleanupIncluded=1048576,setupStatusIncluded=256*1024,latencies=latencies,timeProjection=dict(reviewedOriginals=10,parallelChunkReaders=2,transferSeconds=10*responses*max(latencies)/2,reviewSeconds=60,startupSeconds=10,actionsSeconds=10,total=seconds,wall=120),passWire=wire<=8388608,passTime=seconds<120,qualification='Projection at actual retained size, not guaranteed future sizes. Guard actual charged bytes before every API operation; no resets. Freshness PNGs preserved remotely then collected after guest; every reviewed original inspected during guest.',guest=0,incidents=['Initial oversized policy displays retained in session','Missing optional preflight.json and proxy.py reads retained; not launched','Mistaken head of installed ELF produced bounded binary display; no executable copy or mutation']))
assert wire<=8388608 and seconds<120
print('265 pins PASS; capture/wire/time projection PASS',len(pins),wire,seconds)
