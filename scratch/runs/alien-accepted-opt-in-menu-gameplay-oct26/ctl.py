from work import *
def ctl(c):
 idx=len(list(O.glob('ctl-*.json')));name='ctl-'+str(idx);b=json.dumps(c).encode()
 code='''import pathlib,urllib.request,json,time
h=pathlib.Path('''+repr(R)+''');n='''+repr(name)+''';b='''+repr(b)+'''
(h/(n+'-request.json')).write_bytes(b)
r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:18129/ctl',data=b,headers={'Content-Type':'application/json'}),timeout=20)
b=r.read(8192);(h/(n+'-response.json')).write_bytes(b);print(b.decode())
'''
 j=py(code,timeout=25);save(name+'.json',dict(at=time.time(),request=c,api=j));v=json.loads(j['stdout']);assert v['ok'],v;return v['value']
if __name__=='__main__':print(json.dumps(ctl(json.loads(sys.argv[1]))))
