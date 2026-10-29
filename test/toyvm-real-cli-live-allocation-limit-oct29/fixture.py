import os
p='/tmp/tvlive/w/domain/'
f=os.open(p+'first',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
n=os.write(f,b'a'*16384)
os.close(f)
os.write(1,('first-write='+str(n)+'\n').encode())
if n!=16384: raise SystemExit(3)
f=os.open(p+'second',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
try:
 n=os.write(f,b'b'*16384)
 os.write(1,('second-write='+str(n)+'\n').encode())
except OSError as e:
 os.write(1,('second-rejected='+str(e.errno)+'\n').encode())
finally:
 os.close(f)
