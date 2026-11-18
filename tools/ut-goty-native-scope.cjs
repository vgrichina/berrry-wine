'use strict';
// UT preparation and original scopes: one native process tree, actual pipe EOF
// receipts, a 900-second supervisor and independent 920-second disk watchdog.
// The retainer stays alive on TERM until its real child closes both pipes.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),c=require(root+'/tools/native-supervisor-common.cjs'),out=path.resolve(process.argv[3]||__dirname),mode=process.argv[2];
const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
function retain(child,name){const stdout=fs.createWriteStream(path.join(out,name+'.stdout')),stderr=fs.createWriteStream(path.join(out,name+'.stderr'));child.stdout.pipe(stdout);child.stderr.pipe(stderr);return new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',async(code,signal)=>{const row={pid:child.pid,code,signal,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded};await Promise.all([new Promise(r=>stdout.end(r)),new Promise(r=>stderr.end(r))]);save(name+'-wait.json',row);resolve(row);});});}
(async()=>{
if(mode==='start'){
 fs.mkdirSync(out,{recursive:true});const cfg=JSON.parse(fs.readFileSync(path.join(out,'config.json'))),at=Date.now()/1000;
 if(!Array.isArray(cfg.args)||!cfg.args.length||cfg.args.some(x=>typeof x!=='string')||cfg.policy)throw Error('args required; policy overrides forbidden');
 if(c.freeBytes()<1500000000)throw Error('disk floor');save('launch.json',{at,deadline:at+900,gameplayCutoff:at+720,reserveSeconds:180,nativeScene:true,bindingContract:'native-reviewed-context-v1',inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:15,menuFreshnessSeconds:30}});
 const stdio=['ignore',fs.openSync(path.join(out,'owner.stdout'),'wx'),fs.openSync(path.join(out,'owner.stderr'),'wx')];const p=cp.spawn(process.execPath,[__filename,'owner',out],{cwd:root,detached:true,stdio});save('owner-pid.json',{pid:p.pid,startToken:c.token(p.pid)});p.unref();console.log(p.pid);return;
}
if(mode==='native'){
 const cfg=JSON.parse(fs.readFileSync(path.join(out,'config.json')));const p=cp.spawn(process.execPath,cfg.args,{cwd:root,env:{...process.env,WINE_COM_PROTOCOL_DIR:out},stdio:['ignore','pipe','pipe']});save('native-pid.json',{pid:p.pid,startToken:c.token(p.pid),at:c.now()});const wait=retain(p,'native');for(const sig of ['SIGTERM','SIGINT','SIGHUP'])process.on(sig,()=>{if(p.exitCode===null&&p.signalCode===null)p.kill(sig);});let killed=false;const t=setInterval(()=>{if(!killed&&fs.existsSync(path.join(out,'cancel-request.json'))){killed=true;p.kill('SIGTERM');setTimeout(()=>{if(p.exitCode===null&&p.signalCode===null)p.kill('SIGKILL');},1000).unref();}},100);try{const row=await wait;process.exitCode=row.code||0;}finally{clearInterval(t);}return;
}
if(mode==='watch'){
 const launch=JSON.parse(fs.readFileSync(path.join(out,'launch.json')));let minFree=c.freeBytes(),why;
 while(true){minFree=Math.min(minFree,c.freeBytes());if(fs.existsSync(path.join(out,'supervisor-wait.json'))){why='actual-supervisor-wait';break;}if(c.now()>=launch.at+920||minFree<1500000000){why=minFree<1500000000?'disk-floor':'independent920deadline';const target=JSON.parse(fs.readFileSync(path.join(out,'supervisor-pid.json')));if(c.token(target.pid)===target.startToken)process.kill(target.pid,'SIGTERM');break;}await c.sleep(100);}
 save('watchdog-end.json',{why,minFree,at:c.now()});return;
}
if(mode==='owner'){
 const launch=JSON.parse(fs.readFileSync(path.join(out,'launch.json')));
 const p=cp.spawn(process.execPath,[root+'/tools/native-supervise.cjs',out+'/containment',String(launch.at+900),String(launch.at+940),'--',process.execPath,__filename,'native',out],{cwd:root,stdio:['ignore','pipe','pipe']});save('supervisor-pid.json',{pid:p.pid,startToken:c.token(p.pid)});const wait=retain(p,'supervisor');
 const w=cp.spawn(process.execPath,[__filename,'watch',out],{cwd:root,stdio:['ignore','pipe','pipe']});const ww=retain(w,'watchdog');const results=await Promise.all([wait,ww]);save('owner-complete.json',{results,at:c.now()});return;
}
throw Error('mode');
})().catch(e=>{console.error(e);process.exitCode=1;});

