'use strict';
// Process/listener identity primitives shared by the Node ports of the native
// controllers and runtimes (Neverhood, VB5 CCE, Half-Life 2, Caesar III).
//
// Linux keeps the exact /proc reads the Python originals made (stat field 22
// start token, boot_id, /proc/net/tcp listener inode owned through the
// process's fd table). macOS has no /proc: identity is `ps` lstart plus
// kern.boottime (the same choice as lib/cli-child-observation.js identity()),
// and listener ownership is netstat -anv (pid + socket gencnt) for the one LISTEN socket.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {identity}=require('../lib/cli-child-observation');
const linux=process.platform==='linux';

function noProcess(pid){const e=Error('no such process: '+pid);e.code='ESRCH';return e;}
function statFields(pid){
  let s;
  try{s=fs.readFileSync(`/proc/${pid}/stat`,'utf8');}
  catch(e){if(e.code==='ENOENT')throw noProcess(pid);throw e;}
  return s.slice(s.lastIndexOf(')')+2).split(/\s+/);
}
function psRow(pid,fields){
  let row;
  try{row=cp.execFileSync('ps',['-o',fields,'-p',String(pid)],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
  catch{throw noProcess(pid);}
  if(!row)throw noProcess(pid);
  return row;
}
// Start token: an opaque string that changes when the numeric PID is reused.
function token(pid){
  if(linux)return statFields(pid)[19];
  return psRow(pid,'lstart=');
}
// One-letter scheduler state ('R','S','Z',...).
function state(pid){
  if(linux)return statFields(pid)[0];
  return psRow(pid,'stat=')[0];
}
function parentPid(pid){
  if(linux)return Number(statFields(pid)[1]);
  return Number(psRow(pid,'ppid='));
}
function pgid(pid){
  if(linux)return Number(statFields(pid)[2]);
  return Number(psRow(pid,'pgid='));
}
// Kernel session id (os.getsid). macOS ps exposes only a session pointer, not
// the id, so this is null there; a setsid child is also its own group leader.
function sid(pid){
  if(linux)return Number(statFields(pid)[3]);
  return null;
}
// Another process's environment entries; null where the OS will not show them
// (macOS ps -E and KERN_PROCARGS2 omit other processes' environments).
function environ(pid){
  if(!linux)return null;
  let b;
  try{b=fs.readFileSync(`/proc/${pid}/environ`);}
  catch(e){if(e.code==='ENOENT')throw noProcess(pid);throw e;}
  return b.toString('latin1').split('\0');
}
// One snapshot of every visible process: [{pid,ppid,pgid,sid,state,startToken}].
// Linux reads /proc/<pid>/stat; macOS takes one `ps -A` (sid is null there).
function processes(){
  const rows=[];
  if(linux){
    for(const n of fs.readdirSync('/proc')){
      if(!/^\d+$/.test(n))continue;
      try{const f=statFields(n);rows.push({pid:Number(n),ppid:Number(f[1]),pgid:Number(f[2]),sid:Number(f[3]),state:f[0],startToken:f[19]});}
      catch(e){if(!['ESRCH','ENOENT','EACCES','EPERM'].includes(e.code))throw e;}
    }
    return rows;
  }
  const out=cp.execFileSync('ps',['-A','-o','pid=,ppid=,pgid=,stat=,lstart='],{encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:1<<26});
  for(const line of out.split('\n')){
    const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*?)\s*$/.exec(line);
    if(m)rows.push({pid:Number(m[1]),ppid:Number(m[2]),pgid:Number(m[3]),sid:null,state:m[4][0],startToken:m[5]});
  }
  return rows;
}
function exists(pid){
  if(linux)return fs.existsSync(`/proc/${pid}`);
  try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}
}
function alive(pid){try{return !['Z','X'].includes(state(pid));}catch{return false;}}
function bootId(){
  if(linux)return fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();
  return cp.execFileSync('sysctl',['-n','kern.boottime'],{encoding:'utf8'}).trim();
}
// {pid,startToken,bootId} for a live process; refuses a zombie.
function processIdentity(pid=process.pid){return identity(pid);}

