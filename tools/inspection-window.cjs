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

module.exports={connectInspector,readInspectionState,inspectWholePage};
