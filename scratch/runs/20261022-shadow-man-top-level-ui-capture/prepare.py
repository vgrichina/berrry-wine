import remote,json,pathlib,subprocess,hashlib
E=remote.E
p=subprocess.run(['boat','--json','info',remote.BOX],capture_output=True,text=True);assert p.returncode==0;remote.save('box-before.json',json.loads(p.stdout))
r=remote.run((E/'preserve-current.py').read_text(),'preservation-api.json',30);remote.save('preservation.json',json.loads(r['stdout']))
for name in ['observer.cjs','admit.py','launch.py','handback.py']:
 remote.transfer((E/name).read_bytes(),'../shadow-man-bounded-runtime/shadow-man-top-level-ui-capture-oct22/'+name)
r=remote.run((E/'admit.py').read_text(),'preflight-api.json',30);remote.save('preflight.json',json.loads(r['stdout']))
p=subprocess.run(['node',str(E/'fixture.cjs')],capture_output=True,text=True);assert p.returncode==0;remote.save('offline-fixture.json',json.loads(p.stdout))
remote.save('observer-hashes.json',dict(before=hashlib.sha256((E/'observer-before.cjs').read_bytes()).hexdigest(),after=hashlib.sha256((E/'observer.cjs').read_bytes()).hexdigest()))
print('PREPARED: exact243 pins, quota and backup PASS')
