import pathlib,sys,os,json,hashlib,resource,subprocess,time
H=pathlib.Path(__file__).parent; S=H.parent/'repo/tools/penguin_capture_contract.py'
sha=lambda b:hashlib.sha256(b).hexdigest()
wire=lambda v:json.dumps(v,sort_keys=True,separators=(',',':')).encode()
assert sha(S.read_bytes())=='9ec154496d10053252701d786f26e821fc226db3bdcb0e948f45e68ab0045cb0'
def fixture(name,code):
 d=H/'boundaries'/name;d.mkdir(parents=True);f=d/'child.py';f.write_text(code)
 exe=pathlib.Path(sys.executable).resolve()
 limits={n:list(resource.getrlimit(getattr(resource,'RLIMIT_'+n))) for n in ('DATA','AS','RSS','CPU','FSIZE')};limits.update(CPU=[90,90],FSIZE=[4194304,4194304])
 p=dict(executable=str(exe),executable_sha256=sha(exe.read_bytes()),flags=['-S'],startup=[str(f),'startup',str(d)],guest=[str(f),'guest',str(d)],cwd=str(d),env={'LC_ALL':'C.UTF-8','TZ':'UTC'},limits=limits,resources=dict(rss=67108864,startup_wall=3,guest_wall=3,total_wall=9,text=1024,png=4194304,selected=8388608,remote=16777216,api=1048576),artifacts={str(f):sha(f.read_bytes())},capture_dir=str(d/'captures'))
 return d,p
def invoke(d,p,runner=None):
 profile=d/'profile.json';profile.write_bytes(wire(p));cmd=[sys.executable,'-B',str(runner or S),'supervise',str(profile),'--sha256',sha(profile.read_bytes()),'--output',str(d/'out')]
 with (d/'cli.stdout').open('wb') as out,(d/'cli.stderr').open('wb') as err:
  r=subprocess.run(cmd,stdout=out,stderr=err,timeout=15)
 q=json.loads((d/'out/receipt.json').read_bytes())
 assert sum((d/x).stat().st_size for x in ('cli.stdout','cli.stderr'))<8192
 total=0
 for phase in q['phases']:
  assert phase['owned_group_absent'] is True
  try:os.killpg(phase['pid'],0)
  except ProcessLookupError:pass
  else:raise AssertionError('owned process group survived')
  for n in ('stdout','stderr'):
   b=(d/'out'/(phase['stage']+'.'+n)).read_bytes();total+=len(b)
   assert phase['streams'][n]==dict(path=str(d/'out'/(phase['stage']+'.'+n)),bytes=len(b),sha256=sha(b))
 assert q['text_bytes']==total
 for path in d.glob('*.pid'):
  assert not pathlib.Path('/proc',path.read_text().strip()).exists(),path
 (d/'execution.json').write_bytes(wire(dict(command=cmd,commandSHA256=sha(wire(cmd)),profileSHA256=sha(profile.read_bytes()),exit=r.returncode,receipt=q))+b'\n')
 return r,q
