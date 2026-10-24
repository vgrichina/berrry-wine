from work import *
from ledger import measure
measure('pregates')
for name in ['capture.cjs','preload.cjs','preflight.py','supervise.py','guest-args.json','validate-tree.cjs']:
 b=(H/name).read_bytes();assert len(b)<24000
 save('send-'+name+'.json',py('import pathlib,base64;pathlib.Path('+repr(str(H/name))+').write_bytes(base64.b64decode('+repr(base64.b64encode(b).decode())+'))'))
save('tree-validation-api.json',remote('cd '+shlex.quote(str(H))+' && timeout 60 node --max-old-space-size=256 validate-tree.cjs',60))
save('preflight-api.json',remote('python3 '+shlex.quote(str(H/'preflight.py')),60))
save('watchdog-control-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' negative-control',15))
save('output-control-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' output-control',15))
print('gates PASS',flush=True)
