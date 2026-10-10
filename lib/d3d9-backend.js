// Immutable D3D9 draw snapshots lowered to the shared GPU contract.
// Guest identity, COM refs and mutable device state stay outside this class.
(function (root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./gpu-backend') : root.GpuBackend,
    node ? require('./d3d9-shader') : root.D3D9Shader,
    node ? require('./d3d9-fixed') : root.D3D9Fixed);
  if (node) module.exports = api; else root.D3D9Backend = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (GPU, Shader, Fixed) {
  'use strict';
  const invalid = message => { throw new Error(`D3D9 draw: ${message}`); };
  // Extend an RGBA8 chain that stops above 1x1 down to 1x1 with 2x2 box
  // filtering of the last level (an odd or 1-wide axis repeats its edge).
  const completeMipChain = levels => {
    const out = levels.slice();
    let last = out.at(-1);
    if (!(last.pixels instanceof Uint8Array)) invalid('incomplete mip chain on a GPU-resident level');
    while (last.width > 1 || last.height > 1) {
      const sw = last.width, sh = last.height, src = last.pixels;
      const width = Math.max(1, sw >> 1), height = Math.max(1, sh >> 1);
      const pixels = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const x0 = Math.min(x * 2, sw - 1), x1 = Math.min(x * 2 + 1, sw - 1);
        const y0 = Math.min(y * 2, sh - 1), y1 = Math.min(y * 2 + 1, sh - 1);
        for (let c = 0; c < 4; c++) {
          pixels[(y * width + x) * 4 + c] = (src[(y0 * sw + x0) * 4 + c] + src[(y0 * sw + x1) * 4 + c]
            + src[(y1 * sw + x0) * 4 + c] + src[(y1 * sw + x1) * 4 + c] + 2) >> 2;
        }
      }
      last = { width, height, pixels };
      out.push(last);
    }
    return out;
  };
  // What a sampler reads when the shader samples a stage with no texture bound.
  // D3D9 calls that UNDEFINED; transparent black is the conservative reading,
  // contributing nothing to whatever the shader does with it. Shared, never
  // written, and deliberately identical to the software backend's constant.
  const UNBOUND_SAMPLER = Object.freeze({ width: 1, height: 1, pixels: new Uint8Array(4) });
  const zeroInteger = new Int32Array(4);
  const typedBanks = [
    ['vertexIntegerConstants', Int32Array, 64], ['vertexBooleanConstants', Uint32Array, 16],
    ['pixelIntegerConstants', Int32Array, 64], ['pixelBooleanConstants', Uint32Array, 16],
  ];
  const primitiveVertices = (type, count) => {
    if (!Number.isInteger(count) || count < 0) invalid('invalid primitive count');
    switch (type) {
      case 1: return count;
      case 2: return count * 2;
      case 3: return count ? count + 1 : 0;
      case 4: return count * 3;
      case 5: case 6: return count ? count + 2 : 0;
      default: invalid(`primitive type ${type}`);
    }
  };
  // Geometry expansion only copies immutable guest bytes. Guest vertex and
  // pixel programs, clipping, coverage and interpolation all execute on GPU.
  function outlineGeometry(draw,count) {
    if(![4,5,6].includes(draw.primitive))invalid('outline requires triangle topology');
    const triangles=draw.primitiveCount,bytes=triangles*9*draw.stride;
    if(!Number.isSafeInteger(bytes)||bytes>64*1024*1024)invalid('outline input budget exceeded');
    const result=new Uint8Array(bytes),index=i=>draw.indices?draw.indices[i]:i;
    let dest=0;
    for(let t=0;t<triangles;t++){
      const corners=draw.primitive===4?[t*3,t*3+1,t*3+2]:draw.primitive===5?
        (t&1?[t+1,t,t+2]:[t,t+1,t+2]):[0,t+1,t+2];
      for(let edge=0;edge<3;edge++)for(let v=0;v<3;v++){
        const from=index(corners[(edge+v)%3])*draw.stride;
        if(from+draw.stride>draw.vertices.length)invalid('outline vertex outside buffer');
        result.set(draw.vertices.subarray(from,from+draw.stride),dest);dest+=draw.stride;
      }
    }
    return result;
  }
  function outlineSources(vs,ps,rawPosition,fixed) {
    const varyings=Array.from(ps.source.matchAll(/varying\s+(vec[234]|float)\s+(\w+)\s*;/g),m=>({type:m[1],name:m[2]}));
    const to4=v=>v.type==='vec4'?v.name:v.type==='vec3'?`vec4(${v.name},0.)`:v.type==='vec2'?`vec4(${v.name},0.,0.)`:`vec4(${v.name},0.,0.,0.)`;
    const captures=['outline_position',...varyings.map((_,i)=>'outline_value'+i),'outline_point'];
    const writesSize=/gl_PointSize\s*=/.test(vs.source);
    const fixedPosition=fixed&&!rawPosition?vs.attributes.find(name=>vs.semantics[Number(name.slice(5))]?.usage===0):null;
    const feedback=vs.source.replace(/void\s+main\s*\(/,'void outline_guest(')+
      '\nuniform vec4 outline_point_state;uniform vec4 outline_point_scale;\n'+captures.map(n=>'varying vec4 '+n+';').join('\n')+'\nvoid main(){outline_guest();outline_position='+
      (rawPosition?rawPosition:'gl_Position')+';'+(!rawPosition&&fixed?'outline_position.xy-=vec2(1.,-1.)*outline_position.w/d3d_ff_viewport.zw;':'')+
      varyings.map((v,i)=>`outline_value${i}=${to4(v)};`).join('')+
      `float size=${writesSize?'gl_PointSize':'outline_point_state.x'};`+
      (fixedPosition?`if(outline_point_scale.x!=0.){vec3 eye=(d3d_ff_view*d3d_ff_world*${fixedPosition}).xyz;float distance=length(eye);size=outline_point_scale.y*size*inversesqrt(outline_point_state.y+outline_point_state.z*distance+outline_point_state.w*dot(eye,eye));}`:'')+
      'outline_point=vec4(size,0.,0.,0.);}';
    const declarations=varyings.map((v,i)=>`attribute vec4 oa${i};attribute vec4 ob${i};flat varying vec4 fa${i};flat varying vec4 fb${i};`).join('\n');
    const vertex=`precision highp float;precision highp int;
attribute vec4 pa;attribute vec4 pb;attribute vec4 pc;
attribute vec4 point_data;
uniform vec4 outline_view;uniform vec4 outline_target;uniform vec4 outline_state;
uniform vec4 outline_point_bounds;
flat varying vec4 line_a;flat varying vec4 line_b;
flat varying float point_size;
${declarations}
float plane(vec4 p,int n){if(n==0)return p.w+p.x;if(n==1)return p.w-p.x;if(n==2)return p.w+p.y;if(n==3)return p.w-p.y;if(n==4)return p.w+p.z;return p.w-p.z;}
vec4 project(vec4 p){${rawPosition?'return p;':`float iw=1./p.w;return vec4(outline_view.xy+(p.xy*iw*vec2(1.,-1.)+1.)*.5*outline_view.zw,(p.z*iw*.5+.5)*(outline_target.w-outline_target.z)+outline_target.z,iw);`}}
void main(){
 vec4 a=pa,b=pb;float lo=0.,hi=1.;bool visible=true;
 float orientation=${rawPosition?'-(pb.x-pa.x)*(pc.y-pa.y)+(pb.y-pa.y)*(pc.x-pa.x)':'determinant(mat3(pa.x,pa.y,pa.w,pb.x,pb.y,pb.w,pc.x,pc.y,pc.w))'};
 if(orientation==0.||((outline_state.z==2.)&&orientation<0.)||((outline_state.z==3.)&&orientation>0.))visible=false;
 ${rawPosition?'if(outline_state.x==1.&&(pa.z<outline_target.z||pa.z>outline_target.w))visible=false;':`if(outline_state.x==1.){if(pa.w<=0.||plane(pa,4)<0.||plane(pa,5)<0.)visible=false;}
 else for(int n=0;n<6;n++){float da=plane(pa,n),db=plane(pb,n);if(da<0.&&db<0.)visible=false;else if(da<0.)lo=max(lo,da/(da-db));else if(db<0.)hi=min(hi,da/(da-db));}
 if(lo>hi)visible=false;a=mix(pa,pb,lo);b=mix(pa,pb,hi);if(a.w<=0.||b.w<=0.)visible=false;`}
 line_a=project(a);line_b=project(b);
 ${varyings.map((_,i)=>`fa${i}=mix(oa${i},ob${i},lo);fb${i}=mix(oa${i},ob${i},hi);`).join('\n')}
 vec2 low,high;
 point_size=min(min(outline_point_bounds.y,1.),max(outline_point_bounds.x,point_data.x));
 if(outline_state.x==1.){low=ceil(line_a.xy-vec2(point_size*.5));high=ceil(line_a.xy+vec2(point_size*.5));}
 else{low=min(floor(line_a.xy+.5),floor(line_b.xy+.5));high=max(floor(line_a.xy+.5),floor(line_b.xy+.5))+1.;}
 low=max(low,outline_view.xy);high=min(high,outline_view.xy+outline_view.zw);
 int corner=gl_VertexID; if(orientation>0.)corner=5-corner;
 vec2 uv=(corner==0||corner==3)?vec2(0.,0.):corner==1?vec2(1.,0.):(corner==2||corner==4)?vec2(1.,1.):vec2(0.,1.);
 vec2 screen=mix(low,high,uv);
 gl_Position=visible&&all(greaterThan(high,low))?vec4(screen.x*2./outline_target.x-1.,1.-screen.y*2./outline_target.y,0.,1.):vec4(2.,2.,2.,1.);
}`;
    const guest=ps.source.replace(/varying\s+(vec[234]|float)\s+(\w+)\s*;/g,'$1 $2;').replace(/void\s+main\s*\(/,'void outline_guest(');
    const fragment=guest+`\nflat varying vec4 line_a;flat varying vec4 line_b;flat varying float point_size;
uniform vec4 outline_view;uniform vec4 outline_target;uniform vec4 outline_state;
uniform vec4 outline_point_bounds;
${varyings.map((_,i)=>`flat varying vec4 fa${i};flat varying vec4 fb${i};`).join('\n')}
void main(){
 vec2 pixel=vec2(floor(gl_FragCoord.x),outline_target.y-ceil(gl_FragCoord.y));float t=0.;
 if(outline_state.x==2.){
  ivec2 a=ivec2(floor(line_a.xy+.5)),b=ivec2(floor(line_b.xy+.5)),p=ivec2(pixel),delta=b-a,sgn=ivec2(delta.x<0?-1:1,delta.y<0?-1:1),d=abs(delta);
  if(d.x==0&&d.y==0){if(outline_state.y==0.||any(notEqual(p,a)))discard;}
  else if(d.x>=d.y){int k=(p.x-a.x)*sgn.x;if(k<0||k>d.x||(outline_state.y==0.&&k==d.x))discard;if(p.y!=a.y+((2*k*d.y+d.x)/(2*d.x))*sgn.y)discard;}
  else{int k=(p.y-a.y)*sgn.y;if(k<0||k>d.y||(outline_state.y==0.&&k==d.y))discard;if(p.x!=a.x+((2*k*d.x+d.y)/(2*d.y))*sgn.x)discard;}
  vec2 diff=line_b.xy-line_a.xy;if(abs(diff.x)>=abs(diff.y)){if(diff.x!=0.)t=(pixel.x-line_a.x)/diff.x;}else t=(pixel.y-line_a.y)/diff.y;
 }
 float iw=mix(line_a.w,line_b.w,t);
 ${varyings.map((v,i)=>`${v.name}=((fa${i}*line_a.w*(1.-t)+fb${i}*line_b.w*t)/iw)${v.type==='vec4'?'':v.type==='vec3'?'.xyz':v.type==='vec2'?'.xy':'.x'};`).join('\n')}
 if(outline_state.x==1.&&outline_point_bounds.z!=0.){
  vec2 sprite=(pixel-line_a.xy+point_size*.5)/point_size;
  ${varyings.filter(v=>/^d3d_tex\d+$/.test(v.name)||/^ff_uv[1-5]?$/.test(v.name)).map(v=>`${v.name}=${v.type==='vec4'?'vec4(sprite,0.,1.)':v.type==='vec3'?'vec3(sprite,0.)':'sprite'};`).join('\n')}
 }
 gl_FragDepthEXT=mix(line_a.z,line_b.z,t);
 outline_guest();
}`;
    return {feedback,vertex,fragment:'#extension GL_EXT_frag_depth : require\n'+fragment,captures,varyings};
  }
  class Device {
    constructor(canvas, options={}) {
      this.gpu = new GPU.WebGLBackend(canvas,{apiVersion:options.webglVersion===undefined?'auto':options.webglVersion});
      this.programs = new Map();
      this.fixedPlans = new Fixed.TLCache();
      this.vertices = this.gpu.createBuffer();
      this.indices = this.gpu.createBuffer();
      this.textures = new Map();
      this.textureTargets = new Map();
      this.depthTargets = new Map();
      this.colorTargets = new Map();
      this.resourceSamples = new Map();
      // Host-keyed texture levels stay resident as GL textures. keyedTextures
      // maps a composite key (target + every level key of every face) to the
      // texture built from it; keyMembers maps one level key to the composite
      // keys it is part of, so a host release can find them; stageKeys says
      // which stages currently point at a keyed texture rather than at their
      // own per-stage scratch texture. Before this, every draw re-uploaded
      // every level of every bound texture through texImage2D.
      // residentPixels holds the converted level itself: the same keys come
      // back in different compositions (a LOD change drops the top levels, a
      // mip-atlas stage lays them out differently), and each new composition
      // is built from these without asking the host for the bytes again.
      this.residentPixels = new Map();
      this.keyedTextures = new Map();
      this.keyMembers = new Map();
      this.stageKeys = new Map();
      this.outlinePrograms = new Map();
      this.outlineBuffer = null;
      this.gpu.bindRenderTarget(0,canvas.width,canvas.height,16);
    }
    // The level's bytes: its own when the host sent them (and from then on
    // resident under its key), else the resident copy. Unkeyed levels are
    // returned as they are.
    levelPixels(level){
      if(level.resource||typeof level.key!=='string')return level;
      if(level.pixels!==undefined){
        if(!this.residentPixels.has(level.key))this.residentPixels.set(level.key,level.pixels);
        return level;
      }
      const pixels=this.residentPixels.get(level.key);
      if(!pixels||pixels.length!==level.width*level.height*4)invalid('texture not resident');
      return {...level,pixels};
    }
    releaseTextures(keys){
      for(const key of keys){
        this.residentPixels.delete(key);
        const members=this.keyMembers.get(key);
        if(!members)continue;
        this.keyMembers.delete(key);
        for(const ck of members){
          const held=this.keyedTextures.get(ck);
          if(!held)continue;
          this.keyedTextures.delete(ck);
          this.gpu.deleteTexture(held.texture);
          for(const [stage,stageKey] of this.stageKeys)if(stageKey===ck){
            this.stageKeys.delete(stage);this.textures.delete(stage);this.textureTargets.delete(stage);
          }
          for(const memberKey of held.keys){
            const set=this.keyMembers.get(memberKey);
            if(set){set.delete(ck);if(!set.size)this.keyMembers.delete(memberKey);}
          }
        }
      }
    }
    // Returns the composite key when every level of every face is host-keyed
    // (and none is a render-target resource), else null.
    keyedPlan(chains,target,variant){
      const keys=[];
      for(const chain of chains)for(const level of chain){
        if(level?.resource||typeof level?.key!=='string')return null;
        keys.push(level.key);
      }
      return {keys,ck:target+'|'+variant+'|'+keys.join(',')};
    }
    // A stage's own scratch texture, never a keyed one: the keyed texture is
    // shared by every stage and every later draw that names the same key.
    stageTexture(stage,target){
      const g=this.gpu;
      let texture=this.textures.get(stage);
      if(this.stageKeys.has(stage)){this.stageKeys.delete(stage);texture=null;}
      if(texture&&this.textureTargets.get(stage)!==target){g.deleteTexture(texture);texture=null;}
      if(!texture){texture=g.createTexture();this.textures.set(stage,texture);}
      this.textureTargets.set(stage,target);
      return texture;
    }
    bindKeyed(stage,plan,target,texture){
      if(!this.stageKeys.has(stage)){
        // The stage's scratch texture is no longer reachable through the stage
        // map once a keyed texture takes its slot; drop it.
        const scratch=this.textures.get(stage);
        if(scratch)this.gpu.deleteTexture(scratch);
      }
      this.stageKeys.set(stage,plan.ck);this.textures.set(stage,texture);this.textureTargets.set(stage,target);
      this.resourceSamples.delete(stage);this.mipUniforms?.delete(stage);
    }
    registerKeyed(plan,texture){
      this.keyedTextures.set(plan.ck,{texture,keys:plan.keys});
      for(const key of plan.keys){
        let set=this.keyMembers.get(key);
        if(!set){set=new Set();this.keyMembers.set(key,set);}
        set.add(plan.ck);
      }
    }
    depthTarget(metadata,width=this.gpu.canvas.width,height=this.gpu.canvas.height) {
      if(metadata===undefined)return {key:0,width,height,bits:16};
      if(metadata===null)return {key:null,width,height,bits:0};
      if(!Number.isInteger(metadata.id)||metadata.id<=0||!Number.isInteger(metadata.width)||!Number.isInteger(metadata.height)||
        metadata.width<width||metadata.height<height||metadata.width>2048||metadata.height>2048||![70,80,75,77].includes(metadata.format))invalid('invalid depth attachment');
      return {key:metadata.id,width:metadata.width,height:metadata.height,bits:[70,80].includes(metadata.format)?16:24};
    }
    colorResource(resource){
      if(!resource||!Number.isInteger(resource.id)||resource.id<=0||!Number.isInteger(resource.width)||!Number.isInteger(resource.height)||
        resource.width<1||resource.height<1||resource.width>2048||resource.height>2048||![21,22].includes(resource.format))invalid('invalid color resource');
      const old=this.colorTargets.get(resource.id);
      if(old&&(old.width!==resource.width||old.height!==resource.height||old.format!==resource.format))invalid('color identity changed');return old;
    }
    colorPixels(resource,pixels,pitch){
      if(!(pixels instanceof Uint8Array)||!Number.isInteger(pitch)||pitch<resource.width*4||pixels.length!==pitch*resource.height)invalid('invalid color upload');
      const rgba=new Uint8Array(resource.width*resource.height*4);
      for(let y=0;y<resource.height;y++)for(let x=0;x<resource.width;x++){
        const s=y*pitch+x*4,t=((resource.height-1-y)*resource.width+x)*4;
        rgba[t]=pixels[s+2];rgba[t+1]=pixels[s+1];rgba[t+2]=pixels[s];rgba[t+3]=resource.format===22?255:pixels[s+3];
      }return rgba;
    }
    createColor(resource,pixels=null,pitch=resource.width*4){
      if(this.colorResource(resource))invalid('duplicate color resource');
      const bytes=pixels===null?new Uint8Array(resource.width*resource.height*4):pixels;
      this.gpu.createColorResource(resource.id,resource.width,resource.height,this.colorPixels(resource,bytes,pixels===null?resource.width*4:pitch));
      this.colorTargets.set(resource.id,{...resource,revision:1});return 1;
    }
    updateColor(resource,pixels,pitch,rect){if(resource&&!this.colorResource(resource))invalid('unknown color resource');
      const identity=resource;
      resource=resource??{width:this.gpu.canvas.width,height:this.gpu.canvas.height,format:22};
      const r=rect??{x:0,y:0,width:resource.width,height:resource.height};
      if(![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width<=0||r.height<=0||
        r.width>resource.width-r.x||r.height>resource.height-r.y)invalid('invalid color upload rectangle');
      const rgba=this.colorPixels({...resource,width:r.width,height:r.height},pixels,pitch??r.width*4);
      this.touchColor(identity);this.gpu.updateColorResource(identity?.id??null,rgba,r);return 1;}
    touchColor(resource){if(resource){const color=this.colorTargets.get(resource.id);if(color.revision>=Number.MAX_SAFE_INTEGER)invalid('color revision exhausted');color.revision++;}}
    readColor(resource){
      const g=this.gpu,gl=g.gl,width=resource?.width??g.canvas.width,height=resource?.height??g.canvas.height;
      if(resource&&!this.colorResource(resource))invalid('unknown color resource');
      let rgba;if(resource)rgba=g.readColorResource(resource.id);else{g.bindImplicitTarget();rgba=g.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(width*height*4));}
      const pixels=new Uint8Array(rgba.length);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){const s=((height-1-y)*width+x)*4,t=(y*width+x)*4;
        pixels[t]=rgba[s+2];pixels[t+1]=rgba[s+1];pixels[t+2]=rgba[s];pixels[t+3]=resource?.format===22?255:rgba[s+3];}
      return {pixels,width,height,pitch:width*4,format:resource?.format??21};
    }
    releaseColor(id){
      for(const [stage,record]of this.resourceSamples)if(record.ids.has(id)){
        this.gpu.deleteTexture(this.textures.get(stage));this.textures.delete(stage);this.textureTargets.delete(stage);this.mipUniforms?.delete(stage);this.resourceSamples.delete(stage);
      }
      this.gpu.releaseColorResource(id);this.colorTargets.delete(id);return 1;
    }
    bindDepth(metadata,color) {
      if(color&&!this.colorResource(color))invalid('unknown color attachment');
      const d=this.depthTarget(metadata,color?.width??this.gpu.canvas.width,color?.height??this.gpu.canvas.height);
      const prior=metadata&&this.depthTargets.get(metadata.id);
      if(prior&&(prior.width!==metadata.width||prior.height!==metadata.height||prior.format!==metadata.format))invalid('depth identity changed');
      if(color)this.gpu.bindColorResource(color.id,d);else this.gpu.bindRenderTarget(d.key,d.width,d.height,d.bits);
      if(metadata&&!prior)this.depthTargets.set(metadata.id,{...metadata});
    }
    releaseDepth(id) { this.gpu.releaseRenderTarget(id); this.depthTargets.delete(id); }
    reset(payload) {
      const d=this.depthTarget(payload.depthAttachment,payload.width,payload.height);
      this.gpu.resetRenderTargets(payload.width,payload.height,d);
      this.depthTargets.clear();
      this.colorTargets.clear();
      for(const stage of this.resourceSamples.keys()){this.gpu.deleteTexture(this.textures.get(stage));this.textures.delete(stage);this.textureTargets.delete(stage);this.mipUniforms?.delete(stage);}
      this.resourceSamples.clear();
      // The host forgets every resident key on reset; so do we.
      this.releaseTextures([...this.keyMembers.keys()]);
      if(payload.depthAttachment)this.depthTargets.set(payload.depthAttachment.id,{...payload.depthAttachment});
    }
    clear(color, flags, depth=1, rects=null,depthAttachment=undefined,stencil=0,colorAttachment=undefined) {
      if((flags&2)&&depthAttachment===null)invalid('no depth attachment');
      if(!Number.isInteger(flags)||flags<0||!Array.isArray(color)||color.length!==4||
        color.some(v=>!Number.isFinite(v)||v<0||v>1))invalid('invalid clear');
      if (flags & ~7) invalid('invalid clear flags');
      if((flags&4)&&(!depthAttachment||depthAttachment.format!==75))invalid('stencil clear requires D24S8');
      if((flags&4)&&(!Number.isInteger(stencil)||stencil<0||stencil>0xffffffff))invalid('invalid clear stencil');
      const g = this.gpu, gl = g.gl;
      const width=colorAttachment?.width??g.canvas.width,height=colorAttachment?.height??g.canvas.height;
      if((flags&2)&&(!Number.isFinite(depth)||depth<0||depth>1))invalid('invalid clear depth');
      const regions=rects===null?[[0,0,width,height]]:rects;
      if(!Array.isArray(regions)||regions.length>65536||regions.some(r=>!Array.isArray(r)||r.length!==4||
        r.some(v=>!Number.isInteger(v))||r[0]<0||r[1]<0||r[2]<r[0]||r[3]<r[1]||r[2]>width||r[3]>height))invalid('invalid clear rectangles');
      this.bindDepth(depthAttachment,colorAttachment);
      if(colorAttachment?.format===22)color=[color[0],color[1],color[2],1];
      g.setDepthMask(true);
      if(flags&4){g.setStencilMask(255);gl.clearStencil(stencil&255);}
      gl.clearDepth(flags&2?depth:1);
      gl.colorMask(true,true,true,true);
      g.setCapability(gl.SCISSOR_TEST, true);
      if(flags&1)this.touchColor(colorAttachment);
      for(const [left,top,right,bottom]of regions)if(right>left&&bottom>top){
        g.setScissor(left,g.renderHeight-bottom,right-left,bottom-top);
        g.clear(color, (flags & 1 ? gl.COLOR_BUFFER_BIT : 0) | (flags & 2 ? gl.DEPTH_BUFFER_BIT : 0) | (flags & 4 ? gl.STENCIL_BUFFER_BIT : 0));
      }
    }
    draw(draw) {
      // Releases first, before any validation: the host has already forgotten
      // these keys whatever happens to the rest of this draw.
      const releases=draw.textureReleases;
      if(releases!==undefined){
        if(!Array.isArray(releases)||!releases.every(key=>typeof key==='string'))invalid('invalid texture release list');
        this.releaseTextures(releases);
      }
      // The neutral software path can carry clip equations before WebGL has
      // an equivalent lowering. Never silently render an unclipped draw.
      if(draw.userClipPlanes!==undefined&&draw.userClipPlanes?.mask!==0)
        invalid('WebGL user clip planes are not implemented');
      for (const [name, Type, length] of typedBanks)
        if (draw[name] !== undefined && (!(draw[name] instanceof Type) || draw[name].length !== length))
          invalid(`invalid typed constants ${name}`);
      const g = this.gpu, gl = g.gl;
      const targetWidth=draw.colorAttachment?.width??g.canvas.width,targetHeight=draw.colorAttachment?.height??g.canvas.height;
      const scissor=draw.scissor;
      if(scissor&&(![true,false,0,1].includes(scissor.enabled)||(scissor.enabled&&(
        [scissor.left,scissor.top,scissor.right,scissor.bottom].some(v=>!Number.isInteger(v))||
        scissor.left<0||scissor.top<0||scissor.right<scissor.left||scissor.bottom<scissor.top||
        scissor.right>targetWidth||scissor.bottom>targetHeight))))invalid('invalid scissor rectangle');
      const fog=draw.fogState||{enabled:draw.fixedFunction?.fog||false,color:draw.fixedFunction?.fogColor||0,
        tableMode:draw.fixedFunction?.fogTableMode||0,start:draw.fixedFunction?.fogStart??0,
        end:draw.fixedFunction?.fogEnd??1,density:draw.fixedFunction?.fogDensity??1,depthMode:0};
      if(![false,true,0,1].includes(fog.enabled)||!Number.isInteger(fog.color)||fog.color<0||fog.color>0xffffffff||
        !Number.isInteger(fog.tableMode)||fog.tableMode<0||fog.tableMode>3)invalid('invalid raster fog state');
      const tableFog=fog.enabled&&fog.tableMode;
      let tableParams;
      if(tableFog){
        if((fog.depthMode??0)!==0)invalid('WFOG is not advertised; production table fog requires device Z');
        tableParams=Float32Array.from([fog.start??0,fog.end??1,fog.density??1,0]);
        if(fog.tableMode===3?(!Number.isFinite(tableParams[0])||!Number.isFinite(tableParams[1])||tableParams[0]===tableParams[1]):
          !Number.isFinite(tableParams[2]))invalid('invalid table fog parameters');
      }
      if(draw.fogState&&draw.fixedFunction)draw={...draw,fixedFunction:{...draw.fixedFunction,
        fog:fog.enabled,fogColor:fog.color,fogTableMode:fog.tableMode}};
      // Table fog supersedes vertex fog; it is applied after either pixel path.
      if(tableFog&&draw.fixedFunction)draw={...draw,fixedFunction:{...draw.fixedFunction,fog:false}};
      const fill=draw.state?.fillMode??3,outline=fill!==3;
      const colorMask=draw.state?.colorWriteMask??15;
      if(!Number.isInteger(colorMask)||colorMask<0||colorMask>15)invalid('invalid color write mask');
      if(![1,2,3].includes(fill))invalid('invalid fill mode');
      if(tableFog&&outline)invalid('table fog outline depth linkage is not implemented');
      if(outline&&(g.version!==2||draw.state?.antialiasedLine))invalid('outline requires WebGL2 non-AA');
      if(fill===1&&draw.state?.pointScale&&draw.vertexShader)invalid('programmable point attenuation requires native-reference validation');
      const count = primitiveVertices(draw.primitive, draw.primitiveCount);
      if (!count) return;
      const cubeStages = [];
      (draw.textures || []).forEach((image, stage) => { if (image && image.faces) cubeStages.push(stage); });
      const vp = draw.viewport || { x: 0, y: 0, width: targetWidth, height: targetHeight, minZ: 0, maxZ: 1 };
      // Bridge commands always contain native IR. Raw tokens are retained only
      // for standalone backend diagnostics; never a guest-validation fallback.
      const compile = (shader, options) => shader?.irVersion === 1
        ? Shader.compileNativeIR(shader, options) : Shader.compile(shader, options);
      // Validate bound stages independently before lowering any NULL stage.
      const guestVS=draw.vertexShader?compile(draw.vertexShader):null;
      if(guestVS&&fog.enabled&&!tableFog&&!guestVS.fogOutput)invalid('fog requires a vertex shader oFog output');
      const projectedStages=!guestVS?(draw.fixedFunction?.stages||[]).map(s=>(s.transformFlags&256)?s.transformFlags&255:0):[];
      const guestPS=draw.pixelShader?compile(draw.pixelShader,{cubeStages,projectedStages}):null;
      if(fog.enabled&&guestPS){
        if(![0xffff0101,0xffff0102,0xffff0103,0xffff0104].includes(guestPS.version))invalid('programmed fog profile is not implemented');
        if(/varying\s+vec4\s+d3d_color1\s*;/.test(guestPS.source))invalid('programmed fog specular alpha linkage requires conformance');
      }
      const fixed = !guestVS || !guestPS ? this.fixedPlans.compile(draw, vp, guestPS) : null;
      let vs = guestVS || fixed.vertex;
      if(guestVS&&!outline){
        // D3D9 viewport pixel centers are integers; GL centers are half-integers.
        // This is the same viewport conversion used by fixed VS, not an edge
        // epsilon. Outline expansion computes integer-center coverage itself.
        vs={...vs,uniforms:[...vs.uniforms,'d3d_raster_extent'],source:
          vs.source.replace(/void\s+main\s*\(/,'void d3d_guest_vertex(')+
          '\nuniform highp vec4 d3d_raster_extent;\nvoid main(){d3d_guest_vertex();gl_Position.xy+=vec2(1.0,-1.0)*gl_Position.w/d3d_raster_extent.xy;}\n'};
      }
      const mipStages=[];
      (draw.textures||[]).forEach((image,stage)=>{const s=image?.sampler||{};
        if(image&&!image.faces&&(s.lodBias||s.maxMipLevel||image.baseLOD||(s.min||1)!==(s.mag||1)))mipStages.push(stage);});
      let ps = Shader.withMipSampling(guestPS || fixed.pixel,mipStages);
      const alphaState=draw.state?.alphaTest===undefined?draw.fixedFunction:draw.state;
      if(guestPS&&alphaState?.alphaTest){
        const func=alphaState.alphaFunc,ref=alphaState.alphaRef;
        if(!Number.isInteger(func)||func<1||func>8||!Number.isInteger(ref)||ref<0||ref>0xffffffff)
          invalid('invalid alpha test state');
        const compare=['','false','gl_FragColor.a < d3d_alpha_ref','gl_FragColor.a == d3d_alpha_ref',
          'gl_FragColor.a <= d3d_alpha_ref','gl_FragColor.a > d3d_alpha_ref','gl_FragColor.a != d3d_alpha_ref',
          'gl_FragColor.a >= d3d_alpha_ref','true'][func];
        ps={...ps,uniforms:[...ps.uniforms,'d3d_alpha_ref'],alphaReference:(ref&255)/255,
          source:ps.source.replace(/void\s+main\s*\(\s*\)/,'void d3d_pixel_main()')+
            `\nuniform highp float d3d_alpha_ref;\nvoid main(){d3d_pixel_main();if(!(${compare}))discard;}\n`};
      }
      if(tableFog){
        if(ps.depthOutput)invalid('table fog with pixel depth output requires conformance');
        const color=fog.color>>>0;
        const amount=fog.tableMode===3?'(d3d_tableFog.y-gl_FragCoord.z)/(d3d_tableFog.y-d3d_tableFog.x)':
          fog.tableMode===1?'exp(-d3d_tableFog.z*gl_FragCoord.z)':
          'exp(-(d3d_tableFog.z*gl_FragCoord.z)*(d3d_tableFog.z*gl_FragCoord.z))';
        ps={...ps,uniforms:[...ps.uniforms,'d3d_ff_fogColor','d3d_tableFog'],tableFogParams:tableParams,
          fogColor:new Float32Array([(color>>>16&255)/255,(color>>>8&255)/255,(color&255)/255,0]),
          source:ps.source.replace(/void\s+main\s*\(\s*\)/,'void d3d_before_tableFog()')+
            '\nuniform highp vec4 d3d_ff_fogColor;\nuniform highp vec4 d3d_tableFog;\n'+
            `void main(){d3d_before_tableFog();float f=clamp(${amount},0.0,1.0);gl_FragColor.rgb=mix(d3d_ff_fogColor.rgb,gl_FragColor.rgb,f);}\n`};
      }else if(guestPS&&fog.enabled){
        const color=fog.color>>>0,factor=guestVS?'d3d_fog.x':'ff_fog';
        ps={...ps,uniforms:[...ps.uniforms,'d3d_ff_fogColor'],
          fogColor:new Float32Array([(color>>>16&255)/255,(color>>>8&255)/255,(color&255)/255,0]),
          source:ps.source.replace(/void\s+main\s*\(\s*\)/,'void d3d_before_fog()')+
            (guestVS?'\nvarying highp vec4 d3d_fog;':'\nvarying highp float ff_fog;')+'\nuniform highp vec4 d3d_ff_fogColor;\n'+
            `void main(){d3d_before_fog();gl_FragColor.rgb=mix(d3d_ff_fogColor.rgb,gl_FragColor.rgb,clamp(${factor},0.0,1.0));}\n`};
      }
      // Validate loop domains before attachment copies, compilation, uploads or
      // any GL state changes. Missing banks are API-default zero, not stale GL.
      for (const shader of [vs, ps]) for (const range of shader.integerUniformRanges || []) {
        const match = /^d3d_(vs|ps)_i(\d+)$/.exec(range.name);
        if (!match || Number(match[2]) >= 16 || !Number.isInteger(range.component)
            || range.component < 0 || range.component > 3 || !Number.isInteger(range.min)
            || !Number.isInteger(range.max) || range.min > range.max)
          invalid('invalid integer uniform range');
        const bank = match[1] === 'vs' ? draw.vertexIntegerConstants : draw.pixelIntegerConstants;
        const value = bank ? bank[Number(match[2]) * 4 + range.component] : 0;
        if (value < range.min || value > range.max) invalid(`integer uniform range ${range.name}`);
      }
      // Bind before texture setup: color-preserving attachment copies use unit0.
      this.bindDepth(draw.depthAttachment,draw.colorAttachment);
      if(ps.depthOutput&&g.version!==2&&!gl.getExtension('EXT_frag_depth'))
        invalid('PS1.3 shader depth output requires EXT_frag_depth');
      if(ps.mipStages?.length&&g.version!==2&&!gl.getExtension('OES_standard_derivatives'))
        invalid('WebGL mip emulation requires OES_standard_derivatives');
      if (vs.stage !== 'vertex' || ps.stage !== 'pixel') invalid('shader stage mismatch');
      const bumpStates = new Map();
      for (const stage of ps.bumpStages || []) {
        const values = draw.bumpStates && draw.bumpStates[stage];
        if ((!Array.isArray(values) && !(values instanceof Float32Array))
            || values.length !== 6 || !Array.from(values).every(v => Number.isFinite(v) && Number.isFinite(Math.fround(v))))
          invalid(`missing/invalid bump metadata for stage ${stage}`);
        bumpStates.set(stage, Float32Array.from(values));
      }
      // A complete source key avoids hash collisions changing a guest program.
      const key = vs.source + '\n// PIXEL STAGE\n' + ps.source;
      let program = this.programs.get(key);
      let outlineProgram;
      if(outline){
        const raw=fixed?.vertex&&draw.attributes.find(a=>a.usage===9);
        const rawName=raw?vs.attributes.find(name=>vs.semantics[Number(name.slice(5))]?.usage===9):null;
        const outlineKey=key+'\nRAW '+rawName;
        outlineProgram=this.outlinePrograms.get(outlineKey);
        if(!outlineProgram){
          const source=outlineSources(vs,ps,rawName,!!fixed?.vertex);
          if(4+source.varyings.length*2>gl.getParameter(gl.MAX_VERTEX_ATTRIBS)||source.captures.length*4>gl.getParameter(gl.MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS))invalid('outline varying hardware limit exceeded');
          const names=['pa','pb','pc','point_data',...source.varyings.flatMap((_,i)=>['oa'+i,'ob'+i])];
          const uniforms=[...ps.uniforms,'outline_view','outline_target','outline_state','outline_point_bounds'];
          outlineProgram={source,feedback:g.createProgram(source.feedback,'precision highp float;void main(){gl_FragColor=vec4(0.);}',vs.attributes,[...vs.uniforms,'outline_point_state','outline_point_scale'],{transformFeedbackVaryings:source.captures}),
            program:g.createProgram(source.vertex,source.fragment,names,uniforms)};
          this.outlinePrograms.set(outlineKey,outlineProgram);
        }
        program=outlineProgram.program;
      }else if (!program) {
        program = g.createProgram(vs.source, ps.source, vs.attributes, [...vs.uniforms, ...ps.uniforms]);
        this.programs.set(key, program);
      }
      if (!(draw.vertices instanceof Uint8Array) || !Number.isInteger(draw.stride)
          || draw.stride <= 0 || draw.stride > 255) invalid('invalid vertex bytes/stride');
      const indices = draw.indices;
      if (indices && !(indices instanceof Uint16Array)) invalid('only INDEX16 is implemented');
      if (indices && indices.length < count) invalid('index buffer too short');
      let maxIndex = count - 1;
      if (indices) { maxIndex = 0; for (let i = 0; i < count; ++i) maxIndex = Math.max(maxIndex, indices[i]); }
      const attributes = vs.attributes.map(name => {
        const register = Number(name.slice(5));
        const semantic = vs.semantics[register];
        const input = draw.attributes.find(a => semantic
          ? a.usage === semantic.usage && a.usageIndex === semantic.index
          : a.register === register);
        if (!input) invalid(`missing vertex input v${register}`);
        const sizes = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 4 }; // FLOAT1..4 / normalized color
        const size = sizes[input.type];
        const byteSize = input.type === 4 ? 4 : size * 4;
        if (!size || !Number.isInteger(input.offset) || input.offset < 0 || input.offset % 4)
          invalid('unsupported vertex declaration element');
        if (input.offset + byteSize > draw.stride
            || maxIndex * draw.stride + input.offset + byteSize > draw.vertices.byteLength)
          invalid('vertex input outside buffer');
        return { name, size, offset: input.offset,
          type: input.type === 4 ? gl.UNSIGNED_BYTE : gl.FLOAT, normalized: input.type === 4 };
      });
      for (const shader of [vs, ps]) for (const name of shader.uniforms) {
        const uniformProgram=outline&&shader===vs?outlineProgram.feedback:program;
        const match = /^d3d_(vs|ps)_c(\d+)$/.exec(name);
        const typed = /^d3d_(vs|ps)_([ib])(\d+)$/.exec(name);
        if(typed){
          const index = Number(typed[3]), vertex = typed[1] === 'vs';
          if(index >= 16)invalid(`invalid typed uniform ${name}`);
          if(typed[2] === 'i'){
            const bank = vertex ? draw.vertexIntegerConstants : draw.pixelIntegerConstants;
            g.setUniform(uniformProgram,name,'4i',bank ? bank.subarray(index*4,index*4+4) : zeroInteger);
          } else {
            const bank = vertex ? draw.vertexBooleanConstants : draw.pixelBooleanConstants;
            g.setUniform(uniformProgram,name,'1i',bank && bank[index] !== 0 ? 1 : 0);
          }
        } else if(name==='d3d_raster_extent'){
          g.setUniform(uniformProgram,name,'4f',[vp.width,vp.height,0,0]);
        } else if(name==='d3d_alpha_ref'){
          g.setUniform(program,name,'1f',ps.alphaReference);
        } else if(name==='d3d_ff_fogColor'&&ps.fogColor){
          g.setUniform(program,name,'4f',ps.fogColor);
        } else if(name==='d3d_tableFog'){
          g.setUniform(program,name,'4f',ps.tableFogParams);
        } else if (fixed && fixed.values[name]) {
          const uniform = fixed.values[name];
          g.setUniform(uniformProgram, name, uniform.kind, uniform.value);
        } else if (match) {
          const values = match[1] === 'vs' ? draw.vertexConstants : draw.pixelConstants;
          const offset = Number(match[2]) * 4;
          if (!(values instanceof Float32Array) || values.length < offset + 4)
            invalid(`missing constants ${name}`);
          g.setUniform(uniformProgram, name, '4f', values.subarray(offset, offset + 4));
        } else if (/^d3d_bumpL?\d+$/.test(name)) {
          const match = /^d3d_bump(L?)(\d+)$/.exec(name), values = bumpStates.get(Number(match[2]));
          if (!values) invalid(`missing bump binding ${name}`);
          g.setUniform(program, name, '4f', match[1] ? [values[4], values[5], 0, 0] : values.subarray(0, 4));
        } else if (/^d3d_(mips|lod|filter|extent|address|border)\d/.test(name)) {
          const stage=Number(name.match(/(\d+)(?:\[0\])?$/)[1]),values=this.mipUniforms?.get(stage)?.[name];
          if(!values)invalid(`missing mip metadata ${name}`);
          g.setUniform(program,name,'4f',values);
        } else {
          const stage = Number(name.slice(5));
          // Sampling a stage with no texture bound is legal D3D9 -- the result
          // is UNDEFINED and the device stays usable -- so it costs this sample
          // and not the draw. d3dx9 produces the state whenever an effect has a
          // texture parameter the application never assigned; refusing the draw
          // ended rendering for a whole Black & White 2 run, because the command
          // queue's error is sticky. Kept identical to the software backend's
          // UNBOUND_SAMPLER so the two agree on what undefined looks like.
          const texture = (draw.textures && draw.textures[stage]) || UNBOUND_SAMPLER;
          this.uploadTexture(stage, texture,ps.mipStages?.includes(stage),draw.colorAttachment?.id);
          g.setUniform(program, name, '1i', stage);
        }
      }
      // Texture uploads temporarily bind unit 0; restore all sampled units only
      // after the final upload, otherwise sampling a second texture replaces s0.
      for (const name of ps.uniforms.filter(n => /^d3d_s\d+$/.test(n))) {
        const stage = Number(name.slice(5));
        g.bindTexture(this.textures.get(stage), stage, this.textureTargets.get(stage));
      }
      const state = draw.state || {};
      const compares = [0, gl.NEVER, gl.LESS, gl.EQUAL, gl.LEQUAL, gl.GREATER, gl.NOTEQUAL, gl.GEQUAL, gl.ALWAYS];
      const zfunc = state.zfunc === undefined ? 4 : state.zfunc;
      if (!compares[zfunc]) invalid('invalid depth comparison');
      const blends = [0, gl.ZERO, gl.ONE, gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR,
        gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA,
        gl.DST_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA_SATURATE];
      const source = state.srcblend === undefined ? 2 : state.srcblend;
      const dest = state.dstblend === undefined ? 1 : state.dstblend;
      if (source < 1 || source >= blends.length || dest < 1 || dest >= blends.length)
        invalid('unsupported blend function');
      const cull = state.cull === undefined ? 3 : state.cull;
      if (![1, 2, 3].includes(cull)) invalid('invalid cull mode');
      this.stencilState(state,draw.depthAttachment,compares);
      gl.colorMask(!!(colorMask&1),!!(colorMask&2),!!(colorMask&4),draw.colorAttachment?.format!==22&&!!(colorMask&8));
      g.setCapability(gl.DEPTH_TEST, draw.depthAttachment!==null&&state.zenable !== false);
      g.setDepthFunc(compares[zfunc]); g.setDepthMask(state.zwrite !== false);
      g.setCapability(gl.BLEND, !!state.blend);
      g.setBlendFunc(blends[source], blends[dest]);
      g.setCapability(gl.CULL_FACE, cull !== 1);
      // D3DCULL_CCW keeps visually clockwise screen-space triangles. After
      // viewport Y conversion those remain CW in GL window coordinates.
      g.setFrontFace(gl.CW); g.setCullFace(cull === 2 ? gl.FRONT : gl.BACK);
      g.setViewport(vp.x, g.renderHeight - vp.y - vp.height, vp.width, vp.height);
      g.setDepthRange(vp.minZ, vp.maxZ);
      g.setCapability(gl.SCISSOR_TEST, !!scissor?.enabled);
      if(scissor?.enabled)g.setScissor(scissor.left,g.renderHeight-scissor.bottom,scissor.right-scissor.left,scissor.bottom-scissor.top);
      if(outline){
        const recordBytes=outlineProgram.source.captures.length*16;
        const outputBytes=draw.primitiveCount*9*recordBytes;
        const aggregateBytes=draw.primitiveCount*9*draw.stride+outputBytes;
        if(!Number.isSafeInteger(aggregateBytes)||aggregateBytes>64*1024*1024)invalid('outline aggregate budget exceeded');
        let size=1,min=1,max=1,attenuation=[1,0,0];
        if(fill===1){
          const pointSize=state.pointSize??1;min=state.pointSizeMin??1;max=state.pointSizeMax??1;
          if([pointSize,min,max].some(v=>!Number.isFinite(v)||v<0||v>2048)||min>max||min>1)invalid('point size exceeds advertised capability');
          for(const flag of [state.pointSprite,state.pointScale])if(flag!==undefined&&![false,true,0,1].includes(flag))invalid('invalid point enable');
          attenuation=[state.pointScaleA??1,state.pointScaleB??0,state.pointScaleC??0];
          if(attenuation.some(v=>!Number.isFinite(v)||v<0))invalid('invalid point attenuation');
          size=pointSize;
        }
        const data=outlineGeometry(draw,count);
        if(!this.outlineBuffer)this.outlineBuffer=g.createBuffer();
        g.updateBuffer(this.vertices,gl.ARRAY_BUFFER,data);
        g.setUniform(outlineProgram.feedback,'outline_point_state','4f',[size,...attenuation]);
        g.setUniform(outlineProgram.feedback,'outline_point_scale','4f',[state.pointScale?1:0,vp.height,0,0]);
        g.transformVertices({program:outlineProgram.feedback,vertexBuffer:this.vertices,stride:draw.stride,attributes,count:draw.primitiveCount*9},this.outlineBuffer,outputBytes);
        const outputAttributes=['pa','pb','pc'].map((name,i)=>({name,size:4,offset:i*recordBytes,divisor:1}));
        outputAttributes.push({name:'point_data',size:4,offset:recordBytes-16,divisor:1});
        outlineProgram.source.varyings.forEach((_,i)=>{
          outputAttributes.push({name:'oa'+i,size:4,offset:(i+1)*16,divisor:1},{name:'ob'+i,size:4,offset:recordBytes+(i+1)*16,divisor:1});
        });
        g.setUniform(program,'outline_view','4f',[vp.x,vp.y,vp.width,vp.height]);
        g.setUniform(program,'outline_target','4f',[targetWidth,g.renderHeight,vp.minZ,vp.maxZ]);
        g.setUniform(program,'outline_state','4f',[fill,state.lastPixel===false?0:1,cull,size]);
        g.setUniform(program,'outline_point_bounds','4f',[min,max,state.pointSprite?1:0,0]);
        g.setCapability(gl.CULL_FACE,false);g.setViewport(0,0,targetWidth,g.renderHeight);
        this.touchColor(draw.colorAttachment);
        g.draw({program,vertexBuffer:this.outlineBuffer,stride:recordBytes*3,attributes:outputAttributes,mode:gl.TRIANGLES,count:6,instances:draw.primitiveCount*3});
        if(g.getError()!==gl.NO_ERROR)invalid('GPU outline execution failed');
        return;
      }
      g.updateBuffer(this.vertices, gl.ARRAY_BUFFER, draw.vertices);
      // WebGL2's mandatory primitive restart reserves INDEX16 0xffff, while
      // D3D treats it as an ordinary vertex. Widen only this submitted range.
      const gpuIndices=indices&&g.version===2&&indices.subarray(0,count).includes(65535)?Uint32Array.from(indices.subarray(0,count)):indices;
      if (gpuIndices) g.updateBuffer(this.indices, gl.ELEMENT_ARRAY_BUFFER, gpuIndices.subarray(0, count));
      const modes = [0, gl.POINTS, gl.LINES, gl.LINE_STRIP, gl.TRIANGLES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN];
      this.touchColor(draw.colorAttachment);
      g.draw({ program, vertexBuffer: this.vertices, indexBuffer: indices ? this.indices : null,
        mode: modes[draw.primitive], count, stride: draw.stride, attributes,indexType:gpuIndices instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT });
    }
    stencilState(state,attachment,compares) {
      const g=this.gpu,gl=g.gl;
      if(!state.stencilEnable){g.setCapability(gl.STENCIL_TEST,false);return;}
      if(!attachment||attachment.format!==75)invalid('stencil requires D24S8');
      const ops=[0,gl.KEEP,gl.ZERO,gl.REPLACE,gl.INCR,gl.DECR,gl.INVERT,gl.INCR_WRAP,gl.DECR_WRAP];
      const get=(name,fallback)=>state[name]===undefined?fallback:state[name];
      const ref=get('stencilRef',0),mask=get('stencilMask',0xffffffff),write=get('stencilWriteMask',0xffffffff);
      for(const v of [ref,mask,write])if(!Number.isInteger(v)||v<0||v>0xffffffff)invalid('invalid stencil reference/mask');
      const front=[get('stencilFunc',8),get('stencilFail',1),get('stencilZFail',1),get('stencilPass',1)];
      const back=state.twoSidedStencil?[get('ccwStencilFunc',8),get('ccwStencilFail',1),get('ccwStencilZFail',1),get('ccwStencilPass',1)]:front;
      for(const face of [front,back])if(face.some(v=>!Number.isInteger(v)||v<1||v>8))invalid('invalid stencil function/operation');
      g.setCapability(gl.STENCIL_TEST,true);g.setStencilMask(write&255);
      // D3D CW uses ordinary ops; existing frontFace(CW) makes this GL FRONT.
      for(const [face,values]of [[gl.FRONT,front],[gl.BACK,back]]){
        g.setStencilFunc(face,compares[values[0]],ref&255,mask&255);
        g.setStencilOp(face,ops[values[1]],ops[values[2]],ops[values[3]]);
      }
    }
    resourcePlan(chains,feedbackId,kind){
      // Ordered executor revisions include draws/clears, not just CPU uploads.
      // A producer's optional version cannot prove GPU contents unchanged.
      // Mixed CPU levels lack a stable content identity, so never cache them.
      const ids=new Set(),keys=[];let all=true;
      for(const chain of chains){keys.push('face');for(const level of chain){
        if(!level?.resource){all=false;continue;}
        if(level.pixels!==undefined)invalid('ambiguous resource/pixel mip');
        if(level.resource.id===feedbackId)invalid('render target sampler feedback');
        const color=this.colorResource(level.resource);
        if(!color||color.width!==level.width||color.height!==level.height||level.pitch!==undefined&&level.pitch!==color.width*4)invalid('invalid resource mip layout');
        ids.add(color.id);keys.push(color.id+':'+color.revision+':'+color.width+':'+color.height);
      }}return {ids,key:all&&ids.size?kind+keys.join('|'):null};
    }
    uploadTexture(stage, image, atlas = false,feedbackId) {
      if(atlas)return this.uploadMipAtlas(stage,image,feedbackId);
      const g = this.gpu, gl = g.gl;
      if (!Number.isInteger(image.width) || image.width < 1 || !Number.isInteger(image.height) || image.height < 1)
        invalid('invalid RGBA texture snapshot');
      const sampler = image.sampler || {};
      const bias=sampler.lodBias??0,maxMip=sampler.maxMipLevel??0;
      if(!Number.isFinite(bias)||!Number.isFinite(Math.fround(bias))
          ||!Number.isInteger(maxMip)||maxMip<0||maxMip>0xffffffff)
        invalid('invalid sampler LOD state');
      const addresses = [0, gl.REPEAT, gl.MIRRORED_REPEAT, gl.CLAMP_TO_EDGE];
      const u = sampler.addressU === undefined ? 1 : sampler.addressU;
      const v = sampler.addressV === undefined ? 1 : sampler.addressV;
      if (!addresses[u] || !addresses[v]) invalid('unsupported texture address mode');
      if (g.version !== 2 && (image.width & (image.width - 1) || image.height & (image.height - 1)) && (u !== 3 || v !== 3))
        invalid('WebGL1 NPOT textures require clamp');
      const min = sampler.min === undefined ? 1 : sampler.min;
      const mag = sampler.mag === undefined ? 1 : sampler.mag;
      let mip = sampler.mip || 0;
      if (![1, 2].includes(min) || ![1, 2].includes(mag) || ![0,1,2].includes(mip))
        invalid('unsupported texture filter/mip chain');
      const cube = !!image.faces, target = cube ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D;
      const faces = cube ? image.faces : [image];
      if (cube && (faces.length !== 6 || image.width !== image.height)) invalid('invalid cube faces');
      // A one-level D3D texture clamps every requested LOD to that level.
      // Non-mip GL filtering implements that exactly without inventing pixels.
      const singleLevel=faces.every(face => !face.levels || face.levels.length === 1);
      // One available level clamps every LOD to the same image. Bias can
      // still choose min versus mag filtering, so this is neutral only when
      // both filters agree. Keep genuinely unsupported cases explicit.
      if((bias!==0||maxMip!==0)&&!(singleLevel&&min===mag))
        invalid('WebGL sampler LOD bias/MAXMIPLEVEL is not implemented');
      if (singleLevel) mip = 0;
      if (g.version !== 2 && mip && (image.width & (image.width-1) || image.height & (image.height-1)))
        invalid('WebGL1 NPOT textures cannot use mip filters');
      let chains = faces.map(face => face.levels || [face]);
      const resources=this.resourcePlan(chains,feedbackId,'plain');
      const signedBump = image.format === 62;
      if(signedBump&&resources.ids.size)invalid('signed bump resource aliases are not supported');
      if (signedBump && ((this.gpu.version!==2&&!gl.getExtension('OES_texture_float'))
          || ((min === 2 || mag === 2 || mip === 2) && !gl.getExtension('OES_texture_float_linear'))))
        invalid('signed bump textures require float sampling/filtering extensions');
      // D3D lets a texture stop its chain above 1x1 (CreateTexture Levels=N)
      // and clamps every coarser LOD to the last level it has. WebGL2 says
      // that exactly with TEXTURE_MAX_LEVEL; WebGL1 has no clamp and refuses
      // an incomplete chain, so there the missing levels are box-filtered down
      // from the last real one (Morrowind's DDS textures stop at 4x4/8x8).
      let partialChain=false;
      for (const levels of chains) {
        if (!levels.length || levels.length !== chains[0].length) invalid('inconsistent cube mip counts');
        let width=image.width,height=image.height;
        for(const level of levels) {
          if(level.width!==width || level.height!==height || (!level.resource&&(typeof level.key!=='string'||level.pixels!==undefined)
              &&(!(level.pixels instanceof Uint8Array) || level.pixels.length!==width*height*4))) invalid('invalid mip level');
          if(level.resource&&level.key!==undefined)invalid('ambiguous resource/pixel mip');
          width=Math.max(1,width>>1);height=Math.max(1,height>>1);
        }
        if(mip && (levels.at(-1).width!==1 || levels.at(-1).height!==1)) partialChain=true;
      }
      const keyed=this.keyedPlan(chains,target,signedBump?'signed':'plain');
      let texture,reuse;
      if(keyed){
        chains=chains.map(levels=>levels.map(level=>this.levelPixels(level)));
        const held=this.keyedTextures.get(keyed.ck);
        if(held){texture=held.texture;reuse=true;}
        else{texture=g.createTexture();reuse=false;this.registerKeyed(keyed,texture);}
        this.bindKeyed(stage,keyed,target,texture);
      }else{
        texture=this.stageTexture(stage,target);
        reuse=resources.key!==null&&this.resourceSamples.get(stage)?.key===resources.key;
        if(!reuse)this.resourceSamples.delete(stage);
      }
      const padChain=partialChain&&g.version!==2;
      const uploadChains=padChain?chains.map(levels=>completeMipChain(levels.map(level=>this.levelPixels(level)))):chains;
      if(!reuse)uploadChains.forEach((levels, face) => levels.forEach((level,index) => {
        const upload = { ...level, level:index, unit:0, internalFormat:gl.RGBA, format:gl.RGBA, type:gl.UNSIGNED_BYTE };
        if (signedBump) {
          // Decode each texel before hardware filtering, never filter unsigned
          // bytes across the signed-byte discontinuity at 0x80.
          const pixels = new Float32Array(level.pixels.length);
          for (let i = 0; i < pixels.length; i += 4) {
            for (let c = 0; c < 2; c++) {
              const byte = level.pixels[i + c];
              pixels[i + c] = Math.max((byte >= 128 ? byte - 256 : byte) / 127, -1);
            }
            pixels[i + 2] = level.pixels[i + 2] / 255; pixels[i + 3] = 1;
          }
          upload.pixels = pixels; upload.type = gl.FLOAT;
          // WebGL2 float storage requires a sized internal format.
          if (g.version === 2) upload.internalFormat = gl.RGBA32F;
        }
        if (cube) g.uploadCubeFace(texture, face, upload); else g.uploadTexture2D(texture, upload);
      }));
      if(!reuse)chains.forEach((levels,face)=>levels.forEach((level,index)=>{if(level.resource)g.copyColorToTexture(level.resource.id,texture,{target,face,level:index});}));
      if(resources.ids.size)this.resourceSamples.set(stage,resources);else if(!keyed)this.resourceSamples.delete(stage);
      g.setTextureParameter(texture, gl.TEXTURE_WRAP_S, addresses[u], target);
      g.setTextureParameter(texture, gl.TEXTURE_WRAP_T, addresses[v], target);
      const minFilters=[[gl.NEAREST,gl.LINEAR],[gl.NEAREST_MIPMAP_NEAREST,gl.LINEAR_MIPMAP_NEAREST],
        [gl.NEAREST_MIPMAP_LINEAR,gl.LINEAR_MIPMAP_LINEAR]];
      if(partialChain&&!padChain)g.setTextureParameter(texture, gl.TEXTURE_MAX_LEVEL, chains[0].length-1, target);
      g.setTextureParameter(texture, gl.TEXTURE_MIN_FILTER, minFilters[mip][min-1], target);
      g.setTextureParameter(texture, gl.TEXTURE_MAG_FILTER, mag === 1 ? gl.NEAREST : gl.LINEAR, target);
    }
    uploadMipAtlas(stage,image,feedbackId) {
      const g=this.gpu,gl=g.gl,s=image.sampler||{};let levels=image.levels||[image];
      const base=image.baseLOD??0,ow=image.originalWidth===undefined?image.width*2**base:image.originalWidth;
      const oh=image.originalHeight===undefined?image.height*2**base:image.originalHeight;
      const bias=s.lodBias??0,max=s.maxMipLevel??0,min=s.min===undefined?1:s.min,mag=s.mag===undefined?1:s.mag,mip=s.mip??0;
      const u=s.addressU===undefined?1:s.addressU,v=s.addressV===undefined?1:s.addressV;
      const border=s.borderColor??0;
      const resources=this.resourcePlan([levels],feedbackId,'atlas');
      if(image.faces||!Number.isInteger(base)||base<0||base>11||!Number.isInteger(max)||max<0||max>0xffffffff
        ||!Number.isFinite(bias)||!Number.isFinite(Math.fround(bias))||![1,2].includes(min)||![1,2].includes(mag)||![0,1,2].includes(mip)
        ||![1,2,3,4].includes(u)||![1,2,3,4].includes(v)||!Number.isInteger(ow)||!Number.isInteger(oh)||ow<1||oh<1||ow>2048||oh>2048
        ||!Number.isInteger(border)||border<0||border>0xffffffff||!levels.length||levels.length>12)invalid('invalid mip atlas metadata');
      if(base>Math.floor(Math.log2(Math.max(ow,oh))))invalid('invalid mip atlas residency');
      let width=Math.max(1,ow>>base),height=Math.max(1,oh>>base),yOffset=0;
      if(image.width!==width||image.height!==height)invalid('mip atlas original/resident dimensions disagree');
      const atlasWidth=width,atlasHeight=levels.reduce((sum,level)=>sum+level.height,0),rects=new Float32Array(48);
      if(atlasWidth>gl.getParameter(gl.MAX_TEXTURE_SIZE)||atlasHeight>gl.getParameter(gl.MAX_TEXTURE_SIZE))invalid('mip atlas exceeds GPU texture size');
      levels.forEach((level,i)=>{
        if(level.width!==width||level.height!==height||(!level.resource&&(typeof level.key!=='string'||level.pixels!==undefined)
            &&(!(level.pixels instanceof Uint8Array)||level.pixels.length!==width*height*4)))
          invalid('invalid mip atlas level');
        if(level.resource&&level.key!==undefined)invalid('ambiguous resource/pixel mip');
        rects.set([0,yOffset,width,height],i*4);yOffset+=height;
        if(i+1<levels.length&&width===1&&height===1)invalid('too many mip atlas levels');
        width=Math.max(1,width>>1);height=Math.max(1,height>>1);
      });
      const signed=image.format===62;
      if(signed&&resources.ids.size)invalid('signed bump resource aliases are not supported');
      if(image.format!==undefined&&image.format!==0&&!signed)invalid('unsupported mip atlas pixel format');
      if(signed&&this.gpu.version!==2&&!gl.getExtension('OES_texture_float'))invalid('signed mip atlas requires float texture sampling');
      // The atlas layout is a pure function of the level dimensions, so a
      // keyed atlas is reusable whenever the same keys come back.
      const keyed=this.keyedPlan([levels],gl.TEXTURE_2D,signed?'atlas-signed':'atlas');
      let texture,reuse;
      if(keyed){
        levels=levels.map(level=>this.levelPixels(level));
        const held=this.keyedTextures.get(keyed.ck);
        if(held){texture=held.texture;reuse=true;}
        else{texture=g.createTexture();reuse=false;this.registerKeyed(keyed,texture);}
        this.bindKeyed(stage,keyed,gl.TEXTURE_2D,texture);
      }else{
        texture=this.stageTexture(stage,gl.TEXTURE_2D);
        reuse=resources.key!==null&&this.resourceSamples.get(stage)?.key===resources.key;
        if(!reuse)this.resourceSamples.delete(stage);
      }
      if(!reuse){
        const pixels=signed?new Float32Array(atlasWidth*atlasHeight*4):new Uint8Array(atlasWidth*atlasHeight*4);
        levels.forEach((level,i)=>{const ox=rects[i*4],oy=rects[i*4+1];
          if(level.resource)return;
          for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++)for(let c=0;c<4;c++){
            const value=level.pixels[(y*level.width+x)*4+c];
            pixels[((y+oy)*atlasWidth+x+ox)*4+c]=signed?(c===3?1:c===2?value/255:Math.max((value>=128?value-256:value)/127,-1)):value;
          }});
        g.uploadTexture2D(texture,{width:atlasWidth,height:atlasHeight,pixels,unit:0,internalFormat:signed&&g.version===2?gl.RGBA32F:gl.RGBA,format:gl.RGBA,type:signed?gl.FLOAT:gl.UNSIGNED_BYTE});
        levels.forEach((level,i)=>{if(level.resource)g.copyColorToTexture(level.resource.id,texture,{y:rects[i*4+1]});});}
      if(resources.ids.size)this.resourceSamples.set(stage,resources);else if(!keyed)this.resourceSamples.delete(stage);
      g.setTextureParameter(texture,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      g.setTextureParameter(texture,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      g.setTextureParameter(texture,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      g.setTextureParameter(texture,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      if(!this.mipUniforms)this.mipUniforms=new Map();
      this.mipUniforms.set(stage,{
        [`d3d_mips${stage}[0]`]:rects,[`d3d_lod${stage}`]:[ow,oh,bias,base],
        [`d3d_filter${stage}`]:[min,mag,mip,max],[`d3d_extent${stage}`]:[atlasWidth,atlasHeight,levels.length,base+levels.length-1],
        [`d3d_address${stage}`]:[u,v,0,0],[`d3d_border${stage}`]:[border>>>16&255,border>>>8&255,border&255,border>>>24].map(v=>v/255)
      });
    }
    present() { return this.gpu.present(); }
    destroy() { this.gpu.destroy(); this.programs.clear(); this.fixedPlans.clear(); this.outlinePrograms.clear(); this.textures.clear(); this.textureTargets.clear(); this.depthTargets.clear(); this.colorTargets.clear(); this.resourceSamples.clear(); this.mipUniforms?.clear(); this.keyedTextures.clear(); this.keyMembers.clear(); this.stageKeys.clear(); this.residentPixels.clear(); }
  }
  // A capability probe exercises this frontend's compiler/draw/upload/readback
  // path, not just the presence of a WebGL constructor. Cached by the bridge.
  function probe(canvas) {
    let device;
    try {
      canvas.width=canvas.height=4;device=new Device(canvas);
      const gl=device.gpu.gl;
      if(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)<96
          || gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)<4
          || gl.getParameter(gl.MAX_TEXTURE_SIZE)<2048)return false;
      const vertexShader=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,
        1,0xe00f0000,0xa0e40000,0xffff]);
      const pixelShader=new Uint32Array([0xffff0101,66,0xb00f0000,
        5,0x800f0000,0xb0e40000,0xa0e40000,0xffff]);
      device.clear([0,0,0,1],3);
      device.draw({vertexShader,pixelShader,primitive:4,primitiveCount:1,stride:16,
        vertices:new Uint8Array(new Float32Array([-1,-1,0.25,1,3,-1,0.25,1,-1,3,0.25,1]).buffer),
        indices:new Uint16Array([0,1,2]),attributes:[{register:0,type:3,offset:0}],
        vertexConstants:new Float32Array([0.5,0.5,0,1]),pixelConstants:new Float32Array([0.5,0.25,1,1]),
        textures:[{width:1,height:1,pixels:new Uint8Array([200,160,80,255])}],state:{cull:1}});
      const pixel=device.gpu.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
      return device.gpu.getError()===0 && [100,40,80,255].every((v,i)=>Math.abs(pixel[i]-v)<=1);
    } catch (_) {return false;} finally {if(device)device.destroy();}
  }
  return { Device, primitiveVertices, probe };
});
