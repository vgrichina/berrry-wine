'use strict';
// Pure preparation is safe while another worker owns the browser/build.
// The opt-in browser exercise below must run against the real served shell.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const html=()=>fs.readFileSync(require('node:path').resolve(__dirname,'../index.html'),'utf8');
const BASELINE='c4d097e83';
const oldHTML=()=>require('node:child_process').execFileSync('git',['show',BASELINE+':index.html'],{cwd:require('node:path').resolve(__dirname,'..'),encoding:'utf8'});
function layoutWrites(source){
  const start=source.indexOf('      if (fullscreen) {',source.indexOf('    function resizeCanvas() {'));
  const end=source.indexOf('      if (w > 0 && h > 0',start);
  assert(start>0&&end>start,'resize layout boundary changed');
  return {start,end,text:source.slice(start,end)};
}
function candidate(source){
  const block=layoutWrites(source);
  return source.slice(0,block.start)+
    '      // Fullscreen geometry belongs to the :fullscreen CSS rules. Inline\n'+
    '      // pixel sizes survive browser exit until JS handles fullscreenchange,\n'+
    '      // leaving a stale oversized box when rendering delays that handler.\n'+
    source.slice(block.end);
}
function resizeSource(source){
  const start=source.indexOf('    function resizeCanvas() {'),end=source.indexOf('    window.resizeCanvas = resizeCanvas;',start);
  assert(start>0&&end>start);return source.slice(start,end);
}
function model(source){
  const canvas={width:1920,height:996,style:{}},wrap={style:{}},present={width:1920,height:996},filter=[],resizes=[];
  const renderer={presentationFilter:{resize:(w,h)=>filter.push([w,h])},repaint(){},handleScreenResize:(...args)=>resizes.push(args)};
  const env={document:{getElementById:id=>({screen:canvas,'screen-wrap':wrap,'screen-present':present})[id]},
    applySingleAppMode(){},syncWindowedPageFullscreen(){},wine:{renderer},sharedRenderer:null,console:{log(){}},
    screenCanvasSize:()=>({fullscreen:true,displayW:1920,displayH:996,w:1920,h:996,dpr:1})};
  const context=vm.createContext(env);vm.runInContext(resizeSource(source)+';resizeCanvas();',context);
  return {canvas,wrap,present,filter,resizes};
}
if(require.main===module){
test('causal model: fullscreen inline pixels outlive the browser transition',()=>{
  const source=oldHTML();
  // Before production repair this demonstrates the exact stale 1920x996
  // wrapper from the immutable public observation. It is not a Chrome proof.
  const old=model(source);assert.equal(old.wrap.style.width,'1920px');assert.equal(old.wrap.style.height,'996px');assert.equal(old.wrap.style.position,'fixed');
  assert.equal(old.canvas.width,1920);assert.equal(old.canvas.height,996);
});
test('prepared candidate leaves backing, presentation resize and paint paths identical',()=>{
  const source=html(),baseline=oldHTML(),next=candidate(baseline);
  if(!source.includes("wrap.style.width = displayW + 'px';"))assert.equal(resizeSource(source),resizeSource(next),'production repair must match the qualified minimal candidate');
  const result=model(next);assert.deepEqual(result.wrap.style,{});assert.deepEqual(result.canvas.style,{});
  assert.deepEqual(result.filter,[[1920,996]]);assert.deepEqual(result.resizes,[]);
  const before=baseline.slice(baseline.indexOf('    function screenCanvasSize() {'),baseline.indexOf('    // Resize canvas to match container'));
  assert(source.includes(before)&&next.includes(before),'guest size/mode/keyboard/board policy must remain byte-identical');
  for(const selector of ['#screen-wrap:fullscreen {','#screen-wrap:-webkit-full-screen {','#screen-wrap:fullscreen #screen-canvas-stack,'])assert(next.includes(selector));
});
}
// Delays only the shell's layout callbacks, modelling the interval after the
// browser changes fullscreen/viewport and before a busy page handles it.
// No geometry, paint, owner, admission predicate or acknowledgement is forged.
const INIT=`(() => {
  const add=EventTarget.prototype.addEventListener, queued=[];
  globalThis.__q3LayoutQueue=queued;globalThis.__q3LayoutHold=false;
  EventTarget.prototype.addEventListener=function(type,listener,options){
    if(['resize','fullscreenchange','webkitfullscreenchange'].includes(type)&&typeof listener==='function'){
      const target=this,fn=listener;listener=function(...args){if(globalThis.__q3LayoutHold){queued.push(()=>fn.apply(target,args));return;}return fn.apply(this,args);};
    }
    return add.call(this,type,listener,options);
  };
  const RO=ResizeObserver;
  globalThis.ResizeObserver=class extends RO {constructor(fn){super((...args)=>{if(globalThis.__q3LayoutHold){queued.push(()=>fn(...args));return;}fn(...args);});}};
  return true;
})()`;
async function chromeExit({evaluate,cdp,page,report,PAGE_READ,root,expect='green',browserURL,controller}){
  const before=(await evaluate(PAGE_READ)).apps[0];assert(before.outputVisible);
  const original=await evaluate(`(() => {const r=fixture.r,e=fixture.w.instance.exports;fixture.layoutMode={get_display_mode_active:e.get_display_mode_active,get_display_mode_w:e.get_display_mode_w,get_display_mode_h:e.get_display_mode_h};fixture.layoutShellRenderer=Object.getOwnPropertyDescriptor(wineShell,"renderer");Object.defineProperty(wineShell,"renderer",{configurable:true,get:()=>r});fixture.layoutBacking={w:r.canvas.width,h:r.canvas.height};e.get_display_mode_active=()=>1;e.get_display_mode_w=()=>fixture.layoutBacking.w;e.get_display_mode_h=()=>fixture.layoutBacking.h;__q3LayoutHold=true;return {fullscreen:!!document.fullscreenElement,backing:fixture.layoutBacking};})()`);
  assert(original.fullscreen,'actual trusted host consent must precede exit control');
  await evaluate('document.exitFullscreen().then(()=>true)');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:900,height:720,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('document.fullscreenElement===null'),true);
  const gap=(await evaluate(PAGE_READ)).apps[0];
  const geometry=await evaluate(`(() => {const r=fixture.r,c=r._directPresentation?r.canvas:r.presentationCanvas||r.canvas;return {viewport:{w:innerWidth,h:innerHeight},wrap:document.getElementById('screen-wrap').getBoundingClientRect().toJSON(),output:c.getBoundingClientRect().toJSON(),backing:{w:r.canvas.width,h:r.canvas.height},queued:__q3LayoutQueue.length,publication:r._immutablePublicationSequence};})()`);
  fs.writeFileSync(root+'/layout-gap-'+expect+'.json',JSON.stringify({original,gap,geometry})+'\n',{flag:'wx'});
  assert.deepEqual(geometry.backing,original.backing,'guest backing stays large through the genuine exit');
  assert(geometry.queued>0,'layout callback gap must be actually exercised');
  const broken=geometry.output.right>geometry.viewport.w||geometry.output.bottom>geometry.viewport.h;
  assert.equal(broken,expect==='red','actual exit geometry '+expect);
  if(expect==='red'){
    assert(!gap.outputVisible);assert.equal(gap.outputVisibility.reason,'output outside viewport');
    await assert.rejects(controller.captureScene({evaluate,identity:gap}),/visible/);
  }else{
    assert(gap.outputVisible,'complete public output must fit before delayed JS catches up');
    // Reading the old complete publication is legitimate only while all its
    // public owner/source/output pins still match. No ACK substitution.
    const shot=await controller.captureScene({evaluate,identity:gap});
    assert.equal(shot.metadata.content,'already-displayed');
  }
  await evaluate('(__q3LayoutHold=false,__q3LayoutQueue.splice(0).forEach(fn=>fn()),true)');
  await page.waitForFunction('!fixture.r._repaintScheduled&&!fixture.r._workerPublicationHeld()');
  const after=(await evaluate(PAGE_READ)).apps[0];assert(after.outputVisible);
  const shot=await controller.captureScene({evaluate,identity:after});
  const current=await evaluate(`(() => {const r=fixture.r,c=r._directPresentation?r.canvas:r.presentationCanvas||r.canvas;return {box:c.getBoundingClientRect().toJSON(),backing:{w:r.canvas.width,h:r.canvas.height},png:c.toDataURL('image/png')};})()`);
  assert.deepEqual(current.backing,original.backing,'guest display mode must remain intact');
  const {PNG}=require('pngjs'),actual=PNG.sync.read(shot.png),publicPixels=PNG.sync.read(Buffer.from(current.png.split(',')[1],'base64'));
  assert.equal(actual.width,publicPixels.width);assert.equal(actual.height,publicPixels.height);assert(actual.data.equals(publicPixels.data));
  const b=current.box,screenshot=await cdp.send('Page.captureScreenshot',{format:'png',clip:{x:b.x,y:b.y,width:b.width,height:b.height,scale:1},captureBeyondViewport:false});
  const compositor=PNG.sync.read(Buffer.from(screenshot.data,'base64'));
  assert.equal(compositor.width,actual.width);assert.equal(compositor.height,actual.height);assert(compositor.data.equals(actual.data),'complete current Chrome paint must equal immutable capture');
  fs.writeFileSync(root+'/layout-exit-'+expect+'.png',Buffer.from(screenshot.data,'base64'),{flag:'wx'});
  report.fullscreenExitLayout={expect,original,gap:{visible:gap.outputVisible,reason:gap.outputVisibility.reason,geometry},current:{box:b,backing:current.backing,metadata:shot.metadata},realFullscreenExit:true,realViewportShrink:true,delayedCallbacks:true,completePublicPaint:true,originals:0,originalExitCause:'UNPROVED'};
  // A separately attached synthetic realm is genuinely destroyed. Its old
  // context identifier must fail rather than silently evaluate in a new one.
  // This connection never has input authorization and is closed afterwards.
  const retired=controller.connection(browserURL);await retired.ready;
  let target;
  try{
    target=(await retired.send('Target.createTarget',{url:'about:blank',background:true})).targetId;
    const session=(await retired.send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
    let context;
    retired.event=e=>{if(e.sessionId===session&&e.method==='Runtime.executionContextCreated'&&e.params.context.auxData?.isDefault)context=e.params.context;};
    await retired.send('Runtime.enable',{},session);
    assert(context?.id&&context.uniqueId,'actual independent realm identity');
    const oldContext={...context};
    const value=await retired.send('Runtime.evaluate',{expression:'17',uniqueContextId:oldContext.uniqueId,returnByValue:true},session);assert.equal(value.result.value,17);
    let didRetire=false;
    retired.event=e=>{if(e.sessionId===session&&(e.method==='Runtime.executionContextsCleared'||e.method==='Runtime.executionContextDestroyed'&&e.params.executionContextId===oldContext.id))didRetire=true;};
    await retired.send('Page.enable',{},session);
    await retired.send('Page.navigate',{url:'data:text/html,<title>replacement realm</title>'},session);
    const retireEnd=Date.now()+1000;
    while(!didRetire){assert(Date.now()<retireEnd,'actual realm retirement required');await new Promise(r=>setTimeout(r,10));}
    await assert.rejects(retired.send('Runtime.evaluate',{expression:'17',uniqueContextId:oldContext.uniqueId,returnByValue:true},session));
    report.fullscreenExitLayout.retiredContextRefused=true;
  }finally{
    // Target.closeTarget uses the live independent connection only when its
    // prior command was a known protocol refusal, never after UNKNOWN.
    if(target&&!retired.closed)await retired.send('Target.closeTarget',{targetId:target});
    retired.ws.close();
  }
  await evaluate(`(() => {const e=fixture.w.instance.exports;for(const [k,v] of Object.entries(fixture.layoutMode)){if(v===undefined)delete e[k];else e[k]=v;}delete fixture.layoutMode;Object.defineProperty(wineShell,"renderer",fixture.layoutShellRenderer);delete fixture.layoutShellRenderer;return true;})()`);
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  const entered=await cdp.send('Runtime.evaluate',{expression:"document.getElementById('screen-wrap').requestFullscreen().then(()=>true)",userGesture:true,awaitPromise:true,returnByValue:true});
  assert(!entered.exceptionDetails,'explicit fixture restoration for remaining controls');
  await page.waitForFunction("document.fullscreenElement===document.getElementById('screen-wrap')&&!fixture.r._repaintScheduled&&!fixture.r._workerPublicationHeld()");
}
module.exports={BASELINE,candidate,layoutWrites,resizeSource,INIT,chromeExit};
