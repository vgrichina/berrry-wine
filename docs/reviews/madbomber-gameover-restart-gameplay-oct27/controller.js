// Adapted from retained controller2.js; production runner and guest are unchanged.
const fs=require('fs'),cp=require('child_process');
const base='/home/user/madbomber-restart-oct27',root=base+'/runner',out=base+'/out';fs.mkdirSync(out);
const flags=['--max-old-space-size=512'];
const args=[...flags,'test/run.js','--app=madbomber','--no-build','--wasm='+root+'/build/wine-assembly.wasm','--quiet-api','--no-close','--no-threads','--real-ticks','--time-scale=1','--real-calendar','--tz=UTC','--batch-size=200000','--max-batches=10000000','--max-seconds=120','--control-stdin','--trace-input','--png='+out+'/final.png'];
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('WA_')&&!k.startsWith('WINE_')&&!['NODE_OPTIONS','NODE_PATH'].includes(k)));
const inputs=[[4,{cmd:'keydown:13'}],[4.15,{cmd:'keyup:13'}],[6,{cmd:'mousemove:532:400'}],[7,{cmd:'keydown:32'}],[7.15,{cmd:'keyup:32'}],[8.5,{cmd:'mousemove:470:400'}],[9,{cmd:'mousemove:408:400'}],[9.5,{cmd:'mousemove:346:400'}],[11,{cmd:'mousemove:0:400'}],[16,{cmd:'keydown:32'}],[16.15,{cmd:'keyup:32'}],[26,{cmd:'keydown:32'}],[26.15,{cmd:'keyup:32'}]];
fs.writeFileSync(out+'/launch.json',JSON.stringify({startedAt:new Date().toISOString(),root,args,inputs,capturePlan:{maximum:8,perImage:4194304,total:16777216,reserved:['GameOver','reset','resumedPlay','resumedCatch','final']},logCap:1835008,guestSeconds:120,supervisorSeconds:150},null,2));
const fd=fs.openSync(out+'/output.log','wx'),rf=fs.openSync(out+'/input-receipts.jsonl','wx');
const child=cp.spawn(process.execPath,args,{cwd:root,env,detached:true,stdio:['pipe','pipe','pipe']});fs.writeFileSync(out+'/pid.json',JSON.stringify({controller:process.pid,guest:child.pid}));
const start=performance.now();let bytes=0,reason=null,captures=0,seen=new Set();
const send=o=>{if(o.action==='png'){if(++captures>7)throw Error('capture reservation exhausted');o.path=out+'/'+o.name+'.png';delete o.name;}const rec={at:new Date().toISOString(),elapsedMs:performance.now()-start,command:o,writable:!child.stdin.destroyed};fs.writeSync(rf,JSON.stringify(rec)+'\n');if(rec.writable)child.stdin.write(JSON.stringify(o)+'\n');};
child.stdin.on('error',()=>{});const kill=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
const log=b=>{fs.writeSync(fd,b.subarray(0,Math.max(0,1835008-bytes)));bytes+=b.length;if(bytes>=1835008){reason='log cap';kill();}};child.stdout.on('data',log);child.stderr.on('data',log);
const timers=inputs.map(([s,o])=>setTimeout(()=>send(o),s*1000));
const poll=setInterval(()=>{for(const n of fs.readdirSync(base+'/commands').sort()){if(seen.has(n))continue;seen.add(n);const commands=JSON.parse(fs.readFileSync(base+'/commands/'+n));for(const [delay,o] of commands)timers.push(setTimeout(()=>send(o),delay));}},50);
timers.push(setTimeout(()=>send({action:'png',name:'initial-catch'}),10000));
timers.push(setTimeout(()=>{reason='120s allowance exhausted';kill();},120000));
child.on('close',(code,signal)=>{timers.forEach(clearTimeout);clearInterval(poll);fs.closeSync(fd);fs.closeSync(rf);kill();let groupAbsent;try{process.kill(-child.pid,0);groupAbsent=false;}catch{groupAbsent=true;}const terminal={finishedAt:new Date().toISOString(),elapsedMs:performance.now()-start,code,signal,reason,bytes,captures,groupAbsent};fs.writeFileSync(out+'/terminal.json',JSON.stringify(terminal,null,2));console.log(JSON.stringify(terminal));});
