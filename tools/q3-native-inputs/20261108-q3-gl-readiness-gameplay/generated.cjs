'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../..');
async function fixture(backend){
 const check=(v,s)=>{if(!v)throw Error(s)},logs=[];
 const module=await WebAssembly.compile(await(await fetch('/build/wine-assembly.wasm')).arrayBuffer());
 const sigs=(await(await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
 const apis=await(await fetch('/src/api_table.json')).json();
 const pe=new Uint8Array(await(await fetch('/test/binaries/calc.exe')).arrayBuffer());
 const imageBase=new DataView(pe.buffer).getUint32(new DataView(pe.buffer).getUint32(0x3c,true)+52,true);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const host={};for(const k of Object.keys(sigs))host[k]=()=>{throw Error('unexpected import '+k)};
 for(const k of ['log','log_i32','log_block','log_eip','log_api_exit','dx_trace','beep_process_begin','beep_thread_begin'])host[k]=(...args)=>{logs.push({k,args});return 0};
 const canvas=document.createElement('canvas');canvas.id='screen';canvas.width=320;canvas.height=200;document.body.append(canvas);
 host.get_window_rect=(hwnd,rect)=>{new Int32Array(memory.buffer,rect,4).set([0,0,8,8]);return 1};
 const renderer={windows:{},peekKeyDownState:()=>0,mergeGpuLayerIntoBackCanvas(){},attachWindowSurface(hwnd,canvas){if(!this.windows[hwnd])return false;this.windows[hwnd].surfaceCanvas=canvas;return true}};
 const real=createHostImports({getMemory:()=>memory.buffer,renderer});for(const [k,v] of Object.entries(real.host))if(k.startsWith('gdi_'))host[k]=v;
 const manager=new RenderWorker.Manager({module,memory,sigs,imageBase,workerUrl:'/lib/d3d-render-worker.js'});await manager.ready;
 const createEndpoint=async options=>{const p=manager.createEndpoint(options);await p.ready;return p};
 const bridge=new GLRenderHost.Bridge({backend,renderer,exports:{},createRenderEndpoint:createEndpoint,
  createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c},
  onPresent:layer=>canvas.getContext('2d').drawImage(layer.canvas,0,0,320,200)});
 host.gpu_gl_batch=(desc,owner)=>bridge.replay(Object.assign(GLCommandStream.memoryBatch(memory,desc.memoryOffset,desc.bytes),
  {pool:desc.pool,softwareConfig:desc.softwareConfig,softwareFront:desc.softwareFront}),owner);
 const broker=GuestRpc.createMainBroker(memory,host,sigs,{onError:(name,error)=>{globalThis.__generatedError=name+': '+error}});
 const link=new GuestWorkerLink({slot:0,module,memory,sigs,broker,workerUrl:'/lib/guest-worker.js',sharedRenderWorker:true,d3dimGpu:false,
  createRenderEndpoint:createEndpoint,log:s=>logs.push(s)});await link.start();
 const raw=(name,...args)=>link.callExport(name,...args);
 new Uint8Array(memory.buffer).set(pe,await raw('get_staging'));check(await raw('load_pe',pe.length),'load PE');
 const hwnd=65537;await raw('wnd_table_set',hwnd,0);await raw('ctrl_set_geom',hwnd,0,0,8,8);await raw('wnd_set_style_export',hwnd,0x10000000);
 await raw('test_gdi_client_rect_set',hwnd,0,0,8,8);renderer.windows[hwnd]={hwnd,w:8,h:8,clientRect:{w:8,h:8}};const dc=await raw('test_call_GetDC',hwnd);
 const stack=(await raw('guest_alloc',8192))+4096,out=await raw('guest_alloc',8);
 const wa=p=>raw('guest_to_wasm',p),read=p=>raw('guest_read32',p);
 const invoke=async(name,args=[])=>{
  const id=apis.find(a=>a.name===name)?.id;check(id!==undefined,name);
  const code=[],word=n=>code.push(n&255,n>>>8&255,n>>>16&255,n>>>24);
  for(const x of [...args].reverse()){code.push(0x68);word(x)}
  code.push(0xb8);word(await raw('get_thunk_base'));code.push(0xff,0xd0,0xa3);word(out);code.push(0xc3);
  const pc=await raw('guest_alloc',code.length+4);new Uint8Array(memory.buffer,await wa(pc),code.length).set(code);
  const dv=new DataView(memory.buffer),at=RegionMap.BASE.THUNK_BASE+4,old=dv.getUint32(at,true);dv.setUint32(at,id,true);
  try{await raw('set_esp',stack);await raw('call_func',pc,0,0,0,0);for(let n=0;n<100&&(await raw('get_eip'));n++)await raw('run',10000);
   check(!(await raw('get_eip')),'bounded public x86 completion '+name);return (await read(out))>>>0;
  }finally{dv.setUint32(at,old,true)}
 };
 const pfd=await raw('guest_alloc',40),dv=new DataView(memory.buffer),pa=await wa(pfd);
 dv.setUint16(pa,40,true);dv.setUint16(pa+2,1,true);dv.setUint32(pa+4,0x25,true);dv.setUint8(pa+9,32);dv.setUint8(pa+16,8);dv.setUint8(pa+23,16);
 const pf=await invoke('ChoosePixelFormat',[dc,pfd]);check(pf&&await invoke('SetPixelFormat',[dc,pf,pfd]),'public pixel format');
 const context=await invoke('wglCreateContext',[dc]);check(context&&await invoke('wglMakeCurrent',[dc,context]),'public WGL context');
 const wine={processId:1001,running:true,renderer,guestWorker:{link,get d3dStats(){return link.d3dStats||{}}},_renderWorkerManager:manager};
 globalThis.runningApps=[{name:'dx_tunnel',wine}];
 const f=x=>{const d=new DataView(new ArrayBuffer(4));d.setFloat32(0,x,true);return d.getUint32(0,true)};
 globalThis.__draw=async()=>{
  await invoke('glViewport',[0,0,8,8]);await invoke('glClearColor',[0,0,0,1].map(f));await invoke('glClear',[0x4000]);
  await invoke('glColor4f',[1,0,0,1].map(f));await invoke('glBegin',[4]);
  for(const p of [[-1,-1,0],[1,-1,0],[0,1,0]])await invoke('glVertex3f',p.map(f));await invoke('glEnd');
  await invoke('glFinish');await invoke('SwapBuffers',[dc]);await bridge.drain();
  // raw run results carry the production legacy renderer statistics.
  await link.slice(1);return {context,stats:link.d3dStats,logs};
 };
 globalThis.__fixture={wine,link,bridge,manager,raw,invoke,context,dc};globalThis.__generatedReady=true;
}
function handle(req,res){if(!req.url.startsWith('/generated-readiness'))return false;
 const backend=new URL(req.url,'http://local').searchParams.get('backend')||'software';
 const scripts=['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat','d3d-command-stream','guest-rpc','guest-thread-host','render-worker','gl-render-host','dib','gdi-surface','host-audio','host-window','host-imports'];
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Generated Q3 GL readiness controls</title>'+scripts.map(s=>'<script src="/lib/'+s+'.js"></script>').join('')+
  '<script>globalThis.runningApps=[];('+fixture.toString()+')('+JSON.stringify(backend)+').catch(e=>globalThis.__generatedError=String(e.stack||e));</script>');return true;
}
module.exports={handle};
