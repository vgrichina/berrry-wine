from run import *
assert gate() is None
q=json.loads((H/'donor-views.json').read_text());a=H/'donor-roots';a.mkdir()
for i,s in enumerate(q['original']):
 (a/str(i)).symlink_to(s,target_is_directory=True)
 for x in (H/'readonly-donor-views'/str(i)).iterdir():
  assert x.is_symlink();x.unlink();x.symlink_to('../../donor-roots/'+str(i)+'/'+x.name,target_is_directory=True)
dump('short-alternates.json',dict(reason='inline relative symlinks reduce allocation while preserving exact same read-only donor targets',originals=q['original'],ops=size(H),repo=size(R)))
print('ops',size(H))
