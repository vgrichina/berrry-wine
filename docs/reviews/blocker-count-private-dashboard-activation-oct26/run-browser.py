from control import *
resources('pre-browser')
assert not (P/'browser-profile').exists()
log=(P/'browser-output.log').open('wb')
env=os.environ.copy();env['NODE_OPTIONS']='--max-old-space-size=192'
argv=['/usr/local/bin/node','--max-old-space-size=192',str(P/'browser.cjs')]
p=subprocess.Popen(argv,env=env,preexec_fn=limits,stdout=log,stderr=subprocess.STDOUT)
start=time.monotonic();peak=0;peakdisk=0;samples=[]
while p.poll() is None:
 descendants={p.pid};rss=0
 for q in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   stat=(q/'stat').read_text();bits=stat[stat.rfind(')')+2:].split()
   if int(bits[1]) in descendants or int(q.name) in descendants:
    descendants.add(int(q.name));rss+=int((q/'statm').read_text().split()[1])*4096
  except (OSError,ValueError,IndexError): pass
 peak=max(peak,rss);size=ownedbytes();peakdisk=max(peakdisk,size)
 if time.monotonic()-start>60 or size+8388608>67108864:
  for pid in descendants:
   try:os.kill(pid,9)
   except ProcessLookupError:pass
  save('browser-monitor-blocker.json',{'elapsed':time.monotonic()-start,'bytes':size,'reason':'wall or disk hard gate'});break
 time.sleep(.25)
p.wait(timeout=5);log.close()
save('browser-monitor.json',{'argv':argv,'exitCode':p.returncode,'wallSeconds':time.monotonic()-start,'peakAggregateBrowserNodeRSS':peak,'peakOwnedBytesIncludingProfileAndLauncher':peakdisk,'browserAllowanceBytes':536870912,'profileCleanup':'only owned profile after browser close'})
if (P/'browser-profile').exists():shutil.rmtree(P/'browser-profile')
sample('after-browser');resources('after-browser',peak)
print((P/'browser-output.log').read_text()[:8192])
