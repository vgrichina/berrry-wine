'use strict';
// A private X display only. Never inherits DISPLAY or connects to a desktop.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function child(out,name,command,args,env=process.env){
  const p=cp.spawn(command,args,{env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  const joined=new Promise(resolve=>p.once('close',(code,signal)=>{
    fs.writeFileSync(`${out}/${name}-wait.json`,JSON.stringify({pid:p.pid,code,signal,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded,stdout,stderr},null,2)+'\n',{flag:'wx'});resolve({code,signal,stdout,stderr});
  }));return {p,joined};
}
async function stop(c){if(!c)return;if(c.p.exitCode===null&&c.p.signalCode===null){c.p.kill('SIGTERM');const t=setTimeout(()=>c.p.kill('SIGKILL'),3000);await c.joined;clearTimeout(t);}else await c.joined;}
async function start(out){
  let number;for(let n=0;n<100;n++){const v=400+crypto.randomInt(30000);if(!fs.existsSync('/tmp/.X'+v+'-lock')&&!fs.existsSync('/tmp/.X11-unix/X'+v)){number=v;break;}}assert(number);
  const display=':'+number,auth=out+'/Xauthority',cookie=crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(auth,'',{mode:0o600,flag:'wx'});cp.execFileSync('xauth',['-f',auth,'add',display,'MIT-MAGIC-COOKIE-1',cookie]);
  const env={...process.env,DISPLAY:display,XAUTHORITY:auth};delete env.WAYLAND_DISPLAY;
  const args=[display,'-screen','0','1280x1024x24','-nolisten','tcp','-auth',auth,'-noreset'];
  const x=child(out,'xvfb','Xvfb',args,env);let wm;
  try{
    const deadline=Date.now()+5000;while(!fs.existsSync('/tmp/.X11-unix/X'+number)){assert(Date.now()<deadline&&x.p.exitCode===null,'private display startup');await sleep(20);}
    const info=cp.execFileSync('xdpyinfo',[],{env,encoding:'utf8',timeout:3000});fs.writeFileSync(out+'/xdpyinfo.txt',info,{flag:'wx'});
    const denied=cp.spawnSync('xdpyinfo',[],{env:{...env,XAUTHORITY:'/dev/null'},encoding:'utf8',timeout:1000});
    assert(denied.status!==0,'private X display must reject unauthenticated clients');
    fs.writeFileSync(out+'/xauth-negative.json',JSON.stringify({code:denied.status,signal:denied.signal,stderr:denied.stderr,unauthenticatedDenied:true},null,2)+'\n',{flag:'wx'});
    wm=child(out,'openbox','openbox',['--sm-disable'],env);
    fs.writeFileSync(out+'/display.json',JSON.stringify({display,pid:x.p.pid,args,wmPid:wm.p.pid,private:true,tcp:false,authMode:fs.statSync(auth).mode&0o777,width:1280,height:1024,hardware:false},null,2)+'\n',{flag:'wx'});
    return {env,display,async close(){await stop(wm);await stop(x);fs.unlinkSync(auth);fs.writeFileSync(out+'/display-closed.json',JSON.stringify({at:Date.now(),socketAbsent:!fs.existsSync('/tmp/.X11-unix/X'+number),lockAbsent:!fs.existsSync('/tmp/.X'+number+'-lock'),authAbsent:!fs.existsSync(auth)},null,2)+'\n',{flag:'wx'});}};
  }catch(e){await stop(wm);await stop(x);fs.rmSync(auth,{force:true});throw e;}
}
function rootCapture(out,name,env){
  const at=Date.now();cp.execFileSync('xwd',['-root','-silent','-out',`${out}/${name}.xwd`],{env,timeout:3000});
  const b=fs.readFileSync(`${out}/${name}.xwd`);fs.writeFileSync(`${out}/${name}.json`,JSON.stringify({at,elapsed:Date.now()-at,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),route:'XGetImage root window; entire private display',reviewed:false},null,2)+'\n',{flag:'wx'});
}
module.exports={start,stop,rootCapture};
