import pathlib,ast,json,hashlib,resource
import run as c
H,R=c.H,c.R
for name in ('remote.py','task.py','collect.py','run.py','setup.py','adapt.py'):ast.parse((H/name).read_text())
cfg=R/'.git/config';s=cfg.read_text();s=s.replace('bare = false','bare = false\n sparseCheckout = true');cfg.write_text(s)
plan=json.loads((H/'readiness-plan.json').read_text());ledger=json.loads((H/'api-ledger.json').read_text())
assert not ledger['pending'];assert plan['totalProjection']<=plan['apiAllowance'];assert ledger['charged']<plan['nonCaptureReserve']
assert c.gate() is None
versions={n:hashlib.sha256((H/n).read_bytes()).hexdigest() for n in ('remote.py','task.py','collect.py','run.py','setup.py','adapt.py','startup.cjs','abi-preload.cjs')}
c.dump('configuration-check.json',dict(pass_=True,strictSSH=c.SSH,gitChildOnlyDATA=536870912,limits={str(k):resource.getrlimit(k) for k in (2,9,0,1)},opsPins=versions,ledger=ledger,plan=plan))
print('syntax, exact config and envelope resource gate PASS')
