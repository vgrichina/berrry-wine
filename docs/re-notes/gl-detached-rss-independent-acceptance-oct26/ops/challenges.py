import os,sys,time,json,pathlib,subprocess,signal,resource,importlib.util
H=pathlib.Path('/tmp/gl-detached-rss-independent-acceptance-oct26'); D=H/'tmp'
P=pathlib.Path('/tmp/gl-detached-peak-rss-repair-oct26/repo/test/helpers/palette-browser-supervisor.py')
mode=sys.argv[1] if len(sys.argv)>1 else 'test'
def identity():
 return [os.getpid(),pathlib.Path('/proc/self/stat').read_text().split()[21]]
if mode=='sleeper':
 signal.signal(signal.SIGTERM,signal.SIG_IGN)
 (D/'sleeper.json').write_text(json.dumps(identity()));time.sleep(8);sys.exit()
if mode=='early':
 subprocess.Popen([sys.executable,__file__,'sleeper'],start_new_session=True)
 while not (D/'sleeper.json').exists():time.sleep(.001)
 sys.exit(0)
if mode=='peak':
 a=bytearray(40*1024*1024)
 for i in range(0,len(a),4096):a[i]=1
 peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024
 with (D/'peaks.jsonl').open('a') as f:f.write(json.dumps(dict(identity=identity(),peak=peak))+'\n')
 time.sleep(.025);sys.exit()
if mode=='sequential':
 for _ in range(2):subprocess.run([sys.executable,__file__,'peak'],check=True)
 sys.exit()
if mode=='burn':
 t=time.process_time()
 while time.process_time()-t<.22:pass
 (D/'burn-done').write_text('done');sys.exit()
if mode=='wait-burn':
 subprocess.run([sys.executable,__file__,'burn'],check=True);sys.exit()
if mode=='adopt':
 subprocess.Popen([sys.executable,__file__,'peak'],start_new_session=True);sys.exit()
if mode=='cli-signal':
 os.kill(os.getppid(),signal.SIGTERM);time.sleep(4);sys.exit()
if mode=='cli-disk':
 (D/'cli-charge').write_bytes(b'x'*(2*1024*1024));time.sleep(4);sys.exit()
spec=importlib.util.spec_from_file_location('prod',P);s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
sentinel=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'])
sentinelkey=s.key(s.snapshot()[sentinel.pid]);results={}
def checked(name,r,reason):
 r['output']=r['output'].decode();r['allOwnedGone']=all(not (q:=s.snapshot().get(k[0])) or s.key(q)!=tuple(k) for k in r['owned'])
 r['unrelatedSameIdentity']=s.key(s.snapshot()[sentinel.pid])==sentinelkey
 results[name]=r
 (H/'ops/independent-results.json').write_text(json.dumps(results,indent=2))
 assert r['stopReason']==reason,(name,r)
 assert r['cleanupComplete'] and r['allOwnedGone'] and r['unrelatedSameIdentity'],(name,r)
 cp=json.loads((H/'ops/checkpoint.json').read_text());cp['independentCompleted']=list(results);(H/'ops/checkpoint.tmp').write_text(json.dumps(cp,indent=2));(H/'ops/checkpoint.tmp').replace(H/'ops/checkpoint.json')
 print(name,json.dumps(r),flush=True)
try:
 (D/'sleeper.json').unlink(missing_ok=True)
 r=s.supervise([sys.executable,__file__,'early'],rss_limit=160*1024*1024,wall_limit=2)
 checked('early-success-detached-ignoreterm',r,None);assert r['exit']==0
 assert json.loads((D/'sleeper.json').read_text()) in r['owned']
 (D/'peaks.jsonl').unlink(missing_ok=True)
 r=s.supervise([sys.executable,__file__,'sequential'],rss_limit=96*1024*1024,wall_limit=3)
 checked('sequential-independent-highwaters',r,None)
 peaks=[json.loads(l)['peak'] for l in (D/'peaks.jsonl').read_text().splitlines()]
 assert sum(peaks)>96*1024*1024 and r['peakRSS']<96*1024*1024,(peaks,r)
 assert r['reapedPeakRSS']>=max(peaks)
 # Root exits before an adopted child peaks: success cleanup must reap it safely.
 r=s.supervise([sys.executable,__file__,'adopt'],rss_limit=160*1024*1024,wall_limit=2)
 checked('adopted-child',r,None);assert len(r['owned'])>=2
 (D/'burn-done').unlink(missing_ok=True)
 def pause():
  deadline=time.monotonic()+2
  while not (D/'burn-done').exists() and time.monotonic()<deadline:time.sleep(.001)
  assert (D/'burn-done').exists()
  time.sleep(.04)
 r=s.supervise([sys.executable,__file__,'wait-burn'],rss_limit=160*1024*1024,cpu_limit=.12,wall_limit=3,check=pause)
 checked('waited-cpu-between-samples',r,'aggregate CPU limit');assert r['cpuSeconds']>.12
 r=s.supervise([sys.executable,__file__,'sleeper'],rss_limit=160*1024*1024,wall_limit=.12)
 checked('timeout-ignoreterm-escalation',r,'wall deadline')
 def broken():raise OSError('independent-accounting-callback-fault')
 r=s.supervise([sys.executable,__file__,'early'],rss_limit=160*1024*1024,wall_limit=2,check=broken)
 checked('accounting-exception',r,'accounting check failed: independent-accounting-callback-fault')
 for sig in (signal.SIGINT,signal.SIGHUP):
  calls=[0]
  def interrupt():
   calls[0]+=1
   if calls[0]==2:os.kill(os.getpid(),sig)
  r=s.supervise([sys.executable,__file__,'sleeper'],rss_limit=160*1024*1024,wall_limit=2,check=interrupt)
  checked('signal-'+str(sig),r,'supervisor interrupted')
 # Actual CLI entrypoint, no substituted supervise function or copied runner.
 for name,child in [('cli-signal','cli-signal'),('cli-accounting','cli-disk')]:
  (D/'cli-charge').unlink(missing_ok=True)
  env=dict(os.environ)
  if child=='cli-disk':env['PALETTE_BROWSER_RESOURCE_CONFIG']=json.dumps(dict(roots=[str(D)],reserve=8*1024*1024,future=55*1024*1024,walBaseline={}))
  c=subprocess.run([sys.executable,str(P),sys.executable,__file__,child],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=5)
  text=c.stdout.decode();marker='PALETTE_SUPERVISOR ';r=json.loads(text.split(marker)[-1]);r['output']='';r['CLIExit']=c.returncode
  checked(name,r,'supervisor interrupted' if child=='cli-signal' else 'aggregate disk limit')
  assert c.returncode!=0
  (D/'cli-charge').unlink(missing_ok=True)
finally:
 sentinel.terminate();sentinel.wait()
