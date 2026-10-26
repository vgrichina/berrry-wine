from common import *
import base64,zlib
j=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(str(H))+');p=h/"ops/errno-latch.wasm";b=p.read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),terminal=json.load(open(h/"ops/compile/terminal.json")))))');save('build-result-api.json',j);r=json.loads(j['stdout'])
assert r['terminal']['exit']==0 and r['terminal']['reason']=='natural' and not r['terminal']['remainingGroup']
assert r['bytes']==1884180 and r['sha256']=='fec642f6c711e57e1c4a3dfaeaff0e11be587c56fc64cde394ed7f54147b5988'
for n in ['build-inputs.json','build-outputs.json','startup/command.json','startup/terminal.json','startup/output.log','compile/command.json','compile/terminal.json','compile/output.log','errno-latch.wasm']:
 j=py('import pathlib,json,hashlib;p=pathlib.Path('+repr(str(O/n))+');b=p.read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))');info=json.loads(j['stdout']);assert info['bytes']<=2097152
 p=O/'collected-build'/n if n!='errno-latch.wasm' else O/n;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('wb') as out:
  for off in range(0,info['bytes'],18000):
   j=py('import pathlib,zlib,base64;p=pathlib.Path('+repr(str(O/n))+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(zlib.compress(f.read(18000))).decode())');out.write(zlib.decompress(base64.b64decode(j['stdout'])))
 assert p.stat().st_size==info['bytes'] and sha(p.read_bytes())==info['sha256']
save('tail-retained.json',dict(path=str(O/'errno-latch.wasm'),bytes=r['bytes'],sha256=r['sha256'],verified=True))
# Serialize phases: remove only owned reconstruction data. Keep exact module,
# recipes, compressed evidence and every retained historical donor untouched.
j=py('import pathlib,shutil,json;h=pathlib.Path('+repr(str(H))+');names=["canonical","ops/sources.json.gz","ops/anchors"];removed=[]\nfor n in names:\n p=h/n\n if p.is_dir():shutil.rmtree(p)\n else:p.unlink()\n removed.append(n)\nprint(json.dumps(dict(removed=removed,kept="ops/errno-latch.wasm")))');save('remote-source-cleared.json',j)
(O/'sources.json.gz').unlink();shutil.rmtree(H/'canonical');shutil.rmtree(O/'anchors')
save('remote-after-build.json',remoteInventory())
print(json.dumps(dict(exactTailRetained=True,sha256=r['sha256'],compilePID=r['terminal']['childPID'])))
