"""Read-only complete retained-input gate. No guest or lifecycle action."""
import datetime, hashlib, json, pathlib, subprocess, os, re
R=pathlib.Path('/home/user/aoe3-original-oct22')
errors=[]
def check(p,size,sha):
    try:
        actual=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
        assert p.stat().st_size==size and actual==sha
        return dict(path=str(p),size=size,sha256=actual,ok=True)
    except Exception as ex:
        errors.append(str(p)+': '+repr(ex));return dict(path=str(p),ok=False)
runtime=json.loads((R/'runtime-pins.json').read_text())
installed=json.loads((R/'installed-audit/installed-manifest.json').read_text())['files']
pins=[check(R/'runtime'/x['path'],x['size'],x['sha256']) for x in runtime]
pins += [check(R/'installed'/x['path'],x['size'],x['sha256']) for x in installed]
identity=[]
for rel,size,sha in [
 ('runtime/build/wine-assembly.wasm',1878971,'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'),
 ('runtime/test/run.js',683435,'1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799'),
 ('installed/Age of Empires III/age3.exe',8826880,'5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256'),
 ('installed/Age of Empires III/data/stringtable.xml',2404654,'62fa66202af9e6ea6b98a7bb4b429a6fc724f51b57831c2b3062253ddb249f17'),
 ('installed-audit/launch-registry.json',15888,'69fd648e03a5d4f1f25c41dcdbb2f976f813ca36a1dbdd3d9db5d05280f45cfe')]:
    identity.append(check(R/rel,size,sha))
api=R/'runtime/src/api_table.json'
if not api.is_file():errors.append('required api_table missing: '+str(api))
else:identity.append(dict(path=str(api),size=api.stat().st_size,sha256=hashlib.file_digest(api.open('rb'),'sha256').hexdigest()))
cmd=json.loads((R/'installed-audit/launch-command.json').read_text())
dlls=next(x for x in cmd if x.startswith('--dlls=')).split('=',1)[1].split(',')
for p in dlls:
    if not pathlib.Path(p).is_file():errors.append('required DLL missing: '+p)
print(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),runtimePins=len(runtime),installedPins=len(installed),pins=pins,identities=identity,dlls=dlls,errors=errors,passAll=not errors,node=subprocess.check_output(['node','--version'],text=True).strip(),freeBytes=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize),indent=2))
