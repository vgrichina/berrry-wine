from common import *
ds=json.loads((H/'donors.json').read_text());v=[]
for p in (H/'readonly-object-proxies').iterdir():
 v.append(dict(path=str(p),allocated=sum(x.lstat().st_blocks*512 for x in [p,*p.iterdir()]),entries=len(list(p.iterdir()))))
save('proxy-measure.json',dict(donors=len(ds),largest=sorted(v,key=lambda x:x['allocated'],reverse=True)[:8],total=sum(x['allocated'] for x in v),paths=ds))
print('donors',len(ds),'allocated',sum(x['allocated'] for x in v),'largest',sorted(v,key=lambda x:x['allocated'],reverse=True)[:3])
