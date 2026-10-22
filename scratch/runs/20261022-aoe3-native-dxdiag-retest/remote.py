#!/usr/bin/env python3
import subprocess,sys,json,base64,gzip
from pathlib import Path
E=Path(__file__).resolve().parent
script=Path(sys.argv[1]).read_bytes()
if Path(sys.argv[1]).name=='audit-remote.py':
 script=('PROVIDER='+repr(json.loads((E/'provider.json').read_text()))+'\n').encode()+script
cmd="import base64,gzip;exec(gzip.decompress(base64.b64decode("+repr(base64.b64encode(gzip.compress(script)).decode())+")))"
r=subprocess.run(['/home/user/.ascii/boat','--json','exec','bx_h44kbrcy','--timeout',sys.argv[2] if len(sys.argv)>2 else '120','--','python3','-c',cmd],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
(E/(Path(sys.argv[1]).stem+'-receipt.json')).write_bytes(r.stdout)
if r.stderr: print(r.stderr.decode(),file=sys.stderr)
try:
 d=json.loads(r.stdout);print(json.dumps(d,indent=2))
except: print(r.stdout.decode())
sys.exit(r.returncode)
