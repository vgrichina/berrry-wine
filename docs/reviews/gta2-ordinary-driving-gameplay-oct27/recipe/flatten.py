from run import *
old=(R/'.git/objects/info/alternates').read_text().splitlines(); views=H/'readonly-donor-views';views.mkdir()
new=[]
for i,s in enumerate(old):
 p=pathlib.Path(s);v=views/str(i);v.mkdir()
 for x in p.iterdir():
  if x.name in ('pack',) or (len(x.name)==2 and all(c in '0123456789abcdef' for c in x.name)):(v/x.name).symlink_to(x,target_is_directory=True)
 new.append(str(v))
(R/'.git/objects/info/alternates').write_text('\n'.join(new)+'\n')
dump('donor-views.json',dict(original=old,views=new,readOnly=True,reason='avoid recursive donor alternates warnings without donor mutations or repack'))
print('flat read-only alternate views',len(new))
