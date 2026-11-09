'use strict';
// Generate the retained owning runtimes; never allocate or execute a browser.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const version='q3-native-lifecycle-foreign-v1';
const retained='scratch/runs/20261109-q3-current-checkpoint-native-progress-1585';
const hashes={cancellation:'ae48c5c8ad6c6e673d4e87f468cfbf0699fa6e23adb0fbd903b0ec3c2c6143b1',original:'5e4121217f79fa551dab7cca91094f7accacc3404e4dd3c7ca6fb09351e9036d'};
function once(source,before,after){assert.equal(source.split(before).length,2,'unique native lifecycle seam: '+before);return source.replace(before,after);}
function generate(run,selected){
 assert.equal(selected,version,'explicit native lifecycle version');
 const files=[];
 for(const [phase,sha] of Object.entries(hashes)){
  const input=path.join(root,retained,phase,'runtime.py');let source=fs.readFileSync(input,'utf8');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),sha,'authenticated retained owning runtime');
  source=once(source,"pins=json.loads(gzip.decompress((base.parent/'runtime-pins.json.gz').read_bytes()))","pins=json.loads(gzip.decompress((base.parent/'prepared/runtime-pins.json.gz').read_bytes()))");
  source=once(source,"(P/'runtime-pins.json').write_text(json.dumps(pins))",'');
  source=once(source,"Q3_NATIVE_COMPOSITION='1',",'Q3_NATIVE_PHASE='+JSON.stringify(phase)+',');
  source=once(source,"['node','--require',str(root/'tools/q3-native-driver-composition.cjs'),", "['node',");
  for(const helper of [...(phase==='original'?['q3-menu-pointer-control.cjs']:[]),'q3-native-input-cause-diagnostic.cjs','q3-input-wire-observation.cjs','q3-execution-boundary.cjs'])
   source=once(source,"'--require',str(root/'tools/"+helper+"'),",'');
  source=once(source,"str(P/'browser-run.cjs')", "str(root/'tools/q3-current-foreign-closure-v1.cjs'),'--run-staged',str(base.parent/'prepared'),'q3-current-foreign-a16fc87d4-44fc9a134-v1',life['manifestSHA256']");
  // Diagnostic preloads install before the versioned composition. These are
  // their existing entry hooks; the runtime entry owns composition installation.
  const filename=path.join(path.dirname(run),phase,'runtime.py');
  source=once(source,'root=base.parents[3]', 'root=(base/'+JSON.stringify(path.relative(path.dirname(filename),root))+').resolve()');
  assert(!fs.existsSync(filename),'fresh generated owning runtime required');
  files.push({path:path.relative(root,filename),source});
 }
 return files;
}
function caller(source){
 source=once(source,"out=REMOTE+'/scratch/runs/20261108-q3-gl-readiness-gameplay/changed-control-1475-'+phase", "out=REMOTE+'/'+str((phasebase/'prepared/runtime').relative_to(ROOT))");
 // The independent retained drain constructs its output separately. Bind it
 // to the same directory before its unchanged physical/kernel assertions.
 return once(source," save(phase+'-drain',json.loads(remote(phase+'-drain',script,60)))",
  " script=script.replace(\"out=root/'scratch/runs/20261108-q3-gl-readiness-gameplay/changed-control-1475-\"+phase+\"'\",\"out=Path(\"+repr(out)+\")\")\n save(phase+'-drain',json.loads(remote(phase+'-drain',script,60)))");
}
module.exports={version,generate,caller};
