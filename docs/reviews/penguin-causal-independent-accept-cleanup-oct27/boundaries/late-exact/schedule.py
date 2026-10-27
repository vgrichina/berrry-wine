import pathlib,runpy,sys,hashlib,time,os,signal
from unittest import mock
S=pathlib.Path('/tmp/penguin-causal-independent-accept-cleanup-oct27/repo/tools/penguin_capture_contract.py')
assert hashlib.sha256(S.read_bytes()).hexdigest()=='9ec154496d10053252701d786f26e821fc226db3bdcb0e948f45e68ab0045cb0'
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
