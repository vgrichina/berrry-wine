import os,json
fd=os.open("/tmp/tvunlink/w/domain/A",os.O_CREAT|os.O_RDWR,0o600)
assert os.write(fd,b"a"*16384)==16384
os.unlink("/tmp/tvunlink/w/domain/A")
b=os.open("/tmp/tvunlink/w/domain/B",os.O_CREAT|os.O_WRONLY,0o600)
s=os.fstat(fd)
assert s.st_nlink==0 and s.st_size==16384
assert os.pread(fd,16384,0)==b"a"*16384
print(json.dumps(dict(checkpoint="before-B-write",Afd=fd,Bfd=b,Aopen=True,Alinks=s.st_nlink,Asize=s.st_size,Ainode=s.st_ino)),flush=True)
os.write(b,b"b"*16384)
raise AssertionError("B allocation unexpectedly succeeded")
