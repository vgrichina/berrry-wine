'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const h=require('./simgolf-native-hole-driver.cjs');
if(process.argv[2]==='fixture'){
 const [dir,mode]=process.argv.slice(3),http=require('node:http');
 if(mode==='exit')process.exit(17);
 if(mode==='silent')setInterval(()=>{},1000);
 else {
  const server=http.createServer((req,res)=>{
   if(mode==='hang')return;
   res.end(JSON.stringify({Browser:'fixture',webSocketDebuggerUrl:'ws://127.0.0.1:'+server.address().port+'/devtools/browser/'+(mode==='wrong'?'other':'test')}));
  });server.listen(0,'127.0.0.1',()=>{
   const publish=()=>fs.writeFileSync(dir+'/DevToolsActivePort',server.address().port+'\n/devtools/browser/test\n');
   fs.writeFileSync(dir+'/DevToolsActivePort','partial');
   setTimeout(publish,mode==='delayed'?11000:30);
  });
 }
 return;
}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'simgolf-endpoint-')),results=[];
 try{
  const source=h.compose(path.resolve(__dirname,'..'));
  assert(source.includes("save('chrome-launch.json'"));assert(!source.includes('i<100&&!fs.existsSync(active)'));
  const a=source.indexOf('const {debugPort,debugPath}=await simgolf.waitChromeEndpoint('),b=source.indexOf('\n ws=new WebSocket',a);assert(a>=0&&b>a);
  for(const mode of ['delayed','silent','exit','wrong','hang','cancel','spawn-error']){
   const profile=dir+'/'+mode;fs.mkdirSync(profile);
   const child=mode==='spawn-error'?cp.spawn('/nonexistent-simgolf-chrome',[]):cp.spawn(process.execPath,[__filename,'fixture',profile,mode==='cancel'?'silent':mode],{stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';child.stdout?.on('data',b=>stdout+=b);child.stderr?.on('data',b=>stderr+=b);
   const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
   const records=[],budget=mode==='delayed'?15000:mode==='exit'||mode==='spawn-error'?2000:600;
   const start=performance.now();let checks=0,endpoint=null;
   const scope={simgolf:h,browser:child,out:dir,deadline:Date.now()+budget+120000,Math,Date,chromeEndpointReady:false,guard:{check(){checks++;if(mode==='cancel'&&checks>1)throw Error('cancelled');}},log:(name,v)=>{assert.equal(name,'chrome-startup.jsonl');records.push(v);},save:(name,v)=>{assert.equal(name,'endpoint.json');endpoint=v;}};
   // Execute the actual generated startup seam with its owning caller guard.
   const seam=source.slice(a,b).replace("out+'/chrome-profile'",JSON.stringify(profile)).replace('Date.now()+60000','Date.now()+'+budget);
   vm.createContext(scope);
   try{
    const call=vm.runInContext('(async()=>{'+seam+'})()',scope);
    if(mode==='delayed'){await call;assert(scope.chromeEndpointReady&&endpoint);assert(performance.now()-start>10000);assert(records.some(v=>v.phase==='poll'&&v.last.includes('invalid')));assert.equal(records.at(-1).phase,'ready');}
    else {await assert.rejects(call,mode==='exit'?/exited/:mode==='spawn-error'?/ENOENT/:mode==='cancel'?/cancelled/:/deadline/);assert.equal(endpoint,null);assert.equal(scope.chromeEndpointReady,false);assert.equal(records.at(-1).phase,'failed');}
   }finally{
    if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
    const join=await joined;assert(performance.now()-start<budget+2000);results.push({mode,elapsedMs:performance.now()-start,terminal:records.at(-1),join,stdout,stderr});
   }
  }
  console.log(JSON.stringify({passed:true,actualGeneratedSeam:true,results}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
