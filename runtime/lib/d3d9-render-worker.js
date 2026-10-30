// One endpoint owns its devices; the process render worker owns the WAT heap.
// Present transfers a GPU snapshot. Only READBACK reads GPU pixels into RAM.
(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory(node?require('./d3d-command-stream'):root.D3DCommandStream,
    node?require('./d3d9-backend'):root.D3D9Backend,
    node?require('./d3d9-software-backend'):root.D3D9SoftwareBackend);
  if(node)module.exports=api;else root.D3D9RenderWorker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Stream,Backend,Software){
  'use strict';
  function create({instance,memory,backend,options={}}){
    if(!['software','webgl'].includes(backend))throw new Error('invalid D3D9 worker backend');
    const devices=new Map(),op=Stream.OPCODES;
    let closed=false;
    const finish=device=>{
      if(device.gpu.gl.isContextLost())throw new Error('D3D9 GPU context lost');
      device.gpu.finish();
      if(device.gpu.gl.isContextLost())throw new Error('D3D9 GPU context lost');
    };
    function execute(command){
      if(closed)throw new Error('D3D9 endpoint closed');
      const p=command.payload,id=command.deviceId;
      if(command.opcode===op.RESOURCE_CREATE&&p.kind==='device'){
        if(devices.has(id)||p.backend&&p.backend!==backend)throw new Error('invalid D3D9 worker device creation');
        if(!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width>4096||p.height>4096)
          throw new Error('invalid D3D9 worker device dimensions');
        const device=backend==='software'?new (options.SoftwareDevice||Software.Device)({
          getExports:()=>instance.exports,getMemory:()=>memory.buffer,width:p.width,height:p.height,format:p.format,
          quadBudget:p.quadBudget,maxBytes:p.maxBytes,sliceMs:p.sliceMs===undefined?4:p.sliceMs,
          schedule:Software.yieldTask
        }):new (options.GPUDevice||Backend.Device)(options.createCanvas?
          options.createCanvas(p.width,p.height):new OffscreenCanvas(p.width,p.height));
        devices.set(id,{device,generation:command.generation});
        return {value:{width:p.width,height:p.height,pitch:p.width*4},complete:true};
      }
      const entry=devices.get(id);
      if(!entry||entry.generation!==command.generation)throw new Error('missing/stale D3D9 worker device');
      const device=entry.device;
      if(backend==='software'){
        const result=device.execute(command);
        if(command.opcode===op.RESOURCE_RELEASE&&p.kind==='device')devices.delete(id);
        return result;
      }
      let value=1;
      if(command.opcode===op.RESOURCE_RELEASE){
        if(p.kind==='device'){
          if(!device.gpu.gl.isContextLost())finish(device);
          device.destroy();devices.delete(id);
        }else if(p.kind==='color-set')for(const id of p.ids)device.releaseColor(id);
        else if(p.kind==='color')device.releaseColor(p.id);
        else if(p.kind==='depth')device.releaseDepth(p.id);
        else throw new Error('unsupported WebGL resource release kind');
        if(p.kind!=='device')finish(device);
        return {value,complete:true};
      }
      if(command.opcode===op.RESOURCE_UPDATE&&p.kind==='reset')device.reset(p);
      else if(command.opcode===op.RESOURCE_CREATE&&p.kind==='color')device.createColor(p.resource,p.pixels,p.pitch);
      else if(command.opcode===op.RESOURCE_UPDATE&&p.kind==='color')device.updateColor(p.resource,p.pixels,p.pitch,p.rect);
      else if(command.opcode===op.READBACK)value=device.readColor(p.resource||null);
      else if(command.opcode===op.CLEAR)device.clear(p.color,p.flags,p.depth,p.rects,p.depthAttachment,p.stencil,p.colorAttachment);
      else if(command.opcode===op.DRAW)device.draw(p);
      else if(command.opcode===op.PRESENT){
        const canvas=device.present();
        device.gpu.gl.flush();
        if(device.gpu.gl.isContextLost())throw new Error('D3D9 GPU context lost');
        if(typeof canvas.transferToImageBitmap!=='function')throw new Error('D3D9 worker presentation requires ImageBitmap');
        value={bitmap:canvas.transferToImageBitmap(),width:canvas.width,height:canvas.height};
      }else if(command.opcode!==op.FENCE)throw new Error('unsupported D3D9 worker render command');
      if(command.opcode===op.FENCE||command.opcode===op.READBACK||command.opcode===op.RESOURCE_UPDATE&&p.kind==='reset')finish(device);
      else if(device.gpu.gl.isContextLost())throw new Error('D3D9 GPU context lost');
      return {value,complete:true};
    }
    function destroy(){
      if(closed)return;closed=true;
      let error;
      for(const {device} of devices.values())try{device.destroy();}catch(e){error||=e;}
      devices.clear();if(error)throw error;
    }
    return {execute,destroy};
  }
  return {create};
});
