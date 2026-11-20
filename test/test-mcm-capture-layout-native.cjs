'use strict';
// Opt-in real Chrome layout controls; run under native-supervise. No game.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Lifecycle,launchChrome,connect}=require('../tools/browser-startup-lifecycle.cjs');
const {createLayoutCapture}=require('../tools/mcm-capture-layout.cjs');
const {PNG}=require('pngjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const out=process.env.MCM_LAYOUT_OUT;assert(out,'explicit evidence directory required');
 fs.mkdirSync(out,{recursive:true});
 const life=new Lifecycle({cancelFile:out+'/CLOSED',deadline:Date.now()+60000});
 let display,browser,c;
 const rows=[];
 const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 try{
  display=await require('../tools/gltron-headful-display.cjs').start(out,life);
  await launchChrome(life,{directory:out+'/profile',env:display.env,adopt:v=>browser=v});
  c=connect(life,browser.url);await c.ready;
  const tabs=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(tabs.length,1);
  const session=(await c.send('Target.attachToTarget',{targetId:tabs[0].targetId,flatten:true})).sessionId;
  const layout=createLayoutCapture({send:(m,p,s)=>c.send(m,p,s),session,checkpoint:()=>life.checkpoint('capture')});
  c.event=v=>layout.event(v);
  const send=layout.send;
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true},session);assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Page.enable',{},session);await send('Debugger.enable',{},session);
  await send('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},session);
  // The real host's wrapping toolbar + remaining-height flex screen. Only
  // controls and canvas pixels are authored; CSS comes from this checkout.
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
  await send('Page.setDocumentContent',{frameId:(await send('Page.getFrameTree',{},session)).frameTree.frame.id,
   html:`<style>${css}</style><div id="shell"><div id="toolbar"><button style="width:650px">Native layout control</button><span id="status">Ready</span></div><div id="content"><div id="screen-wrap"><div id="screen-canvas-stack"><canvas id="screen"></canvas></div></div></div></div>`},session);
  await evaluate(`(()=>{const c=document.getElementById('screen');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='teal';x.fillRect(0,0,800,600);x.fillStyle='yellow';x.fillRect(50,50,120,80);return true})()`);
  const expression=`(()=>{const r=document.getElementById('screen').getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},screen:{x:r.x,y:r.y,width:r.width,height:r.height}}})()`;
  const geometry=()=>evaluate(expression);
  const schedule=()=>evaluate(`(()=>{document.getElementById('status').textContent='Ready';setTimeout(()=>document.getElementById('status').textContent='A genuine longer host status wraps onto another toolbar row',250);return true})()`);
  const shot=async()=>{await wait(400);const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);return Buffer.from(r.data,'base64');};
  await schedule();const before=await geometry(),old=await shot(),after=await geometry();
  fs.writeFileSync(out+'/old-failure.png',old);assert.notDeepEqual(before,after);
  rows.push({name:'old capture crosses native toolbar reflow',before,after,refused:true});
  await schedule();let last;
  const positive=await layout.capture({geometry,capture:shot,retain:row=>{
   last={...row,value:undefined};fs.writeFileSync(out+'/new-pass.png',row.value);save('new-pass.json',last);
  }});
  const decoded=PNG.sync.read(positive.value);assert.equal(decoded.width,800);assert.equal(decoded.height,600);assert(last.verified);
  await wait(100);const resumed=await geometry();assert.notDeepEqual(resumed,positive.geometry,'pending real status reflow resumes after capture');
  rows.push({name:'paused transaction preserves full host during pending reflow',...last,resumed});
  let faultRetained=false;
  assert(positive.geometry.screen.height>0);
  await assert.rejects(layout.capture({geometry,capture:async()=>{
   const bytes=await shot();await evaluate("document.getElementById('toolbar').style.paddingTop='60px';true");return bytes;
  },retain:row=>{faultRetained=true;fs.writeFileSync(out+'/fault-retained.png',row.value);save('fault-retained.json',{...row,value:undefined});}}),/capture viewport\/screen changed/);
  assert(faultRetained);rows.push({name:'real geometry fault refused with retained full pixels',retained:true});
  save('controls.json',{pass:true,rows,wholeHost:true,game:false});
 }finally{
  if(c)await c.close();if(browser)save('browser-wait.json',await browser.stop());await life.drain();if(display)await display.close();
  fs.rmSync(out+'/profile',{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
