"""One selected retained-session tar stream; exact inventory, no archive saved."""
import hashlib,json,pathlib,tarfile,time,urllib.parse,urllib.request
from transport import *
def main():
 entries=json.loads((DONOR/'raw/installed-selected-tree.json').read_text())['entries']
 entries=[x for x in entries if x['path']==PREFIX or x['path'].startswith(PREFIX+'/')]
 files={x['path'][len(PREFIX)+1:]:x['size'] for x in entries if x['kind']=='file'}
 dirs={x['path'][len(PREFIX)+1:] for x in entries if x['kind']=='dir'}|{''}
 assert len(files)==2083 and sum(files.values())==186399681
 assert all(x['kind'] in ('dir','file') for x in entries)
 c=json.loads(pathlib.Path('/home/user/.config/ascii/boat/config.json').read_text())
 req=urllib.request.Request('https://boat.dev/api/v1/snapshots/'+SNAP+'/files?'+urllib.parse.urlencode(dict(path=PREFIX)),headers={'Authorization':'Bearer '+c['token']})
 seen=set();receipts=[];started=time.time();total=0
 class Bounded:
  def __init__(self,f):self.f=f;self.count=0
  def read(self,n):
   assert 0<=n<=65536,'Oversized stream read'
   b=self.f.read(n);self.count+=len(b);assert self.count<=210000000,'Archive aggregate bound';return b
 try:
  with OPENER.open(req,timeout=120) as f:
   hdr={k:f.headers.get(k) for k in ['Content-Type','X-Snapshot-Entry-Kind','X-Snapshot-File-Count','X-Snapshot-Total-Size-Bytes','X-Snapshot-Skipped-Base-Image-Files']}
   save('folder-stream-headers.json',dict(status=f.status,headers=hdr))
   assert f.status==200 and hdr['X-Snapshot-Entry-Kind']=='dir'
   assert hdr['X-Snapshot-File-Count']=='2083' and hdr['X-Snapshot-Total-Size-Bytes']=='186399681'
   assert hdr['X-Snapshot-Skipped-Base-Image-Files'] in (None,'0')
   bounded=Bounded(f)
   with tarfile.open(fileobj=bounded,mode='r|',bufsize=65536) as tar:
    for member in tar:
     raw=member.name
     assert not raw.startswith('/') and '\\' not in raw
     assert '..' not in pathlib.PurePosixPath(raw).parts and not member.issym() and not member.islnk()
     raw=raw.removeprefix('./').rstrip('/')
     # The endpoint may root tar paths at the requested folder or snapshot root.
     choices=[raw]
     for p in (PREFIX,'retained-session'):
      if raw==p:choices.append('')
      elif raw.startswith(p+'/'):choices.append(raw[len(p)+1:])
     matches={x for x in choices if x in (dirs if member.isdir() else files)}
     assert len(matches)==1, 'Unrecognized or ambiguous archive member: '+raw
     rel=matches.pop()
     if member.isdir():continue
     assert member.isfile() and rel not in seen and member.size==files[rel],rel
     total+=member.size;assert total<=186399681
     with tar.extractfile(member) as src:
      receipt=upload_stream(src,member.size,ROOT+'/immutable/restored/'+rel)
      assert src.read(1)==b''
     receipts.append(receipt);seen.add(rel)
     with (E/'transfer-files.jsonl').open('a') as out:out.write(json.dumps(receipt)+'\n')
     if len(seen)%100==0:print(json.dumps(dict(files=len(seen),bytes=total,seconds=round(time.time()-started,2))),flush=True)
   while bounded.read(65536):pass
   assert seen==set(files) and total==186399681
   save('transfer-complete.json',dict(passAll=True,files=len(seen),bytes=total,archiveBytes=bounded.count,seconds=time.time()-started,snapshot=SNAP,prefix=PREFIX))
 except Exception as e:
  save('restore-first-error.json',dict(type=type(e).__name__,files=len(seen),bytes=total,seconds=time.time()-started,detail=str(e) if isinstance(e,(AssertionError,RuntimeError)) else 'Transport error; URL suppressed'))
  raise RuntimeError('Restore stopped; see restore-first-error.json') from None
if __name__=='__main__':main()
