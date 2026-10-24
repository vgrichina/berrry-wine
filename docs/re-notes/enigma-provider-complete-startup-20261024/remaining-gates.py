from work import *
save('tree-validation-api.json',remote('cd '+shlex.quote(str(H))+' && timeout 60 node --max-old-space-size=256 validate-tree.cjs',60))
save('preflight-api.json',remote('python3 '+shlex.quote(str(H/'preflight.py')),60))
save('watchdog-control-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' negative-control',15))
save('output-control-api.json',remote('python3 '+shlex.quote(str(H/'supervise.py'))+' output-control',15))
print('remaining exact gates PASS')
