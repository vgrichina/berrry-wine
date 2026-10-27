for i in range(180):
 v=json.loads(py('import pathlib,json,zlib,hashlib;h=pathlib.Path('+repr(str(O))+');p=h/"launch/controller/after-action.png";q=h/"cli-exit.json";print(json.dumps(dict(frame=dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),wire=len(zlib.compress(p.read_bytes(),9))) if p.exists() else None,terminal=json.loads(q.read_text()) if q.exists() else None)))')['stdout'])
 if v['frame']:
  f=v['frame'];save('after-metadata.json',f);remaining=1048576-sum(p.stat().st_size for p in (O/'responses').glob('*'));assert f['wire']*1.334+((f['wire']+4095)//4096)*500+30000<=remaining,('transfer budget',f,remaining)
  fetch(f['path'],'after-action.png',f['wire'],f['sha256'],True);break
 if v['terminal']:print(json.dumps(v));break
 time.sleep(.25)
else:raise RuntimeError('bounded after poll exhausted')
