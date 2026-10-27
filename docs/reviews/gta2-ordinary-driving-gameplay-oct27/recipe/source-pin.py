from run import *
import re
entry=R/'src/main.watx';includes=re.findall(rb'^\s*\(include\s+"([^"]+)"\)\s*$',entry.read_bytes(),re.M)
assert includes and len(set(includes))==len(includes)
closure=[]
for name in [b'main.watx',*includes]:
 p=R/'src'/name.decode();closure.append(dict(path='src/'+name.decode(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
compiler=[]
for name in ['tools/build.sh','tools/build-compile-wat.js','tools/watx-closure.js','tools/watx.js','test/run.js','src/api_table.json','lib/host-import-sigs.generated.json','lib/guest-worker.js','lib/worker-imports.js']:
 p=R/name;compiler.append(dict(path=name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
p=R/'tools/build-compile-wat.js';excerpt=b''.join(p.read_bytes().splitlines(keepends=True)[144:178])
dump('source-compiler-pin.json',dict(revision='4a2bec145ef34b0d084b96b09a682a16e89703fd',entry='src/main.watx',includeClosure=closure,pins=compiler,excerpt=dict(file='tools/build-compile-wat.js',recipe='read_bytes().splitlines(keepends=True)[144:178]',lines='145 through178 inclusive',bytes=len(excerpt),sha256=hashlib.sha256(excerpt).hexdigest()),noManualABI=True,noSilentStubChanges=True))
print('pinned include closure',len(closure),'compiler/full-file pins',len(compiler))
