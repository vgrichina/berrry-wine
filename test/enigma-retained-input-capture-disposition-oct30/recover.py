"""FAILED single bounded diagnostic stage; retained for provenance, do not rerun.
Premature watchdog cleanup prevented subsequent retrieval.
"""
import supervisor as s
import json,datetime,time,subprocess,pathlib,os
C=s.C
s.admission('provision')
v=s.api(['fork','bx_6j9h42np','--ttl','1800'],wall=120)
s.save('fork-response.json',v)
b=v.get('sandbox',v);assert b['id'].startswith('bx_') and b['id']!='bx_6j9h42np'
s.save('new-boat.json',b)
epoch=datetime.datetime.fromisoformat(b['createdAt'].replace('Z','+00:00')).timestamp()
s.save('schedule.json',dict(id=b['id'],createdAt=b['createdAt'],createdEpoch=epoch,guestCutoff=epoch+1200,handback=epoch+1380,shutdownEpoch=epoch+1500,expiry=b.get('expiresAt') or v.get('expiresAt'),shutdownOwner=C.name))
with (C/'watchdog.stdout').open('xb') as a,(C/'watchdog.stderr').open('xb') as e:
 p=subprocess.Popen(['/usr/bin/python3','-B',str(C/'supervisor.py'),'--watchdog'],cwd=s.cwd_check(C),env=s.ENV,stdout=a,stderr=e,start_new_session=True,preexec_fn=lambda:s.limits('python'))
 s.save('watchdog.json',dict(pid=p.pid,parent=os.getpid(),armedBeforeSmoke=True,ownStreams=True))
try:
 smoke=s.remote("import json,pathlib;print(json.dumps({'cwd':str(pathlib.Path.cwd()),'capture':pathlib.Path('capture').is_dir()}))")
 s.save('smoke.json',json.loads(smoke))
 code="""import json,pathlib,hashlib
p=pathlib.Path('capture/runtime-evidence.json');raw=p.read_bytes();assert len(raw)==66561 and hashlib.sha256(raw).hexdigest()=='10c942183341bdfaf795fc4059e876f2879b9c303b3d531a740e0662c284b18d'
d=json.loads(raw)
print(json.dumps({'rawBytes':len(raw),'rawSHA256':hashlib.sha256(raw).hexdigest(),'keys':{k:{'type':type(v).__name__,'length':len(v) if isinstance(v,(list,dict,str)) else None} for k,v in d.items()},'events':[{'index':i,'keys':list(v),'command':v.get('command'),'ackKeys':list(v.get('ack',{}))} for i,v in enumerate(d.get('events',[]))],'traceCount':len(d.get('traceSelected',[]))}))
"""
 out=s.remote(code);s.save('original-keys.json',json.loads(out));print(out)
finally:
 # Controller exits between bounded stages; watchdog closes only at explicit stage completion.
 s.save('stage-parent.json',dict(pid=os.getpid(),stage='keys'))
 # Keep watchdog alive across controller stages by handing it to the persistent launching shell's parent.
 s.save('watchdog.json',dict(pid=p.pid,parent=os.getppid(),armedBeforeSmoke=True,ownStreams=True))
