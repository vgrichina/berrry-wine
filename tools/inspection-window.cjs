'use strict';

const assert = require('node:assert/strict');
const {PNG} = require('pngjs');

// Read geometry and native ownership only. In particular, never call a
// viewport, layout, repaint, window-position or publication API here.
function readInspectionState() {
  const rect = e => {
    const r = e.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height};
  };
  return {
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
      scrollX,scrollY,visual:visualViewport ? {
        width:visualViewport.width,height:visualViewport.height,
        scale:visualViewport.scale,offsetLeft:visualViewport.offsetLeft,
        offsetTop:visualViewport.offsetTop} : null},
    canvases:[...document.querySelectorAll('canvas')].map(c => ({
      id:c.id,width:c.width,height:c.height,rect:rect(c)})),
    apps:(typeof runningApps === 'undefined' ? [] : runningApps).map(a => {
      const w=a.wine,r=w?.renderer,b=w?.hostCtx?.d3dimBridge;
      return {name:a.name,processId:w?.processId,running:w?.running,
        guestEndpoint:w?.guestWorker?.link?.endpointIdentity,
        workerEpoch:b?.workerEpoch,endpointId:b?.endpoint?.id,
        windows:Object.values(r?.windows||{}).filter(v=>v.visible&&!v.isChild).map(v=>({
          hwnd:v.hwnd,processId:v.processId,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,
          clientRect:v.clientRect,
          generation:String((v.wasm||w.instance)?.exports?.wnd_lookup_generation?.(v.hwnd))
        }))};
    })
  };
}

async function connectInspector(browserURL, puppeteer = require('puppeteer')) {
  return puppeteer.connect({browserURL,defaultViewport:null});
}

async function inspectWholePage(page, expected) {
  const before=await page.evaluate(readInspectionState);
  if (expected) assert.deepEqual(before,expected,'inspection attachment changed geometry or owner');
  const png=await page.screenshot({type:'png',fullPage:false,captureBeyondViewport:false});
  const after=await page.evaluate(readInspectionState);
  assert.deepEqual(after,before,'inspection capture changed geometry or owner');
  const decoded=PNG.sync.read(png);
  assert.equal(decoded.width,Math.round(before.viewport.width*before.viewport.dpr),'incomplete whole image width');
  assert.equal(decoded.height,Math.round(before.viewport.height*before.viewport.dpr),'incomplete whole image height');
  return {png,before,after,width:decoded.width,height:decoded.height};
}

// Completed native presentation plus its ordinary desktop composition. Merely
// creating a device (or receiving LAYOUT) does not mean startup has settled.
function readInspectionReadiness() {
  const apps=typeof runningApps==='undefined'?[]:runningApps;
  return apps.length===1 && apps.every(a=>{
    const w=a.wine,r=w?.renderer,b=w?.hostCtx?.d3dimBridge;
    const wins=Object.values(r?.windows||{}).filter(v=>v.visible&&!v.isChild);
    if(w?._stopped||w?.running===false||b?.workerAsyncError||b?.workerClosing)
      throw Error('failed native inspection owner');
    return wins.length===1 && b?.presenter?.presents>0 &&
      r?._currentDisplayRecord?.windows?.some(p=>p.window.deref()===wins[0]);
  });
}

class InspectionScope {
  constructor(page) { this.page=page;this.phase='new';this.baseline=null; }
  async bind({timeoutMs=15000,stableMs=300,pollMs=100}={}) {
    assert.equal(this.phase,'new','inspection scope already used; cannot rebaseline');
    assert(Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=30000);
    assert(Number.isFinite(stableMs)&&stableMs>0&&stableMs<timeoutMs);
    assert(Number.isFinite(pollMs)&&pollMs>=10&&pollMs<=stableMs);
    this.phase='preparing';
    const end=performance.now()+timeoutMs,observations=[];
    const read=async fn=>{
      let timer;
      try { return await Promise.race([this.page.evaluate(fn),new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(Error('pre-binding stabilization timeout')),Math.max(1,end-performance.now()));
      })]); } finally { clearTimeout(timer); }
    };
    let candidate=null,since=0,lastObservation=null;
    try {
      while(performance.now()<end) {
        const ready=await read(readInspectionReadiness);
        const state=await read(readInspectionState),now=performance.now();
        if(now>=end)throw Error('pre-binding stabilization timeout');
        const observation=JSON.stringify({ready,state});
        if(observation!==lastObservation&&observations.length<64) {
          observations.push({ready,state});lastObservation=observation;
        }
        // Only this unbound candidate may change. A bound baseline never does.
        if(!ready||JSON.stringify(state)!==JSON.stringify(candidate)) {
          candidate=ready?state:null;since=now;
        }
        if(ready&&now-since>=stableMs) {
          this.baseline=state;this.phase='bound';
          return {baseline:state,observations,stableMs,timeoutMs};
        }
        await new Promise(r=>setTimeout(r,Math.min(pollMs,end-performance.now())));
      }
      throw Error('pre-binding stabilization timeout');
    } catch(e) { this.phase='closed';e.observations=observations;throw e; }
  }
  async check(page=this.page) {
    assert.equal(this.phase,'bound','inspection scope is not bound');
    try { assert.deepEqual(await page.evaluate(readInspectionState),this.baseline,
      'bound inspection changed geometry or owner'); }
    catch(e) { this.phase='closed';throw e; }
  }
  async capture() {
    assert.equal(this.phase,'bound','inspection scope is not bound');
    try { return await inspectWholePage(this.page,this.baseline); }
    catch(e) { this.phase='closed';throw e; }
  }
}

module.exports={connectInspector,readInspectionState,readInspectionReadiness,inspectWholePage,InspectionScope};
