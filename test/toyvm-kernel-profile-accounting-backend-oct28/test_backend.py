#!/usr/bin/env python3
import errno,json,os,pathlib,resource,sys,tempfile
from supervise_accounted import supervise_accounted

resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(1048576,1048576))
results=[]
def run(name,body,**kwargs):
    with tempfile.TemporaryDirectory(prefix='toyvm-fuse-test-') as temp:
        root=pathlib.Path(temp)/'domain'
        program='import os,pathlib,json,errno,mmap;root=pathlib.Path('+repr(str(root))+');'+body
        r=supervise_accounted([sys.executable,'-B','-c',program],temp,rss_limit=128*1024**2,cpu_limit=90,wall_limit=8,output_limit=65536,**kwargs)
        output=r.pop('output').decode()
        assert not r['filesystemCleanup']['remainingMounts'],r
        assert not r['filesystemCleanup']['serverStderr'],r
        assert r['cleanupComplete'],r
        r.update(name=name,fixtureOutput=output);results.append(r)
        return r

try:
    supervise_accounted([],None,backend='pathname-stat')
    raise AssertionError('unsafe backend accepted')
except ValueError:pass

r=run('create-unlink-open',"p=root/'a';f=os.open(p,os.O_RDWR|os.O_CREAT,0o600);os.write(f,b'x'*8192);os.unlink(p);assert os.fstat(f).st_size==8192;os.write(f,b'y');assert os.fstat(f).st_nlink==0;os.close(f)")
assert r['exit']==0 and not r['stopReason'],r
assert r['filesystem']['peak']>=16384 and r['filesystem']['written']==8193 and r['filesystem']['live']==4096,r

r=run('rename-replace-open',"a=root/'a';b=root/'b';a.write_bytes(b'a'*4096);b.write_bytes(b'b'*4096);f=os.open(b,os.O_RDWR);os.rename(a,b);assert os.fstat(f).st_nlink==0;os.write(f,b'c'*4096);assert b.read_bytes()==b'a'*4096;os.close(f)")
assert r['exit']==0 and not r['stopReason'],r
assert r['filesystem']['written']==12288 and r['filesystem']['peak']>=20480,r

r=run('rapid-allocation-overflow-caught-by-guest',"f=os.open(root/'a',os.O_RDWR|os.O_CREAT,0o600)\ntry:os.write(f,b'a'*8192)\nexcept OSError as e:assert e.errno==errno.ENOSPC\nelse:raise AssertionError('overflow accepted')\nos.close(f)",live_limit=12288)
assert r['stopReason']=='filesystem allocation limit' and r['filesystem']['written']==0,r

r=run('cumulative-rewrite-overflow',"f=os.open(root/'a',os.O_RDWR|os.O_CREAT,0o600);os.write(f,b'a'*4096);os.lseek(f,0,0);os.write(f,b'b'*4096);os.lseek(f,0,0)\ntry:os.write(f,b'c'*4096)\nexcept OSError as e:assert e.errno==errno.ENOSPC\nelse:raise AssertionError('rewrite overflow accepted')\nos.close(f)",write_limit=9000)
assert r['stopReason']=='filesystem cumulative write limit' and r['filesystem']['written']==8192,r

r=run('child-autoreap-retained',"pid=os.fork()\nif pid==0:\n (root/'short-child').write_bytes(b'a'*2048);os._exit(0)\nelse:\n assert os.waitpid(pid,0)[1]==0")
assert r['exit']==0 and not r['stopReason'] and r['filesystem']['written']==2048,r

r=run('domain-and-unsafe-operation-controls',"(root/'a').write_bytes(b'x'*4096)\nfor action in [lambda:os.memfd_create('escape'),lambda:open('/tmp/toyvm-must-not-exist','wb'),lambda:os.rename(root/'a','/tmp/toyvm-rename-escape')]:\n try:action()\n except OSError as e:assert e.errno in (errno.EPERM,errno.EACCES,errno.EXDEV)\n else:raise AssertionError('domain escape permitted')\nf=os.open(root/'a',os.O_RDWR)\ntry:mmap.mmap(f,4096,access=mmap.ACCESS_WRITE)\nexcept OSError as e:assert e.errno in (errno.ENODEV,errno.EINVAL)\nelse:raise AssertionError('unaccounted writable mapping permitted')\nos.close(f)")
assert r['exit']==0 and not r['stopReason'] and r['filesystem']['written']==4096,r

r=run('anonymous-ipc-metadata-and-descriptor-import-denied',"import ctypes,socket;c=ctypes.CDLL(None,use_errno=True)\nfor syscall in [16,41,47,90,101,188,299,300,310,311,319,425,438,447,9999]:\n ctypes.set_errno(0);assert c.syscall(syscall,-1,0,0,0,0,0)==-1;assert ctypes.get_errno()==errno.EPERM\n(root/'a').write_bytes(b'a')")
assert r['exit']==0 and not r['stopReason'] and r['filesystem']['written']==1,r

r=run('truncate-growth-cumulative',"f=os.open(root/'a',os.O_CREAT|os.O_RDWR,0o600);os.ftruncate(f,4096);os.ftruncate(f,0);os.ftruncate(f,4096)\ntry:os.ftruncate(f,8192)\nexcept OSError as e:assert e.errno==errno.ENOSPC\nelse:raise AssertionError('truncate cumulative overflow accepted')\nos.close(f)",write_limit=9000)
assert r['stopReason']=='filesystem cumulative write limit' and r['filesystem']['written']==8192,r

r=run('rapid-peak-fully-released',"\nfor i in range(8):\n p=root/'comma,bearing';p.write_bytes(b'x'*4096);p.unlink()")
assert r['exit']==0 and not r['stopReason'],r
assert r['filesystem']['live']==4096 and r['filesystem']['peak']==12288 and r['filesystem']['written']==32768,r

r=run('literal-SIGCHLD-auto-reap',"import signal;signal.signal(signal.SIGCHLD,signal.SIG_IGN);a,b=os.pipe();pid=os.fork()\nif pid==0:\n os.close(a);(root/'auto').write_bytes(b'a'*1024);os.write(b,b'1');os._exit(0)\nelse:\n os.close(b);assert os.read(a,1)==b'1';os.close(a)")
assert r['exit']==0 and not r['stopReason'] and r['filesystem']['written']==1024,r

r=run('per-file-overflow',"f=os.open(root/'a',os.O_CREAT|os.O_RDWR,0o600)\ntry:os.write(f,b'x'*8192)\nexcept OSError as e:assert e.errno==errno.ENOSPC\nelse:raise AssertionError('per-file limit accepted')\nos.close(f)",file_limit=4096)
assert r['stopReason']=='filesystem per-file limit' and r['filesystem']['written']==0,r
print(json.dumps(dict(checks=12,results=results),indent=2))
