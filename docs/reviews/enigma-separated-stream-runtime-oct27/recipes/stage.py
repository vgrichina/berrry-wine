from work import *
M=ROOT/'scratch/usage-watch/enigma-exact-production-runtime-map-oct27.json'
rows=json.loads(M.read_text())['rows']
if sys.argv[1]=='preflight':
 gate('prestage');j=py('import os,json,pathlib,shutil,resource; p=pathlib.Path('+repr(R+'/ops')+');p.mkdir(parents=True,exist_ok=True);(p/"diagnostic.txt").open("a").write("PASS\\n");print(json.dumps(dict(free=shutil.disk_usage(p).free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,limits=pathlib.Path("/proc/self/limits").read_text())))');save('remote-preflight.json',j);print(j)
elif sys.argv[1]=='files':
 a,b=map(int,sys.argv[2:]);gate('stage-'+str(a))
 items=[]
 for row in rows[a:b]:
  p=pathlib.Path(row['path']);assert p.stat().st_size==row['bytes'] and sha(p.read_bytes())==row['sha256'];items.append((row['target'],p))
 transfer(items);save('stage-'+str(a)+'.json',dict(start=a,end=min(b,len(rows)),files=len(items),at=time.time()));print('staged',a,b)
elif sys.argv[1]=='extras':
 items=[('ops/runtime-map.json',M),('modules/wine-assembly.wasm',pathlib.Path('/tmp/enigma-reconciled-canonical-boat-build-oct26/modules/wine-assembly.wasm'))]
 for n,h in [('enigma-frozen-gameplay-controller.py','77997362d75f9873cd8b022b4840606ed1b66780171e7c82d8f8a6f20b304f26'),('enigma-supervised-gameplay.py','ed3cfbb659a3ed6bdc6e218293579613a1709da1ab283f87a0b59de706048aa9')]:
  p=pathlib.Path('/tmp/enigma-streams-independent-accept-integrate-oct27/repo/tools')/n;assert sha(p.read_bytes())==h;items.append(('runner/tools/'+n,p))
 transfer(items);print('extras staged')
elif sys.argv[1]=='empty':
 items=[(r['target'],pathlib.Path(r['path'])) for r in rows if r['bytes']==0];transfer(items);save('empty-files-correction.json',dict(at=time.time(),count=len(items),cause='transfer read loop skipped zero-length files',guestStarted=False));print('corrected empty file materialization',len(items))
elif sys.argv[1]=='verify':
 j=py('import pathlib,json,hashlib,shutil;h=pathlib.Path('+repr(R)+');m=json.loads((h/"ops/runtime-map.json").read_text());bad=[];total=0\nfor r in m["rows"]:\n p=h/r["target"];b=p.read_bytes();total+=len(b)\n if len(b)!=r["bytes"] or hashlib.sha256(b).hexdigest()!=r["sha256"]:bad.append(r["target"])\nv=dict(rows=len(m["rows"]),bytes=total,mismatches=bad,moduleSha256=hashlib.sha256((h/"modules/wine-assembly.wasm").read_bytes()).hexdigest(),free=shutil.disk_usage(h).free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024);(h/"ops/verified.json").write_text(json.dumps(v,indent=2));print(json.dumps(v));assert not bad')
 save('remote-verified.json',json.loads(j['stdout']));print(j['stdout'])
