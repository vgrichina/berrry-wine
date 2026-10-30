"""Native libc READDIR oracle; Linux x86-64 glibc layout derived from system headers."""
import ctypes, json, os, platform, sys
R='/tmp/tvmd/domain'
def invariant(entries, expected):
    assert entries == expected, ('READDIR entry inode invariant', entries, expected)
if '--control' in sys.argv:
    try: invariant({'.':4,'..':999,'deep':5,'data':6},{'.':4,'..':2,'deep':5,'data':6})
    except AssertionError as e:
        assert e.args[0][0]=='READDIR entry inode invariant'
        print(json.dumps(dict(fixtureControl=True,productionMutant=False,mountedCallback=False,rejectedFor=e.args[0][0])))
    else: raise AssertionError('corrupt dotdot accepted')
    sys.exit(0)
assert platform.machine()=='x86_64' and ctypes.sizeof(ctypes.c_ulong)==8 and ctypes.sizeof(ctypes.c_long)==8
class Dirent(ctypes.Structure):
    _fields_=[('ino',ctypes.c_ulong),('off',ctypes.c_long),('reclen',ctypes.c_ushort),('type',ctypes.c_ubyte),('name',ctypes.c_char*256)]
assert Dirent.name.offset==19 and ctypes.sizeof(Dirent)==280
lib=ctypes.CDLL(None,use_errno=True)
lib.opendir.argtypes=[ctypes.c_char_p];lib.opendir.restype=ctypes.c_void_p
lib.readdir.argtypes=[ctypes.c_void_p];lib.readdir.restype=ctypes.c_void_p
lib.closedir.argtypes=[ctypes.c_void_p];lib.closedir.restype=ctypes.c_int
def read(path,expected,label):
    assert path.startswith(R)
    h=lib.opendir(path.encode())
    if not h: raise OSError(ctypes.get_errno(),'opendir')
    got={}
    try:
        for count in range(32):
            ctypes.set_errno(0);p=lib.readdir(h)
            if not p:
                assert ctypes.get_errno()==0, ('readdir errno',ctypes.get_errno())
                break
            # The fixed prefix ends at d_name; read no name bytes before checking reclen.
            prefix=ctypes.string_at(p,19)
            ino=int.from_bytes(prefix[:8],'little');length=int.from_bytes(prefix[16:18],'little')
            assert 20<=length<=280
            name=ctypes.string_at(p+19,min(length-19,256))
            assert b'\0' in name
            name=name.split(b'\0',1)[0].decode()
            assert name not in got
            got[name]=ino
        else: raise AssertionError('entry count bound')
    finally: assert lib.closedir(h)==0
    print(json.dumps(dict(case=label,path=path,expected=expected,actual=got)),flush=True)
    invariant(got,expected)
for path in [R+'/a',R+'/b',R+'/a/moved',R+'/a/moved/deep']: os.mkdir(path)
payloads={'data':b'readdir-data\n','deep/leaf':b'leaf-data\n'}
for path,data in payloads.items():
    with open(R+'/a/moved/'+path,'wb') as f: assert f.write(data)==len(data)
ids={p:os.stat(R+'/'+p).st_ino for p in ['a','b','a/moved','a/moved/deep','a/moved/data','a/moved/deep/leaf']}
assert os.stat(R).st_ino==1
a,b,m,d,f,l=[ids[p] for p in ['a','b','a/moved','a/moved/deep','a/moved/data','a/moved/deep/leaf']]
assert [a,b,m,d,f,l]==[2,3,4,5,6,7]
def checks(prefix,label):
    read(R,{'.':1,'..':1,'a':a,'b':b},label+'-root')
    read(R+'/a',{'.':a,'..':1,**({'moved':m} if prefix=='a' else {})},label+'-a')
    read(R+'/b',{'.':b,'..':1,**({'moved':m} if prefix=='b' else {})},label+'-b')
    read(R+'/'+prefix+'/moved',{'.':m,'..':a if prefix=='a' else b,'deep':d,'data':f},label+'-moved')
    read(R+'/'+prefix+'/moved/deep',{'.':d,'..':m,'leaf':l},label+'-deep')
checks('a','before')
os.rename(R+'/a/moved',R+'/b/moved')
checks('b','after-fresh-open')
for path,data in payloads.items():
    with open(R+'/b/moved/'+path,'rb') as h: assert h.read()==data
assert os.stat(R+'/b/moved').st_ino==m
assert os.stat(R+'/b/moved/deep').st_ino==d
assert os.stat(R+'/b/moved/data').st_ino==f and os.stat(R+'/b/moved/deep/leaf').st_ino==l
print(json.dumps(dict(PASS=True,finalTree={'/':1,'a':a,'b':b,'b/moved':m,'b/moved/deep':d,'b/moved/data':f,'b/moved/deep/leaf':l},payloadHex={p:v.hex() for p,v in payloads.items()},expectedAccounting=dict(live=36864,peak=36864,written=sum(map(len,payloads.values())),inodes=7),backendCallbackCounters=False)),flush=True)
