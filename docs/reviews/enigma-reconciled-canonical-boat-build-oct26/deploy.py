from transport import *
gate('extract')
payload=json.load(open(O/'payload.json'))
code='''import pathlib,tarfile,hashlib,json,shutil
H=pathlib.Path('/tmp/enigma-reconciled-canonical-boat-build-oct26')
p=H/'transport/payload.tar.gz'
assert hashlib.sha256(p.read_bytes()).hexdigest()==ARCHIVESHA
free=shutil.disk_usage(H).free;assert free-1073741824>=2982150144
assert not (H/'source').exists()
with tarfile.open(p,'r:gz') as t:
 members=t.getmembers()
 for m in members:
  q=pathlib.PurePosixPath(m.name);assert m.isfile() and not q.is_absolute() and '..' not in q.parts
  assert q.parts[0]=='source' or m.name=='input-manifest.json'
 t.extractall(H,filter='data')
manifest=json.load(open(H/'input-manifest.json'))
assert len(manifest)==147
for n,x in manifest.items():
 b=(H/'source'/n).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\\0'+b).hexdigest()==x['oid'],n
print(json.dumps(dict(files=len(manifest),sourceBytes=sum(x['bytes'] for x in manifest.values()),manifestSHA256=hashlib.sha256((H/'input-manifest.json').read_bytes()).hexdigest(),verified=True)))
'''.replace('ARCHIVESHA',repr(payload['archiveSHA256']))
j=api(code,'extract-verify');save('remote-extraction.json',json.loads(j['stdout']));assert json.loads(j['stdout'])['manifestSHA256']==payload['manifestSHA256']
for name in ['remote-run.py']:
 data=(O/name).read_bytes();send(data,name)
 api('import pathlib,shutil; h=pathlib.Path('+repr(REMOTE)+'); (h/"ops").mkdir(exist_ok=True); shutil.copyfile(h/"transport"/'+repr(name)+',h/"ops"/'+repr(name)+')','install-'+name)
print(j['stdout'])
