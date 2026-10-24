import pathlib, subprocess, json, hashlib, re, posixpath
P=pathlib.Path('/tmp/madbomber-winmm-retained-native-oct24'); R=P/'repo'
H=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
C='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'; M='9b263cea5801886d43b6e818f0b415645bb32a50'
def git(*a): return subprocess.check_output(['git','-C',str(R),*a])
alt=R/'.git/objects/info/alternates'; todo=alt.read_text().splitlines(); seen=[]
while todo:
 p=pathlib.Path(todo.pop(0)).resolve()
 if str(p) in seen: continue
 seen.append(str(p)); a=p/'info/alternates'
 if a.exists(): todo += [str((p/x).resolve()) if not x.startswith('/') else x for x in a.read_text().splitlines()]
alt.write_text('\n'.join(reversed(seen))+'\n')
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false')
(R/'.git/info/sparse-checkout').write_text('/docs/re-notes/madbomber-winmm-retained-native-qualification-20261024*\n')
if git('rev-parse','--abbrev-ref','HEAD').decode().strip() != 'task/madbomber-winmm-retained-native-qualification-oct24':
 git('checkout','-q','-b','task/madbomber-winmm-retained-native-qualification-oct24',M)
git('merge-base','--is-ancestor','7fd352855',C)
files={}; todo=['test/test-wave-error-text-native.js','test/test-wave-error-text.js']; external=set()
while todo:
 f=todo.pop(0)
 if f in files: continue
 b=git('show',C+':'+f);files[f]=b
 if f.endswith('.js'):
  for dep in re.findall(rb'require\([\'\"]([^\'\"]+)[\'\"]\)',b):
   dep=dep.decode()
   if not dep.startswith('.'): external.add(dep);continue
   dep=posixpath.normpath(posixpath.join(posixpath.dirname(f),dep))
   if not dep.endswith(('.js','.json','.cjs')): dep+='.js'
   todo.append(dep)
assert sum(map(len,files.values()))<10*1024*1024
rows=[]
for f,b in files.items():
 p=P/'inputs'/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 current=git('show',M+':'+f)
 rows.append({'path':f,'bytes':len(b),'blob':git('rev-parse',C+':'+f).decode().strip(),'sha256':hashlib.sha256(b).hexdigest(),'currentMainBlob':git('rev-parse',M+':'+f).decode().strip(),'unchangedOnMain':b==current})
manifest=json.loads((H/'docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json').read_text())
verified=[]
for row in manifest['files']:
 b=git('show',C+':'+row['path'])
 assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
 assert git('rev-parse',C+':'+row['path']).decode().strip()==row['blob']
 verified.append(row)
wasm=H/'build/wine-assembly.wasm'; wb=wasm.read_bytes(); assert len(wb)==1879746
assert hashlib.sha256(wb).hexdigest()=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
receipt={'source':C,'remoteMain':M,'acceptedImplementationAncestor':'7fd352855','module':str(wasm),'moduleBytes':len(wb),'moduleSHA256':hashlib.sha256(wb).hexdigest(),'closure':rows,'externalRequires':sorted(external),'verifiedBuildSourcePins':verified,'standingGitObjectDirectories':seen}
(P/'source-binding.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps({'files':len(rows),'bytes':sum(map(len,files.values())),'changedOnMain':[r['path'] for r in rows if not r['unchangedOnMain']],'external':sorted(external),'sourcePins':len(verified)}))
