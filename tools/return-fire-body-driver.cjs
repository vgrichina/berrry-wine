'use strict';
const assert = require('assert/strict');
const {createHash} = require('crypto');
const path = require('path');
const {createCollector} = require('./browser-response-body-collector.cjs');
const sha = value => createHash('sha256').update(value).digest('hex');

// Explicitly amend a sealed used-composed input. This helper never starts a
// browser, changes historical inputs, or grants a new original attempt.
function compose({source, expectedSHA256, run, collectorPath = path.join(__dirname,
  'browser-response-body-collector.cjs')} = {}) {
  assert.equal(sha(source), expectedSHA256, 'used composed driver hash changed');
  assert(path.isAbsolute(run) && path.isAbsolute(collectorPath));
  const change = (before, after) => {
    assert.equal(source.split(before).length, 2, 'unique amendment anchor: ' + before);
    source = source.replace(before, after);
  };
  const match = source.match(/,RUN=("[^"\n]+");/);
  assert(match, 'sealed absolute RUN declaration');
  change(match[0], ',RUN=' + JSON.stringify(run) + ';');
  change(" const dir=mock?path.join(RUN,'mock-runtime')", " assert(mock, 'this qualified entry permits no original browser retry');\n const dir=mock?path.join(RUN,'mock-runtime')");
  change(' let browser,server,timer,closing,closed=false,firstFailure=null;',
    ' let browser,server,timer,closing,bodyCollector,closed=false,firstFailure=null;');
  change('if(!firstFailure&&receipts.some(r=>r.row.receipt==="pending"))',
    'if(!firstFailure&&(receipts.some(r=>r.row.receipt==="pending")||(bodyCollector&&!bodyCollector.snapshot().complete)))');
  change('cancelReceipts("browser-close");', 'bodyCollector?.close("browser-close");cancelReceipts("browser-close");await bodyCollector?.settle();');
  change("complete:receipts.every(r=>", "complete:!!bodyCollector&&bodyCollector.snapshot().complete&&receipts.every(r=>");
  change('  const cdp=await page.createCDPSession();', `  const cdp=await page.createCDPSession();
  bodyCollector=require(${JSON.stringify(collectorPath)}).createCollector({origin,
   disconnectedEvent:require('puppeteer').CDPSessionEvent.Disconnected,
   onResponse:r=>{const accepted=responseHandler(r);if(r.status()!==200){checkFault();return accepted;}
    return Promise.resolve(accepted).then(()=>{checkFault();});},onFault:f=>{failureState.value=f;},
   record:row=>record('body-collector.jsonl',{mock,...row})});`);
  // Install response interception before any paused child can execute/fetch.
  change("  cdp.on('Target.attachedToTarget',event=>{const session=cdp.connection().session(event.sessionId),identity=", "  const onAttached=(parent,event)=>{const session=parent.connection()?.session(event.sessionId),identity=");
  change('identity={targetId:event.targetInfo.targetId,sessionId:event.sessionId,',
    'identity={type:event.targetInfo.type,parentSessionId:parent.id(),targetId:event.targetInfo.targetId,sessionId:event.sessionId,');
  change("   pending.push((async()=>{if(event.targetInfo.type==='worker'", `   if(!session){failureState.value={boundary:'browser-body-session-missing',...identity};return;}
   pending.push((async()=>{await bodyCollector.attach(session,identity);
    session.on('Target.attachedToTarget',child=>onAttached(session,child));
    await session.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
    if(event.targetInfo.type==='worker'`);
  change("  });\n  await cdp.send('Target.setAutoAttach'", "  };cdp.on('Target.attachedToTarget',event=>onAttached(cdp,event));\n  await cdp.send('Target.setAutoAttach'");
  change("  page.on('response',r=>{try{", "  const responseHandler=r=>{try{");
  change("receipt:'pending'};", "receipt:'pending',mock,bodyIdentity:r.bodyIdentity};");
  change("   const declaredSystem=", `   if(r.request?.().method()!=='GET'||r.request?.().redirectChain?.().length){complete('rejected-status',{verified:false});failureState.value={boundary:'unclassified-http-method-or-redirect',...row};return;}
   const declaredSystem=`);
  change("if(optionalAbsent){complete('optional-absence',{policy:relative==='favicon.ico'?'implicit-browser-favicon-absent':'optional-build-info-absent',verified:false});return;}",
    "if(optionalAbsent){complete('optional-absence',{policy:relative==='favicon.ico'?'implicit-browser-favicon-absent':'optional-build-info-absent',verified:false});return {optionalAbsence:r.bodyIdentity,policy:row.policy};}");
  change("  }catch(e){let url=null;try{url=String(r.url());}catch{}const row={url,receipt:'rejected-malformed',verified:false,error:String(e)};receipts.push({row,cancel:()=>{}});record('actual-http.jsonl',row);failureState.value={boundary:'malformed-http-response',...row};}});",
    "   return done;\n  }catch(e){let url=null;try{url=String(r.url());}catch{}const row={url,receipt:'rejected-malformed',verified:false,error:String(e)};receipts.push({row,cancel:()=>{}});record('actual-http.jsonl',row);failureState.value={boundary:'malformed-http-response',...row};}};\n  const {targetInfo}=await cdp.send('Target.getTargetInfo');\n  await bodyCollector.attach(cdp,{sessionId:cdp.id(),targetId:targetInfo.targetId});");
  change('   await Promise.all(responses);checkFault();', '   await bodyCollector.drain();await Promise.all(responses);checkFault();');
  change("   write(dir,'receipts-final.json',receiptSummary());", "   write(dir,'receipts-final.json',receiptSummary());\n   write(dir,'body-collector-final.json',{mock,evidenceKind:mock?'synthetic-CDP-with-real-FSHTTP':'browser-CDP',...(bodyCollector?.snapshot()||{complete:false,notAttached:true})});");
  assert(!source.includes("page.on('response'"), 'no duplicate Puppeteer receipt channel');
  return source;
}
module.exports = {compose, sha};

// Pinned actual browser adapter, shared by generated controls and future explicitly
// authorized routes. The sealed compose entry above keeps its default policy.
async function attach({page,origin,pins,record,onFault,onResponse=()=>{},optional=()=>null,observe=async()=>{},timeoutMs=5000,consumerCompletion=false}){
 const pending=[],sessions=new Map();let firstFault=null;
 const fail=f=>{if(!firstFault){firstFault=JSON.parse(JSON.stringify(f));onFault(firstFault);}};
 const policy=r=>{
  const identity=r.bodyIdentity,url=new URL(r.url()),relative=decodeURIComponent(url.pathname).slice(1);
  const row={...identity,path:relative,receipt:'pending'};record('http-policy.jsonl',row);
  const reject=(boundary,error)=>{const fault={boundary,...identity,path:relative,error:String(error)};fail(fault);throw Error(String(error));};
  assert.equal(url.origin,origin);assert.equal(r.request().method(),'GET');
  const expected=pins.get(relative);
  if(r.status()!==200){
   const absence=optional({url,relative,status:r.status(),identity,expected});
   if(!absence)return reject('required-http-status','unclassified HTTP '+r.status()+' '+url.href);
   record('http-policy.jsonl',{...row,receipt:'optional-absence',policy:absence,verified:false});
   onResponse({...row,policy:absence,verified:false});
   return {optionalAbsence:identity,policy:absence};
  }
  return (async()=>{
   const bytes=await r.buffer(),digest=sha(bytes);
   if(!expected||expected.bytes!==bytes.length||expected.sha256!==digest)return reject('required-http-body','required browser body differs from pinned input: '+url.href);
   const accepted={...row,receipt:'verified',bytes:bytes.length,sha256:digest,verified:true};
   record('http-policy.jsonl',accepted);onResponse(accepted);return accepted;
  })();
 };
 const collector=createCollector({origin,onResponse:policy,onFault:fail,record:r=>record('body-collector.jsonl',r),timeoutMs,
  consumerCompletion:!!consumerCompletion,disconnectedEvent:require('puppeteer').CDPSessionEvent.Disconnected});
 const cdp=await page.createCDPSession();
 const observers=[];
 const onAttached=(parent,event)=>{
  const session=parent.connection()?.session(event.sessionId),identity={type:event.targetInfo.type,parentSessionId:parent.id(),targetId:event.targetInfo.targetId,sessionId:event.sessionId,url:event.targetInfo.url,waitingForDebugger:event.waitingForDebugger};
  if(!session){fail({boundary:'browser-body-session-missing',...identity});return;}
  sessions.set(identity.targetId,{session,identity,parent});
  pending.push((async()=>{
   await collector.attach(session,identity);
   session.on('Target.attachedToTarget',child=>onAttached(session,child));
   try{await session.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});}
   catch(error){assert(identity.type==='worklet'&&error.name==='ProtocolError'&&error.originalMessage==="'Target.setAutoAttach' wasn't found"&&(error.code===undefined||error.code===-32601),String(error));record('worklet-target-capability.jsonl',{...identity,method:'Target.setAutoAttach',state:'method-unavailable',error:String(error)});}
   if(consumerCompletion)session.on('Network.requestWillBeSent',event=>{
    if(consumerCompletion.urls.includes(event.request.url))fail({boundary:'unsupported-consumer-owner',...identity,networkId:event.requestId});
   });
   await observe(session,identity);
   await session.send('Runtime.runIfWaitingForDebugger');
  })().catch(error=>fail({boundary:'body-target-attachment',...identity,error:String(error)})));
 };
 cdp.on('Target.attachedToTarget',event=>onAttached(cdp,event));
 // The page is attached before navigation; children are paused before execution.
 const {targetInfo}=await cdp.send('Target.getTargetInfo');
 await collector.attach(cdp,{type:'page',sessionId:cdp.id(),targetId:targetInfo.targetId,url:page.url()});
 if(consumerCompletion)observers.push(await require('./browser-consumer-completion.cjs').observeConsumers({session:cdp,collector,identity:{sessionId:cdp.id(),targetId:targetInfo.targetId},urls:consumerCompletion.urls,record:r=>record('consumer-completion.jsonl',r),onFault:fail}));
 await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
 return {collector,pending,sessions,cdp,get firstFault(){return firstFault;},
  async drain(){await Promise.all(pending);for(const observer of observers)observer.check();await collector.drain();if(firstFault)throw Error(JSON.stringify(firstFault));},
  async close(){collector.close();await collector.settle();for(const observer of observers)await observer.close();}};
}

module.exports.attachPinned = attach;
