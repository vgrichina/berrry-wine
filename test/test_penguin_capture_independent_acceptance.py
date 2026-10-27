"""Independent acceptance of the exact retained Python CLI; no game execution."""
import hashlib,importlib.util,json,os,pathlib,resource,subprocess,sys,tempfile,unittest,zlib,base64

ROOT=pathlib.Path(__file__).resolve().parents[1]
MODULE=ROOT/'tools/penguin_capture_contract.py'
PIN='ed1828a46ea699e21f5ab68893b62bbe6e050884898725dbd0226de44d28573a'
assert hashlib.sha256(MODULE.read_bytes()).hexdigest()==PIN
spec=importlib.util.spec_from_file_location('accepted_exact_module',MODULE)
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
E=pathlib.Path(os.environ['PENGUIN_INDEPENDENT_RECEIPTS'])
E.mkdir(parents=True,exist_ok=True)
def retain(name,data):
 (E/name).write_text(json.dumps(data,indent=2)+'\n')
def invoke(args):
 p=subprocess.run([sys.executable,str(MODULE),*args],capture_output=True,timeout=20,env=dict(os.environ,INDEPENDENT_SENTINEL='not-for-child'))
 assert len(p.stdout)+len(p.stderr)<8192
 return p
def fixture(d,change=False):
 exe=str(pathlib.Path(sys.executable).resolve())
 script=d/'phase.py'
 script.write_text("import sys,os,json,pathlib,resource\np=pathlib.Path(sys.argv[2]);stage=sys.argv[1]\n(p/(stage+'.json')).write_text(json.dumps(dict(exe=sys.executable,env=dict(os.environ),flags=sys.flags.no_site,limits={k:list(resource.getrlimit(getattr(resource,'RLIMIT_'+k))) for k in ('DATA','AS','RSS','CPU','FSIZE')})))\n"+("if stage=='startup':\n q=p/'profile.json';v=json.loads(q.read_text());v['flags'].append('-B');q.write_text(json.dumps(v))\n" if change else ''))
 limits={k:list(resource.getrlimit(getattr(resource,'RLIMIT_'+k))) for k in ('DATA','AS','RSS','CPU','FSIZE')}
 limits.update(CPU=[90,90],FSIZE=[4194304,4194304])
 p=dict(executable=exe,executable_sha256=hashlib.sha256(pathlib.Path(exe).read_bytes()).hexdigest(),flags=['-S'],startup=[str(script),'startup',str(d)],guest=[str(script),'guest',str(d)],cwd=str(d),env={'LC_ALL':'C.UTF-8','TZ':'UTC'},limits=limits,resources=dict(rss=33554432,startup_wall=5,guest_wall=5,total_wall=15,text=2097152,png=4194304,selected=8388608,remote=16777216,api=1048576),artifacts={str(script):hashlib.sha256(script.read_bytes()).hexdigest()},capture_dir=str(d/'captures'))
 path=d/'profile.json';path.write_text(json.dumps(p));return path,p
def supervise(d,path,digest=None):
 return invoke(['supervise',str(path),'--sha256',digest or hashlib.sha256(path.read_bytes()).hexdigest(),'--output',str(d/'out')])

