gate('collect')
code='''import pathlib,json,os,time,hashlib,tarfile
H=pathlib.Path(TASK_HOME);O=H/'ops';matches=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  cmd=(p/'cmdline').read_bytes().split(b'\\0')
  if any(x.startswith(str(H).encode()+b'/') and (x.endswith(b'/enigma-supervised-gameplay.py') or x.endswith(b'/enigma-frozen-gameplay-controller.py') or x.endswith(b'/runner/test/run.js')) for x in cmd):matches.append(dict(pid=int(p.name),argv=[x.decode(errors='replace') for x in cmd]))
 except OSError:pass
terminal=json.loads((O/'cli-exit.json').read_text()) if (O/'cli-exit.json').exists() else None
v=dict(at=time.time(),terminal=terminal,ownedLiveMatches=matches,leaveBoxRunning=True,shutdownOwner='coordinator');(O/'owned-absence.json').write_text(json.dumps(v,indent=2))
assert terminal is not None and not matches
names=['launch','cli-exit.json','supervisor-stdout.log','supervisor-stderr.log','startup-environment.json','supervisor-pid.json','readiness.json','mount-check.json','mount.stdout','mount.stderr','mount-enumeration.json','startup.stdout','startup.stderr','startup-check.json','owned-absence.json','launch-config.json','parser-check.cjs','remote-launch.py']
p=O/'terminal-evidence.tar.gz'
with tarfile.open(p,'w:gz') as t:
 for n in names:
  q=O/n
  if q.exists():t.add(q,arcname=n)
b=p.read_bytes();print(json.dumps(dict(terminal=terminal,ownedAbsent=not matches,archive=dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()),actual=sum(x.lstat().st_blocks*512 for x in [H,*H.rglob('*')]),state='RUNNING_API_EXEC_OBSERVED',box=BOX_ID)))
'''.replace('TASK_HOME',repr(str(H))).replace('BOX_ID',repr(BOX))
v=json.loads(py(code)['stdout']);save('collection.json',v);a=v['archive'];size=a['bytes'];used=sum(p.stat().st_size for p in (O/'responses').iterdir());assert used+((size+4095)//4096)*8192+262144<=8388608
assert size<=8388608
pieces=[]
for off in range(0,size,4096):
 j=py('import pathlib,base64;b=pathlib.Path('+repr(a['path'])+').read_bytes();print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())');pieces.append(base64.b64decode(j['stdout'].strip(),validate=True))
b=b''.join(pieces);assert len(b)==size and sha(b)==a['sha256'];(O/'terminal-evidence.tar.gz').write_bytes(b)
with tarfile.open(fileobj=io.BytesIO(b),mode='r:gz') as t:t.extractall(O/'remote-evidence',filter='data')
save('owned-terminal.json',v);print(json.dumps(dict(terminal=v['terminal'],ownedAbsent=v['ownedAbsent'],bytes=size)))
