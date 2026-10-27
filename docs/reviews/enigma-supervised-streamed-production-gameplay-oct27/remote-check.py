import json,pathlib,subprocess,shlex,time
O=pathlib.Path('/tmp/enigma-supervised-streamed-production-gameplay-oct27/ops')
code='''import json,pathlib,time
guests=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().split(b'\\0')
  if a and pathlib.Path(a[0].decode()).name in ('node','nodejs') and any(x.endswith(b'/test/run.js') or x==b'test/run.js' for x in a):guests.append(int(p.name))
 except (OSError,ValueError,UnicodeDecodeError):pass
print(json.dumps(dict(at=time.time(),productionNodePids=guests,memAvailableKiB=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0]),probe='read-only; no runtime staged or launched')))
'''
cmd='timeout 10 python3 -c '+shlex.quote(code)
a=['/home/user/.ascii/boat','exec','--no-update','--json','--timeout','20','bx_xs97h52x',cmd]
p=subprocess.run(a,capture_output=True,timeout=35)
(O/'box-probe-stdout.log').write_bytes(p.stdout);(O/'box-probe-stderr.log').write_bytes(p.stderr)
assert len(p.stdout)+len(p.stderr)<=8192
j=json.loads(p.stdout)
(O/'box-probe.json').write_text(json.dumps(dict(at=time.time(),argv=a,exit=p.returncode,response=j,stderrBytes=len(p.stderr)),indent=2)+'\n')
assert p.returncode==0 and j.get('exitCode')==0,j
inner=json.loads(j['stdout']);assert inner['productionNodePids']==[]
(O/'owned-cleanup.json').write_text(json.dumps(dict(at=time.time(),guestLaunches=0,supervisorLaunches=0,nodeStartupAttempts=0,ownedGuestPids=[],ownedGuestLive=[],remoteProbeProductionNodePids=inner['productionNodePids'],box='bx_xs97h52x',boxState='RUNNING (successful bounded API exec)',leaveRunning=True,shutdownOwner='coordinator',expiry='2026-10-27T04:33:22.349Z'),indent=2)+'\n')
print('PASS bounded API read-only box handback probe: production Node PIDs absent; box remains RUNNING')
