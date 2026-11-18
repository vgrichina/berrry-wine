'use strict';

// Installed before instantiation in each browser realm. Observe only existing
// calls and their returns. No guest calls, API tracing flags, repaint or input.
function install(root = globalThis) {
  const wasm=root.WebAssembly, original=wasm.instantiate;
  const report=root.__oaPresentation={instances:[],calls:{},rows:[],errors:[]};
  const selected=/^(gdi_surface_(create|upload|attach|delete)|dx_trace|gpu_stream_kick|gpu_gl_call|load_library|read_file|fs_(open_file|read_file|read_file_at|read_pending|read_file_result|close_handle))$/;
  wasm.instantiate=async function(module,imports,...rest) {
    if(report.instances.length>=16)return Reflect.apply(original,this,[module,imports,...rest]);
    const row={id:report.instances.length+1,at:Date.now(),moduleKind:module instanceof wasm.Module?'compiled-module':'bytes',moduleSha256:null,imports:null,exports:null,instantiated:false};
    report.instances.push(row);
    if(module instanceof wasm.Module){row.imports=wasm.Module.imports(module).length;row.exports=wasm.Module.exports(module).length;}
    else if(root.crypto?.subtle) {
      // Hash bytes supplied to this actual instantiation, without Debugger.
      const bytes=ArrayBuffer.isView(module)?new Uint8Array(module.buffer,module.byteOffset,module.byteLength):module;
      root.crypto.subtle.digest('SHA-256',bytes).then(b=>{row.moduleSha256=Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');}).catch(e=>report.errors.push(String(e)));
    }
    const host=imports?.host;
    if(host)for(const name of Object.keys(host)){
      if(!selected.test(name)||typeof host[name]!=='function')continue;
      const fn=host[name];
      host[name]=function(...args){
        const result=Reflect.apply(fn,this,args);
        const key=name==='dx_trace'?name+':'+(args[0]>=0&&args[0]<64?args[0]:'other'):name;
        const c=report.calls[key]||(report.calls[key]={returned:0,nonzero:0});
        c.returned++;if(result)c.nonzero++;
        if(report.rows.length<128 || name==='dx_trace'&&[5,6].includes(args[0])){
          report.rows.push({instance:row.id,at:Date.now(),name,args:args.slice(0,13),result:typeof result==='number'?result:null,boundary:'host-import-return'});
          if(report.rows.length>256)report.rows.splice(128,1);
        }
        return result;
      };
    }
    const result=await Reflect.apply(original,this,[module,imports,...rest]);
    row.instantiated=true;row.completedAt=Date.now();return result;
  };
  return ()=>{wasm.instantiate=original;};
}

// Existing page caches only: reading canonical canvas pixels would flush work.
function readPage(){
  return (typeof runningApps==='undefined'?[]:runningApps).map(a=>{
    const w=a.wine,r=w?.renderer;
    const surfaces=Array.from(w?.hostCtx?.sharedGdi?.surfacePresentations?.values?.()||[]).map(p=>({
      id:p.id,targetHwnd:p.targetHwnd??null,directDraw:p.directDraw,width:p.width,height:p.height,
      version:p.version,uploaded:p.uploaded,flushCount:p.flushCount,writeSeq:p.writeSeq??null,pendingGuestUpload:p.pendingGuestUpload??null}));
    return {name:a.name,processId:w?.processId,publication:r?._immutablePublicationSequence??null,
      displayedAt:r?._currentDisplayRecord?.displayedAt??null,surfaces,
      windows:Object.values(r?.windows||{}).map(v=>({hwnd:v.hwnd,processId:v.processId,visible:v.visible,
        back:v._backCanvas?._waCanonicalPresentation?.id??null,
        layer:v._dxFrameLayer?{api:v._dxFrameLayer.api,kind:v._dxFrameLayer.kind,seq:v._dxFrameLayer.d3dimPresentSeq??null}:null}))};
  });
}
// Preserve the worker's original strict-mode prologue when prepending code.
const prefix="'use strict';\n;("+install.toString()+')(globalThis);\n';
module.exports={install,readPage,prefix};
