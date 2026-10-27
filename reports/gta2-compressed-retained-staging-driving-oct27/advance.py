def send(cmd):
 ident=str(cmd['id']);q=py('import pathlib;p=pathlib.Path('+repr(str(O/'control'/(ident+'.request.json')))+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open("x");f.write('+repr(json.dumps(cmd))+');f.close();print("queued")');save('control-local/'+ident+'.request.json',dict(command=cmd,api=q,at=time.time()));deadline=time.monotonic()+25
 while True:
  q=py('import pathlib;p=pathlib.Path('+repr(str(O/'control'/(ident+'.reply.json')))+');print(p.read_text() if p.exists() else "PENDING")');save('control-local/'+ident+'.observe-'+str(time.time_ns())+'.json',q)
  if q['stdout'].strip()!='PENDING':
   r=json.loads(q['stdout']);assert r['reply']['ok'],r;save('control-local/'+ident+'.reply.json',r);return r['reply']['value']
  assert time.monotonic()<deadline,'unresolved command; do not replay';time.sleep(.2)
ident=int(sys.argv[-2]);total=int(sys.argv[-1]);left=total;receipts=[]
while left:
 n=min(256,left);v=send(dict(id=ident,action='step',n=n));assert v['ran']==n and v['steps']==n and v['frozen'];ident+=1;snap=send(dict(id=ident,action='snapshot'));assert snap['frozen']['frozen'] and snap['frozen']['credits']==0;receipts.append(dict(step=v,followingFrozen=snap['frozen']));ident+=1;left-=n
save('advance-'+sys.argv[-2]+'.json',dict(total=total,nextID=ident,receipts=receipts));print('advanced',total,'nextID',ident,'finalBatch',receipts[-1]['step']['batch'])
