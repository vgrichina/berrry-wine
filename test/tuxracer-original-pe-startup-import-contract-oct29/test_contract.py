import unittest,copy,struct,pathlib,json,sys
from analyze import PE,collect,OUT,BASE
from contract import build,body
from supervisor import run,OWN

def fixture():
 b=bytearray(2048);b[:2]=b'MZ'
 def w(o,v):struct.pack_into('<I',b,o,v)
 def h(o,v):struct.pack_into('<H',b,o,v)
 w(60,128);b[128:132]=b'PE\0\0';h(134,1);h(148,224);o=152;h(o,0x10b);w(o+60,512)
 s=o+224;w(s+12,0x1000);w(s+16,1536);w(s+20,512)
 # Imports: OFT zero, ordinal 7 followed by named Symbol, IAT fallback.
 w(o+104,0x1000);w(o+108,40);w(512+12,0x1080);w(512+16,0x1100)
 b[640:646]=b'x.dll\0';w(768,0x80000007);w(772,0x1180);b[898:905]=b'Symbol\0'
 # Export ordinal 5, named Alias, forwarding to x.#7.
 w(o+96,0x1200);w(o+100,128);e=1024;w(e+16,5);w(e+20,1);w(e+24,1);w(e+28,0x1300);w(e+32,0x1310);w(e+36,0x1320)
 w(1280,0x1240);w(1296,0x1340);h(1312,0);b[1088:1093]=b'x.#7\0';b[1344:1350]=b'Alias\0'
 return b
class Contract(unittest.TestCase):
 def test_fixture_ordinal_name_forward_oft_fallback(self):
  p=PE(fixture());i=p.imports()[0];self.assertEqual(i['symbols'],[{'ordinal':7},{'name':'Symbol','hint':0}]);e=p.exports()[0]
  self.assertEqual((e['ordinal'],e['names'],e['forward']),(5,['Alias'],'x.#7'))
 def test_reject_truncated_unbacked_nonpe(self):
  for data in [b'bad',bytes(fixture()[:300])]:
   with self.assertRaises((ValueError,struct.error)):PE(data).imports()
  p=PE(fixture())
  with self.assertRaises(ValueError):p.off(0x1800)
 def test_source_identity(self):
  import hashlib
  for manifest in ['input-source-pins.json','extra-source-pins.json']:
   for name,pin in json.loads((OUT/manifest).read_text()).items():
    b=(BASE/name).read_bytes();self.assertEqual(len(b),pin['bytes']);self.assertEqual(hashlib.sha256(b).hexdigest(),pin['sha256'])
 def test_exact_original_contract(self):
  r=build();self.assertEqual(len(r['edges']),618);self.assertEqual(len(r['modules']),4)
  self.assertEqual(sum(e['route']=='bundled guest export' for e in r['edges']),85)
  self.assertTrue(all(e['export'] for e in r['edges'] if e['route']=='bundled guest export'))
  self.assertEqual(r['firstExeFailFastInDescriptorOrder']['name'],'glVertex2dv')
  self.assertEqual(r['firstExeUnresolvedInDescriptorOrder']['name'],'gluScaleImage')
  self.assertEqual(sum(bool(e['forward']) for m in r['modules'].values() for e in m['exports']),0)
  self.assertEqual(sum('ordinal' in e for m in r['modules'].values() for d in m['imports'] for e in d['symbols']),0)
 def test_bundled_export_rejecting_oracle(self):
  m=collect();tcl=m['tcl83.dll'];required={s['name'] for d in m['tuxracer.exe']['imports'] if d['dll'].lower()=='tcl83.dll' for s in d['symbols']}
  tcl['exports']=[e for e in tcl['exports'] if not required.intersection(e['names'])]
  self.assertFalse(required.issubset({n for e in tcl['exports'] for n in e['names']}))
 def test_name_presence_is_not_implementation(self):
  r=build();x=r['firstExeFailFastInDescriptorOrder'];self.assertIsNotNone(x['tableRow']);self.assertIn('unreachable',r['sourceBodies']['gl_unimplemented'])
  override=next(e for e in r['edges'] if e.get('name')=='glGetTexLevelParameteriv');self.assertIn('$handle_gpu_api',override['generatedCall']);self.assertFalse(override['status'].startswith('gl_unimplemented fail-fast'))
 def test_cwd_rejections_before_sentinel(self):
  sentinel=OUT/'REJECTED-SPAWN-SENTINEL';self.assertFalse(sentinel.exists());argv=[sys.executable,'-c','from pathlib import Path;Path('+repr(str(sentinel))+').touch()']
  for cwd in ['/',str(BASE.parent.parent),'/home/user/wine-assembly','/tmp/tuxracer-registration-independent-accept-oct29/repo',str(OWN/'../../outside')]:
   with self.assertRaises(ValueError):run(argv,cwd=cwd,label='must-not-spawn')
  with self.assertRaises(TypeError):run(argv)
  with self.assertRaises(ValueError):run(['git','status'],cwd=OWN,git=True,mutate=True,label='invalid-explicit-git')
  self.assertFalse(sentinel.exists());(OUT/'sentinel-receipt.json').write_text(json.dumps({'invalidCwdRejected':5,'omittedCwdRejected':True,'implicitGitRejected':True,'sentinelAbsent':True})+'\n')
if __name__=='__main__':unittest.main()
