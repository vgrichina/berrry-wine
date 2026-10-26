from work import *
code='''import pathlib,json,hashlib,base64,os
h=pathlib.Path('''+repr(R)+''');old=pathlib.Path('/tmp/alien-shooter-current-gameplay-api-oct26');rows=[]
for q in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(q/'cmdline').read_bytes().split(b'\\0');exe=os.readlink(q/'exe')
  if (exe.endswith('/node') and str(old/'runner/test/run.js').encode() in a) or (exe.endswith('/python3.12') and str(h/'supervisor.py').encode() in a):rows.append(dict(pid=int(q.name),argv=[x.decode() for x in a]))
 except OSError:pass
print(json.dumps(dict(files={str(p.relative_to(h)):base64.b64encode(p.read_bytes()).decode() for p in (h/'guest').glob('*') if p.is_file()},ownedLive=rows,oldExecutableExists=(old/'runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe').exists(),allocatedOld=sum(p.lstat().st_blocks*512 for p in [old,*old.rglob('*')]),allocatedNew=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]))))
assert not rows
'''
j=py(code);save('collection-api.json',j);v=json.loads(j['stdout']);d=O/'retained/guest';d.mkdir(parents=True)
for n,b in v['files'].items():(d/pathlib.Path(n).name).write_bytes(base64.b64decode(b))
save('cleanup.json',{k:v for k,v in v.items() if k!='files'})
save('guest-status-api.json',remote('true'))
a=['boat','--no-update','--json','exec','--status',json.loads((O/'guest-detach.json').read_text())['commandId'],BOX]
p=subprocess.run(a,capture_output=True,text=True,timeout=30);save('detach-status.json',dict(argv=a,exit=p.returncode,stdout=p.stdout,stderr=p.stderr));print(p.stdout[:1000])
p=subprocess.run(['boat','--no-update','--json','info',BOX],capture_output=True,text=True,timeout=30);assert p.returncode==0;save('box-handoff-state.json',json.loads(p.stdout));print('COLLECTED')
