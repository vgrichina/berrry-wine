import os,json,time,hashlib
R='/tmp/tvsa/domain';L=R+'/left,parent';D=R+'/right,parent'
S=L+'/moved,directory';T=D+'/new,name';C='/child,data';DATA=b'parent-coherence\x00exact\xff'
def emit(step,**kw):print(json.dumps(dict(step=step,at=time.monotonic(),**kw)),flush=True)
def absent(p):
    try:os.stat(p)
    except FileNotFoundError:return True
    raise AssertionError('old namespace still present')
def check(step,p,parent,old,ino,child=C,data=DATA):
    assert absent(old)
    assert os.stat(p).st_ino==ino
    assert os.stat(p+'/..').st_ino==parent
    names=os.listdir(p);assert names==[child[1:]]
    with open(p+child,'rb') as f:actual=f.read()
    assert actual==data
    emit(step,path=p,parent=parent,inode=ino,oldAbsent=True,names=names,bytes=len(actual),sha256=hashlib.sha256(actual).hexdigest())
os.mkdir(L);os.mkdir(D);os.mkdir(S)
with open(S+C,'xb') as f:f.write(DATA)
left=os.stat(L).st_ino;right=os.stat(D).st_ino;ino=os.stat(S).st_ino
assert len({left,right,ino})==3
assert os.listdir(S)==[C[1:]]
emit('original',left=left,right=right,inode=ino,path=S)
os.rename(S,T);check('moved',T,right,S,ino)
os.rename(T,S);check('moved-back',S,left,T,ino)
F=L+'/fresh,nested';G=D+'/fresh,roundtrip';N='/leaf,dir';P='/payload,data';B=b'fresh-nested-roundtrip\x00'
os.mkdir(F);os.mkdir(F+N)
with open(F+N+P,'xb') as f:f.write(B)
fresh=os.stat(F).st_ino;leaf=os.stat(F+N).st_ino
assert len({left,right,ino,fresh,leaf})==5
assert os.listdir(F)==[N[1:]] and os.listdir(F+N)==[P[1:]]
emit('fresh-original',inode=fresh,leaf=leaf,left=left,right=right)
for step,src,dst,parent in [('fresh-moved',F,G,right),('fresh-moved-back',G,F,left)]:
    os.rename(src,dst);assert absent(src)
    assert os.stat(dst).st_ino==fresh and os.stat(dst+N).st_ino==leaf
    assert os.stat(dst+'/..').st_ino==parent and os.stat(dst+N+'/..').st_ino==fresh
    assert os.listdir(dst)==[N[1:]] and os.listdir(dst+N)==[P[1:]]
    with open(dst+N+P,'rb') as f:actual=f.read()
    assert actual==B
    emit(step,path=dst,parent=parent,inode=fresh,leaf=leaf,oldAbsent=True,sha256=hashlib.sha256(actual).hexdigest())
os.unlink(F+N+P);os.rmdir(F+N);os.rmdir(F)
os.unlink(S+C);os.rmdir(S);os.rmdir(L);os.rmdir(D)
assert os.listdir(R)==[];emit('cleanup',empty=True)
