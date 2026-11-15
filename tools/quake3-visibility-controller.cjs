'use strict';
// Public DOM diagnostics. No admission predicate, input, rendering or clock changes.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const RUN='scratch/runs/20261115-quake3-fullscreen-visibility/';
const HELPER=path.join(__dirname,'quake3-browser-controller.cjs');
const BINDING='__q3VisibilityOperands';
function publicOperands(output) {
  const box=e=>e?.getBoundingClientRect().toJSON()??null;
  const styles=e=>{const s=getComputedStyle(e);return Object.fromEntries([
    'display','visibility','opacity','position','zIndex','overflowX','overflowY',
    'clip','clipPath','transform','filter','maskImage','pointerEvents','backgroundColor','backgroundImage',
    'boxShadow','backdropFilter','contain','isolation','objectFit','outlineStyle','outlineWidth','outlineColor',
    ...['Top','Right','Bottom','Left'].flatMap(k=>['border'+k+'Width','border'+k+'Color'])
  ].map(k=>[k,s[k]]));};
  const element=e=>e?{tag:e.tagName,id:e.id,parentId:e.parentElement?.id??null,connected:e.isConnected,box:box(e),style:styles(e),client:{width:e.clientWidth??null,height:e.clientHeight??null,left:e.clientLeft??null,top:e.clientTop??null},backing:e.tagName==='CANVAS'?{width:e.width,height:e.height}:null}:null;
  const ancestors=[];for(let e=output;e;e=e.parentElement)ancestors.push(element(e));
  const b=box(output),intersecting=[];
  if(b)for(const e of document.querySelectorAll('*')){
    if(e===output||e.contains(output))continue;
    const r=box(e);
    if(!(r.width>0&&r.height>0&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top))continue;
    const chain=[];for(let p=e;p;p=p.parentElement)chain.push(element(p));
    intersecting.push({element:element(e),ancestors:chain,insideFullscreen:!!document.fullscreenElement?.contains(e),
      ownText:[...e.childNodes].some(n=>n.nodeType===3&&!!n.textContent.trim()),
      pseudo:['::before','::after'].map(p=>{const s=getComputedStyle(e,p);return {pseudo:p,content:s.content,display:s.display,opacity:s.opacity};})});
  }
  const samples=[];
  if(b)for(const [x,y] of [[b.left+1,b.top+1],[b.right-1,b.top+1],[b.left+1,b.bottom-1],[b.right-1,b.bottom-1],[(b.left+b.right)/2,(b.top+b.bottom)/2]]){
    if(x>=0&&y>=0&&x<innerWidth&&y<innerHeight)samples.push({x,y,elements:document.elementsFromPoint(x,y).map(element)});
  }
  return {at:Date.now(),bodyClass:document.body?.className??null,documentVisibility:document.visibilityState,hasFocus:document.hasFocus(),
    viewport:{width:innerWidth,height:innerHeight,devicePixelRatio,visual:globalThis.visualViewport?{
      width:visualViewport.width,height:visualViewport.height,offsetLeft:visualViewport.offsetLeft,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null},
    fullscreen:element(document.fullscreenElement),fullscreenContainsOutput:!!document.fullscreenElement?.contains(output),
    output:element(output),ancestors,intersecting,samples,activeElement:element(document.activeElement),
    pointerLock:element(document.pointerLockElement),topLayer:[...document.querySelectorAll('dialog:modal, :popover-open')].map(element)};
}
function replaceOnce(source,needle,replacement){assert.equal(source.split(needle).length,2,'visibility anchor changed: '+needle.slice(0,80));return source.replace(needle,replacement);}
function compose(source){
  let value=replaceOnce(source,'const outputVisibility=visibility(output);','const outputVisibility=visibility(output);outputVisibility.operands=('+publicOperands.toString()+')(output);outputVisibility.physicalAll=Array.from({length:256},(_,key)=>({key,state:w?.renderer?.peekKeyDownState(key)??null}));');
  value=replaceOnce(value,'const PAGE_READ = `(() => {','const PAGE_READ = `(() => { const result=(() => {');
  value=replaceOnce(value,'  })};\n})()`;',"  })};\n})();globalThis."+BINDING+"(JSON.stringify(result));return result;})()`;");
  value=replaceOnce(value,"c.event=v=>{\n      if(v.method==='Target.attachedToTarget'","c.event=v=>{\n      if(v.method==='Runtime.bindingCalled'&&v.params.name==='"+BINDING+"'){log('visibility-operands.jsonl',{at:Date.now(),sessionId:v.sessionId,observation:JSON.parse(v.params.payload)});return;}\n      if(v.method==='Target.attachedToTarget'");
  value=replaceOnce(value,'    // Registered cooperative 10000 scheduling is unchanged.',"    await c.send('Runtime.addBinding',{name:'"+BINDING+"'},session);\n    // Registered cooperative 10000 scheduling is unchanged.");
  return value+'\nmodule.exports.browser=browser;\n';
}
function controller(){const m=new Module(HELPER,module);m.filename=HELPER;m.paths=module.paths;m._compile(compose(fs.readFileSync(HELPER,'utf8')),HELPER);return m.exports;}
function qualificationSource(source){
  let value=replaceOnce(source,"const controller=require('../tools/quake3-browser-controller.cjs');", "const controller=require('../tools/quake3-visibility-controller.cjs').controller();");
  const begin=value.indexOf('async function browserCaptureControls()'),end=value.indexOf('async function chainControls()');
  assert(begin>0&&end>begin);
  const part=value.slice(begin,end).replaceAll("require('../'+controller.HELPER)",'controller');
  value=value.slice(0,begin)+part+value.slice(end);
  value=replaceOnce(value,"await cdp.send('Runtime.enable',{});await cdp.send('Page.enable',{});", "await cdp.send('Runtime.addBinding',{name:'"+BINDING+"'});await cdp.send('Runtime.enable',{});await cdp.send('Page.enable',{});");
  value=replaceOnce(value,'  c.event=v=>{',"  c.event=v=>{if(v.method==='Runtime.bindingCalled'&&v.params.name==='"+BINDING+"'){fs.appendFileSync(root+'/visibility-operands.jsonl',JSON.stringify({at:Date.now(),sessionId:v.sessionId,observation:JSON.parse(v.params.payload)})+'\\n');return;}");
  value=replaceOnce(value,'    report.hostNoReplay=true;',"    report.hostNoReplay=true;await require('../tools/quake3-visibility-controller.cjs').fullscreenTransitions({evaluate,cdp,page,report,PAGE_READ});");
  return value;
}
async function fullscreenTransitions({evaluate,cdp,page,report,PAGE_READ}){
  const observations=[];report.visibilityTransitions={observations,originalLaunched:false};
  const observe=async label=>{const p=await evaluate(PAGE_READ);observations.push({label,page:p});return p.apps[0];};
  await observe('before-production-resize');
  await evaluate('resizeCanvas();true');
  await page.waitForFunction('!fixture.r._repaintScheduled&&!fixture.r._workerPublicationHeld()');
  assert((await observe('after-production-resize')).outputVisible,'ordinary production resize obscured fullscreen output');
  await evaluate('document.exitFullscreen().then(()=>true)');
  assert.equal(await evaluate('document.fullscreenElement===null'),true);
  await observe('after-fullscreen-exit');
  // These are explicit browser fixture transitions, not another host-consent
  // replay, gameplay action or guest fullscreen request.
  const entered=await cdp.send('Runtime.evaluate',{expression:"document.getElementById('screen-wrap').requestFullscreen().then(()=>true)",userGesture:true,awaitPromise:true,returnByValue:true});
  assert(!entered.exceptionDetails,'fixture browser fullscreen reentry failed');
  await page.waitForFunction("document.fullscreenElement===document.getElementById('screen-wrap')&&!fixture.r._repaintScheduled&&!fixture.r._workerPublicationHeld()");
  assert((await observe('after-browser-fullscreen-reentry')).outputVisible,'fullscreen reentry output not visible');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:900,height:720,deviceScaleFactor:1,mobile:false});
  await page.waitForFunction('!fixture.r._repaintScheduled&&!fixture.r._workerPublicationHeld()');
  assert((await observe('after-browser-viewport-resize')).outputVisible,'viewport resize obscured fullscreen output');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.waitForFunction('!fixture.r._repaintScheduled&&!fixture.r._workerPublicationHeld()');
  assert((await observe('after-browser-viewport-restore')).outputVisible,'viewport restore obscured fullscreen output');
  await evaluate(`(() => {const r=fixture.r,c=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas,p=c.parentElement,b=c.getBoundingClientRect();fixture.visibilityClip={c,p,cs:c.getAttribute('style'),ps:p.getAttribute('style')};c.style.setProperty('width',b.width+'px','important');p.style.setProperty('width',Math.max(1,b.width-20)+'px','important');p.style.overflow='hidden';return true;})()`);
  const clipped=await observe('actual-ancestor-clipping');
  assert.equal(clipped.outputVisible,false,'real ancestor clipping must refuse');
  assert.equal(clipped.outputVisibility.reason,'output ancestor clips canvas');
  await assert.rejects(controller().captureScene({evaluate,identity:clipped}),/visible/);
  await evaluate(`(() => {const f=fixture.visibilityClip;for(const [e,s] of [[f.c,f.cs],[f.p,f.ps]]){if(s===null)e.removeAttribute('style');else e.setAttribute('style',s);}delete fixture.visibilityClip;return true;})()`);
  assert((await observe('after-ancestor-style-restoration')).outputVisible,'exact fixture style restoration failed');

  report.visibilityTransitions={observations,productionResize:true,browserFullscreenExitAndReentry:true,browserViewportResizeAndRestore:true,actualAncestorClippingRefused:true,originalLaunched:false};
}
function installServer(out){
  const api=require('../test/static-server.js'),start=api.startStaticServer;
  api.startStaticServer=async function(options){
    const server=await start(options);
    server.prependListener('request',(req,res)=>{
      const h=require('node:crypto').createHash('sha256');let bytes=0;
      const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);h.update(b);bytes+=b.length;}};
      const write=res.write,end=res.end;
      res.write=function(b){add(b);return write.apply(this,arguments);};
      res.end=function(b){add(b);return end.apply(this,arguments);};
      res.once('finish',()=>fs.appendFileSync(out+'/http.jsonl',JSON.stringify({url:req.url,status:res.statusCode,bytes,sha256:h.digest('hex')})+'\n'));
    });return server;
  };
}
function qualified(out){
  assert(path.resolve(out).startsWith(ROOT+'/'+RUN));
  const pins=JSON.parse(fs.readFileSync(out+'/pins.json')),sha=require('node:crypto').createHash;
  for(const p of [...pins.files,...pins.hostFiles])assert.equal(sha('sha256').update(fs.readFileSync(path.resolve(ROOT,p.path))).digest('hex'),p.sha256,'prelaunch dependency drift: '+p.path);
  installServer(out);
  const filename=ROOT+'/test/quake3-browser-controller.test.cjs',source=qualificationSource(fs.readFileSync(filename,'utf8'));
  assert.equal(sha('sha256').update(source).digest('hex'),pins.compositions.qualification,'prelaunch qualification composition drift');
  assert.equal(sha('sha256').update(compose(fs.readFileSync(HELPER,'utf8'))).digest('hex'),pins.compositions.controller,'prelaunch controller composition drift');
  const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
  fs.writeFileSync(out+'/qualification-composition.json',JSON.stringify({sourcePath:path.relative(ROOT,filename),originalSha256:controller().sha(fs.readFileSync(filename)),composedSha256:controller().sha(Buffer.from(source)),sourceCopy:false})+'\n',{flag:'wx'});
  m._compile(source,filename);
}
module.exports={BINDING,RUN,publicOperands,replaceOnce,compose,controller,qualificationSource,fullscreenTransitions,installServer,qualified};
if(require.main===module){const [mode,out]=process.argv.slice(2);assert.equal(mode,'qualified');qualified(out);}
