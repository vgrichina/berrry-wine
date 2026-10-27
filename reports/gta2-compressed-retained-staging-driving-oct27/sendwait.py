cmd=json.loads(sys.argv[-1]);ident=str(cmd['id']);q=py('import pathlib;p=pathlib.Path('+repr(str(O/'control'/(ident+'.request.json')))+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open("x");f.write('+repr(json.dumps(cmd))+');f.close();print("queued")');save('control-local/'+ident+'.request.json',dict(command=cmd,api=q,at=time.time()))
deadline=time.monotonic()+70
while True:
 q=py('import pathlib,json;p=pathlib.Path('+repr(str(O/'control'/(ident+'.reply.json')))+');print(p.read_text() if p.exists() else "PENDING")');save('control-local/'+ident+'.observe-'+str(time.time_ns())+'.json',q)
 if q['stdout'].strip()!='PENDING':
  r=json.loads(q['stdout']);assert r['reply']['ok'],r;save('control-local/'+ident+'.reply.json',r);print(json.dumps(r));break
 assert time.monotonic()<deadline,'control response not terminal; never replay';time.sleep(.3)
