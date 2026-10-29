import os,json
fd=os.open('/tmp/tvfg/w/domain/A',os.O_CREAT|os.O_RDWR,0o600)
try:
 os.ftruncate(fd,8192)
 assert os.fstat(fd).st_size==8192 and os.pread(fd,1,8191)==b'\0'
 os.ftruncate(fd,0)
 assert os.fstat(fd).st_size==0
 os.ftruncate(fd,8192)
 assert os.fstat(fd).st_size==8192 and os.pread(fd,1,8191)==b'\0'
 print(json.dumps(dict(checkpoint='before-regrowth-over-budget',successfulGrowthBytes=16384,fileSize=8192,attemptedSize=8193)),flush=True)
 os.ftruncate(fd,8193)
finally:os.close(fd)
