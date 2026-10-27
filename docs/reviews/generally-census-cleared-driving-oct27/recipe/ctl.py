from common import *
import sys
def request(command):
 state=H/'control-cursor.json';q=json.loads(state.read_text()) if state.exists() else {'next':1,'pending':False}
 assert not q['pending'],'uncertain pending command: no replay'
 i=q['next'];cmd=dict(command,id=i);save('control-cursor.json',dict(next=i+1,pending=True,request=cmd))
 code='''import pathlib,json,time
h=pathlib.Path(HERE);h.joinpath('requests').mkdir(exist_ok=True);p=h/'requests'/NAME;t=p.with_suffix('.tmp');t.write_text(PAYLOAD);t.replace(p)
end=time.monotonic()+38
while not (h/'replies'/NAME).exists():
 if time.monotonic()>end:raise RuntimeError('uncertain ACK timeout; no replay')
 time.sleep(.02)
v=json.loads((h/'replies'/NAME).read_text());print(json.dumps(v))
'''.replace('HERE',repr(O)).replace('NAME',repr(f'{i:04}.json')).replace('PAYLOAD',repr(json.dumps(cmd)))
 r=json.loads(py('control-'+str(i),code,timeout=42)['stdout']);assert r['reply']['ok'];save('control-'+str(i)+'.json',r)
 save('control-cursor.json',dict(next=i+1,pending=False,last=cmd,reply=r['reply']))
 return r['reply']['value']
def frozen():
 x=request(dict(action='snapshot'));assert x['frozen']['frozen'] and x['frozen']['credits']==0,x;return x
mode=sys.argv[1]
if mode=='request':
 command=json.loads(sys.argv[2]);r=request(command)
 if command.get('action')=='step':
  assert r['ran']==command['n'] and r['frozen'],r;f=frozen();assert f['batch']==r['batch']
 print(json.dumps(r))
elif mode=='frame':
 name=sys.argv[2];snap=frozen();r=request(dict(action='png',path=O+'/'+name+'.png'));assert r['batch']==snap['batch'] and r['frozen'] and r['bytes']<=4*M
 meta=json.loads(py('frame-meta-'+name,'import pathlib,json,hashlib;p=pathlib.Path('+repr(O+'/'+name+'.png')+');b=p.read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),path=str(p))))')['stdout'])
 size=meta['bytes'];used=sum(p.stat().st_size for p in H.glob('*.api.stdout'));envelope=((size+4095)//4096)*8192
 assert used+envelope+M<=8*M,(used,envelope)
 save(name+'-transfer-admission.json',dict(at=time.time(),used=used,fullEnvelope=envelope,terminalReserve=M,remoteFrame=meta,frozenSnapshot=snap))
 parts=[];start=time.monotonic()
 for off in range(0,size,4096):
  x=py('frame-'+name+'-'+str(off),'import pathlib,base64;b=pathlib.Path('+repr(meta['path'])+').read_bytes();print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())');assert len(json.dumps(x).encode())<=8192;parts.append(base64.b64decode(x['stdout'].strip(),validate=True))
 b=b''.join(parts);assert len(b)==size and sha(b)==meta['sha256'];(H/(name+'.png')).write_bytes(b);save(name+'.json',dict(meta,elapsed=time.monotonic()-start,batch=snap['batch'],visuallyReviewed=False));print(json.dumps(dict(meta,batch=snap['batch'],elapsed=time.monotonic()-start)))
