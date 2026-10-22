
import pathlib,subprocess,json,hashlib,os,time
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22');e=r/'evidence/host-census-canonical-20261022T1237Z';old=r/'evidence/canonical-qualification-20261022T1226Z/source-manifest.json'
rows=json.loads(old.read_text()); changed=[]
for x in rows:
 p=r/x['path'];h=hashlib.sha256(p.read_bytes()).hexdigest()
 if h!=x['sha256']:
  assert x['path']=='tools/callback-ownership-census.json' and h=='187ada2d73b6bc94ba227f044a526b1684565a32b47d40e914984789237904ff';changed.append(x['path']);x.update(sha256=h,bytes=p.stat().st_size)
assert changed==['tools/callback-ownership-census.json'];assert len(rows)==1078
assert hashlib.sha256((r/'test/test-getprocaddress-sparse-name.js').read_bytes()).hexdigest()=='6c887c8b7e9da0605cd799c90f36611c5c762623f43a28d8b9fec6a9e1f2c5ec'
(e/'source-manifest.json').write_text(json.dumps(rows,indent=2))
def pins():
 o=pathlib.Path('/home/user/aoe3-original-oct22');out=[]
 for base,entries in [(o/'runtime',json.loads((o/'runtime-pins.json').read_text())),(o/'installed',json.loads((o/'installed-audit/installed-manifest.json').read_text())['files'])]:
  for x in entries:
   p=base/x['path'];assert p.stat().st_size==x['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'];out.append(x)
 assert len(out)==373
 return dict(count=373,passAll=True)
env=os.environ.copy();env['NODE_PATH']='/home/user/aoe3-original-oct22/runner/node_modules'
info=dict(candidate='28379f3d7',parent='854f3bdd3d73434b048ee0e6070c00914628d8f4',cwd=str(r),command=['bash','tools/build.sh'],environment={k:v for k,v in env.items() if k in ['NODE_PATH','PATH','LANG','LC_ALL','WINE_WAT_COMPILER','NODE_OPTIONS']},node=subprocess.check_output(['node','--version'],text=True).strip(),pinsBefore=pins(),attempt=1,startedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
assert not (e/'build-start.json').exists();(e/'build-start.json').write_text(json.dumps(info,indent=2))
with (e/'build.log').open('w') as log:
 try:
  p=subprocess.run(['bash','tools/build.sh'],cwd=r,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=240);info['exit']=p.returncode
 except subprocess.TimeoutExpired:info.update(exit=None,timeout=True)
info.update(endedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),pinsAfter=pins(),logSHA256=hashlib.sha256((e/'build.log').read_bytes()).hexdigest())
m=r/'build/wine-assembly.wasm';info['module']=dict(path=str(m),sha256=hashlib.sha256(m.read_bytes()).hexdigest(),bytes=m.stat().st_size) if info['exit']==0 else None
(e/'build-result.json').write_text(json.dumps(info,indent=2));print(json.dumps(dict(result=info,log=(e/'build.log').read_text(),remoteEvidence=str(e))))
