// Run-local delayed HTTP fixture: actual production transport + guard, no guest claim.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const {createGuardedInput}=require(path.join(root,'lib/cli-guarded-input'));
const {startControlServer}=require(path.join(root,'lib/control-server'));
let batch=0,effects=[],requests=[],refs={queue:[]};
const record=(kind,extra={})=>effects.push({kind,at:Date.now(),...extra});
const guard=createGuardedInput({snapshot:()=>({healthy:true,refs}),cleanup:()=>record('UP')});
const ticker=setInterval(()=>batch++,10);
const transport=startControlServer({port:0,commandTimeoutMs:700,onCommand:c=>{
 requests.push({action:c.action||c.cmd,at:Date.now()});
 if(c.action==='snapshot')return {fixturePid:process.pid,batch,quit:false,eip:'0x1',mainHwnd:'0x1',screen:{w:1,h:1}};
 if(c.action==='guarded-bind')return guard.bind();
 if(c.action==='guarded-status')return guard.status(c.nonce);
 if(c.action==='guarded-release')return guard.release(c.owner);
 if(c.action==='guarded-input'){
   const parts=c.cmd.split(':'),key=Number(parts[1]);
   const t=guard.prepare(c.guard,parts[0]==='keydown'?{action:'keydown',code:key}:{action:parts[0],x:key,y:Number(parts[2])});
   const wait=guard.wait(t);
   setTimeout(()=>{
     const r=guard.consume(t,()=>record('DOWN',{nonce:c.guard.nonce}));
     record('consume-result',{receipt:r});
     // Native-like synchronous batches occupy the very event loop needed by
     // the UP HTTP request. A separate release process cannot bypass this.
     const busy=key===80?280:key===89?2250:0;
     if(busy){record('busy-start');const until=Date.now()+busy;while(Date.now()<until){};record('busy-end');}
   },key===37?4500:150);
   if(key===32){const dropped=new Promise(()=>{});dropped.cancel=wait.cancel;return dropped;}
   // Deadline case needs a longer HTTP wait; test sends it via separate action below.
   if(key===78){const delayed=wait.then(v=>new Promise(resolve=>setTimeout(()=>resolve(v),180)));delayed.cancel=wait.cancel;return delayed;}
   return wait;
 }
 if(c.action==='deadline-input'){
   const t=guard.prepare(c.guard,{action:'keydown',code:37});
   setTimeout(()=>record('expired-result',{receipt:guard.consume(t,()=>record('BAD_DOWN'))}),180);
   return guard.wait(t);
 }
 if(c.cmd?.startsWith('png:')){fs.writeFileSync(c.cmd.slice(4),Buffer.from('fixture-image'));return {batch,fixture:true};}
 if(c.action==='quit'){console.log(JSON.stringify({effects,requests}),'CONTROL_SUMMARY');guard.close();clearInterval(ticker);setTimeout(()=>{transport.close();process.exit(0)},20);return {normal:true};}
 throw Error('unsupported fixture action');
}});
setTimeout(()=>process.exit(2),40000).unref();

transport.server.on('listening',()=>{
 const p=path.join(process.cwd(),'fixture-endpoint.json');
 fs.writeFileSync(p+'.pending',JSON.stringify({pid:process.pid,port:transport.server.address().port}));
 fs.renameSync(p+'.pending',p);
});
