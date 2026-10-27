gate('preguest')
assert json.loads((O/'historical-review.png.receipt.json').read_text())['passGate']
assert json.loads((O/'checkpoint.json').read_text())['status']=='EXACT_CLOSURE_AND_MOUNT_PASS_NO_GUEST'
assert time.time()+130<1793092500
remote='''import pathlib,json,shutil,time,hashlib
h=pathlib.Path(HOME);o=h/'ops';rows=json.loads((o/'runtime-manifest.json').read_text());bad=[]
rows.append(dict(target='modules/wine-assembly.wasm',bytes=1880854,sha256='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b'))
for r in rows:
 b=(h/r['target']).read_bytes()
 if len(b)!=r['bytes'] or hashlib.sha256(b).hexdigest()!=r['sha256']:bad.append(r['target'])
used=sum(p.stat().st_blocks*512 for p in [h,*h.rglob('*')] if p.exists());free=shutil.disk_usage(h).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
v=dict(at=time.time(),used=used,allocation=268435456,reserve=33554432,future=max(0,268435456-used),free=free,memAvailable=mem,requiredRAM=4563402752,floor=2982150144,hashMismatches=bad)
v['projected']=free-v['future'];v['pass']=not bad and used+33554432<=268435456 and v['projected']>=v['floor'] and mem>=v['requiredRAM'];(o/'remote-preguest.json').write_text(json.dumps(v,indent=2));print(json.dumps(v));assert v['pass']
'''.replace('HOME',repr(str(H)))
save('remote-preguest.json',json.loads(py(remote)['stdout']))
j=api('timeout 120 python3 '+shlex.quote(str(O/'launch.py')),detach=True);save('launch-api.json',j);save('launch-at.json',dict(at=time.time(),box=BOX,oneInvocation=True,cutoff=1793092500))
save('checkpoint.json',dict(status='ONE_GUEST_LAUNCHED_PENDING_FRAME',at=time.time(),launch=j,guestInvocations=1,restarts=0,inputs=0,gameplay=False,ordinaryQuit=False,remaining=['Actual frame identity and inspect; correlated click','after-action review','terminal/cleanup evidence','publication'],shutdownOwner='coordinator'))
for i in range(180):
 code='import pathlib,json;h=pathlib.Path('+repr(str(O))+');p=h/"launch/controller/menu-candidate.png.json";t=h/"cli-exit.json";print(json.dumps(dict(frame=json.loads(p.read_text()) if p.exists() else None,terminal=json.loads(t.read_text()) if t.exists() else None)))'
 v=json.loads(py(code)['stdout'])
 if v['frame']:
  f=v['frame'];save('new-menu-metadata.json',f)
  historical=(O/'historical-review.png').read_bytes()
  if f['sha256']==sha(historical) and f['bytes']==len(historical):
   (O/'new-menu.png').write_bytes(historical);save('new-menu-transport.json',dict(method='actual metadata SHA256 and bytes exact content dedup',metadata=f,at=time.time(),notAnInputDecision=True))
  else:
   meta=json.loads(py('import pathlib,zlib,json;b=pathlib.Path('+repr(f['path'])+').read_bytes();print(json.dumps(dict(wire=len(zlib.compress(b,9)))))')['stdout']);fetch(f['path'],'new-menu.png',meta['wire'],f['sha256'],True)
  print(json.dumps(f));break
 if v['terminal']:raise RuntimeError(('terminal before frame',v))
 time.sleep(.25)
else:raise RuntimeError('bounded frame poll exhausted; no input')
# Keep the same admitted light-execution permit through inspection and delivery.
# This prevents a two-permit Git publication from delaying the 25s review window.
until=time.monotonic()+20
while time.monotonic()<until and not (O/'inspection-approved.json').exists():time.sleep(.1)
if (O/'inspection-approved.json').exists():
 inspected=json.loads((O/'inspection-approved.json').read_text());assert inspected==dict(frameSHA256=f['sha256'],batch=f['batch'],x=343,y=213,reviewed=True)
 d=dict(inspected,safeStartGame=True);save('decision.json',d)
 code='import pathlib,json,time;p=pathlib.Path('+repr(str(O/'decision.json'))+');assert not p.exists();p.write_text('+repr(json.dumps(d))+');print(json.dumps(dict(deliveredAt=time.time(),frameSHA256='+repr(f['sha256'])+',batch='+str(f['batch'])+')))'
 save('decision-delivery.json',json.loads(py(code)['stdout']));print('New inspected exact-frame decision delivered')
else:save('no-decision.json',dict(reason='No actual image inspection within retained 20-second local window',at=time.time(),inputs=0))
