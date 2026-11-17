'use strict';
// This exact browser entry is shared by authored PE qualification and originals.
function installDriver(root, {app, mode, deadline}) {
  let pin=null, closed=null;
  const waits={missingApp:0,missingInstance:0,missingWindow:0,missingDisplay:0,missingRenderer:0};
  const check=(v,s)=>{if(!v)throw Error(s);};
  const live=()=>{
    check(!closed,closed);check(Date.now()<deadline,'runtime deadline');
    const apps=typeof runningApps==='undefined'?[]:runningApps.filter(a=>a.name===app);
    check(apps.length<=1,'ambiguous selected app');
    const a=apps[0],w=a?.wine;
    if(!a){waits.missingApp++;return null;}
    if(!w?.instance||!w.renderer){waits.missingInstance++;return null;}
    check(!w._stopped&&w.running!==false,'stopped selected app');
    if(mode==='worker'&&!w.guestWorker?.link?.worker)return null;
    if(mode==='coop')check(!w.guestWorker,'unexpected guest Worker');
    const wins=Object.values(w.renderer.windows||{}).filter(v=>v.visible&&!v.isChild&&v.w>0&&v.h>0&&v.processId===w.processId&&v.wasm===w.instance);
    check(wins.length<=1,'ambiguous selected app window');
    if(!wins.length){waits.missingWindow++;return null;}
    const win=wins[0];check(Number.isInteger(win.hwnd)&&win.hwnd>0&&w.renderer.windows[win.hwnd]===win,'invalid live window');
    const manager=w._renderWorkerManager,ports=[...(manager?.ports?.values()||[])];
    check(!manager?._failure&&!w._renderWorkerRetired,'failed rendering owner');
    check(ports.every(p=>!p.closed),'closed rendering endpoint');
    const display=w.renderer._currentDisplayRecord;
    if(!display?.windows?.some(p=>p.window.deref()===win)){waits.missingDisplay++;return null;}
    const bridge=w.hostCtx?.d3dimBridge;
    if(root.WineD3D?.renderer==='webgl'&&!(bridge?.device&&((bridge.device.stats?.records||0)>0||bridge.stats.records>0))){waits.missingRenderer++;return null;}
    check(!bridge?.workerAsyncError&&!bridge?.workerClosing,'failed GPU stream owner');
    if(mode==='worker'&&root.WineD3D?.renderer!=='webgl'&&pinnedWorkerNotReady())return null;
    function pinnedWorkerNotReady(){const s=w.guestWorker?.d3dStats;if(!s?.ready){waits.missingRenderer++;return true;}check(!s.error,'failed guest render readiness');return false;}
    return {a,w,win,renderer:w.renderer,instance:w.instance,guest:w.guestWorker,manager,ports,bridge,device:bridge?.device};
  };
  const verify=()=>{
    const p=live();check(p,'absent selected app window');
    check(pin&&['a','w','win','renderer','instance','guest','manager','bridge','device'].every(k=>p[k]===pin[k])&&p.win.hwnd===pin.hwnd&&p.w.processId===pin.processId&&p.ports.length===pin.ports.length&&p.ports.every((v,i)=>v===pin.ports[i]&&v.id===pin.portIds[i]),'replaced selected owner');
    return p;
  };
  const describe=p=>({app:p.a.name,hwnd:p.win.hwnd,processId:p.w.processId,title:p.win.title,
    window:{x:p.win.x,y:p.win.y,w:p.win.w,h:p.win.h},guestWorker:!!p.guest,
    guestEndpoint:p.guest?.link?.endpointIdentity,renderEndpoints:p.ports.map(v=>({id:v.id,closed:v.closed,options:v.options})),
    d3dStats:p.guest?.d3dStats||null,requestedD3D:root.WineD3D?.renderer,
    bridgeStats:p.w.hostCtx?.d3dimBridge?.stats||null,bridgeDevice:p.w.hostCtx?.d3dimBridge?.device||null,
    waits:{...waits},inner:[innerWidth,innerHeight]});
  root.__boidsDriver={
    async ready(){try{
      while(Date.now()<deadline){const p=live();if(p){
        // A live renderer/window is mandatory. Scalar instance readiness is insufficient.
        // Pin only after ordinary creation has selected this owner.
        pin={...p,ports:p.ports.slice(),hwnd:p.win.hwnd,processId:p.w.processId,portIds:p.ports.map(v=>v.id)};
        return describe(verify());
      }await new Promise(r=>setTimeout(r,20));}
      throw Error('live app/window readiness deadline');
    }catch(e){closed=String(e);throw e;}},
    identity(){try{return describe(verify());}catch(e){closed=String(e);throw e;}},
    async capture(){let t;const started=Date.now(),end=Math.min(deadline,started+5000);try{
      const p=verify();t=p.w.requestCurrentDisplayCapture({hwnd:pin.hwnd});
      while(t.status==='pending'&&Date.now()<end){verify();await new Promise(r=>setTimeout(r,20));}
      check(Date.now()<end,'late capture data');check(t.status==='complete','DISPLAY_UNKNOWN '+t.status+' '+t.error);
      verify();const r=t.read(),m=r?.metadata;
      check(m?.observation==='current-display'&&m.captureOwner?.hwnd===pin.hwnd&&m.captureOwner?.processId===pin.processId,'wrong complete capture owner');
      check(m.readbackCompletedAt>=started&&m.readbackCompletedAt<end,'late complete capture');
      for(const k of ['source','output'])check(Number.isInteger(m[k]?.width)&&m[k].width>0&&Number.isInteger(m[k].height)&&m[k].height>0&&r[k+'RGBA']?.length===m[k].width*m[k].height*4,'incomplete frame');
      const encode=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
      const result={metadata:m,source:encode(r.sourceRGBA),output:encode(r.outputRGBA),identity:describe(verify()),elapsedMs:Date.now()-started};
      check(Date.now()<end,'late encoded capture');return result;
    }catch(e){t?.cancel();closed=String(e);throw e;}},
  };
}
module.exports={installDriver};
