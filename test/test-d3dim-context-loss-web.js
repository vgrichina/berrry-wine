#!/usr/bin/env node
'use strict';

// Real browser counterpart to the queued-Flip exception tests. The descriptor
// fixture follows native16-storage-web; every draw/read uses the shipped executor.
async function fixture() {
  const rows = [];
  const check = (v, label) => { if (!v) throw Error(label); };
  for (const bpp of [16, 32]) for (const route of ['queued', 'sync', 'fenceFlip']) {
    const row = {bpp, route, failures: []}; rows.push(row);
    globalThis.contextLossEvidence = rows;
    const memory = new ArrayBuffer(262144), dv = new DataView(memory), u8 = new Uint8Array(memory);
    const desc=4096, vertices=8192, call=2048, rt=65536, front=66000, dib=131072, other=132096, flip=3072;
    const width=8, height=8, pitch=width*(bpp/8)+8, format=bpp===16?1:0;
    const set=(i,v)=>dv.setUint32(desc+i*4,v,true);
    [rt,width,height,bpp,pitch,dib,format].forEach((v,i)=>set(i,v));
    set(17,4); set(20,5); set(21,6); set(27,1); set(28,2);
    [width,height,bpp,pitch].forEach((v,i)=>dv.setUint16(rt+12+i*2,v,true));
    dv.setUint32(rt+20,dib,true);dv.setUint32(front+20,other,true);
    dv.setUint32(flip,front,true);dv.setUint32(flip+4,rt,true);
    u8.fill(0xa5,dib-16,dib+pitch*height+16);u8.fill(0xc3,other-16,other+pitch*height+16);
    u8.fill(0x39,dib,dib+pitch*height);u8.fill(0x71,other,other+pitch*height);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const errors=[];row.errors=errors;
    const ex={guest_to_wasm:a=>a,d3dim_gpu_describe:()=>desc,d3dim_gpu_surface_fmt:()=>format,
      d3dim_worker_flip:(a,b)=>{const x=dv.getUint32(a+20,true);dv.setUint32(a+20,dv.getUint32(b+20,true),true);dv.setUint32(b+20,x,true);}};
    const make=()=>new D3DIMGpu.D3DIMGpu({webglVersion:2,batchDraws:false,asyncFlip:true,
      getMemory:()=>memory,getExports:()=>ex,createCanvas:()=>canvas,onError:e=>errors.push(String(e))});
    let gpu=make();
    const draw=color=>{
      [1,4,3,vertices,3].forEach((v,i)=>dv.setUint32(call+i*4,v,true));
      [[-8,-8],[24,-8],[-8,24]].forEach(([x,y],i)=>{
        const p=vertices+i*32;[x,y,.5,1].forEach((v,j)=>dv.setFloat32(p+j*4,v,true));dv.setUint32(p+16,color,true);
      });
      check(gpu.call(D3DIMGpu.OPCODES.DRAW,call)===1,'production draw accepted: '+errors.join('; '));
    };
    draw(0xffff0000);
    const t=gpu.targets.get(rt),gl=t.device.gpu.gl,ext=gl.getExtension('WEBGL_lose_context');
    check(ext,'public WEBGL_lose_context available');row.version=gl.getParameter(gl.VERSION);
    row.renderer=gl.getParameter(gl.RENDERER);
    const event=name=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error(name+' deadline')),5000);
      canvas.addEventListener(name,e=>{
        if(name==='webglcontextlost') {
          e.preventDefault();
          row.lossEvent={cancelable:e.cancelable,defaultPrevented:e.defaultPrevented};
        }
        clearTimeout(timer);
        // Chrome enables public restoration after loss dispatch finishes.
        // Resolving inside the listener resumes await during that dispatch.
        setTimeout(resolve,0);
      },{once:true,passive:false});
    });
    const before=Array.from(u8.slice(dib,dib+pitch*height));
    const otherBefore=Array.from(u8.slice(other-16,other+pitch*height+16));
    const canaries=()=>[...u8.slice(dib-16,dib),...u8.slice(dib+pitch*height,dib+pitch*height+16)];
    const guardBefore=canaries();
    if(route==='queued')check(gpu.call(D3DIMGpu.OPCODES.FLIP,flip)===1&&t.inflight,'accepted queued readback');
    // Loss happens after actual readback issue, before any asynchronous poll.
    let promise;
    if(route==='fenceFlip'){
      promise=gpu.fenceFlip().then(v=>({value:v}),e=>({error:String(e)}));
      check(gpu.stats.asyncReads===1&&gpu.stats.syncs===0,'actual asynchronous read is pending before loss');
    }
    const lost=event('webglcontextlost');ext.loseContext();await lost;
    check(gl.isContextLost(),'actual lost context');row.lost=true;
    row.eventFault=String(t.readbackFault||'');
    if(!/context lost/.test(row.eventFault))row.failures.push('loss event did not retain a frame fault');
    const collect=async()=>{
      try{return {value:route==='fenceFlip'?await gpu.fenceFlip():gpu.fence()};}catch(e){return {error:String(e)};}
    };
    row.lossResult=promise?await promise:await collect();
    if(!row.lossResult.error)row.failures.push('lost readback reported success');
    row.unchanged=JSON.stringify(before)===JSON.stringify(Array.from(u8.slice(dib,dib+pitch*height)));
    if(!row.unchanged)row.failures.push('lost readback overwrote accepted DIB');
    row.canaries=JSON.stringify(canaries())===JSON.stringify(guardBefore)&&
      JSON.stringify(Array.from(u8.slice(other-16,other+pitch*height+16)))===JSON.stringify(otherBefore);
    if(!row.canaries)row.failures.push('lost readback changed DIB guard or other backing');
    if(route==='queued'&&!t.inflight)row.failures.push('lost readback cleared accepted pending frame');
    if(route!=='queued'&&!t.dirty)row.failures.push('lost readback cleared dirty work');
    row.stats=gpu.snapshot();
    if(row.stats.syncs!==0)row.failures.push('lost readback counted as completed sync');
    row.pending=!!t.inflight;row.dirty=t.dirty;row.fault=String(t.readbackFault||'');
    const restored=event('webglcontextrestored');ext.restoreContext();await restored;
    check(!gl.isContextLost(),'actual restored context');row.restored=true;
    row.restoredError=gl.getError();
    check(row.restoredError===gl.NO_ERROR||row.restoredError===gl.CONTEXT_LOST_WEBGL,'only the public loss error may remain after restoration');
    row.oldAfterRestore=await collect();
    if(!row.oldAfterRestore.error)row.failures.push('invalid old GPU frame reported restored completion');
    row.afterRestoreUnchanged=JSON.stringify(before)===JSON.stringify(Array.from(u8.slice(dib,dib+pitch*height)));
    if(!row.afterRestoreUnchanged)row.failures.push('old frame changed DIB after restoration');
    if(JSON.stringify(canaries())!==JSON.stringify(guardBefore)||
        JSON.stringify(Array.from(u8.slice(other-16,other+pitch*height+16)))!==JSON.stringify(otherBefore))
      row.failures.push('old frame changed canaries after restoration');
    if(route==='queued'&&!t.inflight)row.failures.push('restoration cleared accepted pending frame');
    if(route!=='queued'&&!t.dirty)row.failures.push('restoration cleared dirty work');
    if(gpu.stats.syncs!==0)row.failures.push('old frame counted as completed after restoration');
    try{gpu.stop();}catch(e){row.stopError=String(e);}
    if(!/context lost/.test(row.stopError||''))row.failures.push('shutdown did not report the lost frame');
    row.cleanupGLError=gl.getError();
    check(row.cleanupGLError===gl.NO_ERROR,'restored executor cleanup GL error '+row.cleanupGLError);
    check(gpu.targets.size===0&&gpu.textures.size===0&&!gpu.pendingDraw,'failed executor cleanup');
    // A lost accepted frame cannot be recovered. Recreate the executor on the
    // restored canvas, then verify a NEW frame rather than inventing a present.
    dv.setUint32(rt+20,dib,true);dv.setUint32(front+20,other,true);set(5,dib);gpu=make();draw(0xff00ff00);
    if(route==='queued')check(gpu.call(D3DIMGpu.OPCODES.FLIP,flip)===1,'fresh queued flip');
    check((route==='fenceFlip'?await gpu.fenceFlip():gpu.fence())===1,'fresh restored frame fence');
    const expected=before.slice();
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*pitch+x*(bpp/8);expected[i]=bpp===16?0xe0:0;expected[i+1]=bpp===16?7:255;
      if(bpp===32){expected[i+2]=0;expected[i+3]=255;}
    }
    row.freshDIB=Array.from(u8.slice(dib,dib+pitch*height));
    check(JSON.stringify(row.freshDIB)===JSON.stringify(expected),'exact fresh native pixels and padding');
    check(JSON.stringify(canaries())===JSON.stringify(guardBefore),'fresh DIB guards');
    check(JSON.stringify(Array.from(u8.slice(other-16,other+pitch*height+16)))===JSON.stringify(otherBefore),'fresh other backing canaries');
    const fresh=gpu.targets.get(rt),g=fresh.device.gpu;g.bindImplicitTarget();
    const rgba=new Uint8Array(width*height*4);g.gl.readPixels(0,0,width,height,g.gl.RGBA,g.gl.UNSIGNED_BYTE,rgba);
    check(g.gl.getError()===g.gl.NO_ERROR,'fresh read error');
    check(rgba.every((v,i)=>v===[0,255,0,255][i%4]),'exact fresh RGBA');row.freshRGBA=Array.from(rgba);
    gpu.stop();check(!gpu.targets.size&&!gpu.textures.size,'fresh cleanup');
    check(gl.getError()===gl.NO_ERROR,'fresh cleanup GL error');
    check(errors.length===0,'no production fallback or error: '+errors.join('; '));
  }
  return rows;
}

