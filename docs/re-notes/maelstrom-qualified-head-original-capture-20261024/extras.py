from transport import *
import base64,zlib,shlex
O=H/'ops'
def send(b,target):
 for off in range(0,len(b),18000):
  row=[target,'wb' if off==0 else 'ab',base64.b64encode(b[off:off+18000]).decode()]
  enc=base64.b64encode(zlib.compress(json.dumps(row).encode())).decode()
  code='import pathlib,base64,zlib,json;h=pathlib.Path('+repr(str(H))+');r=json.loads(zlib.decompress(base64.b64decode('+repr(enc)+')));p=h/r[0];p.parent.mkdir(parents=True,exist_ok=True);p.open(r[1]).write(base64.b64decode(r[2]))'
  remote('python3 -c '+shlex.quote(code))
for p,t in [(H/'guest-args.json','guest-args.json'),(O/'supervise.py','supervise.py'),(H/'repo/tools/maelstrom-head-yield-observer.cjs','observer.cjs'),(pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/13-exports.wat'),'13-exports.wat')]:send(p.read_bytes(),t)
s=pathlib.Path('/tmp/maelstrom-single-return-sync-capture-oct24/validate-tree.cjs').read_text().replace('full.slice(4)','full.slice(3)').replace("filter(s=>s.action==='png').length,3","filter(s=>s.action==='png').length,0")
(O/'validate-tree.cjs').write_text(s);send(s.encode(),'validate-tree.cjs')
cmd='cd '+shlex.quote(str(H))+' && node --max-old-space-size=256 observer.cjs --enable runner/test/run.js 13-exports.wat runner/test/run-head-observed.js && node --max-old-space-size=256 validate-tree.cjs'
save('transform-tree-receipt.json',remote(cmd,60))
code='''
import pathlib,json,hashlib,subprocess,resource,os,re
h=pathlib.Path(ROOT)
assert os.getuid()==1000
assert int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024>=805306368
pins={'observer.cjs':'fcb1ecac66d1e868ff47f7b9e57c93654bdf82b27663f54182132f668ccce931','13-exports.wat':'739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86','runner/test/run.js':'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'}
for p,want in pins.items():assert hashlib.sha256((h/p).read_bytes()).hexdigest()==want,p
p=h/'write-control';p.write_text('ordinary-user');assert p.read_text()=='ordinary-user';p.unlink()
js=r"""
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
const root=process.cwd(),runner=fs.readFileSync('runner/test/run.js','utf8');
const pre=new Module(path.join(root,'runner/test/preguest.cjs'),module);pre.filename=path.join(root,'runner/test/preguest.cjs');pre.paths=Module._nodeModulePaths(path.join(root,'runner/test'));pre._compile(runner.slice(0,runner.indexOf('function canvasToPng')),pre.filename);
const {PNG}=require('./runner/node_modules/pngjs');const p=new PNG({width:1,height:1});p.data.fill(19);assert.deepEqual(PNG.sync.read(PNG.sync.write(p)).data,p.data);
require('./runner/lib/renderer');const fm=require('./runner/lib/font-substitutions').fontMounts(require('./runner/fonts/substitutions.json'),{subset:true});for(const f of fm)fs.readFileSync('./runner/fonts/'+f.file);
console.log(JSON.stringify({node:process.version,pngjs:require('./runner/node_modules/pngjs/package.json').version,preambleLoaded:true,fontFiles:fm.length,realPNG:true}));
"""
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(131072,131072))
r=subprocess.run(['node','--max-old-space-size=256','-e',js],cwd=h,capture_output=True,text=True,timeout=60,preexec_fn=limits)
receipt=dict(returncode=r.returncode,stdout=r.stdout,stderr=r.stderr,pins=pins,transformedSHA256=hashlib.sha256((h/'runner/test/run-head-observed.js').read_bytes()).hexdigest(),ordinaryUserWrites=True)
(h/'preflight.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt));assert r.returncode==0
'''.replace('ROOT',repr(str(H)))
save('preflight-api.json',remote('python3 -c '+shlex.quote(code),60))
save('extras-complete.json',dict(passPreGuest=True,guestExecuted=False))
