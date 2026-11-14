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
  // Retain only bounded draw state when the actual executor refuses a normal
  // transform. No vertex/texture bytes or successful-draw history is retained.
  function normalFailure(command,error,endpointId){
    if(error?.message!=='D3D9 fixed function: singular normal transform')return;
    const p=command.payload,f=p.fixedFunction||{};
    const fields=(value,names)=>Object.fromEntries(names.map(name=>[name,
      ['number','boolean'].includes(typeof value?.[name])?value[name]:null]));
    const matrix=value=>value instanceof Float32Array?{
      length:value.length,values:Array.from(value.subarray(0,16)),
      bits:Array.from(new Uint32Array(value.buffer,value.byteOffset,Math.min(value.length,16)))
    }:null;
    const freeze=value=>{
      if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
      return value;
    };
    const diagnostic=freeze({version:1,endpointId:endpointId??null,
      command:fields(command,['version','deviceId','generation','sequence','opcode']),
      draw:fields(p,['primitive','primitiveCount','stride']),
      vertexShader:!!p.vertexShader,pixelShader:!!p.pixelShader,nativeFixed:!!p.nativeFixed,
      world:matrix(f.world),view:matrix(f.view),projection:matrix(f.projection),
      attributeCount:p.attributes?.length??0,
      attributes:(p.attributes||[]).slice(0,16).map(a=>fields(a,['register','usage','usageIndex','type','offset','stream'])),
      flags:fields(f,['lighting','specular','normalizeNormals','localViewer','colorVertex',
        'diffuseMaterialSource','ambientMaterialSource','specularMaterialSource','emissiveMaterialSource',
        'fog','fogTableMode','fogVertexMode','rangeFog','alphaTest']),
      lightCount:f.lights?.length??0,lightTypes:(f.lights||[]).slice(0,8).map(l=>typeof l.type==='number'?l.type:null),
      stageCount:f.stages?.length??0,
      stages:(f.stages||[]).slice(0,8).map(s=>fields(s,['colorOp','alphaOp','colorArg0','colorArg1','colorArg2',
        'alphaArg0','alphaArg1','alphaArg2','resultArg','texCoordIndex','transformFlags'])),
      executorStack:String(error.stack||error).slice(0,8192)});
    Object.defineProperty(error,'drawDiagnostic',{value:diagnostic,enumerable:true});
  }
  function create({instance,memory,backend,options={},endpointId}){
    if(!['software','webgl'].includes(backend))throw new Error('invalid D3D9 worker backend');
    const devices=new Map(),op=Stream.OPCODES;
    let closed=false;
    const finish=device=>{
      if(device.contextLost||device.gpu.gl.isContextLost())throw new Error('D3D9 GPU context lost');
      device.gpu.finish();
      if(device.contextLost||device.gpu.gl.isContextLost())throw new Error('D3D9 GPU context lost');
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
          options.createCanvas(p.width,p.height):new OffscreenCanvas(p.width,p.height),{format:p.format});
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
        if(p.kind!=='device'&&(device.contextLost||device.gpu.gl.isContextLost()))throw new Error('D3D9 GPU context lost');
        if(p.kind==='device'){
          if(!device.contextLost&&!device.gpu.gl.isContextLost())finish(device);
          device.destroy();devices.delete(id);
        }else if(p.kind==='color-set')for(const id of p.ids)device.releaseColor(id);
        else if(p.kind==='color')device.releaseColor(p.id);
        else if(p.kind==='depth')device.releaseDepth(p.id);
        else throw new Error('unsupported WebGL resource release kind');
        // Ordered GL deletion retains resources needed by preceding commands.
        // Releasing an object is not a guest GPU-completion request.
        if(p.kind!=='device'&&device.gpu.gl.isContextLost())throw new Error('D3D9 GPU context lost');
        return {value,complete:true};
      }
      if(device.contextLost||device.gpu.gl.isContextLost())throw new Error('D3D9 GPU context lost');
      if(command.opcode===op.RESOURCE_UPDATE&&p.kind==='reset')device.reset(p);
      else if(command.opcode===op.RESOURCE_CREATE&&p.kind==='color')device.createColor(p.resource,p.pixels,p.pitch);
      else if(command.opcode===op.RESOURCE_UPDATE&&p.kind==='color')device.updateColor(p.resource,p.pixels,p.pitch,p.rect);
      else if(command.opcode===op.READBACK)value=device.readColor(p.resource||null);
      else if(command.opcode===op.CLEAR)device.clearCommand(p);
      else if(command.opcode===op.COPY)device.copyColor(p);
      else if(command.opcode===op.DRAW){
        try{device.draw(p);}catch(error){normalFailure(command,error,endpointId);throw error;}
      }
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
