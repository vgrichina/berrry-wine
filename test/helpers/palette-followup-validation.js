#!/usr/bin/env node
'use strict';
// Run only with the serialized runtime grant. No asset/dependency installation.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const dir=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('usage: node test/helpers/palette-followup-validation.js NEW_EVIDENCE_DIR [worker|regressions|conformance] [BASELINE_ROOT BASELINE_COMMIT]');
const mode=process.argv[3]||'regressions';
if(!['worker','regressions','conformance'].includes(mode))throw Error('unknown mode '+mode);
let baseline;
if(mode==='conformance'){
  if(!process.argv[4]||!process.argv[5])throw Error('conformance requires baseline checkout and exact commit');
  const root=path.resolve(process.argv[4]),expected=process.argv[5];
  const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if(head!==expected)throw Error(`baseline HEAD ${head} differs from required ${expected}`);
  const diff=cp.execFileSync('git',['diff','HEAD','--stat'],{cwd:root,encoding:'utf8'}).trim();
  if(diff)throw Error('baseline tracked files are modified: '+diff);
  baseline={root,head};
}
fs.mkdirSync(dir);const results=[];
const save=(name,data)=>fs.writeFileSync(path.join(dir,name),data);
save('source-head.txt',cp.execFileSync('git',['rev-parse','HEAD']));
save('source-status.txt',cp.execFileSync('git',['status','--short']));
if(baseline)save('baseline.json',JSON.stringify(baseline,null,2)+'\n');
const suites=mode==='conformance'?[
  ['test-d3dim-render-worker-web.js',['--no-sandbox','--swiftshader']],
  ['test-d3dim-palette-worker-web.js',[]],
  ['test-d3dim-gps-palette.js',[]],
]:mode==='worker'?[['test-d3dim-palette-worker-web.js',[]]]:[
  ['test-directdraw-palette-format.js',[]],['test-directdraw-palette-query-interface.js',[]],
  ['test-d3dim-texture-stage-alias.js',[]],['test-page-watch.js',[]],
  ['test-d3d-shader-vm.js',[]],['test-d3d9-color-surfaces.js',[]],
  ['test-d3d9-texture-residency.js',[]],['test-d3d9-textures.js',[]],
  ['test-d3d9-webgl-versions.js',[]],['test-d3d9-pipeline-web.js',[]],
  ['test-d3d9-shader-web.js',[],{D3D9_WEBGL_VERSION:'1'}],
  ['test-d3d9-shader-web.js',[],{D3D9_WEBGL_VERSION:'2'}],
  ['test-d3dim-gps-boids.js',[]],['test-d3dim-render-worker-web.js',['--no-sandbox','--swiftshader']],
];
try{
  for(const [index,[file,args,extraEnv]] of suites.entries()){
    const label=String(index+1).padStart(2,'0')+'-'+file.replace(/\.js$/,''),start=new Date().toISOString();
    const fd=fs.openSync(path.join(dir,label+'.log'),'w');let r;
    const env={...process.env,...extraEnv,PALETTE_WORKER_EVIDENCE:path.join(dir,'worker.json'),
      PALETTE_GPU_EVIDENCE:path.join(dir,'pixels.json')};
    try{r=cp.spawnSync('timeout',['--signal=TERM','--kill-after=10s','180s',process.execPath,'test/'+file,...args],
      {env,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
    const log=fs.readFileSync(path.join(dir,label+'.log'),'utf8');
    const record={file,args,extraEnv,start,end:new Date().toISOString(),exitCode:r.status,
      signal:r.signal,error:r.error?.message||null,skip:/^SKIP\b/m.test(log)};
    results.push(record);save('status.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(record));
    if(r.status!==0||record.skip)console.log(log.split('\n').slice(-25).join('\n'));
  }
}finally{
  const hashes={};for(const name of fs.readdirSync(dir).sort())if(name!=='artifacts.sha256.json')
    hashes[name]=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex');
  save('artifacts.sha256.json',JSON.stringify(hashes,null,2)+'\n');
}
process.exitCode=results.some(r=>r.exitCode!==0||r.skip)?1:0;
