import pathlib,json,hashlib,re,subprocess,resource,os
H=pathlib.Path('/tmp/maelstrom-tree-mounted-runtime-oct24')
m=json.load(open(H/'manifest.json'))
for x in m:
 b=(H/x['target']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['target']
assert os.getuid()==1000
assert int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024>=2684354560
code=r'''
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=process.cwd();const runner=fs.readFileSync('runner/test/run.js','utf8');
// Load the actual harness's pre-argument dependency preamble, without invoking its main or compiling WASM.
const Module=require('module');const pre=new Module(path.join(root,'runner/test/preguest.cjs'),module);
pre.filename=path.join(root,'runner/test/preguest.cjs');pre.paths=Module._nodeModulePaths(path.join(root,'runner/test'));
pre._compile(runner.slice(0,runner.indexOf('function canvasToPng')),pre.filename);
const {PNG}=require('./runner/node_modules/pngjs');const {encode}=require('./capture.cjs');
const a=new PNG({width:640,height:480});a.data.fill(19);const b=PNG.sync.write(a);const out=encode(b);assert.deepStrictEqual(PNG.sync.read(out).data,a.data);
assert.throws(()=>encode(Buffer.alloc(32)),/real PNG/);const invalid=Buffer.from(b);invalid.writeUInt32BE(801,16);assert.throws(()=>encode(invalid),/dimensions/);
const canvas=require('./runner/lib/canvas-compat').createCanvas(640,480);const cap=encode(canvas.toBufferSync('png'));assert(PNG.sync.read(cap).width===640);
require('./runner/lib/renderer');const fm=require('./runner/lib/font-substitutions').fontMounts(require('./runner/fonts/substitutions.json'),{subset:true});for(const f of fm)fs.readFileSync('./runner/fonts/'+f.file);
console.log(JSON.stringify({codec:require('./runner/node_modules/pngjs/package.json').version,node:process.version,preambleLoaded:true,fontFiles:fm.length,captureBytes:out.length,rasterCaptureBytes:cap.length,rejectingControls:2,pixelsEqual:true}));
'''
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(524288,524288))
r=subprocess.run(['node','--max-old-space-size=256','-e',code],cwd=H,capture_output=True,text=True,timeout=60,preexec_fn=limits)
assert r.returncode==0,r.stderr
j=dict(files=len(m),bytes=sum(x['bytes'] for x in m),ordinaryUID=os.getuid(),manifestPass=True,probe=json.loads(r.stdout),passPreGuest=True)
(H/'preflight.json').write_text(json.dumps(j,indent=2));print(json.dumps(j))
