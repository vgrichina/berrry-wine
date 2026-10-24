from work import *
import shlex
for name in ['capture.cjs','preflight.py','supervise.py','guest-args.json','validate-tree.cjs']:
 b=(H/name).read_bytes();assert len(b)<25000
 code='import pathlib,base64;p=pathlib.Path('+repr(str(H/name))+');p.write_bytes(base64.b64decode('+repr(base64.b64encode(b).decode())+'))'
 save('send-'+name+'.json',py(code))
account('preguest')
save('tree-validation-api.json',remote('cd '+shlex.quote(str(H))+' && timeout 60 node --max-old-space-size=256 validate-tree.cjs',65))
save('preflight-api.json',remote('python3 '+shlex.quote(str(H/'preflight.py')),65))
save('watchdog-control-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' negative-control',15))
print('all preguest controls PASS',flush=True)
