from api import *
import time
E=H/'repo/docs/re-notes/penguin-command-retained-codec-gameplay-20261024';E.mkdir(parents=True,exist_ok=True)
# Compress in memory and transfer at <=6144 base64 bytes per ordinary response.
def get(rel):
 target=ROOT+'/'+rel
 code='import pathlib,zlib;print(len(zlib.compress(pathlib.Path('+repr(target)+').read_bytes())))'
 size=int(remote('python3 -c '+shlex.quote(code))['stdout']);out=bytearray()
 for off in range(0,size,4096):
  code='import pathlib,zlib,base64;b=zlib.compress(pathlib.Path('+repr(target)+').read_bytes());print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())'
  out.extend(base64.b64decode(remote('python3 -c '+shlex.quote(code))['stdout']))
 b=zlib.decompress(out);p=E/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);return dict(path=rel,bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
items=[]
for p in ['preflight.json','preflight-incomplete-font-data.json','runtime-standing.json','preguest-missing-fonts/output.log','preguest-missing-fonts/command.json','preguest-missing-fonts/input-events.json','preguest-missing-fonts/terminal.json','run/output.log','run/command.json','run/input-events.json','run/terminal.json','run/exit.png']:
 items.append(get(p))
for p in ['admission.json','prepare.py','transfer.py','api.py','add-runtime-helper.py','add-font-data.py','preflight.py','supervise.py','collect.py','transfer-receipts.json']:
 b=(H/p).read_bytes();(E/p).write_bytes(b);items.append(dict(path=p,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
(E/'collection-seals.json').write_text(json.dumps(items,indent=2));print('collected',len(items),'files',sum(x['bytes'] for x in items),'bytes')
