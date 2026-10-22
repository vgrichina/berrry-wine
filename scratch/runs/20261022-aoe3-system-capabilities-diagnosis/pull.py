import subprocess,json,base64,hashlib,sys
from pathlib import Path
E=Path(__file__).resolve().parent
for name in sys.argv[1:]:
 assert '..' not in Path(name).parts
 code='from pathlib import Path;import base64,json,hashlib;p=Path('+repr('/home/user/aoe3-system-capabilities-diagnosis-oct22/'+name)+');b=p.read_bytes();print(json.dumps(dict(data=base64.b64encode(b).decode(),sha256=hashlib.sha256(b).hexdigest())))'
 raw=subprocess.check_output(['/home/user/.ascii/boat','--json','exec','bx_h44kbrcy','--timeout','60','--','python3','-c',code]);d=json.loads(raw);assert d['exitCode']==0 and not d['stdoutTruncated'],d
 item=json.loads(d['stdout']);b=base64.b64decode(item['data']);assert hashlib.sha256(b).hexdigest()==item['sha256'];target=E/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);print(name,len(b),item['sha256'])
