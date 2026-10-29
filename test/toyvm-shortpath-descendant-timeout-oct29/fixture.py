import os,time,json
fd=os.open('/tmp/tvdt/w/domain/held-accounted-file',os.O_CREAT|os.O_RDWR,0o600)
os.write(fd,b'parent')
def identity(role):
 s=open('/proc/self/stat').read().rsplit(')',1)[1].split()
 print(json.dumps(dict(role=role,pid=os.getpid(),ppid=os.getppid(),start=s[19],fd=fd)),flush=True)
child=os.fork()
if child==0:
 os.pwrite(fd,b'descendant',0)
 identity('descendant')
 while True:
  os.pwrite(fd,b'x',0)
  time.sleep(.05)
else:
 identity('parent')
 time.sleep(30)
