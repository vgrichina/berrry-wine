'use strict';
// Minimal reconstructed pre-body-collector entry. Keep the legacy amendment
// anchors verbatim: the production compose() must apply every amendment here.
// This is an offline contract fixture, not the deleted sealed Nov 5 driver.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {root:ROOT,sha,fonts,systemFiles,pins}=require('./return-fire-body-support.cjs'),RUN="/offline/return-fire-body-contract";
const {startStaticServer,closeServer}=require('../static-server.js');
const write=(dir,name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2));
async function main({mock=false,launch,review,delay}){
 const dir=mock?path.join(RUN,'mock-runtime'):path.join(RUN,'runtime');
 fs.mkdirSync(dir,{recursive:true});
 let browser,server,timer,closing,closed=false,firstFailure=null;
 const receipts=[],responses=[],pending=[],fallbacks=[];
 const record=(name,row)=>fs.appendFileSync(path.join(dir,name),JSON.stringify(row)+'\n');
 const failureState={get value(){return firstFailure;},set value(value){if(!firstFailure){
  firstFailure=JSON.parse(JSON.stringify(value));Object.freeze(firstFailure);
  write(dir,'first-failure.json',{firstFailure});
 }}};
 const checkFault=()=>{if(firstFailure)throw Error(JSON.stringify(firstFailure));};
 const cancelReceipts=reason=>{for(const receipt of receipts)receipt.cancel(reason);};
 const receiptSummary=()=>({complete:receipts.every(r=>!['pending','rejected-body','rejected-status','cancelled'].includes(r.row.receipt))&&receipts.length>0,receipts:receipts.map(r=>r.row)});
 const close=async()=>{if(closing)return closing;closing=(async()=>{
  if(!firstFailure&&receipts.some(r=>r.row.receipt==="pending"))failureState.value={boundary:'incomplete-http-receipts'};
  cancelReceipts("browser-close");
  if(browser)await browser.close();if(server)await closeServer(server);closed=true;
 })();return closing;};
 let retainedPin;
 try{
  const pin=pins(),byPath=new Map(pin.files.map(f=>[f.path,f]));
  retainedPin=pin;
  for(const expected of systemFiles()){
   const actual=byPath.get(expected.path);
   if(!actual||actual.bytes!==expected.bytes||actual.sha256!==expected.sha256){
    failureState.value={boundary:'system-data-pin-baseline-mismatch',path:expected.path};checkFault();
   }
  }
  server=await startStaticServer({root:ROOT,port:0});
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await launch({defaultViewport:null,args:['--no-sandbox']});
  const page=await browser.newPage();await page.setCacheEnabled(false);
  const cdp=await page.createCDPSession();
  cdp.on('Target.attachedToTarget',event=>{const session=cdp.connection().session(event.sessionId),identity={targetId:event.targetInfo.targetId,sessionId:event.sessionId,url:event.targetInfo.url,waitingForDebugger:event.waitingForDebugger};
   pending.push((async()=>{if(event.targetInfo.type==='worker')await session.send('Runtime.evaluate',{expression:'true'});
    await session.send('Runtime.runIfWaitingForDebugger');})().catch(error=>{failureState.value={boundary:'driver-error',error:String(error)};}));
  });
  await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  page.on('response',r=>{try{
   const url=new URL(r.url()),relative=decodeURIComponent(url.pathname).slice(1),status=r.status();
   const row={path:relative,status,receipt:'pending'};
   let settled=false;
   const complete=(receipt,extra={})=>{if(settled)return;settled=true;Object.assign(row,{receipt},extra);record('actual-http.jsonl',row);};
   receipts.push({row,cancel:reason=>complete('cancelled',{verified:false,reason})});
   const declaredSystem=systemFiles().some(f=>f.path===relative);
   if(declaredSystem&&url.search){complete('rejected-status',{verified:false});failureState.value={boundary:'unclassified-system-data-request',...row};return;}
   const optionalAbsent=status===404&&!url.search&&['favicon.ico','build-info.js'].includes(relative);
   if(optionalAbsent){complete('optional-absence',{policy:relative==='favicon.ico'?'implicit-browser-favicon-absent':'optional-build-info-absent',verified:false});return;}
   if(relative==='__bundle'){
    const requested=url.searchParams.getAll('f');
    if(status!==404||requested.length!==fonts.length||!fonts.every((f,i)=>requested[i]===f)){
     complete('rejected-status',{verified:false});failureState.value={boundary:'unclassified-bundle-request',...row};return;
    }
    fallbacks.push(()=>complete('optional-fallback',{verified:false}));return;
   }
   if(status!==200){complete('rejected-status',{verified:false});failureState.value={boundary:'actual-http-status',...row};return;}
   const done=(async()=>{try{
    const bytes=await r.buffer(),expected=byPath.get(relative);
    if(!expected||expected.bytes!==bytes.length||expected.sha256!==sha(bytes)){
     complete('rejected-body',{verified:false});failureState.value={boundary:'actual-http-body-mismatch',...row};return;
    }
    complete('verified',{verified:true,bytes:bytes.length,sha256:sha(bytes)});
   }catch(error){complete('rejected-body',{verified:false,error:String(error)});failureState.value={boundary:'http-receipt-error',...row};}})();responses.push(done);
  }catch(e){let url=null;try{url=String(r.url());}catch{}const row={url,receipt:'rejected-malformed',verified:false,error:String(e)};receipts.push({row,cancel:()=>{}});record('actual-http.jsonl',row);failureState.value={boundary:'malformed-http-response',...row};}});
  await page.goto(origin+'/index.html');await Promise.all(pending);checkFault();
   await Promise.all(responses);checkFault();
  if(fonts.every(file=>receipts.some(r=>r.row.path===file&&r.row.verified)))for(const complete of fallbacks)complete();
  for(const file of systemFiles())if(!receipts.some(r=>r.row.path===file.path&&r.row.verified)){
   failureState.value={boundary:'system-data-coverage-incomplete',path:file.path};checkFault();
  }
  for(const file of fonts)if(!receipts.some(r=>r.row.path===file&&r.row.verified)){
   failureState.value={boundary:'font-fallback-incomplete',path:file};checkFault();
  }
  const ready=await page.evaluate('ready');assert(ready.ready&&ready.worker&&ready.isolated&&ready.indexed===8);
  const point=await review();await page.mouse.move(point.x,point.y);await delay();
 }catch(error){failureState.value={boundary:'driver-error',error:String(error)};
 }finally{
  await close();
  const finalPin=retainedPin||pins();
  write(dir,'final-pins.json',{verified:finalPin.files.every(f=>sha(fs.readFileSync(path.join(ROOT,f.path)))===f.sha256)});
   write(dir,'receipts-final.json',receiptSummary());
  write(dir,'terminal-result.json',{firstFailure});write(dir,'driver-final.json',{closed,serverListening:!!server?.listening,firstFailure});
 }
 return {firstFailure};
}
module.exports={main,pins};
