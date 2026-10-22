from pathlib import Path
import json,hashlib,subprocess,shutil,socket,datetime
S=Path('/home/user/aoe3-canonical-c7fae5ac-staged');R=Path('/home/user/aoe3-original-oct22');P=Path('/home/user/aoe3-canonical-c7fae5ac-evidence');E=Path('/home/user/aoe3-native-dxdiag-retest-oct22')
assert not E.exists();assert shutil.disk_usage(S).free>4294967296+134217728
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=S).strip()==b'c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2'
api=json.loads((S/'src/api_table.json').read_text());names={r['name']:r['id'] for r in api}
missing=[r for r in PROVIDER['imports'] if 'name' in r and r['name'] not in names]
assert [r['name'] for r in missing]==['QueryServiceConfigA','OpenServiceA'],missing
native=[str(p) for root in [R/'runtime',R/'installed',R/'runner',S/'test/binaries'] if root.exists() for p in root.rglob('*') if p.is_file() and p.name.lower()=='advapi32.dll']
assert not native,native
def excerpt(path,start,end):
 lines=(S/path).read_text().splitlines();return dict(path=str(S/path),sha256=hashlib.sha256((S/path).read_bytes()).hexdigest(),start=start,text='\n'.join(f'{i+1}: {lines[i]}' for i in range(start-1,min(end,len(lines))))+'\n')
sources={}
for path in ['src/08b-dll-loader.wat','lib/dll-loader.js','src/09a0-handlers-base.wat','lib/apps.js']:
 lines=(S/path).read_text().splitlines()
 terms={'src/08b-dll-loader.wat':(';; OLEAUT32.', ';; Process a loaded DLL'), 'lib/dll-loader.js':('const WINDOWS_SYSTEM_DLLS',), 'src/09a0-handlers-base.wat':('(func $handle_OpenSCManagerA',), 'lib/apps.js':('      pirates_2004:',)}[path]
 for term in terms:
  i=next(i for i,l in enumerate(lines) if term in l);sources[path+':'+term]=excerpt(path,i+1,i+(120 if term.startswith(';; Process') else 40))
ordinalMap={2:'SysAllocString',6:'SysFreeString',8:'VariantInit',9:'VariantClear',10:'VariantCopy',23:'SafeArrayAccessData',24:'SafeArrayUnaccessData'}
for ordinal,name in ordinalMap.items():
 t=(S/'src/08b-dll-loader.wat').read_text();assert f'(i32.const {ordinal}))' in t and f'$lookup_api_id "{name}"' in t and name in names
reg=R/'installed-audit/launch-registry.json';registry=json.loads(reg.read_text())
ports={}
for port in [8123,8124]:
 s=socket.socket();ports[str(port)]=s.connect_ex(('127.0.0.1',port));s.close();assert ports[str(port)]!=0
def seal(p):return dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
result=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),source='c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2',provider=PROVIDER,apiTable=seal(S/'src/api_table.json'),namedImports=200,ordinalImports=7,missing=missing,nativeAdvapiCandidates=native,ordinalMap=ordinalMap,sources=sources,registry=seal(reg),originalRunner=seal(P/'guest/original-run-relocated.js'),module=seal(S/'build/wine-assembly.wasm'),portsConnectEx=ports,processes=subprocess.check_output(['ps','-eo','pid,args']).decode(),free=shutil.disk_usage(S).free,stagingCount=0,startupCount=0,acceptCount=0,conclusion='OFFLINE_CLOSURE_BLOCKED: two unresolved named ADVAPI32 imports; no native ADVAPI32 in retained runtime/installed/runner/staged binaries. No runtime reachability claim; no overlay or guest launched.')
E.mkdir();(E/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(path=str(E/'audit.json'),bytes=(E/'audit.json').stat().st_size,sha256=hashlib.sha256((E/'audit.json').read_bytes()).hexdigest(),missing=missing,free=result['free'])))
