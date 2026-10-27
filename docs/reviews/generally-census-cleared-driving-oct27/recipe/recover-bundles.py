from common import *
import io,tarfile
rows=[];buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for name in ['docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js']:
  p=R/name;b=p.read_bytes();rows.append(dict(source=str(p),target='runner/'+name,bytes=len(b),sha256=sha(b),revision=PIN));i=tarfile.TarInfo('runner/'+name);i.size=len(b);t.addfile(i,io.BytesIO(b))
b=buf.getvalue();target=REMOTE+'/recovered-bundles.tgz'
for off in range(0,len(b),24000):
 py('recover-bundles-'+str(off),'import pathlib,base64;p=pathlib.Path('+repr(target)+');f=p.open('+repr('xb' if off==0 else 'ab')+');f.write(base64.b64decode('+repr(base64.b64encode(b[off:off+24000]).decode())+'));f.close();print("stored")')
py('recover-bundles-extract','import pathlib,hashlib,tarfile;p=pathlib.Path('+repr(target)+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(sha(b))+';t=tarfile.open(p);t.extractall('+repr(REMOTE)+',filter="data");t.close();p.unlink();print("extracted")')
save('recovered-bundles.json',rows)
t=(H/'remote-v5.py').read_text().replace("elif mode=='continue-build':","elif mode=='continue-build-two':").replace("H/'continuation-attempt.json'","H/'continuation-two-attempt.json'").replace("'continuation-attempt.json'","'continuation-two-attempt.json'")
t=t.replace("previous=json.loads((H/'compile-supervision.json').read_text());assert", "previous=json.loads((H/'compile-supervision.json').read_text());second=json.loads((H/'compile-continuation-supervision.json').read_text());assert second['exit']==1 and second['stopReason'] is None;previous['cpuSeconds']+=second['cpuSeconds'];previous['wallSeconds']+=second['wallSeconds'];assert")
t=t.replace("mark='node tools/check-browser-cache-versions.js --self-test'","mark='node tools/toyvm/bundle-browser.js --check'").replace("['compile.stdout','compile.stderr']","['compile.stdout','compile.stderr','compile-continuation.stdout','compile-continuation.stderr']").replace("'compile-continuation',6*1024**3","'compile-continuation-two',6*1024**3").replace("coordinator closure omitted index.html; restore exact pinned blob then continue remaining canonical script", "coordinator closure also omitted committed toyvm bundles; restore exact pinned blobs then continue remaining canonical script")
(H/'remote-v6.py').write_text(t)
save('second-continuation-plan.json',dict(source=PIN,canonicalOriginal=sha((R/'tools/build.sh').read_bytes()),recovered=rows,wrapper=sha(t.encode()),originalFailuresPreserved=True,compilerInvocationsBefore=0,cumulativeBudgetUnchanged=True))
print('recovered pinned bundles',sum(x['bytes'] for x in rows),'compressed',len(b),'continue remaining canonical suffix only')
