import os,json
fd=os.open('/tmp/tvow/w/domain/A',os.O_CREAT|os.O_RDWR,0o600)
try:
 assert os.write(fd,b'a'*8192)==8192
 assert os.pwrite(fd,b'b'*8192,0)==8192
 assert os.fstat(fd).st_size==8192 and os.pread(fd,1,0)==b'b'
 print(json.dumps(dict(checkpoint='before-third-write',successfulWriteBytes=16384,fileSize=8192)),flush=True)
 os.pwrite(fd,b'c',0)
finally:os.close(fd)
