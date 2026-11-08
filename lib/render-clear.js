// D3D9 clear contract. API depth encodings (including Glide W clears) belong
// to their caller; this contract only accepts normalized attachment values.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.RenderClear=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KIND='D3D9_CLEAR1';
  const fail=message=>{throw new Error(`D3D9 clear: ${message}`);};
  const uint=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff;
  function extent(width,height){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096)
      fail('invalid target extent');
  }
  function attachment(value,depth,width,height){
    // undefined is the device-owned default; null means absent depth (or the
    // default color target). Preserve both across copying/structured cloning.
    if(value==null)return value;
    const {id,width:w,height:h,format}=value;
    if(!uint(id)||!id||!Number.isInteger(w)||!Number.isInteger(h)||w<width||h<height||w>4096||h>4096||
      !(depth?[70,80,75,77]:[21,22,23]).includes(format)||(!depth&&(w!==width||h!==height)))
      fail('invalid attachment identity or extent');
    return Object.freeze({id,width:w,height:h,format});
  }
  function rectangle(r){
    if(!Array.isArray(r)||r.length!==4||!r.every(Number.isSafeInteger)||r[2]<r[0]||r[3]<r[1])
      fail('invalid rectangle ordering');
  }
  function build(p,width,height,strict){
    extent(width,height);
    const {color,flags,depth=1,stencil=0,colorMask=15}=p;
    if(!uint(flags)||flags>7)fail('invalid flags');
    if(!Array.isArray(color)||color.length!==4||color.some(v=>!Number.isFinite(v)||v<0||v>1))fail('invalid color');
    if(!Number.isInteger(colorMask)||colorMask<0||colorMask>15)fail('invalid channel mask');
    if((flags&2)&&(!Number.isFinite(depth)||depth<0||depth>1))fail('invalid depth value');
    const colorAttachment=attachment(p.colorAttachment,false,width,height);
    const depthAttachment=attachment(p.depthAttachment,true,width,height);
    if((flags&2)&&depthAttachment===null)fail('depth clear without depth attachment');
    if((flags&4)&&(!uint(stencil)||depthAttachment?.format!==75))fail('stencil clear requires D24S8 and uint32 value');
    const clip=p.clip??[0,0,width,height];rectangle(clip);
    if(clip[0]<0||clip[1]<0||clip[2]>width||clip[3]>height)fail('invalid clip extent');
    const input=p.rects==null?[clip]:p.rects;
    if(!Array.isArray(input)||input.length>65536)fail('invalid rectangles');
    const rects=[];
    for(const r of input){
      rectangle(r);
      if(strict&&(r[0]<0||r[1]<0||r[2]>width||r[3]>height||
        (strict==='descriptor'&&(r[0]===r[2]||r[1]===r[3]))))fail('noncanonical rectangle');
      const c=[Math.max(r[0],clip[0]),Math.max(r[1],clip[1]),Math.min(r[2],clip[2]),Math.min(r[3],clip[3])];
      if(c[2]>c[0]&&c[3]>c[1])rects.push(Object.freeze(c));
    }
    return Object.freeze({kind:KIND,width,height,origin:'top-left',flags,
      color:Object.freeze(color.slice()),depth,stencil,colorMask,
      rects:Object.freeze(rects),colorAttachment,depthAttachment});
  }
  function create(p,width,height){return build(p,p.colorAttachment?.width??width,p.colorAttachment?.height??height,false);}
  // Capture while the native D3D state guard is held. Every returned field is
  // owned; no descriptor, rectangle or attachment view escapes guest memory.
  function captureNative({memory,guestToWasm:g2w,address,resolveColor}){
    const view=new DataView(memory),u32=p=>view.getUint32(p,true);
    const id=u32(address),program=g2w(u32(address+4));
    let width=u32(address+12),height=u32(address+16),colorAttachment;
    const colorPointer=u32(program+22020);
    if(colorPointer){
      if(typeof resolveColor!=='function')fail('color resource resolver required');
      colorAttachment=resolveColor(g2w(colorPointer));
      width=colorAttachment.width;height=colorAttachment.height;
    }
    const depthPointer=u32(program+21752);
    const depthAttachment=depthPointer?(()=>{
      const p=g2w(depthPointer);
      if(u32(p+12)!==0xd3d90005||u32(p+8)!==id)throw new Error('invalid D3D9 depth attachment identity');
      return {id:u32(p+36),width:u32(p+20),height:u32(p+24),format:u32(p+28)};
    })():null;
    const outputState=g2w(u32(address+40));
    const scissor=u32(outputState+256+174*4)?[
      u32(program+22016)?view.getInt32(program+22000,true):0,
      u32(program+22016)?view.getInt32(program+22004,true):0,
      u32(program+22016)?view.getInt32(program+22008,true):width,
      u32(program+22016)?view.getInt32(program+22012,true):height,
    ]:null;
    if(scissor&&(scissor[0]<0||scissor[1]<0||scissor[2]<scissor[0]||
        scissor[3]<scissor[1]||scissor[2]>width||scissor[3]>height))
      throw new Error('invalid D3D9 scissor rectangle');
    const color=u32(address+48),z=view.getFloat32(address+52,true);
    const count=u32(address+56),ptr=u32(address+60),flags=u32(address+44);
    if(!!count!==!!ptr||count>65536)throw new Error('invalid D3D9 clear rectangle count/pointer');
    const vx=u32(program+21736)?u32(program+21728):0,vy=u32(program+21736)?u32(program+21732):0;
    const vw=u32(program+21736)||width,vh=u32(program+21736)?u32(program+21740):height;
    if(!vw||!vh||vx+vw>width||vy+vh>height)throw new Error('invalid D3D9 clear viewport');
    const clip=scissor?[Math.max(vx,scissor[0]),Math.max(vy,scissor[1]),
      Math.min(vx+vw,scissor[2]),Math.min(vy+vh,scissor[3])]:[vx,vy,vx+vw,vy+vh];
    clip[2]=Math.max(clip[0],clip[2]);clip[3]=Math.max(clip[1],clip[3]);
    const rects=[];
    if(count){
      const p=g2w(ptr),size=count*16;
      if(ptr+size>0x100000000||p<256||p+size>memory.byteLength||g2w(ptr+size-1)!==p+size-1)
        throw new Error('invalid D3D9 clear rectangle range');
      for(let i=0;i<count;i++){
        const at=p+i*16;
        rects.push([0,4,8,12].map(offset=>view.getInt32(at+offset,true)));
      }
    }
    return create({color:[((color>>>16)&255)/255,((color>>>8)&255)/255,(color&255)/255,(color>>>24)/255],
      flags,depth:z,stencil:u32(address+24),rects:count?rects:null,clip,depthAttachment,colorAttachment},width,height);
  }
  function validate(p,width,height){
    const w=p.colorAttachment?.width??width,h=p.colorAttachment?.height??height;
    if(p.kind!==KIND||p.origin!=='top-left'||p.width!==w||p.height!==h||p.clip!==undefined||
      !Array.isArray(p.rects)||p.colorMask===undefined||p.depth===undefined||p.stencil===undefined||
      !Object.prototype.hasOwnProperty.call(p,'colorAttachment')||
      !Object.prototype.hasOwnProperty.call(p,'depthAttachment'))
      fail('invalid descriptor');
    return build(p,w,h,'descriptor');
  }
  // Legacy callers keep their positional clear ABI. Object commands published
  // by the D3D9 host always use KIND; old direct/neutral callers remain legal.
  function command(p,width,height){
    // Older positional/neutral callers already supply target-bounded regions;
    // keep their rejection of out-of-range rectangles and their empty no-ops.
    return p.kind===undefined?build(p,p.colorAttachment?.width??width,p.colorAttachment?.height??height,'legacy'):
      validate(p,width,height);
  }
  return {KIND,create,validate,command,captureNative};
});
