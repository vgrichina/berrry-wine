import pathlib,sys,os,json,time,subprocess,resource,importlib.util
H=pathlib.Path('/tmp/gl-detached-rss-independent-acceptance-oct26');D=H/'tmp';P=pathlib.Path('/tmp/gl-detached-peak-rss-repair-oct26/repo/test/helpers/palette-browser-supervisor.py')
if len(sys.argv)>1:
 if sys.argv[1]=='child':
  (D/'adopt-ready').write_text('ready')
  while not (D/'adopt-release').exists():time.sleep(.001)
  a=bytearray(48*1024*1024)
  for i in range(0,len(a),4096):a[i]=1
  (D/'adopt-peak').write_text(str(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024))
  del a
  (D/'adopt-done').write_text('done');sys.exit()
 if sys.argv[1]=='parent':
  subprocess.Popen([sys.executable,__file__,'child'],start_new_session=True)
  while not (D/'adopt-ready').exists():time.sleep(.001)
  sys.exit()
spec=importlib.util.spec_from_file_location('prod',P);s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
sentinel=subprocess.Popen([sys.executable,'-c','import time;time.sleep(10)']);identity=s.key(s.snapshot()[sentinel.pid]);results={}
def save(name,r,reason):
 if isinstance(r.get('output'),bytes):r['output']=r['output'].decode()
 r['allOwnedGone']=all(not(q:=s.snapshot().get(k[0])) or s.key(q)!=tuple(k) for k in r['owned'])
 r['unrelatedSameIdentity']=s.key(s.snapshot()[sentinel.pid])==identity
 results[name]=r;(H/'ops/remaining-results.json').write_text(json.dumps(results,indent=2));print(name,json.dumps(r),flush=True)
 assert r['stopReason']==reason and r['cleanupComplete'] and r['allOwnedGone'] and r['unrelatedSameIdentity']
 cp=json.loads((H/'ops/checkpoint.json').read_text());cp['remainingCompleted']=list(results);(H/'ops/checkpoint.tmp').write_text(json.dumps(cp,indent=2));(H/'ops/checkpoint.tmp').replace(H/'ops/checkpoint.json')
try:
 for name,child in [('cli-signal','cli-signal'),('cli-accounting','cli-disk')]:
  (D/'cli-charge').unlink(missing_ok=True);env=dict(os.environ)
  if child=='cli-disk':env['PALETTE_BROWSER_RESOURCE_CONFIG']=json.dumps(dict(roots=[str(D)],reserve=8*1024*1024,future=55*1024*1024,walBaseline={}))
  c=subprocess.run([sys.executable,str(P),sys.executable,str(H/'ops/challenges.py'),child],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=5)
  (H/'ops'/f'{name}-raw.log').write_bytes(c.stdout)
  r=json.loads(c.stdout.decode().split('PALETTE_SUPERVISOR ')[-1]);r['CLIExit']=c.returncode
  save(name,r,'supervisor interrupted' if child=='cli-signal' else 'aggregate disk limit');assert c.returncode!=0
  (D/'cli-charge').unlink(missing_ok=True)
 for n in ('adopt-ready','adopt-release','adopt-done','adopt-peak'):(D/n).unlink(missing_ok=True)
 calls=[0]
 def checkpoint():
  calls[0]+=1;target='adopt-ready' if calls[0]==1 else 'adopt-done'
  if calls[0]==2:(D/'adopt-release').write_text('go')
  deadline=time.monotonic()+2
  while not (D/target).exists() and time.monotonic()<deadline:time.sleep(.001)
  assert (D/target).exists()
  if calls[0]==2:time.sleep(.08)
 r=s.supervise([sys.executable,__file__,'parent'],rss_limit=48*1024*1024,wall_limit=3,check=checkpoint)
 r['independentPeak']=int((D/'adopt-peak').read_text());save('adopted-reaped-overcap',r,'aggregate RSS limit')
 assert r['reapedPeakRSS']>=r['independentPeak']>48*1024*1024 and len(r['owned'])>=2
finally:sentinel.terminate();sentinel.wait()
