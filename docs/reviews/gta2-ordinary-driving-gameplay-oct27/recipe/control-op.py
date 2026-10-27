from common import *
mode=sys.argv[1]
if mode in ('step','snapshot','capture','input'):
 args=['python3',REMOTE+'/remote-control.py',mode,*sys.argv[2:]]
 j,raw=remote(shlex.join(args),timeout=30);q=json.loads(j['stdout']);save('control-'+mode+'-'+str(time.time_ns())+'.json',q);print(json.dumps(q))
elif mode=='review':
 q=json.loads((H/('capture-'+sys.argv[2]+'.json')).read_text());q.update(inspected=True,inspection=sys.argv[3],reviewedAt=time.time())
 save('review-'+sys.argv[2]+'.json',q);send(json.dumps(q).encode(),'reviewed-frame.json');print('review stored',q['sha256'])
elif mode=='fetch':
 name=sys.argv[2];j,raw=py('import pathlib;print((pathlib.Path('+repr(REMOTE+'/control/'+name+'-capture.json')+')).read_text())');q=json.loads(j['stdout']);save('capture-'+name+'.json',q)
 captures=H/'captures';captures.mkdir(exist_ok=True);p=captures/(name+'.png');assert not p.exists()
 projected=used()+((q['bytes']+5999)//6000)*8192+M
 assert projected<=8*M,('exact capture transfer cannot fit APIreserve',projected)
 with p.open('xb') as f:
  for off in range(0,q['bytes'],6000):
   j,raw=py('import pathlib,base64;p=pathlib.Path('+repr(q['path'])+');f=p.open("rb");f.seek('+str(off)+');print(base64.b85encode(f.read(6000)).decode())');b=base64.b85decode(j['stdout'].strip().encode());f.write(b)
 assert p.stat().st_size==q['bytes'] and sha(p.read_bytes())==q['sha256']
 q.update(localPath=str(p),actualAPIUsed=used(),inspected=False);save('capture-'+name+'.json',q);print(json.dumps(q))
else:raise ValueError(mode)
