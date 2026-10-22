import pathlib,subprocess,json,hashlib,base64
E=pathlib.Path('/home/user/wine-assembly-aoe3-reviewed-canonical-localization-oct22/scratch/runs/20261022-aoe3-reviewed-canonical-localization')
d='/home/user/wine-assembly-aoe3-oleaut-independent-sparse-review-oct22';tip='854f3bdd3d73434b048ee0e6070c00914628d8f4'; fixture=subprocess.check_output(['git','-C',d,'show',tip+':test/test-getprocaddress-sparse-name.js'])
code=r'''
import pathlib,hashlib,json,subprocess,os,time,base64
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22'); e=r/'evidence/canonical-qualification-20261022T1226Z';e.mkdir()
f=r/'test/test-getprocaddress-sparse-name.js';data=base64.b64decode(FIXTURE);assert hashlib.sha256(data).hexdigest()==FSHA
# Replace retained obsolete fixture only with exact reviewed Git blob, preserving historical input.
(e/'obsolete-sparse-fixture.js').write_bytes(f.read_bytes());f.write_bytes(data)
paths=sorted([p for d in ['src','lib','tools'] for p in (r/d).rglob('*') if p.is_file()]+[r/'test/test-oleaut32-ordinals.js'],key=lambda p:str(p.relative_to(r)))
rows=[dict(path=str(p.relative_to(r)),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in paths]
identity=hashlib.sha256(''.join(x['path']+'\0'+x['sha256']+'\n' for x in rows).encode().replace(b'\\0',b'\0').replace(b'\\n',b'\n')).hexdigest()
# Explicit binary NUL/newline identity, matching accepted source manifest.
identity=hashlib.sha256(b''.join(x['path'].encode()+bytes([0])+x['sha256'].encode()+bytes([10]) for x in rows)).hexdigest()
assert len(rows)==1078 and identity=='ce23f23ed7fcd525e2e4b4b1afa4d8eeacdb344fc7ca25903e3f78b45eaa9305',(len(rows),identity)
(e/'source-manifest.json').write_text(json.dumps(rows,indent=2))
def pins():
 o=pathlib.Path('/home/user/aoe3-original-oct22');out=[]
 for base,entries in [(o/'runtime',json.loads((o/'runtime-pins.json').read_text())),(o/'installed',json.loads((o/'installed-audit/installed-manifest.json').read_text())['files'])]:
  for x in entries:
   p=base/x['path'];assert p.stat().st_size==x['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'];out.append(x)
 assert len(out)==373
 return dict(count=373,passAll=True)
before=pins();env=os.environ.copy();env['NODE_PATH']='/home/user/aoe3-original-oct22/runner/node_modules'
info=dict(candidateTip=TIP,source='24220bf65a04f665c847fc4037a732f8e82db87c',fixture='2977ba3bd08e5bde5bab5e5323a5de71a14d6b49',cwd=str(r),command=['bash','tools/build.sh'],environment={k:v for k,v in env.items() if k in ['NODE_PATH','PATH','LANG','LC_ALL','WINE_WAT_COMPILER','NODE_OPTIONS']},node=subprocess.check_output(['node','--version'],text=True).strip(),sourceFiles=len(rows),sourceFingerprint=identity,fixtureSHA256=FSHA,pinsBefore=before,startedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),attempt=1)
(e/'build-start.json').write_text(json.dumps(info,indent=2))
with (e/'build.log').open('w') as log:
 p=subprocess.run(['bash','tools/build.sh'],cwd=r,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=540)
info.update(exit=p.returncode,endedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),pinsAfter=pins(),logSHA256=hashlib.sha256((e/'build.log').read_bytes()).hexdigest(),logBytes=(e/'build.log').stat().st_size)
m=r/'build/wine-assembly.wasm';info['module']=dict(path=str(m),sha256=hashlib.sha256(m.read_bytes()).hexdigest(),bytes=m.stat().st_size) if p.returncode==0 else None
(e/'build-result.json').write_text(json.dumps(info,indent=2));print(json.dumps(dict(result=info,log=(e/'build.log').read_text(),remoteEvidence=str(e))))
'''.replace('FIXTURE',repr(base64.b64encode(fixture).decode())).replace('FSHA',repr(hashlib.sha256(fixture).hexdigest())).replace('TIP',repr(tip))
(E/'remote-build-script.py').write_text(code)
p=subprocess.run(['boat','exec','--json','--timeout','570','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'canonical-build-receipt.json').write_text(p.stdout);(E/'canonical-build-cli-stderr.txt').write_text(p.stderr);print(p.stdout,p.stderr)
