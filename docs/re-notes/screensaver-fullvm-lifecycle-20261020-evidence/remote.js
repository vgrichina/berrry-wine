const fs=require('fs'),cp=require('child_process');
const r=cp.spawnSync('boat',['exec','bx_6czhvg6m','--timeout','180','--','node','-e',fs.readFileSync(process.argv[2],'utf8')],{encoding:'utf8',maxBuffer:4*1048576});
fs.writeFileSync(__dirname+'/'+process.argv[3],r.stdout||JSON.stringify({status:r.status,stderr:r.stderr}));
const v=JSON.parse(r.stdout);console.log(v.stdout);console.error(v.stderr||'');if(v.exitCode!==0)process.exitCode=1;
