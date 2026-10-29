import base64,hashlib,json,os,pathlib,resource,signal,subprocess,time
R=pathlib.Path('/tmp/tvdt'); repo=R/'repo';work=R/'w'
manifest=json.loads((R/'pins.json').read_text())
assert all(hashlib.sha256((repo/p).read_bytes()).hexdigest()==v['sha256'] for p,v in manifest.items())
assert pathlib.Path('/usr/bin/python3').is_file() and os.access('/usr/bin/fusermount3',os.X_OK) and pathlib.Path('/dev/fuse').exists()
assert len(str(work/'status.sock').encode())==23
assert hashlib.sha256((R/'cancellation.json').read_bytes()).hexdigest()=='543b076948699e1607179782b472f4863125064cdfa3a4632351e8a1f6ed7870'
work.mkdir();assert not list(work.iterdir())
def rows():
 out={}
 for d in pathlib.Path('/proc').iterdir():
  if not d.name.isdigit():continue
  try:
   f=(d/'stat').read_text().rsplit(')',1)[1].split();out[int(d.name)]=dict(ppid=int(f[1]),pgrp=int(f[2]),start=f[19],rss=int(f[21])*4096)
  except (OSError,ValueError,IndexError):pass
 return out
def spawn(argv,*,cwd):
 p=pathlib.Path(os.path.abspath(cwd));assert p.is_relative_to(R);p=p.resolve(strict=True);assert p.is_relative_to(R)
 return subprocess.Popen(argv,cwd=p,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
resource.setrlimit(resource.RLIMIT_DATA,(128*1048576,resource.getrlimit(resource.RLIMIT_DATA)[1]))
resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1048576,12*1048576))
argv=['/usr/bin/python3','-B',str(repo/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(R/'cancellation.json'),'--work',str(work),'--live-limit','32768','--write-limit','65536','--file-limit','16384','--rss-limit','134217728','--cpu-limit','2','--wall-limit','5','--output-limit','1024','--','/usr/bin/python3','-B','-c','import os\nfor i in range(4):\n assert os.write(1,b"X"*512)==512']
before=rows();start=time.monotonic();q=spawn(argv,cwd=repo);seen={};external=None
while q.poll() is None:
 current=rows();owned={p:r for p,r in current.items() if r['pgrp']==q.pid};seen.update({str(p)+':'+r['start']:r for p,r in owned.items()})
 if time.monotonic()-start>8 or sum(r['rss'] for r in owned.values())>512*1048576 or current[os.getpid()]['rss']>128*1048576:
  external='outer safety action';os.killpg(q.pid,signal.SIGKILL);break
 time.sleep(.002)
out,err=q.communicate(timeout=1);assert len(out)+len(err)<1048576
(R/'cli.stdout').write_bytes(out);(R/'cli.stderr').write_bytes(err)
report=json.loads(out) if out else {};backend=report.get('backendReceipt',{})
current=rows();identities=set(seen)|{str(p)+':'+str(s) for p,s in backend.get('owned',[])}
remaining=[k for k in identities if int(k.split(':')[0]) in current and current[int(k.split(':')[0])]['start']==k.split(':')[1]]
mounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work/'domain') in x]
captured=base64.b64decode(backend.get('output',{}).get('data',''))
receipt=dict(argv=argv,exit=q.returncode,externalSafety=external,wall=time.monotonic()-start,observedIdentities=seen,remainingIdentities=remaining,remainingMounts=mounts,backendCapturedBytes=len(captured),stopReason=backend.get('stopReason'),cli=report,preflight=dict(pinsVerified=True,mountArgv=[],guestMountParserInvoked=False,quotas=[32768,65536,16384]))
receipt['PASS']=q.returncode!=0 and report.get('accepted') is False and backend.get('stopReason')=='output limit' and len(captured)==1024 and report.get('cleanupComplete') is True and not remaining and not mounts and external is None
(R/'runtime.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,sort_keys=True))
raise SystemExit(0 if receipt['PASS'] else 1)
