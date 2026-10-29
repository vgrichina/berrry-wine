import os,json
base='/tmp/tvrn/w/domain/'
a=os.open(base+'A',os.O_CREAT|os.O_RDWR,0o600)
b=os.open(base+'B',os.O_CREAT|os.O_RDWR,0o600)
try:
 assert os.write(a,b'a'*8192)==8192
 assert os.write(b,b'b'*8192)==8192
 ai=os.fstat(a).st_ino
 os.rename(base+'A',base+'B')
 assert os.stat(base+'B').st_ino==ai
 bs=os.fstat(b)
 assert bs.st_nlink==0 and bs.st_size==8192
 assert os.pread(b,1,0)==b'b' and os.pread(a,1,0)==b'a'
 c=os.open(base+'C',os.O_CREAT|os.O_RDWR,0o600)
 try:
  print(json.dumps(dict(checkpoint='before-C-write',oldBOpen=True,oldBLinks=bs.st_nlink,oldBSize=bs.st_size,renamedInode=ai,newBInode=os.stat(base+'B').st_ino)),flush=True)
  os.write(c,b'c'*4096)
 finally:os.close(c)
finally:
 os.close(b)
 os.close(a)
