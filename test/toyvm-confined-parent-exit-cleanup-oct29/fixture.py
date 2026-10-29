import os,time
r,w=os.pipe()
parent=os.getpid()
pid=os.fork()
if pid==0:
    os.close(r)
    fd=os.open('/tmp/tvdt/w/domain/tiny',os.O_CREAT|os.O_WRONLY,0o600)
    os.write(fd,b'tiny-parent-exit\n')
    os.write(1,('child-ready pid=%d parent=%d fd=%d\n'%(os.getpid(),parent,fd)).encode())
    os.write(w,b'R');os.close(w)
    time.sleep(20)
    os.close(fd);os._exit(9)
os.close(w)
assert os.read(r,1)==b'R'
os.close(r)
time.sleep(.15)
os.write(1,('parent-normal-exit pid=%d child=%d\n'%(parent,pid)).encode())
os._exit(0)
