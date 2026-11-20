'use strict';
// Operator targeting only. This supplies no guest input token or focus override.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
function startIdentity(pid){return fs.readFileSync('/proc/'+pid+'/stat','utf8').split(') ').at(-1).split(' ')[19];}
function point(state,x,y){
  assert(state.hasFocus&&state.visible==='visible','actual browser page focus required');
  assert(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<state.width&&y<state.height,'current CSS viewport coordinates required');
  assert(state.visual.scale===1&&state.visual.x===0&&state.visual.y===0,'unmapped visual viewport');
  const r=state.rect;assert(r.width>0&&r.height>0&&x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom,'point outside current canvas');
  return {x,y,canvasX:(x-r.left)*state.canvasWidth/r.width,canvasY:(y-r.top)*state.canvasHeight/r.height};
}
function createOwnedTarget({connection:c,session,targetId,pid,startToken,env,lifecycle,record=()=>{}}){
  const check=()=>{lifecycle?.checkpoint('owned-DOM-target');assert.equal(startIdentity(pid),startToken,'browser PID start identity changed');};
  const exec=(cmd,args)=>{check();return cp.execFileSync(cmd,args,{env,encoding:'utf8',timeout:1000}).trim();};
  const evaluate=async expression=>{check();const r=await c.send('Runtime.evaluate',{expression,returnByValue:true},session);assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  let windowId=null,documentId=null;
  async function activate(){
    check();const info=(await c.send('Target.getTargetInfo',{targetId})).targetInfo;
    assert.equal(info.targetId,targetId);assert.equal(info.type,'page');assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(info.url),'owned loopback page required');
    const ids=exec('xdotool',['search','--onlyvisible','--pid',String(pid)]).split(/\s+/);assert.equal(ids.length,1,'ambiguous owned browser windows');
    if(windowId)assert.equal(ids[0],windowId,'browser window replaced');windowId=ids[0];
    const properties=exec('xprop',['-id',windowId,'_NET_WM_PID','WM_CLASS']);assert(properties.includes('_NET_WM_PID(CARDINAL) = '+pid+'\n'),'window PID mismatch');
    exec('xdotool',['windowactivate','--sync',windowId]);assert.equal(exec('xdotool',['getactivewindow']),windowId,'owned browser not active');
    await c.send('Page.bringToFront',{},session);check();
    const bounds=await c.send('Browser.getWindowForTarget',{targetId});
    record({kind:'owned-window',pid,startToken,windowId,properties,bounds});return {pid,startToken,windowId,bounds};
  }
  async function inspect(x,y){
    check();const s=await evaluate(`(()=>{const w=globalThis.__forsakenOwner,r=w?.renderer,canvas=r?.presentationCanvas||document.querySelector('canvas');if(!canvas)throw Error('current canvas absent');
      let a=globalThis.__hexOwnedDomTarget;if(!a){a=globalThis.__hexOwnedDomTarget={canvas,timeOrigin:performance.timeOrigin,url:location.href,ledger:[]};
        for(const type of ['mousedown','mouseup','click'])window.addEventListener(type,e=>{a.ledger.push({type,trusted:e.isTrusted,targetCanvas:e.target===a.canvas,x:e.clientX,y:e.clientY,at:Date.now()});if(a.ledger.length>128)a.ledger.shift();},true);}
      if(a.canvas!==canvas||a.timeOrigin!==performance.timeOrigin||a.url!==location.href)throw Error('current DOM target replaced');
      const rect=canvas.getBoundingClientRect();return {timeOrigin:a.timeOrigin,url:a.url,hasFocus:document.hasFocus(),visible:document.visibilityState,
        width:innerWidth,height:innerHeight,dpr:devicePixelRatio,screenX,screenY,outerWidth,outerHeight,
        visual:{scale:visualViewport.scale,x:visualViewport.offsetLeft,y:visualViewport.offsetTop},rect:rect.toJSON(),canvasWidth:canvas.width,canvasHeight:canvas.height,
        hit:document.elementFromPoint(${JSON.stringify(x)},${JSON.stringify(y)})===canvas,ledger:a.ledger.slice()};})()`);
    if(documentId)assert.equal(s.timeOrigin,documentId,'page incarnation changed');documentId=s.timeOrigin;
    const mapped=point(s,x,y);assert(s.hit,'point does not hit intended current canvas');check();record({kind:'DOM-target',...s,mapped});return {...s,mapped};
  }
  function delivered(before,after,edge){
    assert.equal(after.timeOrigin,before.timeOrigin);assert.equal(after.url,before.url);
    const events=after.ledger.filter(e=>e.at>=edge.at&&e.type===edge.type);
    assert(events.some(e=>e.trusted&&e.targetCanvas&&e.x===edge.x&&e.y===edge.y),'trusted DOM mouse edge at intended canvas absent');
    return events;
  }
  return {activate,inspect,delivered};
}
module.exports={startIdentity,point,createOwnedTarget};
