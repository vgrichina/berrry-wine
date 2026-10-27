from common import *
old=pathlib.Path('/tmp/generally-ordinary-driving-gameplay-oct27/ops/remote-startup.cjs').read_text()
t=old.replace('/tmp/generally-driving',REMOTE)
mine=(H/'remote-startup.cjs').read_text()
a=mine.index("if(process.argv.includes('--module'))");b=mine.index('\nfor(const f of',a)
c=t.index("if(process.argv.includes('--module'))");d=t.index('\nfor(const f of',c)
t=t[:c]+mine[a:b]+t[d:]
(H/'remote-startup-v4.cjs').write_text(t)
p=H/'remote.py';t=p.read_text().replace("str(H/'remote-startup.cjs')","str(H/'remote-startup-v4.cjs')").replace("'startup-prebuild-v3'","'startup-prebuild-v4'")
(H/'remote-v4.py').write_text(t)
save('startup-helper-repair.json',dict(original=sha((H/'remote-startup.cjs').read_bytes()),corrected=sha((H/'remote-startup-v4.cjs').read_bytes()),remoteWrapper=sha((H/'remote-v4.py').read_bytes()),reason='production importsByDll reports ordinal count; diagnostic preserves exact parser except extracting ordinal numbers; actual production host.resolve_ordinal validates mappings',sourceChanged=False,moduleCompiled=False))
print('bounded helper repair only; existing source/game manifest unchanged')
