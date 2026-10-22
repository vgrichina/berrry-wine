import pathlib,hashlib,json,subprocess,sys,re
from remote import run,E
D='/home/user/aoe3-original-oct22/diagnostics-native-parse-cause-20261022T1125Z'
OLD='/home/user/aoe3-original-oct22/diagnostics-targeted-localization-20261022T1058Z'
# Accepted instance-bound generator result; remote copy checked against local exact bytes.
h=E/'harness';shas={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in h.iterdir()}
# Local original-byte address validation for each selected native region boundary.
b=(E/'msxml4.dll').read_bytes();assert hashlib.sha256(b).hexdigest()=='83206377ad3c28a1cc9f11ec0bfd6ef0abd196ee999f556074ff885f29ed99f1'
assert b.find(bytes.fromhex('68 7f 00 6d c0 ff 15 c0 11 b1 69'))>=0
# already created
# run('import pathlib,shutil,hashlib,json; d=pathlib.Path(%r); assert not d.exists(); d.mkdir(); old=pathlib.Path(%r); (d/"diagnostic-run.js").write_text((old/"diagnostic-run.js").read_text().replace(%r,%r)); [(shutil.copy2(old/f,d/f)) for f in ["instance-hook.js","package.json"]]; print("created diagnostic copy")'%(D,OLD,OLD,D),'create-diagnostic-copy')
import base64
obs=(h/'observer.js').read_bytes();run('import pathlib,base64; pathlib.Path(%r).write_bytes(base64.b64decode(%r))'%(D+'/observer.js',base64.b64encode(obs).decode()),'transfer-focused-observer')
r=run('''import pathlib,hashlib,json,subprocess,os
D=pathlib.Path(%r); expected=%r
for f,sha in expected.items():assert hashlib.sha256((D/f).read_bytes()).hexdigest()==sha,f
for f in ['diagnostic-run.js','observer.js','instance-hook.js']:subprocess.run(['node','--check',str(D/f)],check=True)
# Same --exe route and unchanged runner dependency imports as accepted capture.
previous=json.loads(pathlib.Path(%r).read_text());assert previous['pass']
(D/'dependency-selected-route.json').write_text(json.dumps(previous))
env=dict(os.environ,NODE_PATH='/home/user/aoe3-original-oct22/runner/node_modules')
js=r"""const fs=require('fs'),M=require('module'),f=process.argv[1],q=M.createRequire(f),t=fs.readFileSync(f,'utf8'); let a=[]; for(const x of t.matchAll(/require\\(['\"]([^'\"]+)['\"]\\)/g)){try{a.push([x[1],q.resolve(x[1])]);}catch(e){if(x[1]!=='skia-canvas')throw e;}} console.log(JSON.stringify(a));"""
p=subprocess.run(['node','-e',js,str(D/'diagnostic-run.js')],env=env,text=True,capture_output=True);assert p.returncode==0,p.stderr
(D/'dependency-check.json').write_text(p.stdout);print(json.dumps(dict(hashes=expected,requireResolution=json.loads(p.stdout),optionalSkiaUnreachableOnUnchangedExeRoute=True)))
'''%(D,shas,OLD+'/dependency-selected-route.json'),'focused-dependency-gate',45)
print('dependency pass',r['commandId'])
r=run((E/'staging-gate.py').read_text(),'staging-gate',60);result=json.loads(r['stdout']);assert result['passAll'];(E/'staging-gate-result.json').write_text(json.dumps(result,indent=2));print('373 pins pass',r['commandId'])
s=(E/'driver.py').read_text().replace('2026-10-22T11:30:00+00:00','2026-10-22T11:45:00+00:00')
s=re.sub(r" '--trace-api=[^']*'", " '--trace-api=GetProcAddress,GetModuleHandleA,GetModuleHandleW,LoadLibraryA,LoadLibraryW,LoadLibraryExA,LoadLibraryExW,RaiseException,RtlUnwind,GetLastError,CoCreateInstance,ReadFile'",s)
s=s.replace('--trace-eip-range=0x400000-0x0b00000','--trace-eip-range=0x400000-0x01894000')
s=s.replace(" '--trace-api-mem=CoCreateInstance:0:16,CoCreateInstance:3:16,SendMessageW:3:64',",'')
(E/'driver.py').write_text(s)
run('import pathlib; pathlib.Path(%r).write_text(%r)'%(D+'/driver.py',s),'transfer-driver')
print('READY')
