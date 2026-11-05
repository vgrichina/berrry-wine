'use strict';
const assert = require('assert/strict');
const {createHash} = require('crypto');
const path = require('path');
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
