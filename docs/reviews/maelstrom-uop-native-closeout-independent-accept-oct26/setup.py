from common import *
if not (O/'db-baseline.json').exists():save('db-baseline.json',{str(p):p.stat().st_size for p in C.glob('*.sqlite')})
save('launch.json',dict(session='01a17747-e0f9-7532-9d40-e3c6ac520893',pid=2321379,argv=pathlib.Path('/proc/2321379/cmdline').read_bytes().decode().split('\0'),runtimeFlagsVerified=True))
admit('admission-precheckout.json',True)
s=(ROOT/'test/run.js').read_text();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
assert sha(parser.encode())=='aa2d16119b2edc62abc08862fc7c3ea28a98bdc7fb4d28161937a1f705e4621e'
old=json.loads((E/'configuration.json').read_text())
assert old['actualMountArgv']==[] and old['intendedFiles']==[] and old['parserSHA256']==sha(parser.encode()) and old['trustedSSH']==SSH
parsed=old['priorCommaControl']['actualParsed']
save('parser-resource-failure.json',dict(command='node --max-old-space-size=16 exact canonical parser, RLIMIT_DATA=536870912',exit=-5,diagnostic='Fatal process out of memory: Failed to reserve virtual memory for CodeRange',unchangedRetry=False,resolution='Reuse unchanged exact configuration receipt expressly permitted by task; parser bytes and empty actual argv independently verified; no conditional runtime or mounts',receipt=str(E/'configuration.json'),receiptSHA256=sha((E/'configuration.json').read_bytes())))
assert parsed==dict(tree=[],mount=[])
save('configuration.json',dict(trustedSSH=SSH,actualMountArgv=[],intendedFiles=[],parsed=parsed,parserSHA256=sha(parser.encode()),noRuntime=True,reusedExactReceipt=str(E/'configuration.json')))
assert git('rev-parse','HEAD',cwd=D)==SHA
R.mkdir();git('init','-q',str(R),cwd=H)
obj=D/'.git/objects';leaves=[obj]+[pathlib.Path(x) for x in (obj/'info/alternates').read_text().splitlines()];views=[]
for i,p in enumerate(leaves):
 v=O/'v'/str(i);v.mkdir(parents=True);views.append(str(v))
 for q in p.iterdir():
  if q.name=='pack' or (len(q.name)==2 and all(c in '0123456789abcdef' for c in q.name)):(v/q.name).symlink_to(q.resolve(),target_is_directory=True)
(R/'.git/objects/info/alternates').write_text('\n'.join(views)+'\n')
selected=['/tools/maelstrom-native-errno-latch.cjs','/tools/maelstrom-select-completion-hook.cjs','/test/maelstrom-diagnostic-canonical-native.cjs','/docs/reviews/maelstrom-uop-native-closeout-independent-accept-oct26/']
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false');(R/'.git/info/sparse-checkout').write_text('\n'.join(selected)+'\n')
git('update-ref','refs/heads/task/'+H.name,SHA);git('symbolic-ref','HEAD','refs/heads/task/'+H.name);git('read-tree','-mu','HEAD')
for k in ['user.name','user.email']:git('config',k,git('config',k,cwd=D))
git('remote','add','origin',git('remote','get-url','origin',cwd=D))
save('checkout.json',dict(candidate=SHA,paths=selected,readonlyObjectViews=len(views),noFetch=True))
save('checkpoint.json',dict(candidate=SHA,completed=['configuration, admission, sparse checkout'],remaining=['oracle review','reuse dependencies','report/publication']))
print('setup PASS')
