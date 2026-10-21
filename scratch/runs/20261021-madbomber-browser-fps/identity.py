import pathlib,json,hashlib,datetime,sys
root=pathlib.Path('/home/user/madbomber-fps'); repo=root/'repo';out=root/'evidence'
manifest=json.loads((out/'source-manifest.json').read_text());pins=json.loads((out/'preflight.json').read_text())
for f in manifest['files']:
    b=(repo/f['path']).read_bytes();assert len(b)==f['size'];assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==f['oid'],f['path']
for f in pins['closure']:assert hashlib.sha256((repo/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
module=(repo/'build/wine-assembly.wasm').read_bytes();assert hashlib.sha256(module).hexdigest()==pins['moduleSha256']
deps=[]
for f in sorted((repo/'node_modules').rglob('*')):
    if f.is_file():deps.append({'path':str(f.relative_to(repo)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'revision':manifest['revision'],'sourceVerified':len(manifest['files']),'assetsVerified':len(pins['closure']),'moduleSha256':pins['moduleSha256'],'moduleBytes':len(module),'dependencyFiles':len(deps)}
(out/(sys.argv[1]+'.json')).write_text(json.dumps(r,indent=2));(out/'dependencies.json').write_text(json.dumps(deps));print(json.dumps(r))
