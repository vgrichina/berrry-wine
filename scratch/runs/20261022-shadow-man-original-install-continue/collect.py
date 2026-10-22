import pathlib,json,base64,hashlib,os
from remote import *
inv=json.loads((E/'diagnostic-inventory.json').read_text())
selected=[]
for name,local in [('retained-session','raw/installer'),('retained-game','raw/game')]:
 for x in inv[name]:
  if x['path'].endswith(('.jsonl','.log','-summary.json')) or x['path'] in ['command.json','exit.json','attempt.json','parent-registry.json','game-registry.json']:
   selected.append((REMOTE+'/'+name+'/'+x['path'],local+'/'+x['path'],x['size']))
for n in ['installed-payload.json','game-emergency-cleanup.json','final-handback.json','support-manifest.json','original-seals.json','native-extraction.json','support-sys1-command.json','support-user1-command.json','recovery-exit.json','recovery.log']:
 selected.append((REMOTE+'/'+n,n,None))
assert sum(x[2] or 2000000 for x in selected)+15000000<58720256
receipts=[]
for source,dest,size in selected:
 p=E/dest;p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists() or dest=='final-handback.json'
 r=run('import pathlib,hashlib,json;p=pathlib.Path(%r);print(json.dumps(dict(size=p.stat().st_size,sha256=hashlib.file_digest(p.open("rb"),"sha256").hexdigest())))'%source)
 meta=json.loads(r['stdout']);assert meta['size']<6000000,source
 b=bytearray()
 for pos in range(0,meta['size'],90000):
  r=run('import pathlib,base64;p=pathlib.Path(%r);f=p.open("rb");f.seek(%d);print(base64.b64encode(f.read(90000)).decode())'%(source,pos));assert not r.get('stdoutTruncated');b.extend(base64.b64decode(r['stdout']))
 assert len(b)==meta['size'] and hashlib.sha256(b).hexdigest()==meta['sha256'],source
 p.write_bytes(b);receipts.append(dict(remote=source,local=dest,**meta))
save('retrieval.json',receipts)
print('Collected',len(receipts),'small diagnostic files,',sum(x['size'] for x in receipts),'bytes; no guest payload/media copied')
