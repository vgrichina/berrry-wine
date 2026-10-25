import pathlib,json,hashlib,subprocess,importlib.util,sys
sys.dont_write_bytecode=True
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
def sha(b):return hashlib.sha256(b).hexdigest()
m=json.load(open(O/'closure.json'));seen={};data={}
for r in m['files']:
 b=subprocess.check_output(['git','-C',str(R),'show',m['candidate']+':'+r['path']],timeout=60)
 assert len(b)==r['bytes'] and sha(b)==r['sha256'],r['path']
 assert subprocess.check_output(['git','-C',str(R),'rev-parse',m['candidate']+':'+r['path']],timeout=60).decode().strip()==r['blob']
 if r['standingMatchesCurrent']:assert pathlib.Path(r['standingPath']).read_bytes()==b
 data[r['path']]=b
a=json.load(open(O/'expected-abi-layout.json'));p=pathlib.Path(a['helperPath']);assert sha(p.read_bytes())==a['helperSHA256']
spec=importlib.util.spec_from_file_location('abi',p);abi=importlib.util.module_from_spec(spec);spec.loader.exec_module(abi)
edges=[]
def walk(p):
 if p in seen:return
 seen[p]=True;it=iter(abi.tokens(data[p].decode()));prev=None
 for x in it:
  if prev=='(' and x=='include':
   f=json.loads(next(it));assert next(it)==')';q=f.removeprefix('./');q=q if q.startswith('src/') else 'src/'+q
   assert q in data,('new unpinned include',q)
   edges.append(dict(source=p,include=f,resolved=q));walk(q)
  prev=x
walk('src/main.watx');assert list(seen)==m['reached'] and edges==m['includeEdges']
g=json.load(open(O/'guard-reuse.json'))
for row in [g['guard'],g['qualifier']]+g['receipts']:
 assert sha(pathlib.Path(row['path']).read_bytes())==row['sha256']
g['explicitSourceRoots']=[str(pathlib.Path(m['compilerPath']).parents[1]),str(R)]
(O/'guard-reuse.json').write_text(json.dumps(g,indent=2)+'\n')
(O/'current-closure-verified.json').write_text(json.dumps(dict(candidate=m['candidate'],reached=len(seen),dependencies=len(data),closureSHA256=m['closureSHA256'],allFullFilesVerified=True,entryClosureVerified=True,excerptsUsed=False,reusedInventory=str(O/'expected-abi-layout.json'),sourceModelTestsRepeated=False),indent=2)+'\n')
print('PASS exact current full source/compiler pins and actual entry closure; retained source inventory reused')
