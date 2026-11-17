// Software-GL rasterization on the process render owner, in WAT: 0x20005
// draws, 0x20006 texture copies and their 0x20001 fence. The file keeps its
// D3DIM name because lib/d3d-render-worker.js maps the 'd3dim' adapter here.
// D3DIM itself is only the WAT GPU stream producer (src/09abg-d3dim-gps.wat):
// its old software protocol (0x20000 draw, 0x20002 ready, 0x20003 flip,
// 0x20004 clear) is retired and throws.
(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory();
  if(node)module.exports=api;else root.D3DIMRenderWorker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // `backend` is accepted and ignored.
  function create({instance,memory}){
    const e=instance.exports;
    function run({opcode,wa}){
        const d=new DataView(memory.buffer),u=offset=>d.getUint32((wa>>>0)+offset,true);
        if(opcode===0x20001)return 1;
        if(opcode===0x20005)return e.gl_sw_worker_draw(u(0),u(8))|0;
        if(opcode===0x20006){e.gl_sw_worker_tex_copy(u(0),u(8),u(12),u(16),u(20),u(24));return 1;}
        throw new Error('retired or unknown shared render operation 0x'+(opcode>>>0).toString(16));
    }
    return {
      get d3dimSoftwareDrawCallsCompleted(){return 0;},
      get diagnosticActive(){return false;},
      setDiagnosticContext(){},
      diagnosticRoute(){},
      execute(message){return run(message);},
      diagnostic(){
        throw new Error('ground diagnostic requires the WebGL D3DIM executor, which GPU stream v2 replaced');
      },
      fence(){return 1;},
      destroy(){}
    };
  }
  return {create};
});
