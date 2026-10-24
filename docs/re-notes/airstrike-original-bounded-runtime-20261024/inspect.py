#!/usr/bin/env python3
"""Offline exact-revision inventory; never compiles or instantiates wasm."""
import hashlib,json,os,pathlib,posixpath,re,subprocess
H=pathlib.Path(__file__).parent
ROOT=pathlib.Path('/home/user/wine-assembly')
C='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
def sha(b):return hashlib.sha256(b).hexdigest()
def dump(n,x):(H/n).write_text(json.dumps(x,indent=2)+'\n')
def git(p):
 r=subprocess.run(['git','-C',str(ROOT),'cat-file','blob',C+':'+p],capture_output=True,env={**os.environ,'GIT_NO_LAZY_FETCH':'1'},timeout=10)
 return r.stdout if r.returncode==0 else None
def row(p,b):return dict(path=p,bytes=len(b),sha256=sha(b))
queue=['test/run.js'];seen={};missing=[];external={};edges=[]
# No --no-build path can enter these toolchains. Conditional packages remain
# inventory requirements, rather than being silently supplied or installed.
excluded={'tools/watx-closure.js','tools/region-layout-hash.js'}
while queue:
 p=queue.pop()
 if p in seen or p in excluded:continue
 b=git(p)
 if b is None:missing.append(p);continue
 seen[p]=row(p,b)
 if not p.endswith('.js'):continue
 for spec in re.findall(r'require\(\s*[\'\"]([^\'\"]+)[\'\"]\s*\)',re.sub(r'(?m)^\s*//.*$', '', b.decode())):
  if spec.startswith('.'):
   q=posixpath.normpath(posixpath.join(posixpath.dirname(p),spec))
   choices=[q] if q.endswith(('.js','.json','.cjs')) else [q+'.js',q+'.json',q+'/index.js']
   hit=next((x for x in choices if git(x) is not None),None)
   edges.append([p,spec,hit])
   if hit:queue.append(hit)
   else:missing.append({'from':p,'require':spec})
  elif not spec.startswith('node:'):
   external.setdefault(spec,[]).append(p)
lock=json.loads(git('package-lock.json'));pin=lock['packages']['node_modules/pngjs']
extra=['package-lock.json','src/api_table.json','src/win16-ordinals.generated.json','fonts/substitutions.json','src/02-thread-table.wat']
extra+=['fonts/'+x for x in ['System.fon','MSSansSerif.fon','Fixedsys.fon','Courier.fon','Terminal.fon']]
fm=json.loads(git('fonts/substitutions.json'))
for face in fm['faces']:
 for file in face.get('styles',{}).values():extra.append('fonts/'+file)
extra+=['test/binaries/tlbs/stdole2.tlb']
for p in sorted(set(extra)):
 b=git(p)
 if b is not None:seen[p]=row(p,b)
 else:missing.append(p)
dump('historical-harness-manifest.json',dict(candidate=C,files=list(seen.values()),totalBytes=sum(x['bytes'] for x in seen.values()),edges=edges,unavailable=missing,externalRequires=external,excludedInactiveBuild=sorted(excluded),pngjsPin=pin,scope='Literal relative require closure plus ordinary runtime font/API/ordinal data. Conditional paths included conservatively; dynamic requires are reported by runner source and remain unqualified.'))
v=json.load(open('/tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/minimal-vfs.json'))
release=pathlib.Path('/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a')
for r in v['files']:
 b=(release/r['path']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256'],r['path']
dump('original-vfs-verified.json',v)
paths=[release/x for x in ['SDL.dll','SDL_image.dll','SDL_mixer.dll','jpeg.dll','libpng1.dll','msvcr70.dll']]
paths += [ROOT/'test/binaries/dlls/msvcrt.dll',pathlib.Path('/tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/zlib.dll')]
dll=[row(str(p),p.read_bytes()) for p in paths];assert len(dll)==8
assert dll[-1]['sha256']=='0df0c22bf411ad670d7b8fe5a533e4831313d5a3118cf9216389c642c90ec2f9'
assert dll[-2]['sha256']=='887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1'
dump('dll-identities.json',dll)
module=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm');m=row(str(module),module.read_bytes())
assert m['bytes']==1879746 and m['sha256']=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
contract=json.load(open('/home/user/wine-assembly-shadow-man-memory-recovered-handler-qualification-oct23/docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023/accepted-contract.json'))
assert seen['test/run.js']['sha256']==contract['source'][0]['sha256']
dump('module-identity.json',dict(module=m,source=C,harness=seen['test/run.js'],acceptedImportCount=len(contract['imports']),abiExecution='NOT RUN; prerequisite codec absent',staticContractRetained='/home/user/wine-assembly-shadow-man-memory-recovered-handler-qualification-oct23/docs/re-notes/shadow-man-memory-recovered-handler-qualification-20261023/accepted-contract.json'))
dump('prospective-staging.json',dict(harnessBytes=sum(x['bytes'] for x in seen.values()),moduleBytes=m['bytes'],originalVfsBytes=sum(x['bytes'] for x in v['files']),dllBytes=sum(x['bytes'] for x in dll),copies=2,note='Prospective overlapping two-host materialization; no runtime transfer performed. Missing pinned PNG codec is NOT counted as supplied.'))
print(json.dumps(dict(files=len(seen),bytes=sum(x['bytes'] for x in seen.values()),missing=len(missing),pngjs=pin)))
