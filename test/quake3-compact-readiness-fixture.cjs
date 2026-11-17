'use strict';
const assert=require('node:assert/strict');
// Prepared for insertion into the existing real-Chrome native qualification.
// All transitions happen synchronously in a fixture; every changed descriptor
// is restored in finally. No original invokes this fixture helper.
async function chromeEquivalence({evaluate,cdp,report,old,compact}){
  const observed=(await evaluate(old.PAGE_READ)).apps[0];
  const identity={...observed,unusedDiagnostic:'x'.repeat(600000)};
  const rows=[];
  for(const kind of ['ready','held','pending','damage','replacement','overlay','error','select-output']){
    const want=kind==='select-output'?{...identity,outputCanvasObject:'changed'}:identity;
    const legacy=old.readinessExpression(want,kind==='select-output'),reduced=compact.readinessExpression(want,kind==='select-output');
    const source=`(() => {
      const w=runningApps[0].wine,r=w.renderer,saved=[];
      const change=(o,k,v)=>{saved.push([o,k,Object.getOwnPropertyDescriptor(o,k)]);Object.defineProperty(o,k,{configurable:true,writable:true,value:v});};
      let overlay;
      try{
        if(${JSON.stringify(kind)}==='ready'){if(r._workerPublicationHeld()||r._repainting||r._workerGdiPaintDepth||!r._currentDisplayRecord)throw Error('real ready baseline required');}
        if(${JSON.stringify(kind)}==='held')change(r,'_workerPublicationHeld',()=>true);
        if(${JSON.stringify(kind)}==='pending')change(w,'_presentFrameDue',true);
        if(${JSON.stringify(kind)}==='damage')change(r,'_repaintPending',true);
        if(${JSON.stringify(kind)}==='replacement')change(runningApps[0],'wine',{...w});
        if(${JSON.stringify(kind)}==='overlay'){
          const c=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas,b=c.getBoundingClientRect();
          overlay=document.createElement('div');overlay.textContent='readiness fixture overlay';Object.assign(overlay.style,{position:'fixed',left:b.left+'px',top:b.top+'px',width:'40px',height:'40px',background:'red',pointerEvents:'none',zIndex:'2147483647'});(document.fullscreenElement||document.body).append(overlay);
        }
        if(${JSON.stringify(kind)}==='error'){
          for(const [o,k] of [[w,'_dxDirty'],[w,'_dxLockDeferred'],[w,'_presentFrameDue'],[r,'_workerGdiPaintDepth'],[r,'_repainting'],[r,'_repaintScheduled'],[r,'_repaintPending'],[r,'_workerRepaintDeferred']])change(o,k,false);
          change(r,'_workerPublicationHeld',()=>false);change(r,'_validateCurrentDisplayCapture',()=>{throw Error('deliberate validator exception');});
        }
        const observe=f=>{try{const v=f();delete v.at;return {value:v};}catch(e){return {error:e.message};}};
        const before={publication:r._immutablePublicationSequence,capture:r._immutableCaptureRequest,held:r._workerPublicationHeld()},a=observe(()=>(${legacy})),b=observe(()=>(${reduced}));
        return {a,b,unchanged:before.publication===r._immutablePublicationSequence&&before.capture===r._immutableCaptureRequest&&before.held===r._workerPublicationHeld()};
      }finally{overlay?.remove();for(const [o,k,d] of saved.reverse()){if(d)Object.defineProperty(o,k,d);else delete o[k];}}
    })()`;
    const result=await evaluate(source);assert.deepEqual(result.a,result.b,kind);assert(result.unchanged,kind+' read-only guard');
    if(kind==='ready')assert(result.b.value?.ready,JSON.stringify(result));
    if(['held','pending','damage'].includes(kind))assert.equal(result.b.value?.ready,false);
    if(['replacement','overlay','error'].includes(kind))assert(result.b.error,kind);
    rows.push({kind,...result,legacyBytes:Buffer.byteLength(legacy),compactBytes:Buffer.byteLength(reduced)});
  }
  // CDP compile and run boundaries are separately observable. compileScript
  // roundtrip includes transport/inspector cost: it is not pure V8 compile time.
  // Runtime body samples use one page clock and exclude transport/compilation.
  const timings=[];
  for(const [name,expression] of [['legacy',old.readinessExpression(identity)],['compact',compact.readinessExpression(identity)]]){
    const wrapped=`(() => {const begin=performance.now();let result;try{result=(${expression});return {begin,end:performance.now(),result};}catch(e){return {begin,end:performance.now(),error:e.message};}})()`;
    const serialStart=performance.now(),wire=JSON.stringify({method:'Runtime.compileScript',params:{expression:wrapped,sourceURL:'',persistScript:true}}),serialMs=performance.now()-serialStart;
    const compileStart=performance.now(),compiled=await cdp.send('Runtime.compileScript',{expression:wrapped,sourceURL:'',persistScript:true}),compileRoundtripMs=performance.now()-compileStart;
    assert(!compiled.exceptionDetails&&compiled.scriptId,'actual Chrome compilation');
    const runStart=performance.now(),ran=await cdp.send('Runtime.runScript',{scriptId:compiled.scriptId,returnByValue:true}),runRoundtripMs=performance.now()-runStart;
    assert(!ran.exceptionDetails);const value=ran.result.value;assert(Number.isFinite(value.begin)&&value.end>=value.begin);
    timings.push({name,expressionBytes:Buffer.byteLength(expression),wireBytes:Buffer.byteLength(wire),serialMs,compileRoundtripMs,runRoundtripMs,bodyMs:value.end-value.begin,compileOnlyMs:null,transportOnlyMs:null});
  }
  report.compactReadiness={rows,timings,semanticEquivalence:true,readOnly:true,originals:0,historical1113Cause:'UNKNOWN',compileAndTransportIndividuallyUnresolved:true};
}
module.exports={chromeEquivalence};
