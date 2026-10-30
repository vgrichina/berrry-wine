import os,json
root='/tmp/tvtrunc/w/domain/'
a=os.open(root+'A',os.O_CREAT|os.O_RDWR,0o600)
wa=os.write(a,b'A'*16384);assert wa==16384
assert os.fstat(a).st_size==16384
os.ftruncate(a,0)
sa=os.fstat(a);assert sa.st_size==0 and sa.st_nlink==1
os.close(a)
b=os.open(root+'B',os.O_CREAT|os.O_RDWR,0o600)
wb=os.write(b,b'B'*16384);assert wb==16384
sb=os.fstat(b);assert sb.st_size==16384 and sb.st_nlink==1
os.close(b)
sa=os.stat(root+'A');assert sa.st_size==0 and sa.st_nlink==1
print(json.dumps(dict(writeA=wa,truncateA=sa.st_size,AStillLinked=sa.st_nlink,writeB=wb,BSize=sb.st_size,closedA=True,closedB=True)))
