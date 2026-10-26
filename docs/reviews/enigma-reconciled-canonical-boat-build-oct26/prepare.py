from common import *
import tarfile,io,zlib
gate('before-staging')
plan=json.loads((ROOT/'scratch/usage-watch/enigma-reconciled-canonical-build-input-plan-oct26.json').read_text())
assert plan['candidate']=='425755ee5ee9be0734c7aca187521100f5487674' and not plan['missing'] and len(plan['files'])==147
accept=pathlib.Path('/tmp/enigma-reconciled-msg-independent-source-accept-oct26/ops')
pins=json.loads((accept/'candidate-pins.json').read_text());checked=[]
for x in pins['files']:
 p=pathlib.Path('/tmp/enigma-accepted-msg-current-tree-reconcile-oct26/repo')/x['path'];b=p.read_bytes()
 assert sha(b)==x['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['blob']
 checked.append(x)
save('accepted-14-unchanged.json',dict(candidate=plan['candidate'],files=checked,acceptance='facebcb2e6d04b84e80211a7814654e528566b0f',reused=True))
manifest={}
with tarfile.open(O/'payload.tar.gz','w:gz',compresslevel=6) as t:
 for p,x in sorted(plan['files'].items()):
  assert not pathlib.PurePosixPath(p).is_absolute() and '..' not in pathlib.PurePosixPath(p).parts
  b=pathlib.Path(x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['oid'],p
  manifest[p]=x
  info=tarfile.TarInfo('source/'+p);info.size=len(b);info.mode=0o644;info.mtime=0;t.addfile(info,io.BytesIO(b))
 b=(json.dumps(manifest,sort_keys=True,indent=2)+'\n').encode();info=tarfile.TarInfo('input-manifest.json');info.size=len(b);info.mode=0o644;t.addfile(info,io.BytesIO(b))
save('input-manifest.json',manifest)
save('payload.json',dict(candidate=plan['candidate'],files=len(manifest),sourceBytes=sum(x['bytes'] for x in manifest.values()),archiveBytes=(O/'payload.tar.gz').stat().st_size,archiveSHA256=sha((O/'payload.tar.gz').read_bytes()),manifestSHA256=sha(b)))
assert (O/'payload.tar.gz').stat().st_size<8*1048576
print(json.dumps(json.load(open(O/'payload.json'))))
