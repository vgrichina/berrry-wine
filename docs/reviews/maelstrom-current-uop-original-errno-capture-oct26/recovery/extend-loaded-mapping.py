from common import *
# Diagnostic-only snapshot extension, before the sole invocation. Observe the
# actual loaded _getptd call destination and its bytes alongside _errno.
p=H/'runner/test/run.js';s=p.read_text();a='const spans=[{va:0x52e430,n:9},{va:0x40e125,n:11},{va:0x7a4010,n:4},';assert s.count(a)==1
s=s.replace(a,'const crtGetptdTarget=0x52e430+5+new DataView(memory.buffer).getInt32(0x52e431-0x400000+0x12000,true);\n    const spans=[{va:0x52e430,n:9},{va:crtGetptdTarget,n:64},{va:0x40e125,n:11},{va:0x7a4010,n:4},')
a="const row={schema:'original-native-raw/v1',stage,error:error?String(error):null,moduleBases:";assert s.count(a)==1;s=s.replace(a,"const row={schema:'original-native-raw/v1',stage,crtGetptdTarget,error:error?String(error):null,moduleBases:")
p.write_text(s);rows=json.load(open(H/'manifest.json'));row=next(r for r in rows if r['target']=='runner/test/run.js');before=row['sha256'];row['bytes']=p.stat().st_size;row['sha256']=sha(p.read_bytes());save('../manifest.json',rows)
save('loaded-mapping-extension.json',dict(diagnosticOnly=True,noGuestExecution=True,noModuleChange=True,beforeRunnerSHA256=before,runnerSHA256=row['sha256'],getptdTargetDerivedFromActualLoadedCall=True,bytesObserved=64,transfers=[put(p,p),put(H/'manifest.json',H/'manifest.json')]))
j=remote('cd '+shlex.quote(str(H))+' && node --max-old-space-size=512 validate-tree.cjs');save('mount-actual-extended-api.json',j)
print(json.dumps(dict(ready=True,runnerSHA256=row['sha256'])))
