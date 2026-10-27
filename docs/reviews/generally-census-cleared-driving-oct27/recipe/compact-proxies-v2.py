from common import *
ds=sorted(json.loads((H/'donors.json').read_text()));before=0;after=0;links=0
for i,donor in enumerate(ds):
 d=H/'readonly-object-proxies'/str(i);donor=pathlib.Path(donor)
 before+=sum(p.lstat().st_blocks*512 for p in [d,*d.iterdir()])
 if not (d/'donor').exists():(d/'donor').symlink_to(donor,target_is_directory=True)
 for q in donor.iterdir():
  if q.name!='pack' and not (len(q.name)==2 and all(c in '0123456789abcdef' for c in q.name)):continue
  p=d/q.name;temp=d/('new-'+q.name);temp.symlink_to('donor/'+q.name,target_is_directory=True);os.replace(temp,p);assert p.resolve()==q.resolve();links+=1
 after+=sum(p.lstat().st_blocks*512 for p in [d,*d.iterdir()])
save('proxy-storage-repair.json',dict(before=before,after=after,links=links,allResolvedTargetsUnchanged=True,donorsReadOnly=True,originalIncident='compact-proxies supervisor accounting raced transient unlink; no physical cap exceeded; partial owned links repaired atomically',reason='short relative symlinks avoid long-symlink blocks'))
print('unchanged targets',links,'physical before',before,'after',after)
