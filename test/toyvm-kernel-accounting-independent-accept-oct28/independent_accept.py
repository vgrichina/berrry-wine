#!/usr/bin/env python3
"""Independent kernel fixtures; no browser compatibility or caller integration claim."""
import errno,hashlib,importlib.util,json,os,pathlib,sys,tempfile
HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'toyvm-kernel-profile-accounting-backend-oct28'))
import supervise_accounted as adapter
RESULTS=[]
def run(name,body,**kw):
 with tempfile.TemporaryDirectory(prefix='independent-',dir=str(HERE.parents[2]/'fixtures')) as d:
  root=pathlib.Path(d)/'domain'
  code='import os,pathlib,errno,json,mmap;root=pathlib.Path('+repr(str(root))+');'+body
  r=adapter.supervise_accounted([sys.executable,'-B','-c',code],d,rss_limit=96*1024**2,cpu_limit=90,wall_limit=5,output_limit=65536,**kw)
  r['fixtureOutput']=r.pop('output').decode();r['name']=name
  assert r['filesystemCleanup']['remainingMounts']==[] and r['cleanupComplete'],r
  assert r['filesystemCleanup']['serverExit'] is not None,r
  RESULTS.append(r);return r
(HERE.parents[2]/'fixtures').mkdir(exist_ok=True)
# Production boundary first: exact pinned adapter, exact pinned supervisor and confiner.
r=run('production-entry-defaults',"(root/'entry').write_bytes(b'entry');print('entry-ok')")
assert r['exit']==0 and r['stopReason'] is None and r['filesystem']['written']==5,r
assert r['filesystem']['live']==12288 and r['filesystem']['openHandles']==0,r
try:adapter.supervise_accounted([],None,backend='pathname-stat')
except ValueError as e:RESULTS.append({'name':'entry-unsafe-backend','error':str(e)})
else:raise AssertionError('unsafe backend accepted')
with tempfile.TemporaryDirectory(dir=str(HERE.parents[2]/'fixtures')) as d:
 (pathlib.Path(d)/'domain').mkdir()
 try:adapter.supervise_accounted(['/bin/true'],d)
 except RuntimeError as e:
  assert 'FileExistsError' in e.filesystemCleanup['serverStderr'] and not e.filesystemCleanup['remainingMounts']
  RESULTS.append({'name':'entry-setup-fails-closed','error':str(e),'cleanup':e.filesystemCleanup})
 else:raise AssertionError('setup failure accepted')
print(json.dumps({'phase':'production-entry','results':RESULTS}),flush=True)
if '--entry-only' in sys.argv:sys.exit(0)
r=run('unlinked-descriptor-retains-storage',"f=os.open(root/'a',os.O_CREAT|os.O_RDWR,0o600);os.write(f,b'a'*4096);os.unlink(root/'a');(root/'b').write_bytes(b'b'*4096);assert os.fstat(f).st_nlink==0;os.lseek(f,4096,0);os.write(f,b'c');assert os.fstat(f).st_size==4097;os.close(f)")
assert r['exit']==0 and not r['stopReason'] and r['filesystem']['peak']==24576 and r['filesystem']['live']==12288 and r['filesystem']['written']==8193,r
r=run('replacement-retains-two-descriptors',"(root/'a').write_bytes(b'a'*4096);(root/'b').write_bytes(b'b'*4096);f=os.open(root/'b',os.O_RDWR);g=os.dup(f);os.replace(root/'a',root/'b');os.close(f);assert os.fstat(g).st_nlink==0;os.lseek(g,4096,0);os.write(g,b'z');assert (root/'b').read_bytes()==b'a'*4096;os.close(g)")
assert r['exit']==0 and not r['stopReason'] and r['filesystem']['peak']==24576 and r['filesystem']['live']==12288 and r['filesystem']['written']==8193,r
r=run('truncate-rewrite-dense-accounting',"f=os.open(root/'a',os.O_CREAT|os.O_RDWR,0o600);os.write(f,b'a'*4097);os.ftruncate(f,1);os.ftruncate(f,4097);os.pwrite(f,b'z',4096);os.close(f)")
assert r['exit']==0 and not r['stopReason'] and r['filesystem']['written']==8194 and r['filesystem']['peak']==16384 and r['filesystem']['live']==16384,r
r=run('quota-delete-does-not-reset-failure',"f=os.open(root/'a',os.O_CREAT|os.O_RDWR,0o600);os.write(f,b'x'*4096);os.lseek(f,0,0)\ntry:os.write(f,b'y'*4096)\nexcept OSError as e:assert e.errno==errno.ENOSPC\nelse:raise AssertionError('over quota accepted')\nos.unlink(root/'a');os.close(f);g=os.open(root/'after',os.O_CREAT|os.O_RDWR,0o600)\ntry:os.write(g,b'z')\nexcept OSError as e:assert e.errno==errno.ENOSPC\nelse:raise AssertionError('write latch reset by delete')\nos.close(g)",write_limit=4096)
assert r['stopReason']=='filesystem cumulative write limit' and r['filesystem']['written']==4096,r
r=run('own-path-descriptor-mmap-and-ipc-controls',"import socket;outside=root.parent/'outside'\nfor action in [lambda:outside.write_bytes(b'x'),lambda:os.memfd_create('own-control'),lambda:socket.socket(socket.AF_UNIX),lambda:os.open('/proc/self/fd/0',os.O_WRONLY)]:\n try:action()\n except OSError as e:assert e.errno in (errno.EPERM,errno.EACCES,errno.ENXIO)\n else:raise AssertionError('outside-domain allocation allowed')\n(root/'m').write_bytes(b'x'*4096);f=os.open(root/'m',os.O_RDWR)\ntry:mmap.mmap(f,4096,access=mmap.ACCESS_WRITE)\nexcept OSError as e:assert e.errno in (errno.ENODEV,errno.EINVAL)\nelse:raise AssertionError('unaccounted mmap allowed')\nos.close(f)")
assert r['exit']==0 and not r['stopReason'] and r['filesystem']['written']==4096,r
print(json.dumps({'phase':'independent-kernel','results':RESULTS}),flush=True)
