from work import *
P=pathlib.Path('/tmp/alien-shooter-current-gameplay-api-oct26/ops');OLD='/tmp/alien-shooter-current-gameplay-api-oct26'
# Rehash existing runtime only; canonical compiler-only removals recorded previously.
removed=json.loads((P/'removed-reproducible-compiler.json').read_text());save('compiler-removals-reuse.json',removed)
print('REMOVED',json.dumps(removed)[:2000])
m=json.loads((P/'runtime-manifest.json').read_text());enc=base64.b64encode(gzip.compress(json.dumps(m).encode())).decode()
code='''import pathlib,json,gzip,base64,hashlib,shutil,resource,os
h=pathlib.Path('''+repr(OLD)+''');m=json.loads(gzip.decompress(base64.b64decode('''+repr(enc)+''')));bad=[];missing=[];ok=0
for x in m:
 p=h/'runner'/x['path']
 if not p.exists():missing.append(x['path']);continue
 if p.stat().st_size!=x['bytes'] or hashlib.file_digest(p.open('rb'),'sha256').hexdigest()!=x['sha256'] or p.stat().st_mode&511!=x['mode']:bad.append(x['path'])
 else:ok+=1
w=h/'current.wasm';assert hashlib.file_digest(w.open('rb'),'sha256').hexdigest()=='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75'
print(json.dumps(dict(verified=ok,missing=missing,bad=bad,moduleSHA256=hashlib.file_digest(w.open('rb'),'sha256').hexdigest(),allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]),memAvailable=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024,free=shutil.disk_usage('/tmp').free,uid=os.getuid(),preloadSHA256=hashlib.file_digest((h/'capture-wrapper.cjs').open('rb'),'sha256').hexdigest())))
assert not bad
'''
j=py(code);save('retained-verification-api.json',j);print(j['stdout'])
# Exact prior mount argv and enumeration reused; no mount-related changes.
save('trusted-ssh-config.json',dict(command=SSH,reused=str(P/'trusted-ssh-config.json'),rootRefReceipt=json.loads((ROOT/'scratch/usage-watch/alien-shooter-retained-gameplay-api-oct26/root-ref-digest.json').read_text())))
save('mount-checkpoint-reuse.json',dict(receipt=str(P/'canonical-parser.json'),sha256=sha((P/'canonical-parser.json').read_bytes()),unchangedApp='alien_shooter',unchangedMountArgs=[],manifestEnumeration=431))
