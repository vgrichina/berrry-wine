import supervisor as s,json,hashlib,base64,time,pathlib
C=s.C
code=r'''import json,pathlib,hashlib,collections
p=pathlib.Path('capture/runtime-evidence.json');raw=p.read_bytes();assert len(raw)==66561 and hashlib.sha256(raw).hexdigest()=='10c942183341bdfaf795fc4059e876f2879b9c303b3d531a740e0662c284b18d'
d=json.loads(raw);t=d['traceSelected']
ix=[0,74,79,82,84,108,109,110,113,116,118,165,175,178,179]
s={'kind':'bounded diagnostic extract, NOT complete raw report','raw':{'path':str(p.resolve()),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'originalKeys':list(d),'originalTraceCount':len(t),'omissions':'All unlisted fields/events/trace indices omitted; individual selected values and lines are exact, not truncated. Original trace is itself selected from stdout, boundary stream saturates.','fields':{k:d[k] for k in ['utc','utcEnd','exit','reason','elapsed','peakRSS','gameplayAccepted','route']},'events':{str(i):d['events'][i] for i in [6,8,13,17]},'traceSelected':{str(i):t[i] for i in ix},'sourcePaths':'fields -> original root keys; events indices and traceSelected indices map directly to original arrays (zero-based)','unknowns':['guest wndproc execution and SDL consumption not established','CPU time not recorded; elapsed is wall time','capabilities deny qualification; message-completion records are historical diagnostic observations, not current-main qualification','UP consumption unknown after trace saturation']}
b=(json.dumps(s,separators=(',',':'))+'\n').encode();assert len(b)<=8192
q=pathlib.Path('capture/diagnostic-summary.json');assert not q.exists();q.write_bytes(b)
names=['final.png','diagnostic-summary.json'];assert len(set(names))==len(names)
m=[{'path':n,'bytes':len((q.parent/n).read_bytes()),'sha256':hashlib.sha256((q.parent/n).read_bytes()).hexdigest()} for n in names];assert sum(v['bytes'] for v in m)<=400000
assert m[0]['bytes']==389913 and m[0]['sha256']=='8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5'
print(json.dumps(m))
'''
try:
 m=json.loads(s.remote(code));s.save('selected-manifest.json',m)
 for row in m:
  dest=C/row['path'];assert not dest.exists()
  with dest.open('xb') as f:
   for offset in range(0,row['bytes'],9000):
    assert time.time()<json.loads((C/'schedule.json').read_text())['cutoff']
    q=s.remote("import pathlib,base64,sys; n=sys.argv[1];assert n in ['final.png','diagnostic-summary.json'];p=pathlib.Path('capture')/n;print(base64.b64encode(p.read_bytes()[int(sys.argv[2]):int(sys.argv[2])+9000]).decode())",row['path'],str(offset))
    b=base64.b64decode(q,validate=False);assert len(b)==min(9000,row['bytes']-offset);f.write(b)
    # API stdout is a redundant reversible base64 representation of these exact bytes.
    # Retain its hash/length in operation receipt; keep decoded evidence, not duplicate payload.
    op=C/('%s-%03d'%(s.PREFIX,s.SEQ)+'.stdout');meta=op.with_suffix('.json');r=json.loads(meta.read_text());r.update(discardedRedundantSelectedPayload=True,stdoutBytes=op.stat().st_size,stdoutSHA256=s.digest(op),decodedPath=str(dest),decodedOffset=offset,decodedBytes=len(b));s.save(meta.name,r);op.unlink()
  assert dest.stat().st_size==row['bytes'] and s.digest(dest)==row['sha256']
 s.save('retrieval-verification.json',dict(PASS=True,files=m,total=sum(r['bytes'] for r in m),rawDownloaded=False,guestInvocations=0))
 print(json.dumps({'verified':m,'total':sum(r['bytes'] for r in m)}))
finally:s.close()
