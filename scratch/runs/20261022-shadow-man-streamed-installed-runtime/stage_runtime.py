"""Pinned source/codec/module staging. No package install, build or guest."""
import urllib.parse
from transport import *
W=E.parents[2]
def main():
 pins=json.loads((E/'codec-pins.json').read_text())['files'];assert len(pins)==23
 tree=json.loads(pathlib.Path('/home/user/wine-assembly-shadow-man-integrated-installed-runtime-oct22/scratch/runs/20261022-shadow-man-integrated-installed-runtime/snapshot-tree.json').read_text())
 inv={x['path']:x for x in tree['entries']}
 for pin in pins:
  rel=pin['path'].removeprefix('runner/');src='shadow-man-dsetup-canonical-qualification-oct22/'+rel;assert inv[src]['size']==pin['size']
  p=W/'runtime'/rel;p.parent.mkdir(parents=True,exist_ok=True)
  c=json.loads(pathlib.Path('/home/user/.config/ascii/boat/config.json').read_text());size=pin['size']
  req=urllib.request.Request('https://boat.dev/api/v1/snapshots/de8639e2-cf50-4c6b-a330-6c482bc6f573/files?'+urllib.parse.urlencode(dict(path=src)),headers={'Authorization':'Bearer '+c['token'],'Range':f'bytes=0-{size-1}'})
  with OPENER.open(req,timeout=60) as f,p.open('xb') as o:
   assert f.status==206 and f.headers.get('Content-Range')==f'bytes 0-{size-1}/{size}'
   n=0
   while n<size:
    b=f.read(min(65536,size-n));assert b;o.write(b);n+=len(b)
   assert not f.read(1)
  with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==pin['sha256']
 print('Pinned23 codec source hashes PASS',flush=True)
 staged=[]
 for p in sorted((W/'runtime').rglob('*')):
  if not p.is_file():continue
  with p.open('rb') as f:r=upload_stream(f,p.stat().st_size,ROOT+'/immutable/runtime/'+str(p.relative_to(W/'runtime')))
  staged.append(r)
 module=DONOR/'canonical-primary.wasm';assert module.stat().st_size==1879387
 with module.open('rb') as f:r=upload_stream(f,1879387,ROOT+'/immutable/runtime/build/wine-assembly.wasm')
 assert r['sha256']=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553';staged.append(r)
 for n in ['runtime-manifest.json','accepted-installed-payload.json','accepted-parent-registry.json','codec-pins.json']:
  p=E/n
  with p.open('rb') as f:staged.append(upload_stream(f,p.stat().st_size,ROOT+'/immutable/receipts/'+n))
 save('runtime-stage.json',staged);print('Runtime/module/receipts uploaded',len(staged),flush=True)
if __name__=='__main__':main()
