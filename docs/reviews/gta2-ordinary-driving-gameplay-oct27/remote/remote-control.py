import sys,json,pathlib,time,urllib.request,hashlib
H=pathlib.Path('/tmp/gta2-ordinary-driving-gameplay-oct27');L=H/'control';L.mkdir(exist_ok=True)
def request(cmd):
 b=json.dumps(cmd,separators=(',',':')).encode();i=len(list(L.glob('*.request.json')));(L/(str(i)+'.request.json')).write_bytes(b)
 (L/(str(i)+'.start.json')).write_text(json.dumps(dict(at=time.time(),commandSHA256=hashlib.sha256(b).hexdigest())))
 req=urllib.request.Request('http://127.0.0.1:8123/ctl',data=b,headers={'Content-Type':'application/json'},method='POST')
 try:
  with urllib.request.urlopen(req,timeout=25) as r:raw=r.read(65536)
 except BaseException as e:
  (L/(str(i)+'.failure.json')).write_text(json.dumps(dict(at=time.time(),error=repr(e),uncertain=True)));raise
 (L/(str(i)+'.response.json')).write_bytes(raw);q=json.loads(raw);assert q['ok'],q
 return q['value']
def frozen():
 s=request(dict(action='snapshot'));assert s['frozen']['frozen'] and s['frozen']['credits']==0,s
 return s
mode=sys.argv[1]
if mode=='step':
 n=int(sys.argv[2]);assert 1<=n<=5000
 before=frozen();a=request(dict(action='step',n=n));assert a['ran']==n and a['steps']==n and a['frozen'],a
 after=frozen();assert after['batch']==a['batch'] and after['batch']-before['batch']==n,(before,a,after)
 print(json.dumps(dict(before=before,ack=a,after=after)))
elif mode=='snapshot':print(json.dumps(frozen()))
elif mode=='capture':
 before=frozen();name=sys.argv[2];assert name.replace('-','').isalnum()
 p=H/'captures'/(name+'.png');assert not p.exists()
 a=request(dict(action='png',path=str(p)));after=frozen();assert before['batch']==after['batch']==a['batch']
 b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n' and len(b)<=4194304
 w=int.from_bytes(b[16:20],'big');h=int.from_bytes(b[20:24],'big')
 q=dict(name=name,path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),width=w,height=h,batch=after['batch'],frozenCredits=0,at=time.time())
 (L/(name+'-capture.json')).write_text(json.dumps(q));print(json.dumps(q))
elif mode=='input':
 review=json.loads((H/'reviewed-frame.json').read_text());p=pathlib.Path(review['path']);assert hashlib.sha256(p.read_bytes()).hexdigest()==review['sha256']
 before=frozen();cmd=sys.argv[2];heldfile=H/'held-keys.json';held=json.loads(heldfile.read_text()) if heldfile.exists() else []
 releasing=cmd.startswith('keyup:') and int(cmd.split(':')[1]) in held
 assert releasing or before['batch']==review['batch'],'reviewed frame stale'
 cmd=sys.argv[2];assert cmd.split(':')[0] in ('keydown','keyup','keypress','click','mousemove','mousedown','mouseup')
 a=request(dict(cmd=cmd));assert a['queued'] and a['batch']==before['batch']
 if cmd.startswith('keydown:'):held.append(int(cmd.split(':')[1]))
 if cmd.startswith('keyup:') and int(cmd.split(':')[1]) in held:held.remove(int(cmd.split(':')[1]))
 heldfile.write_text(json.dumps(held))
 print(json.dumps(dict(input=cmd,queued=a,reviewedFrame=review)))
else:raise ValueError(mode)
