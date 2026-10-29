import os
fd=os.open('/tmp/tvft2/w/domain/A',os.O_CREAT|os.O_RDWR,0o600)
try:
 print('FTRUNCATE_ATTEMPTED_SIZE:16385',flush=True)
 os.ftruncate(fd,16385)
finally:
 os.close(fd)