// Exactly one 127.0.0.1:port LISTEN socket exists and the process owns it.
// Returns {owned, inode|null, listeners}. Linux reads TCP before FDs, the
// order the originals require (a listener created between reads is not foreign).
function listener(pid,port){
  if(linux){
    const rows=fs.readFileSync('/proc/net/tcp','utf8').split('\n').slice(1).map(x=>x.trim().split(/\s+/)).filter(r=>r.length>9);
    const key='0100007F:'+port.toString(16).toUpperCase().padStart(4,'0');
    const matches=rows.filter(r=>r[1]===key&&r[3]==='0A').map(r=>r[9]);
    const sockets=new Set();
    let names=[];try{names=fs.readdirSync(`/proc/${pid}/fd`);}catch(e){if(e.code==='ENOENT')throw noProcess(pid);throw e;}
    for(const n of names){try{sockets.add(fs.readlinkSync(`/proc/${pid}/fd/${n}`));}catch{}}
    return {listeners:matches.length,inode:matches[0]??null,owned:matches.length===1&&sockets.has('socket:['+matches[0]+']')};
  }
  // `netstat -anv` (~80ms) carries the owning pid and the socket generation
  // count (the inode analogue); lsof costs most of a second per call here,
  // which would eat the controllers' sub-second request budgets.
  if(!exists(pid))throw noProcess(pid);
  const out=cp.execFileSync('netstat',['-anv','-p','tcp'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:1<<26});
  const lines=out.split('\n'),header=lines.find(l=>/\bpid\b/.test(l)&&/gencnt/.test(l));
  if(!header)throw Error('netstat -anv lacks pid/gencnt columns');
  const rows=lines.map(l=>l.trim().split(/\s+/)).filter(r=>r[0]==='tcp4'&&r[3]==='127.0.0.1.'+port&&r[5]==='LISTEN');
  return {listeners:rows.length,inode:rows.length===1?'gencnt:'+rows[0][12]:null,owned:rows.length===1&&Number(rows[0][8])===Number(pid)};
}
// Descriptors open in this process (Linux /proc/self/fd links; macOS /dev/fd).
function openFds(pid=process.pid){
  const dir=linux?`/proc/${pid}/fd`:'/dev/fd';
  const out=new Set();
  for(const n of fs.readdirSync(dir)){try{out.add(linux?fs.readlinkSync(path.join(dir,n)):n);}catch{}}
  return out;
}
// Linux run/wait scheduler nanoseconds; null where the kernel has no schedstat.
function schedstat(){
  if(!linux)return null;
  try{const s=fs.readFileSync('/proc/self/schedstat','utf8').split(/\s+/);return [Number(s[0]),Number(s[1])];}catch{return null;}
}
// Free bytes under /home on Linux (the originals' disk floor); home dir elsewhere.
function freeBytes(where=linux?'/home':os.homedir()){
  const s=fs.statfsSync(where);return s.bavail*s.bsize;
}
function killpg(pid,sig){process.kill(-pid,sig);}
// Signal a process group only while the leader still has the recorded token.
function killOwned(info,sig){
  try{if(token(info.pid)===info.startToken){killpg(info.pid,sig);return true;}}
  catch(e){if(!['ESRCH','ENOENT'].includes(e.code))throw e;}
  return false;
}
function sleepSync(ms){if(ms>0)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
const sleep=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
// Python time.time() / time.monotonic() equivalents, in seconds.
const now=()=>Date.now()/1000;
const monotonic=()=>Number(process.hrtime.bigint())/1e9;
module.exports={linux,token,state,parentPid,pgid,sid,environ,processes,exists,alive,bootId,processIdentity,listener,openFds,schedstat,freeBytes,killpg,killOwned,sleepSync,sleep,now,monotonic};
