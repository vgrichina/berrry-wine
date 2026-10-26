'use strict';
const fs=require('fs'),cp=require('child_process'),path=require('path');
const H='/tmp/thps2-installed-demo-gameplay-api-oct26', O=H+'/ops', E=H+'/guest';
const args=JSON.parse(fs.readFileSync(O+'/guest-args.json'));
const schedule=JSON.parse(fs.readFileSync(O+'/input-timeline.json'));
const log=fs.openSync(E+'/output.log','a');fs.writeSync(log,'[supervisor] append bootstrap verified\n');
const start=Date.now(),events=[];let reason='natural',ending=false,peakRSS=0;
const p=cp.fork(args[2],args.slice(3),{execPath:args[0],execArgv:[args[1],`--require=${O}/capture.cjs`],cwd:H+'/runner',env:process.env,detached:true,stdio:['ignore',log,log,'ipc']});
function group(){const out=[];for(const d of fs.readdirSync('/proc'))if(/^\d+$/.test(d)){try{const s=fs.readFileSync('/proc/'+d+'/stat','utf8');const a=s.slice(s.lastIndexOf(')')+2).split(' ');if(+a[2]===p.pid)out.push(+d);}catch{}}return out;}
function stop(why){if(ending)return;ending=true;reason=why;try{process.kill(-p.pid,'SIGTERM')}catch{};setTimeout(()=>{try{process.kill(-p.pid,'SIGKILL')}catch{}},700).unref();}
const timers=schedule.map(e=>setTimeout(()=>{if(!ending&&p.connected){const at=Date.now();p.send({t:'go'});events.push({...e,sentAt:new Date(at).toISOString(),elapsedMs:at-start});}},e.ms));
const monitor=setInterval(()=>{
 let rss=0;for(const pid of group()){try{rss+=+fs.readFileSync(`/proc/${pid}/status`,'utf8').match(/VmRSS:\s+(\d+)/)[1]*1024}catch{}}
 peakRSS=Math.max(rss,peakRSS);
 const n=fs.statSync(E+'/output.log').size, png=fs.readdirSync(E).filter(x=>x.endsWith('.png')).reduce((n,f)=>n+fs.statSync(E+'/'+f).size,0);
 const mem=+fs.readFileSync('/proc/meminfo','utf8').match(/MemAvailable:\s+(\d+)/)[1]*1024;
 if(Date.now()-start>=88000||Date.now()>=Date.parse('2026-10-26T19:10:00Z'))stop('wall-cutoff');
 else if(n>=131072||n+png>2097152)stop('output-guard');
 else if(rss>2147483648||mem<805306368)stop('physical-memory-guard');
 else{const fd=fs.openSync(E+'/output.log','r'),b=Buffer.alloc(Math.min(n,8192));fs.readSync(fd,b,0,b.length,Math.max(0,n-b.length));fs.closeSync(fd);if(/UNIMPLEMENTED API:|\*\*\* CRASH|RuntimeError:|\[capture\] TERMINAL/.test(b.toString()))stop('first-real-failure');}
},40);
p.on('exit',(code,signal)=>{ending=true;for(const t of timers)clearTimeout(t);clearInterval(monitor);try{process.kill(-p.pid,'SIGKILL')}catch{};
 setTimeout(()=>{const remaining=group();fs.closeSync(log);fs.writeFileSync(E+'/terminal.json',JSON.stringify({code,signal,reason,elapsedMs:Date.now()-start,peakRSS,events,remaining,box:'bx_xfbwmcty',leaveRunning:true,expiry:'2026-10-26T19:29:32Z'},null,2));process.exit(remaining.length?2:0);},200);});
