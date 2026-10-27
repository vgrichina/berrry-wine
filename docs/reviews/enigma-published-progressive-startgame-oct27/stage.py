gate('stage-'+sys.argv[-1]);group=int(sys.argv[-1]);rs=json.loads((O/'runtime-manifest.json').read_text());batch=rs[group*150:(group+1)*150]
assert batch
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w') as t:
 for r in batch:
  b=pathlib.Path(r.get('source',r.get('path'))).read_bytes();assert sha(b)==r['sha256'];info=tarfile.TarInfo(r['target']);info.size=len(b);t.addfile(info,io.BytesIO(b))
remote=str(O/('pack-'+str(group)+'.tar'));put(remote,buf.getvalue(),'pack-'+str(group))
py('import pathlib,tarfile,json;p=pathlib.Path('+repr(remote)+');h=pathlib.Path('+repr(str(H))+');t=tarfile.open(p);assert all(not x.name.startswith("/") and ".." not in pathlib.Path(x.name).parts for x in t);t.extractall(h,filter="data");t.close();p.unlink();print("extracted")')
print('staged group',group,'files',len(batch))
