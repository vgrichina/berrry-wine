gate('preguest')
assert json.loads((O/'historical-menu.png.receipt.json').read_text())['passGate']
assert time.time()+130<1793076000
remote=py('import pathlib,shutil,json;h=pathlib.Path("/tmp/enigma-prepared-readback-startgame-oct27");mem=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024;free=shutil.disk_usage(h).free;old={str(p):pathlib.Path("/proc/"+str(p)).exists() for p in [25292,25293,25300]};assert mem>=3758096384+805306368 and free>=67108864 and not any(old.values());print(json.dumps(dict(at=__import__("time").time(),memAvailable=mem,free=free,requiredRAM=4563402752,oldProcesses=old,newAllocation=67108864)))')
save('remote-preguest.json',json.loads(remote['stdout']))
argv=['/home/user/.ascii/boat','exec','--no-update','--json','--detach',BOX,'timeout 120 python3 '+str(O/'launch.py')];p=subprocess.run(argv,capture_output=True,timeout=15);assert len(p.stdout)+len(p.stderr)<=8192
(O/'launch-api.json').write_bytes(p.stdout);(O/'launch-api.stderr').write_bytes(p.stderr);save('launch-api-command.json',dict(argv=argv,exit=p.returncode,at=time.time(),responseBytes=len(p.stdout)+len(p.stderr)));assert p.returncode==0
for i in range(180):
 j=py('import pathlib,json;h=pathlib.Path('+repr(str(O))+');p=h/"launch/controller/menu-candidate.png.json";terminal=h/"cli-exit.json";print(json.dumps(dict(frame=json.loads(p.read_text()) if p.exists() else None,terminal=json.loads(terminal.read_text()) if terminal.exists() else None)))');v=json.loads(j['stdout'])
 if v['frame']:
  f=v['frame'];save('new-menu-metadata.json',f)
  if f['sha256']==sha((O/'historical-menu.png').read_bytes()) and f['bytes']==(O/'historical-menu.png').stat().st_size:
   (O/'new-menu.png').write_bytes((O/'historical-menu.png').read_bytes());save('new-menu-transport.json',dict(method='exact SHA256 and length content deduplication',metadata=f,bytesVerified=True,notAnInputDecision=True));print(json.dumps(f));break
  else:
   raise RuntimeError('new frame differs; stop automatic delivery, inspect remaining budget before bounded transfer')
 if v['terminal']:raise RuntimeError(('terminal guest',v))
 time.sleep(.25)
else:raise RuntimeError('bounded poll exhausted; no input')
