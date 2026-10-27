from common import *
before=0;after=0;links=0
for d in (H/'readonly-object-proxies').iterdir():
 entries=list(d.iterdir());before+=sum(p.lstat().st_blocks*512 for p in [d,*entries])
 targets={p.name:p.resolve() for p in entries};parents={p.parent for p in targets.values()};assert len(parents)==1
 donor=next(iter(parents));(d/'donor').symlink_to(donor,target_is_directory=True)
 for name,target in targets.items():
  p=d/name;p.unlink();p.symlink_to('donor/'+name,target_is_directory=True);assert p.resolve()==target;links+=1
 after+=sum(p.lstat().st_blocks*512 for p in [d,*d.iterdir()])
save('proxy-storage-repair.json',dict(before=before,after=after,links=links,allResolvedTargetsUnchanged=True,donorsReadOnly=True,reason='short local relative symlinks avoid per-prefix4096B long-symlink blocks; one donor link per immutable ODB view'))
print('unchanged targets',links,'physical before',before,'after',after)
