"""Exact main JS runtime closure; use matching local bytes or selected source files.

Never fetch a module, compiler closure or package. Assembly precedes the gate.
"""
import os,subprocess
from transport import *
W=E.parents[2]
PRIOR=pathlib.Path('/home/user/wine-assembly-shadow-man-integrated-installed-runtime-oct22/scratch/runs/20261022-shadow-man-integrated-installed-runtime')
BASE='58e90870a40a541a4083cae5e987ca8de31889e6'
def gitblob(p):
 h=hashlib.sha1();h.update(b'blob '+str(p.stat().st_size).encode()+b'\0')
 with p.open('rb') as f:
  while b:=f.read(65536):h.update(b)
 return h.hexdigest()
def main():
 rows=json.loads((PRIOR/'planned-source-closure.json').read_text());tree=json.loads((PRIOR/'snapshot-tree.json').read_text())
 inventory={x['path']:x for x in tree['entries']};out=[];env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
 for r in rows:
  p=W/'runtime'/r['path'];p.parent.mkdir(parents=True,exist_ok=True)
  if p.exists() and gitblob(p)==r['blob']:origin='already verified local selected bytes'
  else:
   found=False
   for base in (pathlib.Path('/home/user/wine-assembly'),pathlib.Path('/home/user/wine-assembly-shadow-man-dsetup-qualified-integrate-oct22')):
    src=base/r['path']
    if src.is_file() and gitblob(src)==r['blob']:
     with src.open('rb') as f,p.open('wb') as o:
      while b:=f.read(65536):o.write(b)
     origin=str(src);found=True;break
    proc=subprocess.run(['git','cat-file','blob',r['blob']],cwd=base,env=env,capture_output=True)
    if proc.returncode==0:p.write_bytes(proc.stdout);origin=str(base)+':git:'+r['blob'];found=True;break
   if not found:
    rel='shadow-man-dsetup-canonical-qualification-oct22/'+r['path'];size=inventory[rel]['size'];assert size<=1048576
    import urllib.parse
    c=json.loads(pathlib.Path('/home/user/.config/ascii/boat/config.json').read_text())
    req=urllib.request.Request('https://boat.dev/api/v1/snapshots/de8639e2-cf50-4c6b-a330-6c482bc6f573/files?'+urllib.parse.urlencode(dict(path=rel)),headers={'Authorization':'Bearer '+c['token'],'Range':f'bytes=0-{size-1}'})
    with OPENER.open(req,timeout=60) as f,p.open('wb') as o:
     assert f.status==206 and f.headers.get('Content-Range')==f'bytes 0-{size-1}/{size}' and f.headers.get('X-Snapshot-Entry-Kind')=='file'
     n=0
     while n<size:
      b=f.read(min(65536,size-n));assert b;o.write(b);n+=len(b)
     assert not f.read(1)
    origin='snapshot:de8639e2-cf50-4c6b-a330-6c482bc6f573:'+rel
  assert gitblob(p)==r['blob'],r['path']
  with p.open('rb') as f:h=hashlib.file_digest(f,'sha256').hexdigest()
  out.append(dict(**r,size=p.stat().st_size,sha256=h,readOnlySource=origin))
  save('runtime-manifest.json',out)
 print('Exact main runtime assembled:',len(out),'files',sum(x['size'] for x in out),'bytes')
if __name__=='__main__':main()
