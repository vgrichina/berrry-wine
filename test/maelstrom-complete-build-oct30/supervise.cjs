'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
process.chdir('/tmp/maelbuild');
const M=1048576, node='/home/user/.nvm/versions/node/v24.22.1/bin/node';
function allocated(p){let n=fs.lstatSync(p).blocks*512;if(fs.lstatSync(p).isDirectory())for(const f of fs.readdirSync(p))n+=allocated(p+'/'+f);return n;}
const available=()=>Number(fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m)[1])*1024;
const pre={at:new Date().toISOString(),MemAvailable:available(),allocated:allocated('.'),projectedPeak:4352*M,floor:2048*M,diskBudget:256*M,reserve:16*M,node,nodeSHA256:crypto.createHash('sha256').update(fs.readFileSync(node)).digest('hex'),limits:fs.readFileSync('/proc/self/limits','utf8')};
fs.writeFileSync('runtime-preflight.json',JSON.stringify(pre,null,2));
if(pre.MemAvailable<pre.projectedPeak+pre.floor||pre.allocated>240*M)throw Error('remote admission rejected');
const startup=process.argv.includes('--startup');
const args=startup?['--max-old-space-size=3072','-e','console.log(JSON.stringify({node:process.execPath,versions:process.versions,limits:require("fs").readFileSync("/proc/self/limits","utf8"),memory:process.memoryUsage()}))']:['--max-old-space-size=3072','build.cjs'];
const out=fs.openSync(startup?'startup.stdout':'runtime.stdout','w'),err=fs.openSync(startup?'startup.stderr':'runtime.stderr','w');
const env={...process.env};delete env.NODE_OPTIONS;
const child=cp.spawn('/bin/bash',['-c','ulimit -t 180; ulimit -f 65536; exec "$@"','remote-child',node,...args],{cwd:'/tmp/maelbuild',env,stdio:['ignore',out,err],detached:true});
const begin=Date.now();let peak=0,parentPeak=0,reason=null;
const timer=setInterval(()=>{try{
 const rows=new Map();for(const p of fs.readdirSync('/proc').filter(p=>/^\d+$/.test(p)))try{const s=fs.readFileSync('/proc/'+p+'/stat','utf8').split(') ').pop().split(' ');rows.set(+p,{parent:+s[1],rss:+s[21]*4096});}catch{}
 const ids=new Set([child.pid]);let size;do{size=ids.size;for(const [p,r]of rows)if(ids.has(r.parent))ids.add(p);}while(size!==ids.size);
 const rss=[...ids].reduce((n,p)=>n+(rows.get(p)?.rss||0),0);peak=Math.max(peak,rss);parentPeak=Math.max(parentPeak,process.memoryUsage().rss);
 if(rss>4096*M)reason='groupRSS';else if(parentPeak>256*M)reason='parentRSS';else if(Date.now()-begin>300000)reason='wall';else if(fs.fstatSync(out).size+fs.fstatSync(err).size>65536)reason='capture';else if(allocated('.')>256*M)reason='disk';
 if(reason)process.kill(-child.pid,'SIGKILL');
}catch(e){reason=String(e);try{process.kill(-child.pid,'SIGKILL');}catch{}}},100);
child.on('exit',(code,signal)=>{clearInterval(timer);const rec={code,signal,reason,peakGroupRSS:peak,peakParentRSS:parentPeak,elapsedMs:Date.now()-begin,allocated:allocated('.'),MemAvailable:available(),startup};fs.writeFileSync(startup?'startup-receipt.json':'runtime-receipt.json',JSON.stringify(rec,null,2));console.log(JSON.stringify(rec));process.exitCode=reason||code?1:0;});
