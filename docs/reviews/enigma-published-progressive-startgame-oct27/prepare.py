gate('prepare')
M=json.loads((ROOT/'scratch/usage-watch/enigma-progressive-published-runtime-map-oct27.json').read_text());rs=M['files']
accepted=pathlib.Path('/tmp/enigma-accepted-progressive-menu-main-integrate-oct27/repo')
pins={'runner/tools/enigma-supervised-gameplay.py':('tools/enigma-supervised-gameplay.py','05326027c821b39960e3417c86786d06a8c824b7fcd731d7c3586b59a5ce40a4'),'runner/tools/enigma-frozen-gameplay-controller.py':('tools/enigma-frozen-gameplay-controller.py','2c8d064d21e3d4c86b099591f076115b622450eb76371844324ee8be645f6beb')}
rs=[r for r in rs if r['target'] not in pins]
for target,(p,h) in pins.items():
 b=(accepted/p).read_bytes();assert sha(b)==h;rs.append(dict(target=target,source=str(accepted/p),bytes=len(b),sha256=h))
rs=[r for r in rs if r['target']!='modules/wine-assembly.wasm']
rs.append(dict(target='modules/wine-assembly.wasm',source='/tmp/enigma-reconciled-canonical-boat-build-oct26/modules/wine-assembly.wasm',bytes=1880854,sha256='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b'))
for r in rs:
 p=pathlib.Path(r.get('source',r.get('path')));b=p.read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256'],r['target']
assert next(r for r in rs if r['target']=='runner/test/run.js')['sha256']=='6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e'
save('runtime-manifest.json',rs);save('closure-local.json',dict(at=time.time(),files=len(rs),bytes=sum(r['bytes'] for r in rs),allPins=True,originalMapSHA=sha((ROOT/'scratch/usage-watch/enigma-progressive-published-runtime-map-oct27.json').read_bytes())))
old=pathlib.Path('/tmp/enigma-full-frame-terminal-startgame-oct27/ops')
c=json.loads((old/'launch-config.json').read_text());s=json.dumps(c).replace('/tmp/enigma-cleanup-startgame-oct27',str(H)).replace('/tmp/enigma-full-frame-terminal-startgame-oct27/ops',str(O));c=json.loads(s);c['cutoff_at']=1793098500
c['controller'].update(checkpoint_seconds=18,review_seconds=28,after_action_seconds=20,progress=dict(max_checkpoints=3,total_seconds=110,cpu_reserve=15,api_bytes=1048576,capture_total_bytes=8388608))
save('launch-config.json',c)
parser=(old/'parser-check.cjs').read_text().replace('/tmp/enigma-cleanup-startgame-oct27',str(H)).replace('/tmp/enigma-full-frame-terminal-startgame-oct27/ops',str(O));(O/'parser-check.cjs').write_text(parser)
save('profile.json',dict(box=BOX,localAllocation=134217728,remoteAllocation=268435456,guestPhysical=3221225472,cpu=90,wall=110,heap=2048,apiTotal=8388608,apiResponse=8192,cleanupReserve=1048576,cutoff='2026-10-27T10:55:00Z',handback='2026-10-27T10:57:00Z',shutdown='2026-10-27T11:00:00Z',expiry='2026-10-27T11:06:11Z',shutdownOwner='coordinator',noWorkers=True,noSourceRepair=True))
print(json.dumps(dict(files=len(rs),bytes=sum(r['bytes'] for r in rs),pins='PASS')))
