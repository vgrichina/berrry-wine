from common import *
import shlex
for n in ['compile-result.json','module-identity.json','native-result.json','test-result.json','node-startup.json','remote-admission.json','test.log']:
 b=api('cat '+shlex.quote(REM+'/'+n)).encode();(O/n).write_bytes(b)
 print(n,b.decode()[:1200] if n!='module-identity.json' else 'sealed canonical inventory retained')
pid=str(json.load(open(O/'execution-launch.json'))['pid'])
save('execution-status-final.json',json.loads(run(['boat','exec','--json','--status',pid,BOX])))
cmd='import pathlib,hashlib,json,os,shutil;h=pathlib.Path('+repr(REM)+');b=(h/"module.wasm").read_bytes();print(json.dumps(dict(moduleSHA256=hashlib.sha256(b).hexdigest(),moduleBytes=len(b),allocated=sum(p.stat().st_blocks*512 for p in h.rglob("*") if p.is_file()),apiProcessLogs=sum(pathlib.Path(p).stat().st_blocks*512 for p in ["/home/user/.ascii/processes/23231.log","/home/user/.ascii/processes/23231.err.log","/home/user/.ascii/processes/'+pid+'.log","/home/user/.ascii/processes/'+pid+'.err.log"]),memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,diskFree=shutil.disk_usage(h).free,box="bx_7tjybtxp",apiAlive=True)))'
save('remote-final-state.json',json.loads(api('python3 -c '+shlex.quote(cmd))))
j=json.load(open(O/'test-result.json'));c=json.load(open(O/'compile-result.json'));f=json.load(open(O/'remote-final-state.json'));n=json.load(open(O/'native-result.json'))
assert j['pass_'] and c['success'] and c['sha256']==f['moduleSHA256']==n['sha256'] and n['instantiated']
manifest=json.load(open(O/'source-manifest.json'));rows={r['path']:r for r in manifest['files']}
identity=json.load(open(O/'module-identity.json'))
for r in identity['inputs']:
 assert r['sha256']==rows[r['file']]['sha256'] and r['bytes']==rows[r['file']]['bytes']
assert identity['options']==dict(tailCalls=True)
save('checkpoint.json',dict(candidate=REV,testSHA256='c06d10e8d419302a82eab03bd68e0c788df84323a0c1ed484b28bfd19246aebe',sourceManifestSHA256=sha((O/'source-manifest.json').read_bytes()),compile=c,test=j,native=n,module=f,remaining=['actual WebGL/GPU/backend','native palette policy','gameplay/27-app compatibility'],oracleChanged=False,productionChanged=False))
gate('acceptance',remote=f['allocated']+f['apiProcessLogs'])
print('ACCEPTANCE CHECKPOINT PASS')
