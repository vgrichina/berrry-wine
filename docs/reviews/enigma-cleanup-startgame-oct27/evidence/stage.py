gate('stage-group-'+sys.argv[-1])
mp=ROOT/'scratch/usage-watch/enigma-cleanup-verified-runtime-map-oct27.json';assert sha(mp.read_bytes())=='06a72d86b409850d73a8158d4f12d974b517ed0c9532652a1fc5f0ee2cb09f83'
rows=json.loads(mp.read_text())['files'];groups=[];group=[];n=0
for r in rows:
 if group and n+r['bytes']>4*1048576:groups.append(group);group=[];n=0
 group.append(r);n+=r['bytes']
if group:groups.append(group)
i=int(sys.argv[-1])
if i>=len(groups):
 print('All '+str(len(groups))+' groups already staged; no API or guest action');sys.exit(0)
group=groups[i];buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w') as tar:
 for r in group:
  p=pathlib.Path(r.get('source',r.get('path')));data=p.read_bytes();assert len(data)==r['bytes'] and sha(data)==r['sha256'],str(p)
  info=tarfile.TarInfo(r['target']);info.size=len(data);info.mode=0o644;tar.addfile(info,io.BytesIO(data))
 data=json.dumps([{k:r[k] for k in ('target','bytes','sha256')} for r in group]).encode();info=tarfile.TarInfo('ops/stage-'+str(i)+'.rows.json');info.size=len(data);info.mode=0o644;tar.addfile(info,io.BytesIO(data))
name=str(O/('stage-'+str(i)+'.tar'));put_bytes(name,buf.getvalue(),'closure-'+str(i))
code='import pathlib,tarfile,json,hashlib;p=pathlib.Path('+repr(name)+');h=pathlib.Path('+repr(str(H))+');t=tarfile.open(p);t.extractall(h,filter="data");t.close();rows=json.loads((h/"ops/stage-'+str(i)+'.rows.json").read_text());\nfor r in rows:\n b=(h/r["target"]).read_bytes();assert len(b)==r["bytes"] and hashlib.sha256(b).hexdigest()==r["sha256"]\np.unlink();print("verified group '+str(i)+' files '+str(len(group))+'")'
j=py(code);save('verified-group-'+str(i)+'.json',dict(index=i,groups=len(groups),files=len(group),bytes=sum(r['bytes'] for r in group),targets=[r['target'] for r in group],remote=j));print(j['stdout'])
