from common import *
assert not (O/'compile-api.json').exists()
j=remoteInventory();save('remote-immediate-precompile-corrected.json',j);account('immediate-precompile-corrected',j['allocated'],12582912)
j=remote('python3 '+shlex.quote(str(O/'supervise.py'))+' compile',detach=True);save('compile-api.json',j);print(json.dumps(j))
