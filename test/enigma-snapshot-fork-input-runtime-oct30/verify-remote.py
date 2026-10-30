import pathlib,hashlib,json,resource
resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_DATA,(134217728,134217728));resource.setrlimit(resource.RLIMIT_FSIZE,(12582912,12582912))
ps=sorted(pathlib.Path('/home/user/enigma-original.parts').glob('archive-*'));h=hashlib.sha256();n=0
for p in ps:
 with p.open('rb') as f:
  while b:=f.read(65536):h.update(b);n+=len(b)
a=dict(parts=len(ps),bytes=n,sha256=h.hexdigest());print(json.dumps(a),flush=True)
assert a==dict(parts=17,bytes=17282066,sha256='43dcac837bfe6b2eaa1c3aa4c2a3a63ea42ffeed54f1128ef192c2cbd5e757c3')
r=pathlib.Path('/home/user/enigma-original');files=sorted((p for p in r.rglob('*') if p.is_file()),key=lambda p:p.relative_to(r).as_posix());h=hashlib.sha256();n=0
for p in files:
 with p.open('rb') as f:d=hashlib.file_digest(f,'sha256').hexdigest()
 size=p.stat().st_size;n+=size;h.update((p.relative_to(r).as_posix()+chr(0)+str(size)+chr(0)+d+chr(10)).encode())
a=dict(files=len(files),bytes=n,manifestDigest=h.hexdigest());print(json.dumps(a),flush=True)
assert len(files)==2663 and h.hexdigest()=='46e5799af7235be8ea9af36fa62801de816766764be9c5cdecf137e8f6fb5940'
assert hashlib.sha256((r/'modules/wine-assembly.wasm').read_bytes()).hexdigest()=='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b'
