from work import *
gate('cleanup')
j=py('''import pathlib,json,time,hashlib,shutil
h=pathlib.Path(ROOT)
out=json.loads((h/'ops/launch/supervisor-outcome.json').read_text())
sp=json.loads((h/'ops/supervisor-pid.json').read_text())
ids=[dict(pid=p,start=str(s)) for p,s in out['owned']]+[sp]
rows=[]
for r in ids:
 p=pathlib.Path('/proc')/str(r['pid'])/'stat'
 try:
  x=p.read_text().split(') ')[1].split();live=x[19]==r['start'] and x[0] not in ['Z','X'];observed=dict(state=x[0],start=x[19])
 except FileNotFoundError:live=False;observed=None
 rows.append(dict(**r,live=live,observed=observed))
v=dict(at=time.time(),identities=rows,ownedProcessAbsence=not any(r['live'] for r in rows),box='bx_nmvbu5c7',boxState='RUNNING (successful API exec)',shutdownOwner='coordinator',expiry='2026-10-27T05:12:05Z',used=sum(p.stat().st_blocks*512 for p in h.rglob('*') if p.is_file()),free=shutil.disk_usage(h).free)
assert v['ownedProcessAbsence'];(h/'ops/owned-cleanup.json').write_text(json.dumps(v,indent=2));print(json.dumps(v))
'''.replace('ROOT',repr(R)));save('owned-cleanup.json',json.loads(j['stdout']));print(j['stdout'])
p=subprocess.run(['/home/user/.ascii/boat','exec','--no-update','--json','--status','25287',BOX],capture_output=True,text=True,timeout=30)
assert len(p.stdout.encode())+len(p.stderr.encode())<=8192
save('api-terminal-status.json',dict(exit=p.returncode,response=json.loads(p.stdout),stderr=p.stderr));print(p.stdout)
