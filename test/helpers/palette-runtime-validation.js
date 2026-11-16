#!/usr/bin/env node
'use strict';
// Requires the serialized build/browser slot. Run from the candidate root.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const dir=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('usage: node test/helpers/palette-runtime-validation.js NEW_EVIDENCE_DIR');
fs.mkdirSync(dir);
const save=(name,value)=>fs.writeFileSync(path.join(dir,name),value);
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'});
const results=[];
let failed=false;
function run(label,seconds,command,args,env=process.env){
  const start=new Date().toISOString(),fd=fs.openSync(path.join(dir,label+'.log'),'w');
  save(label+'.command.json',JSON.stringify({command,args,timeoutSeconds:seconds},null,2)+'\n');
  let result;
  try{result=cp.spawnSync('timeout',['--signal=TERM','--kill-after=10s',seconds+'s',command,...args],
    {env,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
  const record={label,start,end:new Date().toISOString(),exitCode:result.status,
    signal:result.signal,error:result.error?.message||null};
  results.push(record);save('status.json',JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(record));
  if(result.status!==0){failed=true;console.log(fs.readFileSync(path.join(dir,label+'.log'),'utf8').split('\n').slice(-25).join('\n'));}
  return result.status===0;
}
try{
  save('source-head.txt',git('rev-parse','HEAD'));
  const status=git('status','--short');save('source-status.txt',status);
  save('source.patch',git('diff','--binary','HEAD'));
  if(status)throw Error('Candidate must be clean before validation');
  save('environment.json',JSON.stringify({node:process.version,platform:process.platform,
    arch:process.arch,chrome:process.env.CHROME||'/usr/bin/chromium'},null,2)+'\n');
  if(run('build',600,'bash',['tools/build.sh'])){
    save('production-module.sha256',crypto.createHash('sha256').update(fs.readFileSync('build/wine-assembly.wasm')).digest('hex')+'\n');
    for(const [label,file] of [['palette-lifetime','test-d3dim-palette-alpha-page-watch.js'],
      ['device7-load','test-d3dim-device7-load.js'],['indexed-texture','test-d3dim-indexed-texture.js'],
      ['software-raster','test-gl-software-raster.js']])run(label,240,process.execPath,['test/'+file]);
    // GPU pixels: the WAT producer (test-d3dim-gps-palette.js) replaced the
    // deleted JS executor's browser fixture test-d3dim-palette-gpu-web.js.
    run('gpu-pixels',360,process.execPath,['test/test-d3dim-gps-palette.js']);
  }
}catch(error){failed=true;save('driver-error.txt',error.stack+'\n');console.error(error);}
finally{
  const hashes={};for(const name of fs.readdirSync(dir).sort())if(name!=='artifacts.sha256.json')
    hashes[name]=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex');
  save('artifacts.sha256.json',JSON.stringify(hashes,null,2)+'\n');
}
process.exitCode=failed?1:0;
