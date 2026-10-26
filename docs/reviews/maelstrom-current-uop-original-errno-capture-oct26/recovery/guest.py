from common import *
assert time.time()+70<1793008800
assert not (O/'one-guest-launch.json').exists()
assert (O/'mount-actual-api.json').exists() and (O/'tail-retained.json').exists()
startup=json.load(open(O/'collected-build/startup/terminal.json'));assert startup['exit']==0 and not startup['remainingGroup'] and startup['limits']['RLIMIT_DATA'][0]==-1 and startup['limits']['RLIMIT_AS'][0]==-1
j=remoteInventory();save('remote-immediate-preguest.json',j);assert j['uid']==1000 and j['memAvailable']>=2684354560 and j['free']-67108864>=2982150144
account('immediate-preguest',j['allocated'],j['allocated']+1048576)
save('checkpoint-ready.json',dict(revision=REV,exactTail=True,mountActual=True,unchangedOriginalRecipe=True,startupReceipt='collected-build/startup/terminal.json',guestAttempts=0,box=BOX))
save('one-guest-launch.json',dict(at=time.time(),attempt=1,box=BOX,cutoff='2026-10-26T10:00:00Z'))
j=remote('python3 '+shlex.quote(str(O/'supervise.py'))+' guest',timeout=80);save('guest-api.json',j)
r=json.loads(j['stdout']);assert not r['remainingGroup'];save('checkpoint-guest-terminal.json',r)
print(json.dumps(r))
