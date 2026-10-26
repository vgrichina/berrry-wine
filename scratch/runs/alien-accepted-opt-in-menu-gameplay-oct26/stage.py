from work import *
M=ROOT/'scratch/usage-watch/alien-accepted-opt-in-menu-gameplay-oct26-inputs.json'
m=json.loads(M.read_text());assert len(m['files'])==602 and not m['bad']
for x in m['files']:
 p=pathlib.Path(x['source']);assert p.stat().st_size==x['bytes'] and sha(p.read_bytes())==x['sha256'] and p.stat().st_mode&0o777==x['mode'],x['target']
save('input-map-identity.json',dict(path=str(M),sha256=sha(M.read_bytes()),files=602,bytes=sum(x['bytes'] for x in m['files']),bad=[]))
probe=O/'transfer-probe.bin';probe.write_bytes(bytes(range(256))*117)
transfer([('probe.bin',probe)])
j=py('import pathlib,hashlib,json;p=pathlib.Path('+repr(R+'/probe.bin')+');print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open("rb"),"sha256").hexdigest())))');assert json.loads(j['stdout'])['sha256']==sha(probe.read_bytes());save('transfer-probe.json',j)
print('probe PASS; staging602',flush=True)
transfer([(x['target'],pathlib.Path(x['source'])) for x in m['files']])
# full expected map itself is small enough via chunking
p=O/'readback-expected.json';p.write_text(json.dumps([{k:x[k] for k in ['target','sha256','bytes','mode']} for x in m['files']]))
transfer([('expected.json',p)])
j=py('''import pathlib,hashlib,json,os,shutil
h=pathlib.Path('''+repr(R)+''');m=json.loads((h/'expected.json').read_text());bad=[]
for x in m:
 p=h/x['target']
 if not p.is_file() or p.stat().st_size!=x['bytes'] or p.stat().st_mode&0o777!=x['mode'] or hashlib.file_digest(p.open('rb'),'sha256').hexdigest()!=x['sha256']:bad.append(x['target'])
r=dict(count=len(m),bad=bad,expectedSHA256=hashlib.file_digest((h/'expected.json').open('rb'),'sha256').hexdigest(),allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]),memAvailable=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024,free=shutil.disk_usage(h).free)
(h/'closure.json').write_text(json.dumps(r));print(json.dumps(r));assert not bad
''');save('closure-readback.json',j);print(j['stdout'],flush=True)
