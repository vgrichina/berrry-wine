gate('transport-preflight')
old=OLD/'ops'
save('trusted-config.json',dict(ssh=SSH,identityExists=pathlib.Path('/home/user/.ssh/wine_github_ed25519').is_file(),knownHostsExists=pathlib.Path('/home/user/.ssh/wine_github_known_hosts').is_file()))
pins={}
for path,expected in [('tools/enigma-supervised-gameplay.py','ed3cfbb659a3ed6bdc6e218293579613a1709da1ab283f87a0b59de706048aa9'),('tools/enigma-frozen-gameplay-controller.py','77997362d75f9873cd8b022b4840606ed1b66780171e7c82d8f8a6f20b304f26')]:
 p=pathlib.Path('/tmp/enigma-streams-independent-accept-integrate-oct27/repo')/path;pins[path]=sha(p.read_bytes());assert pins[path]==expected
save('source-pins.json',pins)
manifest=json.loads((OLD/'repo/docs/reviews/enigma-separated-stream-runtime-oct27/manifest.json').read_text())
print('manifest type',type(manifest).__name__)
remote=py('import pathlib,json,hashlib,zlib,os; p=pathlib.Path("/tmp/enigma-separated-stream-runtime-oct27/ops/launch/controller/menu-candidate.png");b=p.read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),compressedBytes=len(zlib.compress(b,9)),memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,oldProcesses={str(pid):pathlib.Path("/proc/"+str(pid)).exists() for pid in [25292,25293,25300]})))')
meta=json.loads(remote['stdout']);save('immutable-meta.json',meta);print(json.dumps(meta));assert meta['bytes']==389913 and meta['sha256']=='8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5'
fetch(str(OLD/'ops/launch/controller/menu-candidate.png'),'historical-menu.png',meta['compressedBytes'],meta['sha256'],True)
