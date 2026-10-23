import importlib.util, pathlib, json, re, hashlib, subprocess, os, shutil
H=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ready',H/'readiness.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
manifest=json.loads((H/'closure-inputs.json').read_text());rows={r['path']:r for r in manifest['files']}
cache={}
def read(f):
 if f not in cache:cache[f]=m.read_exact(rows[f],None)
 return cache[f]
starts=['test/run.js','tools/shadow-man-null-preload.cjs','tools/shadow-man-null-capture.cjs','tools/build-compile-wat.js','tools/watx-closure.js']
pending=list(starts);seen=set();edges=[];external=[];unresolved=[]
while pending:
 f=pending.pop()
 if f in seen:continue
 seen.add(f)
 for dep in re.findall(r'require\(\s*[\'"]([^\'"]+)[\'"]\s*\)',read(f).decode(errors='replace')):
  if not dep.startswith('.'):
   external.append(dict(file=f,dependency=dep));continue
  base=os.path.normpath(str(pathlib.PurePosixPath(f).parent/dep))
  target=next((p for p in [base,base+'.js',base+'.cjs',base+'.json',base+'/index.js'] if p in rows),None)
  edges.append(dict(file=f,request=dep,target=target))
  if target and target.endswith(('.js','.cjs')):pending.append(target)
  if target is None:unresolved.append(dict(file=f,request=dep))
main=read('src/main.watx').decode();includes=re.findall(r'\(include\s+"([^"]+)"\)',main)
wat=read('src/13-exports.wat').decode()
keys=['set_null_diag','null_diag_field','null_diag_token','null_diag_root']
diagnostic={k:re.search(r'\(func\s+\(export "'+k+r'"\)([^\n]*)',wat).group(0) for k in keys}
result=dict(candidate=m.CAND,entrypoints=starts,staticLiteralRequireClosure=[rows[f] for f in sorted(seen)],edges=edges,externalRequests=external,unresolved=unresolved,limitations='Lexical literal-require coverage includes comments/optional/conditional branches; misses computed require/import/importScripts, dynamic eval, generated code, spawn and data loads. Not a whole-runtime dependency proof. No scripts evaluated.',includeOrder=includes,includeInputs=[rows['src/'+f] for f in includes],diagnosticExports=diagnostic,scannerBoundary='callback census: src/*.wat[x], root *.js, recursive lib/*.js; tools CJS and actual test/run.js outside. Region js-copies/embedded scans recursive lib/tools/test *.js. Passing ledger is a review lock, not lifetime ownership. Prior 4/404 remain pending.',compilerInputs=[r for f,r in rows.items() if f.startswith('tools/watx-src/') or f in ['tools/watx.js','tools/watx-closure.js','tools/build-compile-wat.js']],fullClosure='UNQUALIFIED: admission stopped before build gates/dependency execution')
(H/'source-boundaries.json').write_text(json.dumps(result,indent=2)+'\n')
tools=[]
for name in ['node','python3','git','bash','ssh']:
 p=pathlib.Path(shutil.which(name)).resolve();b=p.read_bytes();tools.append(dict(name=name,path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),execution='in place, pre-existing, no copies or installs'))
donors=[]
for p in [m.DONOR,m.REVIEW,m.ROOT]:
 donors.append(dict(path=str(p),head=m.git(p,'rev-parse','HEAD').decode().strip(),gitBytes=int(subprocess.check_output(['du','-sb',str(p/'.git')]).split()[0]),usage='read-only Git objects or hash-checked standing files; no donor metadata/index writes'))
(H/'standing-identities.json').write_text(json.dumps(dict(tools=tools,donors=donors),indent=2)+'\n')
print('source boundaries recorded; no gates or compilation')