class EntryBoundary(unittest.TestCase):
 def test_04_payload_digest_and_cumulative_receiver_budget(self):
  with tempfile.TemporaryDirectory(dir=ROOT/'test') as name:
   png=pathlib.Path(name)/'bounded.png';data=b'\x89PNG\r\n\x1a\n'+b'independent bounded transport bytes';png.write_bytes(data)
   # This is an opaque transport fixture, not a valid visual PNG or gameplay proof.
   p=c.plan_images([png],used=11,tail_reserve=19)
   changed=dict(p,images=[dict(p['images'][0],sha256='0'*64)])
   with self.assertRaisesRegex(c.ContractError,'lossless PNG verification failed'):c.restore_images(changed,p['frames'])
   changed=dict(p,used=1048576-sum(map(len,p['frames']))-19+1)
   with self.assertRaisesRegex(c.ContractError,'cumulative API budget'):c.restore_images(changed,p['frames'])
   retain('05-receiver-oracles.json',dict(sha256MismatchRejected=True,cumulativeOneByteOverflowRejected=True,opaqueTransportFixture=True,visualPNGValidationClaim=False))
 def test_01_identity_mismatch_before_any_child(self):
  observations=[]
  for kind in ('profile_digest','executable_digest'):
   with tempfile.TemporaryDirectory(dir=ROOT/'test') as name:
    d=pathlib.Path(name);path,p=fixture(d)
    if kind=='executable_digest':p['executable_sha256']='0'*64;path.write_text(json.dumps(p))
    r=supervise(d,path,'0'*64 if kind=='profile_digest' else None)
    self.assertEqual(r.returncode,2,r.stderr);self.assertFalse((d/'startup.json').exists());self.assertFalse((d/'guest.json').exists());self.assertFalse((d/'out').exists())
    observations.append(dict(kind=kind,argvBoundary='actual CLI supervise',returncode=r.returncode,stdout=r.stdout.decode(),startupAbsent=True,guestAbsent=True))
  retain('01-identity-boundary.json',observations)
 def test_02_same_owner_positive_and_pre_guest_change(self):
  results=[]
  for change in (False,True):
   with tempfile.TemporaryDirectory(dir=ROOT/'test') as name:
    d=pathlib.Path(name);path,p=fixture(d,change);r=supervise(d,path)
    receipt=json.loads((d/'out/receipt.json').read_text())
    self.assertEqual(r.returncode,2 if change else 0,r.stdout+r.stderr)
    self.assertEqual(receipt['guest_starts'],0 if change else 1)
    if change:self.assertFalse((d/'guest.json').exists());self.assertIn('profile changed before guest',receipt['error'])
    else:
     startup=json.loads((d/'startup.json').read_text());guest=json.loads((d/'guest.json').read_text());self.assertEqual(startup,guest);self.assertEqual(guest['env'],p['env']);self.assertEqual(guest['limits'],p['limits']);self.assertEqual(guest['flags'],1);self.assertEqual(guest['exe'],p['executable'])
    self.assertTrue(all(x['owned_group_absent'] for x in receipt['phases']))
    results.append(dict(change=change,returncode=r.returncode,receipt=receipt))
  retain('02-owner-and-change-boundary.json',results)
 def test_03_png_cli_budget_boundary(self):
  with tempfile.TemporaryDirectory(dir=ROOT/'test') as name:
   d=pathlib.Path(name);png=d/'comma,image.png'
   def chunk(tag,data):return len(data).to_bytes(4,'big')+tag+data+(zlib.crc32(tag+data)&0xffffffff).to_bytes(4,'big')
   data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',b'\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00')+chunk(b'IDAT',zlib.compress(b'\x00\xff\x00\x00\xff'))+chunk(b'IEND',b'')
   png.write_bytes(data)
   good=invoke(['plan',str(png),'--used','0','--tail-reserve','17']);self.assertEqual(good.returncode,0,good.stdout+good.stderr)
   plan=json.loads(good.stdout);spare=1048576-plan['serialized_bytes']-17
   exact=invoke(['plan',str(png),'--used',str(spare),'--tail-reserve','17']);self.assertEqual(exact.returncode,0,exact.stdout);self.assertEqual(json.loads(exact.stdout)['total'],1048576)
   over=invoke(['plan',str(png),'--used',str(spare+1),'--tail-reserve','17']);self.assertEqual(over.returncode,2);self.assertIn(b'UNSUPPORTED_PLAN',over.stdout);self.assertNotIn(b'frames',over.stdout)
   retain('03-cli-budget.json',dict(pngSHA256=hashlib.sha256(data).hexdigest(),positive=json.loads(good.stdout),exact=json.loads(exact.stdout),oneByteOver=json.loads(over.stdout)))
   # Exercise actual lossless decoder with independent bytes; isolate digest
   # verification even when the expected wire frames themselves are changed.
   p=c.plan_images([png],used=7,tail_reserve=17);restored,charged=c.restore_images(p,p['frames']);self.assertEqual(restored,[data]);self.assertEqual(charged,7+sum(map(len,p['frames'])))
   frames=list(p['frames']);rec=json.loads(json.loads(frames[1])['stdout']);rec['data']=base64.b64encode(zlib.compress(data[:-1]+bytes([data[-1]^1]),9)).decode();frames[1]=c.response(rec,p['envelope']);changed=dict(p,frames=tuple(frames))
   with self.assertRaises(c.ContractError):c.restore_images(changed,frames)
   for bad in (p['frames'][:-1],(p['frames'][0][:-1],*p['frames'][1:]),(p['frames'][0],p['frames'][1]+b' ',*p['frames'][2:])):
    with self.assertRaises(c.ContractError):c.restore_images(p,bad)
   retain('04-integrity.json',dict(lossless=True,digestMismatchRejected=True,missingTruncatedExtraFramingRejected=True,chargedOnce=charged,apiCap=1048576))

if __name__=='__main__':unittest.main(verbosity=2)
