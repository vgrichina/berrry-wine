from work import *
M=ROOT/'scratch/usage-watch/alien-accepted-dispatch-runtime-inputs-oct27.json';m=json.loads(M.read_text());files=m['files'];assert len(files)==610 and not m['bad']
p=O/'readback-expected.json';p.write_text(json.dumps([{k:x[k] for k in ['target','sha256','bytes','mode']} for x in files]));transfer([('expected.json',p)])
j=py('''import pathlib,json,hashlib
h=pathlib.Path('''+repr(R)+''');bad=[]
for i,x in enumerate(json.loads((h/'expected.json').read_text())):
 p=h/x['target']
 if not p.is_file() or p.stat().st_size!=x['bytes'] or p.stat().st_mode&0o777!=x['mode'] or hashlib.file_digest(p.open('rb'),'sha256').hexdigest()!=x['sha256']:bad.append(i)
print(json.dumps(bad))
''');missing=json.loads(j['stdout']);save('stage-resume-missing-'+str(time.time_ns())+'.json',dict(indices=missing));print('missing',len(missing),flush=True)
# Bound each transfer operation below local supervisor wall; successful flushes remain reusable.
original=py;started=time.monotonic()
class Boundary(Exception):pass
def bounded(code,**kw):
 j=original(code,**kw)
 if time.monotonic()-started>75:raise Boundary()
 return j
transfer.__globals__['py']=bounded
try:transfer([(files[i]['target'],pathlib.Path(files[i]['source'])) for i in missing])
except Boundary:print('clean bounded transfer handoff; next operation hashes completed files',flush=True);sys.exit(0)
transfer.__globals__['py']=original
j=py('''import pathlib,hashlib,json,shutil
h=pathlib.Path('''+repr(R)+''');m=json.loads((h/'expected.json').read_text());bad=[]
for x in m:
 p=h/x['target']
 if not p.is_file() or p.stat().st_size!=x['bytes'] or p.stat().st_mode&0o777!=x['mode'] or hashlib.file_digest(p.open('rb'),'sha256').hexdigest()!=x['sha256']:bad.append(x['target'])
r=dict(count=len(m),bad=bad,expectedSHA256=hashlib.file_digest((h/'expected.json').open('rb'),'sha256').hexdigest(),allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]),memAvailable=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024,free=shutil.disk_usage(h).free)
(h/'closure.json').write_text(json.dumps(r));print(json.dumps(r));assert not bad
''');save('closure-readback.json',j);print(j['stdout'],flush=True)
