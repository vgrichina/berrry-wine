'use strict';
// Actual CLI -> sealed caller -> genuine consumer/preflight. Fault injection
// changes only reads, so shared source/providers and historical evidence stay
// untouched. A stale source must refuse even with current module bytes present.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const current=require('./q3-current-module.cjs'),route=require('./q3-current-foreign-closure-v1.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'');
assert(process.argv[2]&&out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=args=>cp.execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
const options={foreignClosureVersion:route.version};
const run=path.join(out,'prepared');
const seal=JSON.parse(cp.execFileSync(process.execPath,[path.join(__dirname,'q3-current-module.cjs'),
 '--prepare',run,'--foreign-closure-version',route.version],{cwd:root,encoding:'utf8'}));
const pins=route.staged(run,route.version,seal.manifestSHA256);
assert.equal(pins.publishedModuleCommit,'5e8b6cb70c6e7b14c746870894beac791befcc7b');
assert.equal(pins.publishedCustodyCommit,'a815540593f9b3d5fb4982dfbe5f156f510812c8');
for(const [name,digest] of Object.entries({
 'src/03-registers.wat':'ce6098280c94e48aa2a985f5e39b3df55f689dcb17eec951a0969b37b74e551d',
 'src/06b-core-handlers.wat':'895a65bde3588aedace99c2c0c219a0790d36f0a23e05510bf29a349d7622e17',
 'tools/native_kernel_custody.py':'f8e6e8be352a20f668185c907fdcf4308f5cb93f8c6b8297fada063fc8140b77'
}))assert.equal(pins.files.find(p=>p.path===name)?.sha256,digest);
assert.equal(pins.files.find(p=>p.path==='build/wine-assembly.wasm').sha256,current.SELECTED.sha256);
// Compile both CPU modes from the authenticated source in memory. This binds
// the fixed module pins to actual construction, not just an updated validator.
const compiler=require('./watx-closure.js'),built=[];
const {layoutHash,appendSection}=require('./region-layout-hash.js');
for(const tailCalls of [true,false]){
 const closure=compiler.watxSourceClosure();
 if(!tailCalls)closure.vfs=require('../lib/dispatch-trampoline.js').applyToVfs(new Map(closure.vfs));
 const result=compiler.compileClosure(closure,{tailCalls});
 assert(result.success&&result.wasmBinary,JSON.stringify(result.errors));
 const bytes=appendSection(Buffer.from(result.wasmBinary),layoutHash(result.regions.regions)),name='build/wine-assembly'+(tailCalls?'':'.compat')+'.wasm';
 assert.deepEqual(bytes,fs.readFileSync(path.join(root,name)),'source constructs exact selected module');
 built.push({path:name,size:bytes.length,sha256:hash(bytes)});
}
const negatives=[];
for(const name of ['src/03-registers.wat','src/06b-core-handlers.wat','src/09ad-handlers-d3d9.wat','lib/d3d9-host.js','test/static-server.js','tools/watx-closure.js',
 'tools/native_kernel_custody.py','tools/q3-native-prelaunch.py','build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){
 const actual=fs.readFileSync(path.join(root,name));
 const stale=name.startsWith('src/')?git(['show','e7e0312bd:'+name]):
  name==='tools/native_kernel_custody.py'?git(['show','f977ebf7c:'+name]):null;
 for(const [mode,replacement] of [['tampered',Buffer.concat([actual,Buffer.from('\n')])],
  ...(stale?[['stale-published',stale]]:[])]){
  assert.notEqual(hash(actual),hash(replacement));
  const read=fs.readFileSync,target=path.join(root,name),dest=path.join(out,'refused-'+negatives.length);
  fs.readFileSync=function(file,...args){
   if(path.resolve(String(file))===target)return typeof args[0]==='string'?replacement.toString(args[0]):replacement;
   return read.call(this,file,...args);
  };
  try{
   assert.throws(()=>current.prepare(dest,options));assert(!fs.existsSync(dest),'refusal before output');
   assert.throws(()=>route.staged(run,route.version,seal.manifestSHA256),'sealed consumer rejects stale provider');
   if(name==='tools/native_kernel_custody.py')assert.throws(()=>route.composition(route.version),'actual composition refuses stale custody');
   negatives.push({name,mode,sha256:hash(replacement)});
  }finally{fs.readFileSync=read;}
 }
}
const runtime=JSON.parse(cp.execFileSync(process.execPath,[path.join(__dirname,'q3-current-foreign-closure.test.cjs'),
 '--runtime-probe',run,seal.manifestSHA256],{cwd:root,encoding:'utf8',timeout:15000}));
assert(runtime.passed&&runtime.gitFree&&runtime.compiled===1);
const preflight=JSON.parse(cp.execFileSync(process.execPath,[path.join(__dirname,'q3-current-foreign-closure-v1.cjs'),
 '--run-staged',run,route.version,seal.manifestSHA256],{cwd:root,encoding:'utf8',timeout:15000,
 env:{...process.env,DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+60000),
 Q3_EXECUTION_BOUNDARY_OUT:path.join(run,'cli-preflight.jsonl.gz')}}));
assert(preflight.passed&&preflight.chromiumStarted===false&&preflight.pins===pins.files.length);
// The Python prelaunch gate independently carries exact native custody pins.
// Exercise it too: a JS-only migration can pass the CPU/consumer checks above.
const prelaunchMigration=JSON.parse(cp.execFileSync('python3',['-B','-c',`
from pathlib import Path
import gzip,json,runpy,sys
root=Path.cwd();pins=json.loads(gzip.decompress((Path(sys.argv[1])/'runtime-pins.json.gz').read_bytes()))
def audit(event,args):
 if event in ('subprocess.Popen','os.fork','os.exec','socket.connect'):raise AssertionError(event)
sys.addaudithook(audit)
check=runpy.run_path(str(root/'tools/q3-native-prelaunch.py'))['require_composition']
check(root,pins)
native=next(p for p in pins['files'] if p['path']=='tools/native_kernel_custody.py')
for stale in ['e32418fcab89681c799c627353303a73e062e542c5391d978900c32385146b2e','3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240','0'*64]:
 native['sha256']=stale
 try:check(root,pins)
 except ValueError as error:assert 'tools/native_kernel_custody.py' in str(error)
 else:raise AssertionError('stale custody accepted')
print(json.dumps(dict(passed=True,refusals=3,noProcessOrNetwork=True)))
`,run],{cwd:root,encoding:'utf8'}));
const result={passed:true,built,negatives,runtime,preflight,prelaunchMigration,manifestSHA256:seal.manifestSHA256,
 publishedModuleCommit:pins.publishedModuleCommit,publishedCustodyCommit:pins.publishedCustodyCommit};
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:true,built,negativeControls:negatives.length,actualCLI:true,actualConsumer:true}));
