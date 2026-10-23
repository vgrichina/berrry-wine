import pathlib,subprocess,json,hashlib,re,posixpath,shutil
BASE=pathlib.Path('/tmp/d3d-late-batch-independent-oct23');ROOT=pathlib.Path('/home/user/wine-assembly');DONOR='/tmp/d3d-late-batch-oct23/repo';REV='09dc88de08907d362eef2ac5dbbaad0080147358'
def git(*args):return subprocess.check_output(['git','-C',DONOR,*args],timeout=20)
tree={}
for row in git('ls-tree','-rl',REV).decode().splitlines():
 meta,p=row.split('\t',1);mode,kind,oid,size=meta.split();tree[p]={'blob':oid,'bytes':int(size)}
def read(p):
 assert tree[p]['bytes']<=25165824
 return git('show',REV+':'+p)
starts=['test/test-d3d-software-compaction.js','test/test-d3d-software-ctx-arena-reuse.js','test/test-d3d9-software-backend.js']
closure=set(starts);queue=starts[:];external=set();unresolved=[]
while queue:
 p=queue.pop();data=read(p).decode()
 for req in re.findall(r'''require\(['"]([^'"]+)['"]\)''',data):
  if not req.startswith('.'):
   external.add(req);continue
  q=posixpath.normpath(posixpath.join(posixpath.dirname(p),req))
  q=next((x for x in [q,q+'.js',q+'.json',q+'/index.js'] if x in tree),None)
  if q is None:unresolved.append([p,req]);continue
  if q not in closure:closure.add(q);queue.append(q)
# Dynamic compiler loader inputs and all directory-enumerated WAT inputs.
closure.update(p for p in tree if p.startswith('src/') and re.search(r'\.(wat|watx)$',p))
closure.update(['tools/watx.js','tools/watx-closure.js']+[f'tools/watx-src/{x}' for x in ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js']])
manifest=[]
for p in sorted(closure):
 b=read(p);entry={'path':p,**tree[p],'sha256':hashlib.sha256(b).hexdigest()}
 existing=ROOT/p
 entry['root_standing_exact']=existing.is_file() and existing.stat().st_size==len(b) and hashlib.file_digest(existing.open('rb'),'sha256').hexdigest()==entry['sha256']
 manifest.append(entry)
packages={}
for pkg in sorted(external-{'fs','path','vm','assert','crypto','os','util','zlib','events','stream','worker_threads','child_process','perf_hooks','url','http','https','net','buffer'}):
 p=ROOT/'node_modules'/pkg
 packages[pkg]={'standing_exists':p.exists(),'standing_bytes':sum(x.stat().st_size for x in p.rglob('*') if x.is_file() and not x.is_symlink()) if p.exists() else None}
admission=json.loads((BASE/'admission.json').read_text())
total=sum(x['bytes'] for x in manifest);missing=sum(x['bytes'] for x in manifest if not x['root_standing_exact'])
receipt={'candidate':REV,'entrypoints':starts,'native_command':'node --max-old-space-size=512 test/<entrypoint>.js','compiler_command':'node --max-old-space-size=2048 test/<entrypoint>.js (NOT admitted as combined native harness)',
 'closure':manifest,'closure_bytes':total,'root_standing_nonmatching_bytes':missing,'external_require_names':sorted(external),'package_inventory':packages,'unresolved_literal_imports':unresolved,
 'fresh_closure_projection':admission['projected']+total,'allocation':67108864,
 'compiler_loader_excerpt':{'path':'tools/watx.js','blob':tree['tools/watx.js']['blob'],'full_sha256':hashlib.sha256(read('tools/watx.js')).hexdigest(),'recipe':'entire file, bytes unchanged','excerpt_bytes':len(read('tools/watx.js'))},
 'native_verdict':'NOT ADMITTED',
 'native_blocker':'Exact entrypoints synchronously compileSrcWasm then instantiate in one Node process. No per-phase heap/CPU/wall/MemAvailable/module-size enforcement in these helpers. Compiler 2048MiB heap cannot satisfy native 512MiB heap by launching the combined command; cheap Node 256MiB is not the compiler allowance. No matching qualified extraWat module or approved phase-separated runner was supplied. Fresh full closure exceeds disk allocation; standing sources could reduce disk but do not resolve enforcement or establish artifact provenance. No compile or instantiate attempted.',
 'module_inventory':{'root_build_wasm':list(map(str,(ROOT/'build').glob('*.wasm'))),'producer_wasm':list(map(str,pathlib.Path(DONOR).rglob('*.wasm')))},
 'fonts':'compaction and arena explicitly fonts:none; backend uses default fonts and requires font manifest/files in addition; full cold backend closure not admitted',
 'native_limits':{'compiler_heap':2147483648,'compiler_cpu_wall':900,'compiler_memavailable':2684354560,'native_heap':536870912,'native_cpu_wall':150,'native_memavailable':1610612736,'wasm_memory':536870912,'module_max':8388608,'workers':0}}
(BASE/'native-admission.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:receipt[k] for k in ['closure_bytes','root_standing_nonmatching_bytes','fresh_closure_projection','unresolved_literal_imports','package_inventory','module_inventory','native_verdict']}))
