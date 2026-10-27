
import urllib.request,json,os,signal,pathlib
original=urllib.request.Request
def request(*args,**kwargs):
 c=json.loads(kwargs.get('data',b'{}'))
 if c.get('action')=='step':
  root=pathlib.Path(os.environ['BOUNDARY_ROOT'])
  child=json.loads((root/'child.json').read_text())
  mode=os.environ['BOUNDARY_MODE']
  if mode=='death':
   os.kill(child['pid'],signal.SIGKILL)
   os.waitpid(child['pid'],0)
  elif mode=='terminal':
   (root/'launch/terminal.json').write_text('{}')
  elif mode=='identity':
   # Explicit synthetic identity observation, not an actual PID reuse claim.
   read=pathlib.Path.read_text
   def changed(path,*a,**k):
    raw=read(path,*a,**k)
    if str(path)==f"/proc/{child['pid']}/stat":
     at=raw.rfind(')')+2;fields=raw[at:].split();fields[19]='0'
     return raw[:at]+' '.join(fields)
    return raw
   pathlib.Path.read_text=changed
  else:
   raise SystemExit('injected-controller-crash-after-intent')
 return original(*args,**kwargs)
urllib.request.Request=request