// Separate permission from renderer behavior. Both controls preventDefault;
// only the task boundary before restoreContext differs. No executor is used.
async function restorationProbe() {
  const rows=[];
  for(const defer of [false,true]) {
    const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');
    const ext=gl.getExtension('WEBGL_lose_context'),row={defer};rows.push(row);
    await new Promise(resolve=>{
      const timer=setTimeout(()=>{row.timeout=true;resolve();},1000);
      canvas.addEventListener('webglcontextrestored',()=>{
        clearTimeout(timer);row.restored=!gl.isContextLost();resolve();
      },{once:true});
      canvas.addEventListener('webglcontextlost',e=>{
        e.preventDefault();row.cancelable=e.cancelable;row.defaultPrevented=e.defaultPrevented;
        const restore=()=>{ext.restoreContext();row.restoreError=gl.getError();};
        if(defer)setTimeout(restore,0);else Promise.resolve().then(restore);
      },{once:true,passive:false});
      ext.loseContext();
    });
  }
  return rows;
}

async function runtime(){
  const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
  const puppeteer=require('puppeteer'),root=process.cwd(),out=process.env.CONTEXT_LOSS_EVIDENCE;
  const scripts=['gpu-backend','d3d9-shader','d3d9-fixed','render-clear','d3d9-backend','d3dim-gpu'];
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  const evidence={source:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    hashes:Object.fromEntries([...scripts.map(n=>'lib/'+n+'.js'),path.relative(root,__filename)].map(n=>[n,hash(fs.readFileSync(path.join(root,n)))])),
    control:process.env.CONTEXT_LOSS_CONTROL||null,console:[]};
  let browser,closed;
  try{
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
      userDataDir:process.env.CONTEXT_LOSS_PROFILE});
    const child=browser.process();evidence.pid=child.pid;
    if(process.env.CONTEXT_LOSS_BROWSER_PID)fs.writeFileSync(process.env.CONTEXT_LOSS_BROWSER_PID,String(child.pid));
    closed=new Promise(resolve=>child.once('close',(code,signal)=>{evidence.close={code,signal};resolve();}));
    evidence.browser=await browser.version();
    const page=await browser.newPage();
    page.on('console',m=>evidence.console.push(m.text()));
    evidence.restorationProbe=await page.evaluate(restorationProbe);
    if(process.env.CONTEXT_LOSS_PROBE_ONLY)return;
    for(const n of scripts) {
      if(n==='d3dim-gpu'&&process.env.CONTEXT_LOSS_CONTROL) {
        const source=cp.execFileSync('git',['show',process.env.CONTEXT_LOSS_CONTROL+':lib/d3dim-gpu.js'],{encoding:'utf8'});
        evidence.controlSourceHash=hash(source);await page.addScriptTag({content:source});
      } else await page.addScriptTag({path:path.join(root,'lib',n+'.js')});
    }
    try{evidence.rows=await page.evaluate(fixture);}catch(e){evidence.rows=await page.evaluate(()=>globalThis.contextLossEvidence);throw e;}
    await page.close();await browser.close();await closed;browser=null;
    assert.deepEqual(evidence.close,{code:0,signal:null});
    assert.deepEqual(evidence.rows.flatMap(r=>r.failures),[]);
    evidence.status='PASS';console.log('PASS real WebGL loss/restore: six native16/32 queued/sync/fenceFlip cases');
  }catch(e){evidence.status='FAIL';evidence.error=String(e);throw e;}
  finally{if(browser)await browser.close();if(closed)await closed;if(out)fs.writeFileSync(out,JSON.stringify(evidence,null,2)+'\n');}
}
if(require.main===module)runtime().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture,runtime};
