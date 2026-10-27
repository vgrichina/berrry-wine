gate('preguest');assert time.time()+130<1793104980
assert json.loads((O/'validate-launch-remote.json').read_text())['passGate']
assert (O/'startup-check.json').exists()
assert (O/'readiness-remote.json').exists() and json.loads((O/'capture-readiness.json').read_text())['pass']
def readjson(path):
 j=json.loads(py('import pathlib,json,hashlib;p=pathlib.Path('+repr(path)+');b=p.read_bytes() if p.exists() else b"null";print(b.decode() if len(b)<=4096 else json.dumps(dict(largeFile=True,bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))')['stdout'])
 if isinstance(j,dict) and j.get('largeFile'):
  name='large-'+sha(path.encode())+'.json';fetch(path,name,j['bytes'],j['sha256']);return json.loads((O/name).read_text())
 return j
def fetch(remote,name,size,digest):
 used=sum(p.stat().st_size for p in (O/'responses').iterdir());envelope=((size+4095)//4096)*8192
 assert size<=700000 and used+envelope+1048576<=8388608
 save(name+'.admission.json',dict(at=time.time(),used=used,pendingFullEnvelope=envelope,cleanupReserve=1048576))
 pieces=[];start=time.monotonic()
 for off in range(0,size,4096):
  j=py('import pathlib,base64;b=pathlib.Path('+repr(remote)+').read_bytes();print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())');pieces.append(base64.b64decode(j['stdout'].strip(),validate=True))
 b=b''.join(pieces);assert len(b)==size and sha(b)==digest;(O/name).write_bytes(b);save(name+'.receipt.json',dict(bytes=size,sha256=digest,elapsed=time.monotonic()-start,serial=True))
launch=api('timeout 120 python3 '+shlex.quote(str(O/'remote-launch.py')),detach=True);save('launch-api.json',launch);save('guest-invocation.json',dict(at=time.time(),count=1,box=BOX))
seen=set();deadline=time.monotonic()+115
while time.monotonic()<deadline:
 phase=readjson(str(O/'launch/controller/phase.json'))
 if phase and phase.get('phase')=='AWAIT_IMAGE_REVIEW':
  f=phase['frame'];identity=(f['sha256'],f['batch'])
  if identity not in seen:
   seen.add(identity);n=len(seen);save('frame-'+str(n)+'.json',f);fetch(f['path'],'frame-'+str(n)+'.png',f['bytes'],f['sha256']);print('FRAME_READY',n,json.dumps(f),flush=True)
   # Only an external human/model image inspection can authorize a decision.
   until=time.monotonic()+26
   choice=O/('review-'+str(n)+'.json')
   while time.monotonic()<until and not choice.exists():time.sleep(.05)
   if choice.exists():
    d=json.loads(choice.read_text());assert d.get('reviewed') is True and d.get('frameSHA256')==f['sha256'] and d.get('batch')==f['batch'];assert bool(d.get('continueLoading')) != bool(d.get('safeStartGame'))
    py('import pathlib,json;p=pathlib.Path('+repr(str(O/'decision.json'))+');q=p.with_suffix(".tmp");q.write_text('+repr(json.dumps(d))+');q.replace(p);print("review delivered")');save('review-'+str(n)+'-delivered.json',dict(at=time.time(),decision=d));print('REVIEW_DELIVERED',n,flush=True)
   else:save('review-'+str(n)+'-absent.json',dict(at=time.time(),reason='No external decision before bounded wait'))
 terminal=readjson(str(O/'cli-exit.json'))
 if terminal:save('cli-exit.json',terminal);print('TERMINAL',json.dumps(terminal),flush=True);break
 time.sleep(.2)
else:raise RuntimeError('Original invocation terminal uncertain; no replay')
for name in ['supervisor-outcome.json','controller/outcome.json','controller/first-n1-completion-gate.json','controller/start-game-action-ACK.json','controller/after-action.png.json','node-startup.json','terminal.json']:
 v=readjson(str(O/'launch'/name));save('launch-'+name.replace('/','-'),v)
 if name.endswith('after-action.png.json') and v:fetch(v['path'],'after-action.png',v['bytes'],v['sha256'])
print('COLLECTED',flush=True)
