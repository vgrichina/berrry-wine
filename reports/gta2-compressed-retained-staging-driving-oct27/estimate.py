import gzip
rc=json.loads((O/'source-readiness.json').read_text());rows=[dict(r,kind='source',target=r['path']) for r in rc['sourceFiles']]+[dict(r,kind='game',target=str(pathlib.Path(r['path']).relative_to(ROOT))) for r in json.loads((ROOT/'scratch/usage-watch/gta2-driving-input-readiness-oct27.json').read_text())['files']]
completed=json.loads(pathlib.Path('/tmp/gta2-census-cleared-driving-oct27/ops/completed-pins.json').read_text());save('completed-shape.json',dict(type=type(completed).__name__,count=len(completed),first=str(completed)[:200]))
# Git child alone receives DATA limit; fixed 128MiB outer bound covers aggregate stream memory.
def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
with open('/tmp/wine-ops-production-git.lock','a') as lk:
 fcntl.flock(lk,fcntl.LOCK_EX)
 with (O/'estimate-git.stderr').open('xb') as err:
  p=subprocess.Popen(['git','-C',str(H/'repo'),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,preexec_fn=lim,env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0'));groups=[]
  for start in range(320,len(rows),40):
   batch=rows[start:start+40];buf=io.BytesIO();pins=[]
   with tarfile.open(fileobj=buf,mode='w:gz',compresslevel=6) as t:
    for r in batch:
     if r['kind']=='source':
      p.stdin.write((r['oid']+'\n').encode());p.stdin.flush();header=p.stdout.readline().decode().split();assert header==[r['oid'],'blob',str(r['bytes'])];b=p.stdout.read(r['bytes']);assert p.stdout.read(1)==b'\n'
     else:b=pathlib.Path(r['path']).read_bytes();assert sha(b)==r['sha256']
     assert len(b)==r['bytes'];i=tarfile.TarInfo(r['target']);i.size=len(b);t.addfile(i,io.BytesIO(b));pins.append(dict(target=r['target'],bytes=len(b),sha256=sha(b),oid=r.get('oid'),kind=r['kind']))
   z=buf.getvalue();groups.append(dict(start=start,count=len(batch),bytes=sum(x['bytes'] for x in pins),gzipBytes=len(z),base64Bytes=((len(z)+2)//3)*4,requests=max(1,(((len(z)+2)//3)*4+29999)//30000),pins=pins))
  p.stdin.close();assert p.wait(timeout=5)==0
old=pathlib.Path('/tmp/gta2-census-cleared-driving-oct27/ops');lat=[]
for f in (old/'requests').glob('*.terminal.json'):
 j=json.loads(f.read_text());st=f.with_name(f.name.replace('.terminal','.start'))
 if st.exists() and 'at' in j:lat.append(j['at']-json.loads(st.read_text())['at'])
lat.sort();avg=sum(lat)/len(lat);remainingRequests=sum(g['requests'] for g in groups);raw=sum(p.stat().st_size for p in (old/'responses').iterdir())+sum(p.stat().st_size for p in (O/'responses').iterdir());source=rc['sourceBytes'];game=rc['gameBytes'];peak=source+game+max(g['base64Bytes']+g['gzipBytes']+g['bytes'] for g in groups)+64*1048576+16*1048576+180*1048576
v=dict(at=time.time(),sourceBytes=source,gameBytes=game,remainingBytes=sum(g['bytes'] for g in groups),gzipBytes=sum(g['gzipBytes'] for g in groups),base64Bytes=sum(g['base64Bytes'] for g in groups),remainingRequests=remainingRequests,measuredHistoricalRequestMean=avg,measuredHistoricalRequestP90=lat[int(len(lat)*.9)],estimatedStageSeconds=remainingRequests*avg,buildGuestCleanupReservedSeconds=600,secondsUntilCutoff=1793106480-time.time(),remotePeak=peak,remoteAllocation=1073741824,rawResponsesUsed=raw,rawResponseProjected=raw+remainingRequests*1200+1048576+6000000,rawAllowance=8388608,groups=groups)
v['timePass']=v['estimatedStageSeconds']+600<v['secondsUntilCutoff'];v['remotePass']=peak<1073741824;v['wirePass']=v['rawResponseProjected']<=8388608
save('compressed-transfer-plan.json',v);print(json.dumps({k:x for k,x in v.items() if k!='groups'}))
