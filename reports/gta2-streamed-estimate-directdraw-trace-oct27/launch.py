import pathlib,json,time
from api import api
O=pathlib.Path(__file__).parent
r=json.loads((O/'runtime-readiness.json').read_text());assert r['stagingCompleteBefore15MinuteMargin']
assert time.time()+300<1793110080
assert not (O/'guest-launch.json').exists()
# Exclusive creation spends the sole invocation before the external request.
(O/'guest-launch.json').open('x').write(json.dumps(dict(state='request-intent-spent',at=time.time(),box='bx_cqss3x42',maxInvocations=1)))
j=api('python3 /home/user/wineops-gta2-causal-trace-oct27/ops/remote-trace.py guest',detach=True)
(O/'guest-launch-response.json').write_text(json.dumps(j,indent=2));print(json.dumps(j))
