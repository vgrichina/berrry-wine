gate('collect-terminal')
code='''import pathlib,json,time,tarfile,hashlib,zlib,shutil
h=pathlib.Path(HOME);o=h/'ops';l=o/'launch';cli=json.loads((o/'cli-exit.json').read_text());out=json.loads((l/'supervisor-outcome.json').read_text());startup=json.loads((l/'node-startup.json').read_text());controller=json.loads((l/'controller/outcome.json').read_text());sp=json.loads((o/'supervisor-pid.json').read_text());ids=[dict(pid=p,start=str(s)) for p,s in out['owned']]+[sp];live=[]
for r in ids:
 p=pathlib.Path('/proc')/str(r['pid'])/'stat'
 try:
  x=p.read_text().split(') ')[1].split()
  if x[19]==r['start'] and x[0] not in ['Z','X']:live.append(r)
 except FileNotFoundError:pass
frames=[]
for p in sorted((l/'controller').glob('*.png')):
 b=p.read_bytes();assert len(b)<=2097152;frames.append(dict(path=str(p),name=p.name,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),wireBytes=len(zlib.compress(b,9))))
assert len(frames)<=4 and sum(r['bytes'] for r in frames)<=8388608
summary=dict(at=time.time(),cli=cli,controller=controller,supervisorStatus=out.get('status'),supervisorReason=out.get('reason'),nodeStartupExit=startup['exit'],ownedIdentityCount=len(ids),live=live,ownedProcessAbsence=not live,frames=frames,box='bx_mueag3dn',shutdownOwner='coordinator',state='RUNNING_API_EXEC_SUCCEEDED',expiry='2026-10-27T09:42:54Z',used=sum(p.stat().st_blocks*512 for p in [h,*h.rglob('*')] if p.exists()),free=shutil.disk_usage(h).free,memAvailable=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024)
(o/'terminal-summary.json').write_text(json.dumps(summary,indent=2));assert not live
archive=o/'terminal-evidence.tar.gz'
with tarfile.open(archive,'w:gz') as t:
 for p in sorted(l.rglob('*')):
  if p.is_file() and p.suffix!='.png':t.add(p,arcname=str(p.relative_to(o)),recursive=False)
 for name in ['cli-exit.json','supervisor-pid.json','startup-environment.json','supervisor-stderr.log','supervisor-stdout.log','launch-config.json','launch.py','remote-preguest.json','remote-verified.json','terminal-summary.json','mount-check.json','mount-enumeration.json','mount-parser.stdout','mount-parser.stderr','mount-preflight-api.stdout','mount-preflight-api.stderr','mount-preflight-v2-api.stdout','mount-preflight-v2-api.stderr']:
  p=o/name
  if p.is_file():t.add(p,arcname=name,recursive=False)
b=archive.read_bytes();assert len(b)<=25165824;print(json.dumps(dict(summary=summary,archive=dict(path=str(archive),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))))
'''.replace('HOME',repr(str(H)))
j=json.loads(py(code)['stdout']);save('terminal-meta.json',j);f=j['archive'];remaining=1048576-sum(p.stat().st_size for p in (O/'responses').iterdir());estimated=(f['bytes']+4095)//4096*5900
save('collection-response-admission.json',dict(remaining=remaining,archiveBytes=f['bytes'],projectedEnvelopeBytes=estimated));assert estimated<=remaining,'Terminal archive cannot fit cumulative API response limit'
fetch(f['path'],'terminal-evidence.tar.gz',f['bytes'],f['sha256']);target=O/'terminal';target.mkdir(exist_ok=True)
with tarfile.open(O/'terminal-evidence.tar.gz') as t:t.extractall(target,filter='data')
for f in j['summary']['frames']:
 if f['name']=='menu-candidate.png' and (O/'new-menu.png').is_file() and sha((O/'new-menu.png').read_bytes())==f['sha256']:continue
 remaining=1048576-sum(p.stat().st_size for p in (O/'responses').iterdir());estimated=(f['wireBytes']+4095)//4096*5900
 if estimated>remaining:save('untransferred-'+f['name']+'.json',dict(frame=f,remaining=remaining,estimated=estimated,reason='Cumulative API response guard; retained on running assigned Boat; no reviewed gameplay claim'));continue
 fetch(f['path'],f['name'],f['wireBytes'],f['sha256'],True)
print(json.dumps(j['summary']))
