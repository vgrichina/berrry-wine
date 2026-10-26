import pathlib,json,importlib.util,hashlib,sys
sys.dont_write_bytecode=True
O=pathlib.Path(__file__).resolve().parent;ROOT=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23');F=ROOT/'docs/re-notes/shadow-man-span-static-canonical-20261023'
spec=importlib.util.spec_from_file_location('abi',F/'static-abi.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
m=json.load(open(F/'manifest.json'));combined=pathlib.Path(m['standingCombined']['path'])
assert hashlib.sha256(combined.read_bytes()).hexdigest()==m['standingCombined']['sha256']
imports,exports=a.source_abi(combined);regions,serialization,layout=a.inventory(combined.read_text(),(ROOT/'lib/region-map.generated.js').read_text())
assert layout=='9a3bc9149d58209c' and len(regions)==269 and sum(r['kind']=='span' for r in regions)==1
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
bases=[];historical=json.load(open(F/'outputs.json'))
for name in ['wine-assembly.wasm','wine-assembly.compat.wasm']:
 p=ROOT/'build'/name;expected=next(r for r in historical if r['path'].endswith(name));assert hashlib.sha256(p.read_bytes()).hexdigest()==expected['sha256']
 sec=sections(p);bases.append(dict(tailCalls=name=='wine-assembly.wasm',sha256=expected['sha256'],globals=globals_(sec[6]),storageSections={str(k):hashlib.sha256(sec.get(k,b'')).hexdigest() for k in [5,11]}))
# Actual rejecting source inventory mutations, not declared fingerprint alone.
controls=[]
for name,rs in [('omitted span',[r for r in regions if r['kind']!='span']),('changed span',[dict(r,size=r['size']+1) if r['kind']=='span' else r for r in regions])]:
 try:computed=hashlib.sha256(a.layout_lines(rs).encode()).hexdigest()[:16]
 except AssertionError:pass
 else:assert computed!=layout
 controls.append(name)
out=dict(imports=imports,exports=exports,inventory=regions,serialization=serialization,computedLayout=layout,bases=bases,controls=controls,combinedSHA256=m['standingCombined']['sha256'],mirrorSHA256=hashlib.sha256((ROOT/'lib/region-map.generated.js').read_bytes()).hexdigest(),helperSHA256=hashlib.sha256((F/'static-abi.py').read_bytes()).hexdigest())
(O/'static-oracle.json').write_text(json.dumps(out,indent=2));print(json.dumps(dict(status='PASS',imports=len(imports),exports=len(exports),regions=len(regions),layout=layout)))
