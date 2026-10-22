"""Recover only bounded evidence, keeping all large media on assigned Boat."""
import base64,hashlib,io,json,pathlib,tarfile
from remote import E,REMOTE,run,retrieve,save,transfer
transfer((E/'final-audit.py').read_bytes(),'final-audit.py')
print(run('import subprocess;subprocess.run(["python3",%r],check=True)'%(REMOTE+'/final-audit.py'),'final-audit-receipt.json')['stdout'])
code='''import pathlib,json,hashlib,tarfile
R=pathlib.Path(%r);paths=[]
for rel in ['recovery-start.txt','recovery-end.txt','recovery-exit.txt','recovery.log','pre-native-disk.txt','runtime-expected.json','HANDOFF.json','receipt/REPORT.md','receipt/closure.json','receipt/recover-source.sh','receipt/verify.py','receipt/probe.py','recovery/iso-recovered.sha256','recovery/iso-listing.txt','recovery/directx-recovered.sha256','recovery/extracted-members.json','recovery/extraction.log']:
 paths.append(R/rel)
for rel in ['native-audit','setup-run']:
 for p in (R/rel).rglob('*'):
  if p.is_file() and 'vfs' not in p.relative_to(R/rel).parts and 'capture' not in p.relative_to(R/rel).parts:paths.append(p)
# Preserve only the small partial decompression product, never local media.
paths.extend((R/'setup-run/vfs/windows/temp').rglob('*'))
paths=sorted(set(p for p in paths if p.is_file()))
manifest=[]
for p in paths:
 assert p.stat().st_size<4000000,(str(p),p.stat().st_size)
 with p.open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
 manifest.append(dict(path=p.relative_to(R).as_posix(),size=p.stat().st_size,sha256=sha))
assert sum(x['size'] for x in manifest)<12000000
(R/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\\n')
with tarfile.open(R/'evidence.tar.gz','w:gz') as t:
 for p in paths:t.add(p,arcname=p.relative_to(R),recursive=False)
 t.add(R/'evidence-manifest.json',arcname='evidence-manifest.json')
p=R/'evidence.tar.gz';print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),files=len(manifest),uncompressedBytes=sum(x['size'] for x in manifest))))
'''%REMOTE
receipt=run(code,'collection-receipt.json');meta=json.loads(receipt['stdout']);print(meta)
p=retrieve('evidence.tar.gz','evidence.tar.gz',12000000)
assert p.stat().st_size==meta['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==meta['sha256']
with tarfile.open(p) as t:t.extractall(E/'raw',filter='data')
for x in json.loads((E/'raw/evidence-manifest.json').read_text()):
    p=E/'raw'/x['path'];assert p.stat().st_size==x['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256']
print('Recovered bounded raw evidence; media and runtime remain remote.')
