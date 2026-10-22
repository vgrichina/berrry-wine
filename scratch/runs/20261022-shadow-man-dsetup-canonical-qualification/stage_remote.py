#!/usr/bin/env python3
import hashlib, json, os, subprocess, time
from pathlib import Path
C='7a21579f9adb208164312961c249a0aa9080a8b7'
B='89f1e9d2c67aa94d56d2319115589d07204d42e0'
R=Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22')
E=R/'evidence'
CAP=1073741824
RESERVE=67108864
PREFIXES=('src/','lib/','tools/','test/','fonts/')
EXTRA={'CLAUDE.md','AGENTS.md','.gitignore','index.html','package.json','package-lock.json','docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js'}
def allocated():
    return int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]) if R.exists() else 0
def budget(growth=0):
    free=os.statvfs('/home/user').f_bavail*os.statvfs('/home/user').f_frsize
    used=allocated()
    assert free-growth>2147483648 and used+growth+RESERVE<CAP,(free,used,growth)
    return dict(free=free,allocated=used,growth=growth,reserve=RESERVE,cap=CAP,floor=2147483648)
assert not R.exists()
admit=budget(402653184)
R.mkdir(); E.mkdir()
os.environ['GIT_NO_LAZY_FETCH']='1'
def run(args, name, data=None):
    with (E/(name+'.log')).open('wb') as log:
        p=subprocess.run(args,cwd=R,input=data,stdout=log,stderr=subprocess.STDOUT,timeout=240)
    assert p.returncode==0,(name,p.returncode,(E/(name+'.log')).read_text()[-3000:])
def git(*args):return subprocess.check_output(['git','-C',str(R),*args])
run(['git','init'], 'git-init')
run(['git','remote','add','origin','https://github.com/vgrichina/wine-assembly.git'],'git-origin')
run(['git','config','remote.origin.promisor','true'],'git-promisor')
run(['git','config','remote.origin.partialclonefilter','blob:none'],'git-filter')
refs=git('ls-remote','origin','refs/heads/main','refs/heads/task/shadow-man-dsetup-native-version-repair-oct22')
assert (B+'\trefs/heads/main').encode() in refs and (C+'\trefs/heads/task/shadow-man-dsetup-native-version-repair-oct22').encode() in refs
(E/'actual-refs.txt').write_bytes(refs)
# Two real generations cover HEAD, actual parent/main, and main's parents.
# Truthful shallow boundary is retained, never synthesized/unshallowed broadly.
run(['git','fetch','--depth=2','--filter=blob:none','--no-tags','origin',C,B],'fetch-exact-history')
assert git('rev-parse',C+'^').decode().strip()==B
tree=[]
for record in git('ls-tree','-rz',C).split(b'\0'):
    if not record: continue
    meta,p=record.split(b'\t'); mode,kind,oid=meta.decode().split(); p=p.decode()
    if p.startswith(PREFIXES) or p in EXTRA or ('/' not in p and p.endswith('.js')):
        assert kind=='blob' and mode in ('100644','100755'),(p,kind,mode)
        tree.append(dict(path=p,mode=mode,blob=oid))
assert EXTRA.issubset({r['path'] for r in tree})
assert {'fonts/Terminal.fon','tools/toyvm/emit-decoder.js'}.issubset({r['path'] for r in tree})
history=[]
for rev,p in [(C,'src/api_table.json'),(B,'src/api_table.json'),(C+'^','tools/check-silent-stubs.js')]:
    history.append(dict(revision=git('rev-parse',rev).decode().strip(),path=p,blob=git('rev-parse',rev+':'+p).decode().strip()))
oids=sorted({r['blob'] for r in tree+history})
budget(268435456)
# Explicit bounded blob request: only selected closure and required history blobs.
run(['git','-c','fetch.negotiationAlgorithm=noop','fetch','--no-tags','--no-write-fetch-head','--recurse-submodules=no','--filter=blob:none','origin','--stdin'],'fetch-selected-blobs',('\n'.join(oids)+'\n').encode())
batch=subprocess.Popen(['git','cat-file','--batch'],cwd=R,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
pins={}
for oid in oids:
    batch.stdin.write((oid+'\n').encode());batch.stdin.flush()
    header=batch.stdout.readline().decode().split(); assert len(header)==3 and header[1]=='blob',header
    raw=batch.stdout.read(int(header[2]));assert batch.stdout.read(1)==b'\n'
    assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==oid
    pins[oid]=dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
batch.stdin.close();assert batch.wait()==0
for r in tree+history:r.update(pins[r['blob']])
size=sum(r['bytes'] for r in tree)
projection=budget(size+len(tree)*4096+201326592)
(E/'pre-expansion-admission.json').write_text(json.dumps(dict(initial=admit,projected=projection,sourceBytes=size,files=len(tree)),indent=2)+'\n')
(E/'build-inputs.json').write_text(json.dumps(dict(revision=C,main=B,inputs=tree,count=len(tree),bytes=size),indent=2)+'\n')
(E/'history-inputs.json').write_text(json.dumps(history,indent=2)+'\n')
run(['git','sparse-checkout','init','--no-cone'],'sparse-init')
def literal(p):return '/'+''.join('\\'+c if c in '\\*?[]' else c for c in p)
run(['git','sparse-checkout','set','--no-cone','--stdin'],'sparse-patterns',('\n'.join(literal(r['path']) for r in tree)+'\n').encode())
run(['git','checkout','--detach',C],'checkout-exact')
assert git('rev-parse','HEAD').decode().strip()==C
for r in tree:
    p=R/r['path'];assert p.is_file() and p.stat().st_size==r['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'],r['path']
    assert p.stat().st_mode&0o777==int(r['mode'],8)&0o777
actual={p.relative_to(R).as_posix() for prefix in PREFIXES for p in (R/prefix).rglob('*') if p.is_file()}
actual.update(p.name for p in R.glob('*.js'))
assert not actual-{r['path'] for r in tree}
for r in history:assert hashlib.sha256(git('show',r['revision']+':'+r['path'])).hexdigest()==r['sha256']
run(['git','diff','--exit-code','HEAD','--','src','lib','tools','test','fonts','host.js','index.html','CLAUDE.md'],'working-tree-clean')
run(['git','diff','--cached','--exit-code','HEAD'],'index-clean')
ident=dict(head=git('rev-parse','HEAD').decode().strip(),parent=git('rev-parse','HEAD^').decode().strip(),shallow=git('rev-parse','--is-shallow-repository').decode().strip(),shallowBoundaries=(R/'.git/shallow').read_text(),history=git('log','--format=raw','-3').decode(),node=subprocess.check_output(['node','--version']).decode().strip(),git=subprocess.check_output(['git','--version']).decode().strip(),bash=subprocess.check_output(['bash','--version']).decode().splitlines()[0],nodePath=subprocess.check_output(['which','node']).decode().strip())
ident['nodeSHA256']=hashlib.sha256(Path(ident['nodePath']).resolve().read_bytes()).hexdigest()
ident['resources']=budget()
(E/'staging-identity.json').write_text(json.dumps(ident,indent=2)+'\n')
print(json.dumps(dict(staged='PASS',files=len(tree),bytes=size,identity=ident),indent=2))
