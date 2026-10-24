import os, pathlib, subprocess, json, time, resource, signal, selectors, ctypes, hashlib
P=pathlib.Path(__file__).parent; H=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
ctypes.CDLL(None).prctl(36,1,0,0,0)
def run(name,args,heavy=False):
 available=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 floor=2684354560 if heavy else 805306368
 assert available>=floor, ('memory admission rejected',available,floor)
 cap=90 if heavy else 60
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(cap,cap)); resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 argv=['/usr/local/bin/node','--max-old-space-size='+('512' if heavy else '256'),*args]
 t=time.monotonic(); proc=subprocess.Popen(argv,cwd=P/'inputs',stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits)
 sel=selectors.DefaultSelector(); outputs={}; total=0; reason=None
 for stream,label in [(proc.stdout,'stdout'),(proc.stderr,'stderr')]:
  sel.register(stream,selectors.EVENT_READ,label);outputs[label]=open(P/(name+'.'+label),'wb')
 while sel.get_map() or proc.poll() is None:
  if time.monotonic()-t>cap: reason='wall limit'
  if total>262144: reason='capture limit'
  if reason: break
  for key,_ in sel.select(.1):
   b=os.read(key.fd,4096)
   if b: outputs[key.data].write(b);total+=len(b)
   else: sel.unregister(key.fileobj)
 if reason or proc.poll() is None:
  os.killpg(proc.pid,signal.SIGTERM)
  try: proc.wait(timeout=5)
  except subprocess.TimeoutExpired: os.killpg(proc.pid,signal.SIGKILL)
 proc.wait()
 try: os.killpg(proc.pid,0);remaining=True
 except ProcessLookupError: remaining=False
 if remaining:
  os.killpg(proc.pid,signal.SIGTERM);time.sleep(.1)
  try: os.killpg(proc.pid,signal.SIGKILL)
  except ProcessLookupError: pass
 while True:
  try:
   pid,_=os.waitpid(-1,os.WNOHANG)
   if not pid: break
  except ChildProcessError: break
 for f in outputs.values():f.close()
 try:os.killpg(proc.pid,0);remaining=True
 except ProcessLookupError:remaining=False
 receipt={'argv':argv,'cwd':str(P/'inputs'),'pid':proc.pid,'exit':proc.returncode,'reason':reason,'elapsed':time.monotonic()-t,'MemAvailable':available,'memoryFloor':floor,'cpuWallLimit':cap,'captureBytes':total,'processGroupRemaining':remaining,'subreaper':True,'reaped':True,'maxChildRSSBytes':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024}
 (P/(name+'.json')).write_text(json.dumps(receipt,indent=2)); print(json.dumps(receipt),flush=True)
 return proc.returncode
if __name__=='__main__':
 import sys
 mode=sys.argv[1];wasm=str(H/'build/wine-assembly.wasm');sha='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
 if mode=='host': code=run('host',['test/test-wave-error-text.js'])
 elif mode=='wrong-hash': code=run('wrong-hash',['test/test-wave-error-text-native.js','--wasm='+wasm,'--sha256='+'0'*64])
 elif mode=='native': code=run('native',['test/test-wave-error-text-native.js','--wasm='+wasm,'--sha256='+sha],True)
 else:raise ValueError(mode)
 sys.exit(0 if mode=='wrong-hash' and code==1 else code)
