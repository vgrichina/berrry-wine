'use strict';
// Ordinary browser input: DOWN and independently prearmed UP share this exact
// key/code mapping. Transport completion is never a guest-consumption receipt.
const assert = require('node:assert/strict');
const base = require('./gltron-browser-binding.cjs');
const binding = {...base, PAGE_READ: base.PAGE_READ
  .replace("['gl','gl-gps']", "['gl','gl-gps','d3dim','d3dim-gps']")
  .replace('const gps=w?.hostCtx?.getGlGpsBridge?.();', 'const gps=p?.options.api==="d3dim-gps"?w?.hostCtx?.d3dimBridge:w?.hostCtx?.getGlGpsBridge?.();')
  .replaceAll("p?.options.api==='gl-gps'", "['gl-gps','d3dim-gps'].includes(p?.options.api)")};
// Whole-display capture supports DirectDraw menus before a 3D endpoint exists.
// Keep process, main module, guest endpoint and window identity across loading;
// record the actual backend at each scene instead of requiring its early birth.
const CORE_FIELDS = ['processId','processObject','endpoint','endpointObject',
  'workerObject','moduleObject','epoch','pageRendererObject','canvasObject',
  'windowHwnd','windowObject','windowInstance'];
function sameCore(before, after) {
  for(const field of CORE_FIELDS) {
    assert(before[field]!==null&&before[field]!==undefined, 'missing core '+field);
    assert.equal(after[field],before[field], 'changed core '+field);
  }
}
const keys = {ArrowUp:38, ArrowDown:40, ArrowLeft:37, ArrowRight:39,
  Enter:13, Escape:27, Space:32, Control:17, a:65, s:83};
function mediaRoutes(file) {
  assert(file.startsWith('test/binaries/')&&!file.split('/').includes('..'), 'pinned local media path');
  // The registered app uses test/binaries; imported companions can use binaries.
  return [file,file.slice(5)];
}
function keyEvent(key, type) {
  assert(Object.hasOwn(keys, key), 'supported ordinary key');
  assert(['keyDown','keyUp'].includes(type), 'balanced event type');
  return {type, key:key==='Space'?' ':key,
    code:key==='Control'?'ControlLeft':key==='a'?'KeyA':key==='s'?'KeyS':key,
    windowsVirtualKeyCode:keys[key], ...(key==='Control'?{location:1}: {})};
}
async function deliver({validate, arm, down, holdMs=120, now=Date.now}) {
  assert(Number.isInteger(holdMs)&&holdMs>=50&&holdMs<=1200, 'finite ordinary hold');
  const startedAt=now();
  await validate();
  const validatedAt=now(), release=await arm();
  let downAt=null, acknowledgementAt=null, error=null, wait;
  try {
    assert(Number.isFinite(release.fallback), 'finite prearmed fallback');
    assert(now()+holdMs+50<release.fallback, 'NOT_SENT: insufficient prearmed hold window');
    downAt=now(); await down(); acknowledgementAt=now();
    release.schedule(Math.min(release.fallback,downAt+holdMs));
  } catch(e) { error=e; }
  finally { wait=await release.finish(); }
  if(error)throw error;
  return {startedAt,validatedAt,downAt,acknowledgementAt,fallback:release.fallback,wait,
    deliveryBoundary:'ordinary browser transport; no native consumption ACK asserted'};
}
module.exports = {binding, keyEvent, deliver, mediaRoutes, CORE_FIELDS, sameCore};
