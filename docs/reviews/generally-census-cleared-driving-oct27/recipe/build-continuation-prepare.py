from common import *
previous=json.loads((H/'retained-compile-supervision.json').read_text());assert previous['exit']==1 and previous['stopReason'] is None
assert 'index.html' in (H/'retained-compile.stderr').read_text()
p=H/'recover-index.stdout';b=p.read_bytes();target=S+'/index.html'
for off in range(0,len(b),24000):
 py('recover-index-'+str(off),'import pathlib,base64;p=pathlib.Path('+repr(target)+');f=p.open('+repr('xb' if off==0 else 'ab')+');f.write(base64.b64decode('+repr(base64.b64encode(b[off:off+24000]).decode())+'));f.close();print("stored")')
py('recover-index-verify','import pathlib,hashlib;p=pathlib.Path('+repr(target)+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(sha(b))+';print("verified")')
t=(H/'remote-v4.py').read_text().replace('def supervise(cmd,label,rss,wall=240,output=2*M):','def supervise(cmd,label,rss,wall=240,output=2*M,cpu=180):').replace('cpu_limit=180,wall_limit=wall','cpu_limit=cpu,wall_limit=wall')
addition='''elif mode=='continue-build':
 assert (H/'compile-attempt.json').exists() and not (H/'continuation-attempt.json').exists()
 previous=json.loads((H/'compile-supervision.json').read_text());assert previous['exit']==1 and previous['stopReason'] is None
 assert not (R/'runner/build/wine-assembly.wasm').exists()
 source=(R/'runner/tools/build.sh').read_text();mark='node tools/check-browser-cache-versions.js --self-test';start=source.index(mark);suffix=source[start:]
 script='set -e\\ncd '+shlex.quote(str(R/'runner'))+'\\n'+suffix;p=H/'canonical-build-remaining.sh';p.write_text(script)
 consumed=sum((H/n).stat().st_size for n in ['compile.stdout','compile.stderr'])
 save('continuation-attempt.json',dict(at=time.time(),canonicalSourceSHA256=hashlib.sha256(source.encode()).hexdigest(),suffixSHA256=hashlib.sha256(suffix.encode()).hexdigest(),firstLine=source[:start].count('\\n')+1,alreadyChargedCPU=previous['cpuSeconds'],alreadyChargedWall=previous['wallSeconds'],alreadyChargedOutput=consumed,compilerInvocationsBefore=0,reason='coordinator closure omitted index.html; restore exact pinned blob then continue remaining canonical script without replaying passed prefix or resetting budget'))
 supervise(['bash',str(p)],'compile-continuation',6*1024**3,wall=240-previous['wallSeconds'],output=4*M-consumed,cpu=180-previous['cpuSeconds'])
'''
t=t.replace("elif mode=='compile':",addition+"elif mode=='compile':")
(H/'remote-v5.py').write_text(t)
save('build-continuation-plan.json',dict(pin=PIN,recoveredPath='index.html',recoveredSHA256=sha(b),recoveredBytes=len(b),priorBuild=previous,oneCanonicalBuildCumulative=True,maxCompilerInvocations=1,remainingCPU=180-previous['cpuSeconds'],remainingWall=240-previous['wallSeconds'],prefixReplayed=False,originalFailurePreserved=True,wrapperSHA256=sha(t.encode())))
print('exact pinned index restored',len(b),'remaining canonical build CPU',180-previous['cpuSeconds'],'wall',240-previous['wallSeconds'])
