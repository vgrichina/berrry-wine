import os,json,stat
fd=os.open('/tmp/tvsp/w/domain/A',os.O_CREAT|os.O_RDWR,0o600)
try:
 assert os.fstat(fd).st_size==0
 print(json.dumps(dict(checkpoint='before-sparse-offset-write',attemptedOffset=8191,attemptedBytes=1,initialSize=0)),flush=True)
 os.pwrite(fd,b'x',8191)
finally:os.close(fd)
