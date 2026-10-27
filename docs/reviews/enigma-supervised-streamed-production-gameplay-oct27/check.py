import ast,hashlib,json,pathlib,subprocess,time,sys
sys.dont_write_bytecode=True
H=pathlib.Path('/tmp/enigma-supervised-streamed-production-gameplay-oct27');O=H/'ops';ROOT=pathlib.Path('/home/user/wine-assembly')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
donor=pathlib.Path('/tmp/enigma-retained-integration-allocation-recovery-oct27/repo')
pins={'tools/enigma-frozen-gameplay-controller.py':'77997362d75f9873cd8b022b4840606ed1b66780171e7c82d8f8a6f20b304f26',
 'tools/enigma-supervised-gameplay.py':'6f00afae565b32114cc6b78d9b806348d2195ff69122e345aabaf09493b5960c'}
inputs=[]
for rel,expected in pins.items():
 p=donor/rel;actual=sha(p);assert actual==expected
 inputs.append(dict(path=str(p),sha256=actual,bytes=p.stat().st_size,revision='b2922b17dd6b62f4129fc87fd03b0e1df269ba4a'))
p=donor/'tools/enigma-supervised-gameplay.py';source=p.read_text();tree=ast.parse(source);calls=[]
for node in ast.walk(tree):
 if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and isinstance(node.func.value,ast.Name) and node.func.value.id=='subprocess' and node.func.attr=='Popen':
  kw={k.arg:ast.unparse(k.value) for k in node.keywords}
  calls.append(dict(line=node.lineno,endLine=node.end_lineno,argv=ast.unparse(node.args[0]),stdout=kw.get('stdout'),stderr=kw.get('stderr'),excerpt=ast.get_source_segment(source,node)))
assert len(calls)==2 and all(c['stdout']=='subprocess.PIPE' and c['stderr']=='subprocess.STDOUT' for c in calls)
schema=next(n for n in ast.walk(tree) if isinstance(n,ast.Compare) and ast.unparse(n.left)=='set(c)' and isinstance(n.comparators[0],ast.Set))
fields=sorted(ast.literal_eval(schema.comparators[0]));assert not any('stderr' in x or 'stdout' in x for x in fields)
fixture=donor/'test/fixtures/enigma-controller/test_supervised.py'
inputs.append(dict(path=str(fixture),sha256=sha(fixture),bytes=fixture.stat().st_size,reviewOnly=True,testsRerun=False))
runtimeMap=ROOT/'scratch/usage-watch/enigma-exact-production-runtime-map-oct27.json';m=json.loads(runtimeMap.read_text());rows=m['rows']
assert len(rows)==2663 and sum(r['bytes'] for r in rows)==37486692
for suffix,expected in [('test/run.js','55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e'),('host-imports.js','0d2dc6eff2b2ff9153f0b6b8b3caca69f71ae02bd62fe58599786d0d8f500347')]:
 row=next(r for r in rows if r['target'].endswith('/'+suffix));assert row['sha256']==expected and sha(pathlib.Path(row['path']))==expected;inputs.append(row)
module=pathlib.Path('/tmp/enigma-reconciled-canonical-boat-build-oct26/modules/wine-assembly.wasm')
assert sha(module)=='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b'
inputs.append(dict(path=str(module),sha256=sha(module),bytes=module.stat().st_size))
save('source-diagnostic-check.json',dict(at=time.time(),verdict='BLOCKED_BEFORE_GUEST',sourceIdentityPass=True,inputs=inputs,childLaunchSites=calls,
 launchFields=fields,schemaLine=schema.lineno,diagnosticRequirement='Distinct owned stdout AND stderr files from process creation, including startup/preflight and failed spawn/setup.',
 mismatch='Both exact pinned supervisor Popen calls set stderr=subprocess.STDOUT; bytes lose stream identity before output.log. Outer CLI stderr redirection cannot separate child streams.',
 sourceChangesAuthorized=False,wrapperOrMonkeypatchUsed=False,fullMap=dict(path=str(runtimeMap),sha256=sha(runtimeMap),rows=len(rows),bytes=sum(r['bytes'] for r in rows),allRowsRehash='coordinator dispatch receipt reused; not repeated'),
 canonicalMountParser='NOT RUN: prelaunch source contract rejection precedes staging, config construction, checkout and conditional guest execution',
 runtimeLaunches=0,nodeStartupAttempts=0,guestAllowanceUsed=0,testsRerun=False))
save('checkpoint.json',dict(at=time.time(),state='BLOCKED_BEFORE_GUEST',completed=['read exact schema and fixture examples','verified supervisor/controller pins','AST verified both irreversible stream merges','production runner/host-imports/module hashes verified'],
 remaining=['authorized supervisor diagnostic repair','independent affected acceptance','canonical filename/tree mount validation','remote full closure hashes','exact Node environment/limit startup receipt','original production owned launch','step1 actual ACK and matching frozen zero','presented menu','safe StartGame','actual gameplay','ordinary guest Quit'],
 historicalIncidents='Prior synthetic60 paired/backend cases,28 controller tests and79-step old production initialization remain limited to their original scope; no retroactive new-path/gameplay qualification.',
 lifecycle=json.loads((ROOT/'scratch/usage-watch/enigma-supervised-streamed-production-gameplay-oct27.task.runtime.json').read_text())))
print('PASS exact source identities and AST mismatch evidence retained; BLOCKED_BEFORE_GUEST; no tests or guest launched')
