#!/usr/bin/env python3
"""Exact retained-byte closure and combined, phased execution admission.

Read-only default. No Git historical-object fallback, fetching or tool staging.
The execution driver must consume this manifest without modifying any pins.
"""
import hashlib, json, os, pathlib, re, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
HOST=pathlib.Path('/home/user/wine-assembly')
READY=pathlib.Path(str(HOST)+'-render-positiont-file-log-bounds-readiness-oct23')
FIX=pathlib.Path(str(HOST)+'-render-positiont-com-qualification-fixture-oct23')
PREV=pathlib.Path(str(HOST)+'-render-positiont-diagnostic-com-qualification-oct23')
E=ROOT/'docs/re-notes/render-positiont-guarded-com-qualification-20261023'
OLD=READY/'docs/re-notes/render-positiont-file-log-bounds-readiness-20261023'
EXT=HOST/'scratch/usage-watch/render-positiont-guarded-com-qualification-oct23'
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T05-35-13-01a16741-95be-7290-9a36-530ef0de9548.jsonl')
ENV=dict(os.environ,GIT_NO_LAZY_FETCH='1',GIT_OPTIONAL_LOCKS='0')
def sha(b):return hashlib.sha256(b).hexdigest()
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def git(d,*a):return subprocess.check_output(['git','-C',str(d),*a],env=ENV,timeout=20)
def save(n,v):(E/n).write_text(json.dumps(v,indent=2)+'\n')
def footprint(p):
 if not p.exists():return 0
 return p.lstat().st_size+sum(q.lstat().st_size for q in p.rglob('*')) if p.is_dir() else p.stat().st_size
def main():
 assert git(FIX,'rev-parse','HEAD').decode().strip()=='7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6'
 assert git(READY,'rev-parse','HEAD').decode().strip()=='54d701e9d7f5de8c9e8fc045864228e6d85db01f'
 for donor,folder,rev in [(READY,OLD,'54d701e9d7f5de8c9e8fc045864228e6d85db01f'),(PREV,PREV/'docs/re-notes/render-positiont-diagnostic-com-qualification-20261023','6fb1ce4b36b5463b100557a8299ad5d4a9cd2f51')]:
  seals=json.loads((folder/'seals.json').read_text())
  for s in seals:
   b=(donor/s['path']).read_bytes();assert len(b)==s['bytes'] and sha(b)==s['sha256']
   assert b==git(donor,'show',rev+':'+s['path'])
 rows=json.loads((OLD/'manifest.json').read_text());manifest={r[0]:r for r in rows}
 cache={};locations={}
 def read(p):
  if p in cache:return cache[p]
  r=manifest[p]
  # Accepted retained paths only; no speculative Git lookup or archives.
  for d in dict.fromkeys([READY,pathlib.Path(r[3]),FIX]):
   q=d/p
   if q.is_file():
    b=q.read_bytes()
    if blob(b)==r[1] and len(b)==r[2]:cache[p]=b;locations[p]=str(q);return b
  raise RuntimeError('EXACT_RETAINED_SOURCE_UNAVAILABLE '+p+' '+r[1])
 pins=json.loads(read('test/support/positiont-com-source-pins.json'))
 assert len(pins)==286
 for p,h in pins.items():assert manifest[p][1]==h and blob(read(p))==h
 build={'test/support/positiont-com-module.js','test/compile-src.js','tools/watx-closure.js','tools/watx.js'}
 qualify={'test/test-d3d9-positiont-com-qualification.js','test/support/positiont-com-module.js','test/render-helper.js'}
 dynamic={'tools/watx-src/'+n for n in ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js']}
 builtins=set();edges=[]
 def closure(roots):
  seen=set();queue=list(roots)
  while queue:
   p=queue.pop()
   if p in seen:continue
   seen.add(p);b=read(p)
   if not p.endswith(('.js','.cjs')):continue
   text=b.decode()
   for name in re.findall(r'require\(\s*[\'"]([^\'"]+)[\'"]\s*\)',text):
    if not name.startswith('.'):
     builtins.add(name);continue
    base=os.path.normpath(str(pathlib.PurePosixPath(p).parent/name))
    q=next((x for x in [base,base+'.js',base+'.json',base+'/index.js'] if x in manifest),None)
    assert q, (p,name)
    edges.append([p,name,q]);queue.append(q)
  return seen
 bc=closure(build|dynamic);qc=closure(qualify)
 files=set(pins)|bc|qc|{'test/support/positiont-com-source-pins.json'}
 assert builtins-{'pngjs','@node-3d/glfw','@node-3d/webgl'} <= {'fs','path','crypto','assert','vm','zlib','util','events','stream','buffer','os','node:fs','node:path','node:crypto','node:os','node:net','node:worker_threads'} , builtins
 records=[dict(path=p,blob=manifest[p][1],bytes=len(read(p)),sha256=sha(read(p)),retained=locations[p],build=p in bc,qualify=p in qc,pin=p in pins) for p in sorted(files)]
 standing=json.loads((OLD/'standing.json').read_text())
 for t in standing['tools']:
  b=pathlib.Path(t['path']).read_bytes();assert len(b)==t['standingBytes'] and sha(b)==t['sha256']
 for f in standing['pngjs']['files']:
  b=(pathlib.Path(standing['pngjs']['root'])/f['path']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256']
 save('source-manifest.json',records);save('standing.json',standing)
 save('closure.json',dict(build=sorted(bc),qualification=sorted(qc),explicitDynamicCompiler=sorted(dynamic),literalRequireEdges=edges,external=sorted(builtins),pins=len(pins),sourceBytes=sum(r['bytes'] for r in records),
  dynamicReviewRequired=True,note='Static closure includes inactive literal requires; dynamic/data consumers require independent source review before execution. All 286 pins remain through qualification final consumer. No gates/decoder rerun.'))
 print(json.dumps(dict(files=len(records),bytes=sum(r['bytes'] for r in records),build=len(bc),qualify=len(qc),external=sorted(builtins),currentOwned=footprint(ROOT)+footprint(EXT)+footprint(SESSION))))
if __name__=='__main__':main()
