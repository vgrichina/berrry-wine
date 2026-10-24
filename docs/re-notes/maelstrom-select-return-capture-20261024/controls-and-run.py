from work import *
import shlex
for name in ['capture.cjs','preload.cjs','observer.cjs','preflight.py','supervise.py','guest-args.json','validate-tree.cjs','observer-test.cjs']:
 b=(H/name).read_bytes();assert len(b)<25000
 code='import pathlib,base64;p=pathlib.Path('+repr(str(H/name))+');p.write_bytes(base64.b64decode('+repr(base64.b64encode(b).decode())+'))'
 save('send-'+name+'.json',py(code))
account('preguest')
save('tree-validation-api.json',remote('cd '+shlex.quote(str(H))+' && timeout 60 node --max-old-space-size=256 validate-tree.cjs',60))
save('preflight-api.json',remote('python3 '+shlex.quote(str(H/'preflight.py')),60))
save('observer-test-api.json',remote('cd '+shlex.quote(str(H))+' && timeout 60 node --max-old-space-size=256 observer-test.cjs',60))
save('watchdog-control-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' negative-control',15))
save('output-control-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' output-control',15))
print('all preguest controls PASS',flush=True)
