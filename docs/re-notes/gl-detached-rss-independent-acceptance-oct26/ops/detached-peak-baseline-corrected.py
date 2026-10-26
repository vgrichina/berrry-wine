"""Independent challenge: detached child peak entirely between accounting samples.
No browser/network. Synchronization removes chance/timing retries. check() models
an allowed accounting traversal that takes 100ms, with no resource gate changed.
"""
import os,sys,time,json,pathlib,subprocess,importlib.util,resource
H=pathlib.Path('/tmp/gl-launch-controls-retained-challenges-oct26')
D=H/'tmp'; mode=sys.argv[1] if len(sys.argv)>1 else 'test'
if mode=='peak-child':
 (D/'ready').write_text(str(os.getpid()))
 while not (D/'release').exists(): time.sleep(.001)
 allocation=bytearray(48*1024*1024)
 for i in range(0,len(allocation),4096): allocation[i]=1
 (D/'measured-peak.json').write_text(json.dumps(dict(pid=os.getpid(),start=pathlib.Path('/proc/self/stat').read_text().split()[21],rssHighWater=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024)))
 del allocation
 (D/'done').write_text('done')
 sys.exit(0)
if mode=='peak-parent':
 c=subprocess.Popen([sys.executable,__file__,'peak-child'],start_new_session=True)
 c.wait();time.sleep(.12);sys.exit(c.returncode)
if mode=='detach-parent':
 c=subprocess.Popen([sys.executable,'-c','import time;time.sleep(5)'],start_new_session=True)
 (D/'detached-pid').write_text(str(c.pid));time.sleep(.04);sys.exit(7)
spec=importlib.util.spec_from_file_location('candidate','/tmp/gl-browser-launch-control-repair-oct26/source/test/helpers/palette-browser-supervisor.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
def absent(k):
 r=s.snapshot().get(int(k[0]));return r is None or r['start']!=str(k[1])
# A preexisting direct child is explicitly outside task ownership.
unrelated=subprocess.Popen([sys.executable,'-c','import time;time.sleep(10)'])
try:
 u=s.snapshot()[unrelated.pid]; control=s.supervise([sys.executable,__file__,'detach-parent'],rss_limit=128*1024*1024,wall_limit=2)
 control['output']=control['output'].decode(); control['unrelatedAliveSameIdentity']=s.key(s.snapshot()[unrelated.pid])==s.key(u)
 detached=int((D/'detached-pid').read_text());control['detachedOwned']=any(k[0]==detached for k in control['owned']);control['allOwnedGone']=all(absent(k) for k in control['owned'])
 (H/'ops/detached-control.json').write_text(json.dumps(control,indent=2));print('DETACHED_CONTROL '+json.dumps(control),flush=True)
 assert control['exit']==7 and control['stopReason'] is None and control['cleanupComplete'] and control['detachedOwned'] and control['allOwnedGone'] and control['unrelatedAliveSameIdentity']
 # Pause one real accounting callback while short child allocation runs.
 state={'count':0}
 def accounting():
  state['count']+=1
  if state['count']==1:
   deadline=time.monotonic()+2
   while not (D/'ready').exists() and time.monotonic()<deadline: time.sleep(.001)
   assert (D/'ready').exists(),'child startup failed'
   return None
  if state['count']==2:
   (D/'release').write_text('go'); deadline=time.monotonic()+2
   while not (D/'done').exists() and time.monotonic()<deadline: time.sleep(.001)
   assert (D/'done').exists(),'child did not finish'
   time.sleep(.1)
  return None
 result=s.supervise([sys.executable,__file__,'peak-parent'],rss_limit=48*1024*1024,wall_limit=3,check=accounting)
 result['output']=result['output'].decode();result['independentChildPeak']=json.loads((D/'measured-peak.json').read_text()); result['limit']=48*1024*1024; result['allOwnedGone']=all(absent(k) for k in result['owned']);result['accountingCallbacks']=state['count'];result['unrelatedAliveSameIdentity']=s.key(s.snapshot()[unrelated.pid])==s.key(u)
 result['verdict']='REJECT' if result['independentChildPeak']['rssHighWater']>result['limit'] and result['stopReason'] is None else 'PASS_OR_DIFFERENT_FAILURE'
 (H/'ops/peak-challenge.json').write_text(json.dumps(result,indent=2));print('PEAK_CHALLENGE '+json.dumps(result),flush=True)
 assert result['verdict']!='REJECT','candidate accepted detached child peak above RSS cap; sampled peak and wait4 omit exited RSS high water'
finally:
 unrelated.terminate();unrelated.wait()
