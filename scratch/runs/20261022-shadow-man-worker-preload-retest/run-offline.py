import pathlib,json,base64,hashlib,difflib
from remote import run,save
E=pathlib.Path(__file__).resolve().parent
original=(E/'observer.original.cjs').read_text()
guarded=original.replace("'use strict';\n","'use strict';\nif (require('worker_threads').isMainThread) {\n",1)+'}\n'
(E/'observer.guarded.cjs').write_text(guarded)
(E/'observer.diff').write_text(''.join(difflib.unified_diff(original.splitlines(True),guarded.splitlines(True),fromfile='observer.original.cjs',tofile='observer.guarded.cjs')))
save('observer-hashes.json',{k:hashlib.sha256(v.encode()).hexdigest() for k,v in [('original',original),('guarded',guarded)]})
for name,obs,fixture in [('guarded-authority',guarded,False),('guarded-fork',guarded,True),('negative-guard-removed',original,False)]:
 O='/home/user/shadow-man-bounded-runtime/offline-'+name
 obs=obs.replace("OUT='/home/user/shadow-man-bounded-runtime/attempt'",'OUT='+repr(O))
 files={n:(E/n).read_text() for n in ['offline.cjs','bootstrap.cjs','png-child.cjs']};files['observer.cjs']=obs
 cmd=['node']
 if fixture:cmd+=['--require',O+'/bootstrap.cjs']
 cmd+=['--require',O+'/observer.cjs',O+'/offline.cjs']
 if fixture:cmd+=['--fork-fixture']
 code='''import pathlib,base64,subprocess,os,json
O=pathlib.Path(%r);assert not O.exists();O.mkdir();(O/'tmp').mkdir()
files=%r
for n,b in files.items():(O/n).write_bytes(base64.b64decode(b))
env=dict(os.environ,TMPDIR=str(O/'tmp'),TMP=str(O/'tmp'),TEMP=str(O/'tmp'),NODE_PATH='/home/user/shadow-man-tools-ready-oct22/runner/node_modules')
p=subprocess.run(%r,env=env,cwd=O,capture_output=True,text=True,timeout=12)
print(json.dumps(dict(exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr,files={p.name:base64.b64encode(p.read_bytes()).decode() for p in O.iterdir() if p.is_file() and p.suffix in ['.jsonl','.json','.png']})))
assert p.returncode==0
'''%(O,{n:base64.b64encode(s.encode()).decode() for n,s in files.items()},cmd)
 r=run(code,'offline-'+name+'-api.json',20);v=json.loads(r['stdout']);save('offline-'+name+'.json',v)
 if name.startswith('negative'):
  assert 'EEXIST' in v['stdout'] and 'ETIMEDOUT' in v['stdout'] and 'actual-authority-requests-pass' not in v['stdout']
 else:
  assert 'actual-authority-requests-pass' in v['stdout'] and 'actual-worker-error' not in v['stdout']
  if fixture:assert 'real-fork-child-preload-png-pass' in v['stdout']
 print(name,'PASS',v['stdout'])
save('offline-pass.json',dict(passAll=True,actualOriginalEEXIST=True,actualAuthorityRequests=True,realForkPreloadPNG=True,negativeGuardRemoved=True))
