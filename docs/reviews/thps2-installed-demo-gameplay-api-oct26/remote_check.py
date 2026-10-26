import os,json,pathlib,resource,subprocess,hashlib,time,re,shutil
H=pathlib.Path('/tmp/thps2-installed-demo-gameplay-api-oct26');O=H/'ops'
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(2097152,2097152))
env={k:v for k,v in os.environ.items() if k not in ['NODE_OPTIONS','WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','WINE_ASSEMBLY_WASM','MAELSTROM_CAPTURE_INSTALL','ENIGMA_TERMINAL_CAPTURE_INSTALL']}
node='/home/user/.nvm/versions/node/v24.22.1/bin/node'
code=r'''const fs=require('fs'),Module=require('module'),assert=require('assert'),path=require('path');const H=process.cwd();
const runner=fs.readFileSync(H+'/runner/test/run.js','utf8'),pre=new Module(H+'/runner/test/preguest.cjs',module);pre.filename=H+'/runner/test/preguest.cjs';pre.paths=Module._nodeModulePaths(H+'/runner/test');pre._compile(runner.slice(0,runner.indexOf('function canvasToPng')),pre.filename);
const {PNG}=require('./runner/node_modules/pngjs'), helper=require('./ops/lossless-capture-png.cjs');const c=require('./runner/lib/canvas-compat').createCanvas(640,480);const encoded=helper.encode(PNG,c.toBufferSync('png'),'single-frame');assert.equal(PNG.sync.read(encoded).width,640);assert.throws(()=>helper.encode(PNG,Buffer.alloc(10),'single-frame'));require('./runner/lib/renderer');
const fm=require('./runner/lib/font-substitutions');for(const f of fm.BUNDLED_BITMAP_FONTS)fs.readFileSync('./runner/fonts/'+f);for(const f of fm.fontMounts(require('./runner/fonts/substitutions.json'),{subset:true}))fs.readFileSync('./runner/fonts/'+f.file);
const bytes=fs.readFileSync('./runtime/build/wine-assembly.wasm');const {SECTION_NAME}=require('./runner/tools/region-layout-hash.js');const sections=[];const mirror=require('./runner/lib/region-map.generated.js');console.log(JSON.stringify({startup:true,node:process.version,execPath:process.execPath,execArgv:process.execArgv,codec:require('./runner/node_modules/pngjs/package.json').version,losslessBytes:encoded.length,preamble:true,fontFiles:fm.fontMounts(require('./runner/fonts/substitutions.json'),{subset:true}).length,moduleCompile:false,mirrorHash:mirror.layoutHash||mirror.LAYOUT_HASH,limits:fs.readFileSync('/proc/self/limits','utf8'),environment:process.env}));'''
# Do not expose environment credentials: retained receipt records only controlled variables.
code=code.replace('environment:process.env','environment:{NODE_OPTIONS:process.env.NODE_OPTIONS||null,WINE_RUN_EXTRA_ARGS:process.env.WINE_RUN_EXTRA_ARGS||null,WINE_REGION_MAP:process.env.WINE_REGION_MAP||null}')
p=subprocess.run([node,'--max-old-space-size=512','--require='+str(O/'capture.cjs'),'-e',code],cwd=H,env=env,capture_output=True,text=True,timeout=45,preexec_fn=limits)
receipt=dict(returncode=p.returncode,stdout=p.stdout[:8192],stderr=p.stderr[:8192],at=time.time(),uid=os.getuid(),memAvailable=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024,diskFree=shutil.disk_usage('/tmp').free)
(O/'startup.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(dict(returncode=p.returncode,stdout=p.stdout[:4500],stderr=p.stderr[:1500])));assert p.returncode==0
