import supervisor as s
import pathlib,json,os,time,subprocess,datetime,base64,hashlib,ast
C=s.C;R=s.R
def main():
 pre=json.loads((R/'enigma-fresh-boat-efficient-transfer-runtime-oct30/preflight.json').read_text())
 for name,pin in pre['immutablePins'].items():
  st=pathlib.Path(name).stat();assert [st.st_dev,st.st_ino,st.st_size,st.st_mtime_ns,st.st_ctime_ns]==pin,name
 assert s.digest(R/'enigma-fresh-boat-efficient-transfer-runtime-oct30/efficient-runtime.py')=='c404ec694a4e65b291a70d5dc5617c1991325dbf6f6a626f39f82c94616bfe81'
 assert s.digest(R/'enigma-fresh-boat-efficient-transfer-runtime-oct30/completion-receipt.json')=='940e79f7d24dfc3fabecb41d07028a7af23e25080552dc5adcf8aa605d134f1e'
 blob=s.git('show','HEAD:test/enigma-fresh-boat-efficient-transfer-runtime-oct30/verifier-correction.json')['stdout'].encode()
 assert hashlib.sha256(blob).hexdigest()=='74fef1af68b98d5b678d66c44e3ab5cd681b73d7fa53d6677ac5898c0452ba4c'
 s.save('pin-check.json',dict(PASS=True,at=time.time(),immutablePreflightPins=len(pre['immutablePins']),correctedHelper=s.digest(R/'enigma-fresh-boat-efficient-transfer-runtime-oct30/efficient-runtime.py'),verifier=s.digest(C/'verify-remote.py'),guest=s.digest(C/'guest.py')))
 s.admission('before-fork')
 assert not (C/'fork-attempt.json').exists(),'one fork only'
 s.save('fork-attempt.json',dict(at=time.time(),parent='bx_jvne7b63',ttl=1800))
 result=s.api(['fork','bx_jvne7b63','--ttl','1800'],wall=150)
 v=result.get('sandbox',result);ident=v.get('id') or result.get('sandboxId');assert ident and ident!='bx_jvne7b63',result
 s.save('new-boat.json',dict(id=ident,fork=result,at=time.time()))
 info=s.api(['info',ident])['sandbox'];s.save('initial-info.json',info)
 created=info['createdAt'];epoch=datetime.datetime.fromisoformat(created.replace('Z','+00:00')).timestamp()
 sch=dict(id=ident,createdAt=created,createdEpoch=epoch,guestCutoff=epoch+1200,handback=epoch+1380,shutdownEpoch=epoch+1500,expiry=info.get('archiveAfter'),shutdownOwner=C.name)
 s.save('schedule.json',sch)
 s.save('watchdog.json',dict(parent=os.getpid(),shutdownEpoch=sch['shutdownEpoch'],independentCapture=True))
 # New process, no inherited Python stream, and dedicated exclusive capture handles.
 with (C/'watchdog-process.stdout').open('xb') as a,(C/'watchdog-process.stderr').open('xb') as b:
  w=subprocess.Popen(['/usr/bin/python3','-B',str(C/'supervisor.py'),'--watchdog'],cwd=s.cwd_check(C),env=s.ENV,stdout=a,stderr=b,stdin=subprocess.DEVNULL,close_fds=True,start_new_session=True,preexec_fn=lambda:s.limits('native'))
 s.save('watchdog.json',dict(pid=w.pid,parent=os.getpid(),shutdownEpoch=sch['shutdownEpoch'],independentCapture=True,stdout='watchdog-process.stdout',stderr='watchdog-process.stderr'))
 try:
  s.save('smoke.json',json.loads(s.remote("import pathlib,json;print(json.dumps(dict(smoke=True,rootExists=pathlib.Path('/home/user/enigma-original').is_dir(),cwd=str(pathlib.Path.cwd()),limits=pathlib.Path('/proc/self/limits').read_text())))")))
  # Full verification is in place: no extraction and no retransfers.
  s.save('remote-verification.json',dict(stdout=s.remote((C/'verify-remote.py').read_text(),wall=60)))
  for local,target in [(C/'guest.py','guest-progression.py'),(R/'guest-poll-args.json','guest-args.json'),(R/'guest-poll-instrument.py','guest-poll-instrument.py')]:
   data=local.read_bytes();code="import pathlib,base64,hashlib,sys;b=base64.b64decode(sys.argv[2]);assert hashlib.sha256(b).hexdigest()==sys.argv[3];pathlib.Path('/home/user/enigma-original',sys.argv[1]).write_bytes(b);print(sys.argv[3])"
   args=[target,base64.b64encode(data).decode(),hashlib.sha256(data).hexdigest()]
   assert len(code.encode())+sum(len(x.encode()) for x in args)<16384
   s.remote(code,*args)
  s.save('observer.json',dict(stdout=s.remote("import subprocess,pathlib; r=pathlib.Path('/home/user/enigma-original');subprocess.run(['/usr/bin/python3','-B',str(r/'guest-poll-instrument.py'),str(r/'runner/test/run.js')],cwd=r,check=True);subprocess.run(['/home/user/.nvm/versions/node/v24.22.1/bin/node','--check',str(r/'runner/test/run.js')],cwd=r,check=True)")))
  s.admission('before-guest');assert time.time()+135<sch['guestCutoff']
  s.save('guest-invocation.json',dict(at=time.time(),count=1,wall=115,CPU=60))
  s.save('runtime-operation.json',dict(stdout=s.remote("import subprocess,json,pathlib;q=subprocess.run(['/usr/bin/python3','-B','/home/user/enigma-original/guest-progression.py'],cwd='/home/user/enigma-original',capture_output=True,text=True,timeout=115);print(json.dumps(dict(exit=q.returncode,stdout=q.stdout[-1000:],stderr=q.stderr[-2000:])))",wall=130)))
  files=json.loads(s.remote("import pathlib,json,hashlib;r=pathlib.Path('/home/user/enigma-original/capture');print(json.dumps([dict(path=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in r.iterdir() if p.is_file()]))"));s.save('capture-manifest.json',files)
  by={x['path']:x for x in files}
  # Select named files before arithmetic. Unselected duplicate PNGs do not count.
  names=['runtime-evidence.json']+(['final.png'] if 'final.png' in by else ['before.png'] if 'before.png' in by else [])
  selected=[by[n] for n in names];s.save('selected-captures.json',dict(names=names,files=selected,total=sum(x['bytes'] for x in selected),ceiling=400000))
  assert sum(x['bytes'] for x in selected)<=400000
  for x in selected:
   assert pathlib.Path(x['path']).name==x['path']
   data=base64.b64decode(s.remote("import pathlib,base64,sys;print(base64.b64encode(pathlib.Path('/home/user/enigma-original/capture',sys.argv[1]).read_bytes()).decode())",x['path']))
   assert len(data)==x['bytes'] and hashlib.sha256(data).hexdigest()==x['sha256'];(C/x['path']).write_bytes(data)
 except BaseException as e:
  s.save('failure.json',dict(at=time.time(),error=repr(e)));print(repr(e),flush=True)
 finally:
  s.close()
  w.wait(timeout=5)
  s.save('watchdog-reaped.json',dict(pid=w.pid,exit=w.returncode))
 print(json.dumps(dict(id=ident,closed=True,failure=(C/'failure.json').exists())))
if __name__=='__main__':main()
