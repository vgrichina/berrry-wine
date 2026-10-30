import sys,pathlib,json,types,copy,ast
E=pathlib.Path(__file__).parent
S=E/'stage/repo/test/toyvm-kernel-profile-accounting-backend-oct28'
sys.path.insert(0,str(S))
import test_namespace_wire as n
p=n.production
# Keep the unchanged transport, shortening only its temporary status socket root.
# The original deeply nested test helper path exceeds AF_UNIX sun_path.
temporary=n.transport.tempfile.TemporaryDirectory
def short_temporary(*args,**kwargs):
 kwargs['dir']=str(E.parent)
 return temporary(*args,**kwargs)
n.transport.tempfile.TemporaryDirectory=short_temporary
source=(S/'fuse_backend.py').read_text()
tree=ast.parse(source)
handle=next(x for x in ast.walk(tree) if isinstance(x,ast.FunctionDef) and x.name=='handle')
branches={ast.unparse(x.test):ast.unparse(x) for x in handle.body if isinstance(x,ast.If)}
assert "stat.S_IFDIR" in branches['op == 9'] and "stat.S_IFREG" in branches['op == 35']
assert source.index('try:answer=self.handle(op,ino,raw[40:])')<source.index('self.record_namespace_callback(op,unique,ino,error)')
def probe(module=p,limit=2,explicit=True):
 with n.wire(limit,module=module,explicit=explicit) as w:
  expected=[];observations=[]
  def call(op,parent,payload,error):
   before=n.stable(w);nodes=copy.deepcopy(w.backend.nodes)
   reply=w.call(op,parent,payload);assert reply[0]==-error
   if error:assert n.stable(w)==before and w.backend.nodes==nodes
   expected.append(dict(opcode=op,unique=w.unique,inode=parent,errno=error,callbackCount=len(expected)+1))
   state=w.state()
   if limit:
    assert state.pop('namespaceEvidence')==dict(limit=limit,callbackCount=len(expected),countSaturated=False,records=expected[-limit:]),'missing corresponding callback'
   else:
    assert 'namespaceEvidence' not in state
    assert not hasattr(w.backend,'namespace_evidence') and not hasattr(w.backend,'namespace_callbacks')
   observations.append([reply,json.dumps(state,sort_keys=True),copy.deepcopy(w.backend.nodes)])
   return reply[1]
  d=p.pack('2I',0o700,0);f=p.pack('4I',0,0o600,0,0)
  parent=p.unpack('Q',call(9,1,d+b'private-dir,alpha\0',0))[0]
  child=p.unpack('Q',call(35,parent,f+b'private-file,beta\0',0))[0]
  for op,prefix in [(9,d),(35,f)]:
   call(op,parent,prefix+b'private-file,beta\0',17)
   call(op,child,prefix+b'private-other\0',20)
   call(op,n.MAX,prefix+b'private-other\0',2)
  final=w.state()
  if limit:
   ev=final['namespaceEvidence'];assert ev['callbackCount']==8 and len(ev['records'])==2
   assert all(set(v)=={'opcode','unique','inode','errno','callbackCount'} and all(type(x)is int and 0<=x<=n.MAX for x in v.values()) for v in ev['records'])
  for private in ('private-','987654','876543','765432','unused-namespace'):assert private not in json.dumps(final)
  return observations
enabled=probe()
controls={}
needle='self.namespace_evidence_limit and op in (9,10,11,35)'
assert source.count(needle)==1
for name,ops in [('disable-mkdir','10,11,35'),('disable-create','9,10,11')]:
 mutant=types.ModuleType(name)
 exec(compile(source.replace(needle,'self.namespace_evidence_limit and op in ('+ops+')'),str(S/'fuse_backend.py'),'exec'),mutant.__dict__)
 try:probe(mutant)
 except AssertionError as ex:
  assert str(ex)=='missing corresponding callback';controls[name]='REJECTED missing corresponding callback'
 else:raise AssertionError('negative control accepted')
assert enabled==probe(limit=0)==probe(limit=0,explicit=False)
result=dict(PASS=True,productionServeRequests=8,handlerDerivedOpcodes={'MKDIR':9,'CREATE':35},positive=True,negativeControls=controls,disabledOmittedExplicitZeroEnabledBehaviorParity=True,cap=2,callbackCount=8,retained=2,numericOnly=True,privacy=True,scope='independent distinguishing production serve wire; no mount claim',productionSourcesMutated=False)
(E/'wire-result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
