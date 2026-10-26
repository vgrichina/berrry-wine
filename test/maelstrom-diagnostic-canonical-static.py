"""Full binary ABI and independently derived source storage/span inventory."""
import hashlib,importlib.util,json,pathlib,sys,copy
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parents[2]/'ops'
spec=importlib.util.spec_from_file_location('abi',pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/docs/re-notes/shadow-man-span-static-canonical-20261023/static-abi.py'));a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
oracle=json.load(open(pathlib.Path('/tmp/maelstrom-errno-api-canonical-native-oct25/ops/static-oracle.json')));assert hashlib.sha256((pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/docs/re-notes/shadow-man-span-static-canonical-20261023/static-abi.py')).read_bytes()).hexdigest()==oracle['helperSHA256']
imports=oracle['imports'];exports=oracle['exports'];layout=oracle['computedLayout']
msc='started phase token entries parks completions fault capped active api thunk thread regs pre ret post result'.split()
mne='status event token thread regs pre post selectRet parks result nativeEntry callBlock sourceBlock pc esp eax ebp errno caller socketSet timeout'.split()
mne += 'rejectReason rejectModes rejectExpectedRet rejectObservedRet rejectPhase rejectCompletions rejectFault rejectActive rejectCapped'.split()
for prefix,fields in [('msc',msc),('mne',mne)]:
 for n in fields:exports[prefix+'_'+n]=dict(params=[],results=['i32'])
 exports[prefix+'_start']=dict(params=[],results=[])
def sections(p):
 r=a.Reader(p.read_bytes()[8:]);out={}
 while r.p<len(r.b):
  k=r.byte();b=r.take(r.leb())
  if k:out[k]=b
 return out
def globals_(body):
 r=a.Reader(body);out=[]
 for _ in range(r.leb()):
  start=r.p;ty=r.byte();mut=r.byte();op=r.byte();assert op in (0x41,0x42,0x43,0x44)
  if op in (0x41,0x42):
   while r.byte()&128:pass
  else:r.take(4 if op==0x43 else 8)
  assert r.byte()==0xb;out.append(body[start:r.p].hex())
 r.end();return out
outputs=[];controls=[]
for row in json.load(open(H/'build-outputs.json')):
 p=pathlib.Path(row['path']);o=a.parse(p);assert o['sha256']==row['sha256'];a.compare(o,imports,exports,layout)
 assert not any(c['name']=='name' for c in o['customSections']);assert o['noStart']
 sec=sections(p);base=next(r for r in oracle['bases'] if r['tailCalls']==row['tailCalls']);gs=globals_(sec[6]);remaining=iter(gs)
 for old in base['globals']:
  while True:
   now=next(remaining)
   if now==old:break
   assert now=='7f0141000b'
 assert all(g=='7f0141000b' for g in remaining)
 assert len(gs)==len(base['globals'])+48
 for k,v in base['storageSections'].items():assert hashlib.sha256(sec.get(int(k),b'')).hexdigest()==v,('guest storage changed',k)
 for name,mutate in [
  ('new host import',lambda x:x['imports'].append(dict(module='host',name='forged',kind=0,signature=dict(params=[],results=[])))),
  ('wrong getter signature',lambda x:next(e for e in x['exports'] if e['name']=='mne_errno')['signature'].update(results=[])),
  ('wrong start signature',lambda x:next(e for e in x['exports'] if e['name']=='mne_start')['signature'].update(params=['i32'])),
  ('wrong layout',lambda x:next(c for c in x['customSections'] if c['name']=='wine-region-layout').update(payloadHex=b'0000000000000000'.hex())),
 ]:
  bad=copy.deepcopy(o);mutate(bad)
  try:a.compare(bad,imports,exports,layout)
  except AssertionError:controls.append(dict(binary=p.name,control=name,rejected=True))
  else:raise AssertionError(('control escaped',name))
 outputs.append(o)
out=dict(status='PASS',outputs=outputs,importsCompared=len(imports),functionExportsCompared=len(exports),inventory=oracle['inventory'],serialization=oracle['serialization'],computedLayout=layout,controls=controls,privateGlobalsAdded=48,oracleSHA256=hashlib.sha256((pathlib.Path('/tmp/maelstrom-errno-api-canonical-native-oct25/ops/static-oracle.json')).read_bytes()).hexdigest(),nativeInstances=0)
(H/'static-abi.json').write_text(json.dumps(out,indent=2));print(json.dumps(dict(status='PASS',imports=len(imports),exports=len(exports),layout=layout,regions=len(oracle['inventory']),controls=len(controls))))
