import supervisor as s, json, datetime, time, subprocess, os, base64, hashlib
C=s.C
s.admission('before-provision')
v=s.api(['fork','bx_jtdgbp9t','--ttl','1800'],wall=120);s.save('fork-response.json',v)
b=v.get('sandbox',v);assert b['id'].startswith('bx_') and b['id']!='bx_jtdgbp9t';s.save('new-boat.json',b)
epoch=datetime.datetime.fromisoformat(b['createdAt'].replace('Z','+00:00')).timestamp()
s.save('schedule.json',dict(id=b['id'],createdAt=b['createdAt'],createdEpoch=epoch,cutoff=epoch+1200,handback=epoch+1380,shutdownEpoch=epoch+1500,expiry=b.get('expiresAt'),shutdownOwner=C.name))
try:
 with (C/'watchdog.stdout').open('xb') as a,(C/'watchdog.stderr').open('xb') as e:
  p=subprocess.Popen(['/usr/bin/python3','-B',str(C/'supervisor.py'),'--watchdog'],cwd=s.cwd_check(C),env=s.ENV,stdout=a,stderr=e,start_new_session=True,preexec_fn=lambda:s.limits('python'))
  s.save('watchdog.json',dict(pid=p.pid,parent=os.getpid(),armedBeforeSmoke=True,ownStreams=True,deadlineBased=True))
 s.save('smoke.json',json.loads(s.remote("import pathlib,json;print(json.dumps({'cwd':str(pathlib.Path.cwd()),'capture':pathlib.Path('capture').is_dir()}))")))
 code="""import json,pathlib,hashlib
raw=pathlib.Path('capture/runtime-evidence.json').read_bytes();assert len(raw)==66561 and hashlib.sha256(raw).hexdigest()=='10c942183341bdfaf795fc4059e876f2879b9c303b3d531a740e0662c284b18d'
d=json.loads(raw)
print(json.dumps({'keys':list(d),'eventKeys':[{ 'index':i,'keys':list(e),'ackType':type(e.get('ack')).__name__} for i,e in enumerate(d['events'])],'traceCount':len(d['traceSelected']),'traceSample':list(enumerate(d['traceSelected']))[:4],'relevantEvents':{str(i):d['events'][i] for i in [6,8,9,13,14,17]}}))
"""
 q=json.loads(s.remote(code));s.save('original-keys.json',q);print(json.dumps(q))
except BaseException as e:
 s.save('first-failure.json',dict(error=repr(e),at=time.time()));s.close();raise
