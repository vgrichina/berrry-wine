'use strict';
// Verifies a retained negative experiment. This does not qualify trusted input.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const PIN='83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f';
function verifyNegative(out,{focused=false}={}){
  out=path.resolve(out);const read=n=>JSON.parse(fs.readFileSync(path.join(out,n),'utf8'));
  const wire=read('wire.json'),failure=read('failure.json');
  assert.match(failure.error,/UNKNOWN Page.captureScreenshot; never replay/);assert.equal(failure.transportClosed,true);
  assert.equal(failure.originalLaunched,false);
  const requests=wire.filter(e=>e.direction==='request'),captures=requests.filter(e=>e.method==='Page.captureScreenshot');
  assert.equal(captures.length,1);assert.deepEqual(captures[0].params,{format:'png',captureBeyondViewport:false});
  assert.equal(requests.filter(e=>e.at>=failure.at).length,0,'no request after permanent UNKNOWN');
  assert.equal(requests.filter(e=>e.method.startsWith('Input.')).length,0,'no physical input qualification claimed');
  assert(!fs.existsSync(out+'/native-host.png'),'no adopted late CDP pixels');
  const module=read('module.json');assert.equal(module.sha256,PIN);assert.equal(module.bytes,2279037);
  const display=read('display.json');assert.equal(display.private,true);assert.equal(display.tcp,false);assert.equal(display.authMode,0o600);assert(display.args.includes('-nolisten'));assert(!display.args.includes('-ac'));
  const viewport=read('viewport.json');assert.equal(viewport.width,1024);assert.equal(viewport.height,757);assert.equal(viewport.deviceScale,1);
  if(focused){assert.equal(read('content-focus.json').focus,true);assert.equal(read('content-focus.json').visibility,'visible');assert.equal(read('xauth-negative.json').unauthenticatedDenied,true);}
  const host=read('host-state.json');assert.equal(host.page.apps.length,1);assert.equal(host.page.apps[0].name,'live_input_fixture');assert.equal(host.page.apps[0].running,true);assert.equal(host.button.visible,true);assert.equal(host.button.enabled,true);assert.equal(host.button.hit,true);
  for(const name of ['presented-before-capture','presented-pending-capture']){
    const b=fs.readFileSync(out+'/'+name+'.xwd');assert.equal(b.readUInt32BE(16),1280);assert.equal(b.readUInt32BE(20),1024);
  }
  for(const name of ['chrome','probe','xvfb','openbox']){const w=read(name+'-wait.json');assert.equal(w.actualWait,true);assert.equal(w.stdoutEOF,true);assert.equal(w.stderrEOF,true);}
  const closed=read('display-closed.json');for(const key of ['socketAbsent','lockAbsent','authAbsent'])assert.equal(closed[key],true);
  assert(!fs.existsSync(out+'/profile'));
  for(const name of ['-wait.json','-watchdog-wait.json']){const w=JSON.parse(fs.readFileSync(out+name));assert.equal(w.actualWait,true);assert.equal(w.stdoutEOF,true);assert.equal(w.stderrEOF,true);assert.equal(w.code,name==='-wait.json'?1:0);}
  const events=fs.readFileSync(out+'/probe-events.txt','utf8').split('\n').flatMap(line=>{const m=line.match(/\s(\d+) \[\d+\]\s+([\d.]+):\s+probe_headful:(gltron_\w+):/);return m?[{tid:Number(m[1]),at:Number(m[2]),name:m[3]}]:[];});
  const entry=events.find(e=>e.name==='gltron_capture_enter');assert(entry);
  const phases=events.map(e=>({...e,sinceCaptureMs:(e.at-entry.at)*1000}));
  if(focused){
    for(const name of ['gltron_cc_draw','gltron_surface_activate','gltron_viz_swap'])assert(phases.some(e=>e.name===name&&e.sinceCaptureMs>0&&e.sinceCaptureMs<3000),'actual presentation pipeline before UNKNOWN: '+name);
    assert(phases.find(e=>e.name==='gltron_copy_surface').sinceCaptureMs>3000,'copy entered only after UNKNOWN');
  }
  return {outcome:'EXPECTED_PERMANENT_UNKNOWN',observationConfiguredMs:3000,observedFailureMs:failure.at-captures[0].at,requestsAfterUNKNOWN:0,inputRequests:0,qualified:false,focused,phases};
}
module.exports={verifyNegative};
