#!/usr/bin/env python3
"""Tiny binary fixtures only; never call native WebAssembly or allocate arenas."""
import copy,hashlib,importlib.util,json,pathlib,tempfile,unittest,sys,subprocess
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('abi',H/'static-abi.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
SOURCE='''(region.declare-fixed $A (base 0x10) (size 0x10))
(region.declare-span $WINDOW (base 0) (end 0x40) (owner "limit"))'''
LINES='A:00000010:00000010\nWINDOW:00000000:00000040\n'
HASH=hashlib.sha256(LINES.encode()).hexdigest()[:16]
MIRROR="""const REGIONS = {
    A: { name: 'A', base: 0x10, size: 0x10, end: 0x20, within: null },
  };
const LAYOUT_HASH = '%s';"""%HASH
def leb(n):
 out=b''
 while n>=128:out+=bytes([(n&127)|128]);n>>=7
 return out+bytes([n])
def name(s):
 b=s.encode();return leb(len(b))+b
def section(k,b):return bytes([k])+leb(len(b))+b
def fixture(payload=HASH,start=False,duplicate=False):
 # One imported host.log_eip, shared imported memory, one defined i32 getter.
 types=b'\2\x60\1\x7f\0\x60\0\1\x7f'
 imports=b'\2'+name('host')+name('log_eip')+b'\0\0'+name('host')+name('memory')+b'\2\3'+leb(8192)+leb(32768)
 exports=b'\2'+name('get_eip')+b'\0\1'+name('memory')+b'\2\0'
 custom=section(0,name('wine-region-layout')+payload.encode())
 return b'\0asm\1\0\0\0'+section(1,types)+section(2,imports)+section(3,b'\1\1')+section(7,exports)+(section(8,b'\0') if start else b'')+custom+(custom if duplicate else b'')
class Tests(unittest.TestCase):
 def rejects_inventory(self,source=SOURCE,mirror=MIRROR):
  with self.assertRaises((AssertionError,ValueError,KeyError)):a.inventory(source,mirror)
 def test_serialization(self):
  regions,text,h=a.inventory(SOURCE,MIRROR);self.assertEqual((text,h),(LINES,HASH));self.assertEqual(len(regions),2)
  self.assertEqual(a.layout_lines(list(reversed(regions))),LINES)
  self.assertEqual(a.inventory('(; nested (; region.declare-span ;) ;)'+SOURCE,MIRROR)[2],HASH)
 def test_omitted_span(self):self.rejects_inventory(source=SOURCE.splitlines()[0])
 def test_changed_span_extent(self):self.rejects_inventory(source=SOURCE.replace('end 0x40','end 0x44'))
 def test_changed_span_placement(self):self.rejects_inventory(source=SOURCE.replace('(base 0) (end 0x40)','(base 4) (end 0x44)'))
 def test_duplicate_span(self):self.rejects_inventory(source=SOURCE+'\n'+SOURCE.splitlines()[1])
 def test_duplicate_storage(self):self.rejects_inventory(mirror=MIRROR.replace('  };',MIRROR.splitlines()[1]+'\n  };'))
 def test_incomplete_record(self):self.rejects_inventory(mirror=MIRROR.replace(', end: 0x20',''))
 def test_missing_record(self):self.rejects_inventory(mirror=MIRROR.replace(MIRROR.splitlines()[1],''))
 def test_unsupported_span(self):self.rejects_inventory(source=SOURCE.replace('(owner "limit")','(owner "limit") (align 4)'))
 def test_unknown_declaration(self):self.rejects_inventory(source=SOURCE.replace('declare-span','declare-other'))
 def test_incomplete_span(self):self.rejects_inventory(source=SOURCE.replace('(end 0x40)',''))
 def test_duplicate_clause(self):self.rejects_inventory(source=SOURCE.replace('(end 0x40)','(end 0x40) (end 0x40)'))
 def test_bounds(self):self.rejects_inventory(source=SOURCE.replace('0x40','0x20000001'))
 def test_changed_storage(self):self.rejects_inventory(mirror=MIRROR.replace('base: 0x10','base: 0x14').replace('end: 0x20','end: 0x24'))
 def test_exact_candidate_readonly(self):
  donor=pathlib.Path('/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23')
  manifest=json.loads((donor/'docs/re-notes/shadow-man-native-bound-canonical-20261023/manifest.json').read_text())
  row=next(r for r in manifest['files'] if r['path']=='lib/region-map.generated.js')
  mirror=subprocess.check_output(['git','-C',str(donor),'cat-file','blob',row['blob']])
  self.assertEqual(hashlib.sha256(mirror).hexdigest(),row['sha256'])
  combined=pathlib.Path(manifest['standingCombined']['path']);b=combined.read_bytes()
  self.assertEqual(hashlib.sha256(b).hexdigest(),'68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b')
  regions,text,h=a.inventory(b.decode(),mirror.decode());self.assertEqual(h,'9a3bc9149d58209c');self.assertEqual(len(regions),269)
  self.assertEqual(sum(r['kind']=='span' for r in regions),1)
  imports,exports=a.source_abi(combined)
  self.assertEqual(exports['null_diag_token'],dict(params=[],results=['i64']))
  self.assertEqual(next(r for r in imports if r['name']=='log_eip')['signature'],dict(params=['i32'],results=[]))
  (H/'candidate-test.json').write_text(json.dumps(dict(regions=len(regions),spanCount=1,layout=h,serialization=text,imports=len(imports),exports=len(exports),native=False),indent=2)+'\n')
 def test_binary_and_mismatches(self):
  with tempfile.TemporaryDirectory(dir=H) as td:
   p=pathlib.Path(td)/'tiny.wasm';p.write_bytes(fixture());o=a.parse(p)
   imports=copy.deepcopy(o['imports']);exports={'get_eip':dict(params=[],results=['i32'])}
   self.assertEqual(a.compare(o,imports,exports,HASH),exports)
   for b in [fixture(payload='0'*16),fixture(duplicate=True)]:
    p.write_bytes(b)
    with self.assertRaises(AssertionError):a.compare(a.parse(p),imports,exports,HASH)
   for key in ('params','results'):
    bad=copy.deepcopy(exports);bad['get_eip'][key]=['i64']
    with self.assertRaises(AssertionError):a.compare(o,imports,bad,HASH)
   bad=copy.deepcopy(imports);bad[0]['signature']['params']=['i64']
   with self.assertRaises(AssertionError):a.compare(o,bad,exports,HASH)
   bad=copy.deepcopy(o);bad['memories'].append(dict(flags=0,min=1,max=None,shared=False))
   with self.assertRaises(AssertionError):a.compare(bad,imports,exports,HASH)
   p.write_bytes(fixture(start=True))
   with self.assertRaises(AssertionError):a.parse(p)
   p.write_bytes(fixture()+section(1,b'\0'))
   with self.assertRaises(AssertionError):a.parse(p)
if __name__=='__main__':unittest.main(verbosity=2)
