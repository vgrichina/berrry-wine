import pathlib,json,hashlib,re,subprocess,os,time,resource
H=pathlib.Path('/tmp/penguin-retained-codec-oct24');m=json.load(open(H/'manifest.json'));checked=[]
def sha(b):return hashlib.sha256(b).hexdigest()
for x in m:
 b=(H/x['target']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['target'];checked.append(x['target'])
c=json.load(open(H/'accepted-contract.json'));wasm=(H/'runtime/build/wine-assembly.wasm').read_bytes();assert len(wasm)==1879746 and sha(wasm)==c['module']['sha256']=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
# Decode only the inert custom section, no engine/module/arena compilation.
pos=8
def leb():
 global pos
 n=s=0
 while True:
  b=wasm[pos];pos+=1;n|=(b&127)<<s
  if not b&128:return n
  s+=7
stamp=None
while pos<len(wasm):
 section=wasm[pos];pos+=1;length=leb();end=pos+length
 if section==0:
  n=leb();name=wasm[pos:pos+n];pos+=n
  if name==b'wine-region-layout':stamp=wasm[pos:end].decode()
 pos=end
mirror=(H/'runner/lib/region-map.generated.js').read_text();assert stamp==c['layout']['payload']=='9a3bc9149d58209c' and stamp in mirror
assert c['memories']==[{'flags':3,'min':8192,'max':32768,'shared':True}];assert len(c['imports'])==291
runner=(H/'runner/test/run.js').read_text();assert '--control-stdin' in runner and "require('../lib/canvas-compat')" in runner
assert "if (HEADLESS_GL)" in runner
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert mem>=805306368
code="const p='./node_modules/pngjs';const {PNG}=require(p);const a=new PNG({width:1,height:1});a.data.set([1,2,3,255]);const b=PNG.sync.read(PNG.sync.write(a));require('assert').deepStrictEqual(a.data,b.data);require('./lib/canvas-compat');require('./lib/renderer');const fm=require('./lib/font-substitutions').fontMounts(require('./fonts/substitutions.json'),{subset:true});for(const f of fm)require('fs').readFileSync('./fonts/'+f.file);console.log(JSON.stringify({version:require(p+'/package.json').version,pixels:[...b.data],node:process.version,canvasRoute:'production rasterCanvas',pass:true}));"
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
r=subprocess.run(['node','--max-old-space-size=256','-e',code],cwd=H/'runner',capture_output=True,text=True,timeout=60,preexec_fn=limits);assert r.returncode==0,r.stderr
j=dict(time=time.time(),files=len(checked),bytes=sum(x['bytes'] for x in m),manifestPass=True,codec=json.loads(r.stdout),regionStamp=stamp,acceptedABIReusedByExactModuleHash=True,imports=c['imports'],memories=c['memories'],memoryAvailable=mem,ordinaryAssets=len(list((H/'game/data/gfx').glob('*'))),renderer='rasterCanvas; no headlessGL; skia only decodeImage profile not selected; guest JPEG/PNG bundled native DLLs',passPreGuest=True)
(H/'preflight.json').write_text(json.dumps(j,indent=2));print(json.dumps({k:j[k] for k in ['files','bytes','codec','regionStamp','memoryAvailable','ordinaryAssets','passPreGuest']}))
