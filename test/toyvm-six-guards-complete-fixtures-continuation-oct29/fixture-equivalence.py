"""Authorized fixture adaptation: full-state equivalence and parent controls."""
import runpy,pathlib,json,copy,errno,stat,hashlib
H=pathlib.Path(__file__).resolve().parent
old=pathlib.Path('/tmp/toyvm-six-accepted-guards-candidate-oct29/repo/test/toyvm-six-accepted-guards-candidate-oct29/unlink-independent.py')
adapted=runpy.run_path(str(H/'unlink-independent.py'))
original={'__file__':str(H/'unlink-independent.py'),'__name__':'original_fixture'}
exec(compile(old.read_text(),str(old),'exec'),original)
source=(H.parent/'toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
Backend=adapted['load'](source)
guard="        if not stat.S_ISDIR(n['mode']):raise OSError(errno.ENOTDIR,'parent non-directory')\n"
assert source.count(guard)==1
unguarded=adapted['load'](source.replace(guard,''))
rows=[]
for context in ('root','cross-parent','nested'):
 for size in (0,1,4096,4097):
  for opens in (0,1,2):
   args=(context,'file',size,opens,True)
   a,*ai=adapted['fixture'](Backend,*args)
   b,*bi=original['fixture'](unguarded,*args)
   assert ai==bi and vars(a)==vars(b), (context,size,opens)
   assert a.live==sum(adapted['charge'](n) for n in a.nodes.values())
   try:original['fixture'](Backend,*args)
   except OSError as e:assert e.errno==errno.ENOTDIR
   else:raise AssertionError('original invalid setup unexpectedly accepted')
   rows.append(dict(context=context,size=size,opens=opens,stateSHA256=adapted['state_hash'](adapted['state'](a))))
# Legitimate direct create remains valid; denied create has no state effect.
b=Backend(H/'never-mounted');f=b.create(1,b'f',stat.S_IFREG|0o600)
before=copy.deepcopy(vars(b))
try:b.create(f,b'child',stat.S_IFREG|0o600)
except OSError as e:assert e.errno==errno.ENOTDIR
else:raise AssertionError('parent guard absent')
assert vars(b)==before
d=b.create(1,b'd',stat.S_IFDIR|0o700);child=b.create(d,b'child',stat.S_IFREG|0o600)
assert b.nodes[d]['names'][b'child']==child
report=dict(PASS=True,equivalentConstructions=len(rows),rows=rows,compared='all vars including nodes/modes/names/links/opens/data/next/live/peak/written/handles/operations',originalFixtureENOTDIR=36,removedNondirectoryParentGuardControl='original construction succeeds with identical complete state',legitimateDirectoryCreation=True,deniedCreateStateUnchanged=True,sourceSha256=hashlib.sha256(source.encode()).hexdigest(),scope='in-memory direct backend only; no mount')
(H/'fixture-equivalence.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS 36 full-state equivalent constructions; 36 original ENOTDIR controls; removed-parentguard and legitimate-directory controls')