LATE='''import os,sys,pathlib,time,signal
d=pathlib.Path(sys.argv[2]);stage=sys.argv[1]
(d/(stage+'.started')).write_text('started')
if stage=='startup':
 pid=os.fork()
 if pid==0:
  def late(*_):
   os.write(1,b'LATE-OUT');os.write(2,b'LATE-ERR');(d/'late.ack').write_text('written')
  signal.signal(signal.SIGUSR1,late)
  (d/'descendant.pid').write_text(str(os.getpid()));(d/'ready').write_text('ready')
  while True:time.sleep(.05)
 while not (d/'ready').exists():time.sleep(.005)
 os.write(1,b'BASE');os._exit(0)
'''
RUNNER='''import pathlib,runpy,sys,hashlib,time,os,signal
from unittest import mock
S=pathlib.Path(SOURCE)
assert hashlib.sha256(S.read_bytes()).hexdigest()==PIN
d=pathlib.Path(sys.argv.pop(1));sys.argv[0]=str(S)
real=None
def controlled(proc):
 if (d/'descendant.pid').exists() and not (d/'late.ack').exists():
  os.kill(int((d/'descendant.pid').read_text()),signal.SIGUSR1)
  end=time.monotonic()+1
  while not (d/'late.ack').exists():
   assert time.monotonic()<end,'late write handshake deadline'
   time.sleep(.005)
 return real(proc)
def intercept(frame,event,arg):
 global real
 if event=='call' and frame.f_code.co_filename==str(S) and frame.f_code.co_name=='main':
  real=frame.f_globals['reap_group'];frame.f_globals['reap_group']=controlled
  sys.setprofile(None)
sys.setprofile(intercept)
runpy.run_path(str(S),run_name='__main__')
'''
# Exact production module executed as main; a narrow reaper scheduling hook
# releases a real owned descendant after natural polling, before real cleanup.
# No production source transformation or guard replacement is performed.
def main():
 rows=[]
 for name,cap,expect in [('late-exact',20,0),('late-over',19,2)]:
  d,p=fixture(name,LATE);p['resources']['text']=cap
  runner=d/'schedule.py';runner.write_text(RUNNER.replace('SOURCE',repr(str(S))).replace('PIN',repr(sha(S.read_bytes()))))
  # Wrapper gets task-owned directory as its only additional scheduling arg.
  profile=d/'profile.json';profile.write_bytes(wire(p))
  bridge=d/'entry.py';bridge.write_text('import runpy,sys\nsys.argv.insert(1,'+repr(str(d))+')\nrunpy.run_path('+repr(str(runner)) +',run_name="__main__")\n')
  r,q=invoke(d,p,bridge)
  assert r.returncode==expect,(name,r.returncode,q)
  assert (d/'out/startup.stdout').read_bytes()==b'BASELATE-OUT'
  assert (d/'out/startup.stderr').read_bytes()==b'LATE-ERR'
  assert q['text_bytes']==20 and (d/'late.ack').exists()
  if expect:
   assert q['guest_starts']==0 and len(q['phases'])==1 and q['phases'][0]['reason']=='text'
   assert not (d/'guest.started').exists()
  else:assert q['guest_starts']==1 and q['status']=='PASS_OFFLINE_RECIPE'
  rows.append(dict(case=name,result='PASS',execution=str(d/'execution.json')))
  checkpoint(rows)
 code='''import pathlib,sys,os,time
d=pathlib.Path(sys.argv[2]);stage=sys.argv[1];(d/(stage+'.started')).write_text('started')
if stage=='startup':
 child=os.fork()
 if child==0:(d/'aggregate-child.pid').write_text(str(os.getpid()))
 block=bytearray(12*1024*1024)
 os.write(2,b'aggregate-rss-participant\\n')
 time.sleep(5)
'''
 d,p=fixture('aggregate-rss',code);p['resources']['rss']=32*1048576
 r,q=invoke(d,p)
 assert r.returncode==2 and q['guest_starts']==0 and len(q['phases'])==1
 assert q['phases'][0]['reason']=='rss' and q['phases'][0]['peak_rss']>32*1048576
 assert not (d/'guest.started').exists()
 assert (d/'out/startup.stderr').read_bytes().count(b'aggregate-rss-participant')==2
 rows.append(dict(case='aggregate-rss',result='PASS',execution=str(d/'execution.json'),cap=32*1048576,participants=2,eachAllocation=12*1048576))
 checkpoint(rows)
 code='''import pathlib,sys,time,os
d=pathlib.Path(sys.argv[2]);stage=sys.argv[1];(d/(stage+'.started')).write_text('started');os.write(2,(stage+'-wall\\n').encode());time.sleep(.65)
'''
 d,p=fixture('combined-total-wall',code);p['resources']['total_wall']=1
 r,q=invoke(d,p)
 assert r.returncode==2 and q['guest_starts']==1 and len(q['phases'])==2
 assert q['phases'][0]['status']=='passed' and q['phases'][1]['reason']=='wall'
 rows.append(dict(case='combined-total-wall',result='PASS',execution=str(d/'execution.json'),totalWall=1,individualWall=3))
 checkpoint(rows)
 print('Independent late descendant exact/over combined text; aggregate RSS; combined total wall PASS')
def checkpoint(rows):
 (H/'boundary-result.json').write_text(json.dumps(rows,indent=2)+'\n')
 q=json.loads((H/'checkpoint.json').read_text());q.update(at=time.time(),group='independent remaining boundaries',completed=rows,fixtureSHA256=sha(pathlib.Path(__file__).read_bytes()),remaining=['boundary groups not yet listed','reuse reconciliation and publication'])
 temp=H/'checkpoint.tmp';temp.write_text(json.dumps(q,indent=2)+'\n');temp.replace(H/'checkpoint.json')
if __name__=='__main__':main()
