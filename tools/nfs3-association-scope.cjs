'use strict';
// Keep the native supervisor and its actual waits outside the submitting
// command's lifetime. The driver, browser and guest still have finite custody.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),c=require('./native-supervisor-common.cjs');
const {identity,retain}=require('./aow2-durable-launcher.cjs');
const np=require('./native-proc.cjs'),root=path.resolve(__dirname,'..');
function launch({run,driver,args=[],duration=900,cleanup=920,env={}}){
  run=path.resolve(run);driver=path.resolve(driver);
  assert(duration>0&&duration<=900&&cleanup>duration+5&&cleanup<=920);
  assert(c.freeBytes()>1500000000);assert(fs.statSync(driver).isFile());
  assert(args.every(a=>typeof a==='string'));
  fs.mkdirSync(run,{recursive:true});const at=c.now();
  c.save(run,'config.json',{driver,args,env,at,deadline:at+duration,
    cleanupDeadline:at+cleanup,reserveSeconds:180,gameplayCutoff:at+duration-180});
  const out=fs.openSync(path.join(run,'owner.stdout.log'),'wx');
  const err=fs.openSync(path.join(run,'owner.stderr.log'),'wx');
  try{
    const p=cp.spawn(process.execPath,[__filename,'owner',run],{
      cwd:root,detached:true,stdio:['ignore',out,err]});
    const row={...identity(p.pid),detached:true,submitter:identity(process.pid)};
    c.save(run,'owner-process.json',row);
    p.unref();return row;
  }finally{fs.closeSync(out);fs.closeSync(err);}
}
async function watchdog(run,cfg){
  c.save(run,'watchdog-armed.json',{...identity(process.pid),deadline:cfg.cleanupDeadline,
    independent:true,diskFloor:1500000000});
  let minimum=Infinity,reason=null;const known=new Map();
  for(;;){
    minimum=Math.min(minimum,c.freeBytes());const rows=np.processes();
    const nativeFile=path.join(run,'native-process.json');
    if(c.exists(nativeFile)){const p=c.readJSON(nativeFile);known.set(p.pid,p.startToken);}
    for(let i=0;i<8;i++)for(const row of rows)
      if(known.has(row.ppid)&&known.get(row.ppid)===rows.find(p=>p.pid===row.ppid)?.startToken)
        known.set(row.pid,row.startToken);
    if(c.exists(path.join(run,'watchdog-cancel'))){
      c.save(run,'watchdog-result.json',{minimum,reason,cancelled:true});return;
    }
    if(!reason&&minimum<1500000000){reason='disk-floor';
      const p=c.readJSON(path.join(run,'native-process.json'));
      if(np.token(p.pid)===p.startToken)process.kill(p.pid,'SIGTERM');
    }
    if(c.now()>=cfg.cleanupDeadline){reason||='independent-deadline';const killed=[];
      for(const [pid,token]of known)try{
        if(np.token(pid)===token){process.kill(pid,'SIGKILL');killed.push({pid,token});}
      }catch(error){if(!['ENOENT','ESRCH'].includes(error.code))throw error;}
      c.save(run,'watchdog-result.json',{minimum,reason,killed,cancelled:false});return;
    }
    await c.sleep(50);
  }
}
async function owner(run,cfg){
  const w=cp.spawn(process.execPath,[__filename,'watchdog',run],{
    detached:true,stdio:['ignore','pipe','pipe']}),ww=retain(w,run,'watchdog');
  while(!c.exists(path.join(run,'watchdog-armed.json')))await c.sleep(10);
  const p=cp.spawn(process.execPath,[path.join(root,'tools/native-supervise.cjs'),
    path.join(run,'native'),String(cfg.deadline),String(cfg.cleanupDeadline),
    '--',process.execPath,cfg.driver,...cfg.args],{cwd:root,
    env:{...process.env,...cfg.env,NFS_SCOPE_RUN:run,
      NFS_NATIVE_DEADLINE:String(cfg.deadline),NFS_GAMEPLAY_CUTOFF:String(cfg.gameplayCutoff)},
    stdio:['ignore','pipe','pipe']});
  const wait=retain(p,run,'native');
  let cancelled=false;
  const cancel=setInterval(()=>{if(!cancelled&&c.exists(path.join(run,'cancel-request.json'))){
    cancelled=true;p.kill('SIGTERM');}},50);
  const onSignal=()=>p.kill('SIGTERM');process.on('SIGTERM',onSignal);
  try{
    const native=await wait;fs.writeFileSync(path.join(run,'watchdog-cancel'),'');
    const watchdog=await ww;c.save(run,'owner-complete.json',{native,watchdog,
      actualWaits:true,at:c.now()});process.exitCode=native.exit??1;
  }finally{clearInterval(cancel);process.removeListener('SIGTERM',onSignal);}
}
module.exports={launch};
if(require.main===module){const [mode,run]=process.argv.slice(2),cfg=c.readJSON(path.join(run,'config.json'));
  (mode==='owner'?owner(run,cfg):watchdog(run,cfg)).catch(error=>{console.error(error);process.exitCode=1;});
}
