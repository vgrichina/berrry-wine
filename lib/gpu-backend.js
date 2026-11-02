// Backend-neutral GPU command target for accelerated guest graphics APIs.
//
// Frontends (OpenGL 1.x today, Direct3D later) own their API-specific state
// machines and lower them to this small WebGL/GLES-shaped contract: buffers,
// textures, programs, uniforms, fixed raster state, draw, readback, present.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GpuBackend = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Our generated ES1 shaders use extensions promoted to core in ES3.
  // WebGL2 accepts ES1 too, but those extension directives require porting:
  // https://registry.khronos.org/webgl/specs/2.0/
  function shader300(source, fragment) {
    if(/^\s*#version\s+300\s+es\b/.test(source))return source;
    if(/^\s*#version\s+(?!100\b)/.test(source))throw new Error('Unsupported generated shader version');
    source=source.replace(/^\s*#version\s+100\s*\n/,'')
      .replace(/^\s*#extension\s+GL_(?:OES_standard_derivatives|EXT_frag_depth|EXT_shader_texture_lod)\s*:[^\n]*\n/gm,'')
      .replace(/\battribute\b/g,'in').replace(/\bvarying\b/g,fragment?'in':'out')
      .replace(/\btexture2DProj\b/g,'textureProj')
      .replace(/\b(?:texture2DLodEXT|textureCubeLodEXT)\b/g,'textureLod')
      .replace(/\b(?:texture2DGradEXT|textureCubeGradEXT)\b/g,'textureGrad')
      .replace(/\b(?:texture2D|textureCube)\b/g,'texture')
      .replace(/\bgl_FragDepthEXT\b/g,'gl_FragDepth');
    const color=fragment&&/\bgl_FragColor\b/.test(source);
    if(color)source=source.replace(/\bgl_FragColor\b/g,'wa_FragColor');
    return '#version 300 es\n'+(color?'out highp vec4 wa_FragColor;\n':'')+source;
  }

  // Is this context's shader compiler GLSL ES, or a desktop GLSL one?
  //
  // A browser's WebGL is always GLSL ES 1.00. A headless Node context
  // (@node-3d/webgl, see lib/headless-gl.js) hands our source straight to the
  // platform's native compiler, which on a Mac reports GLSL 110 -- and the two
  // dialects are NOT the same language. Every shader in this project is
  // written in ESSL, so without a port step they all fail to compile headless,
  // with errors that read like our shaders are malformed rather than merely
  // in the wrong dialect.
  //
  // Cached on the context: getParameter is a synchronous driver round trip and
  // this is asked once per shader compile.
  function isGLSLES(gl) {
    if (gl.__wineIsES === undefined) {
      let v = '';
      try { v = String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || ''); } catch (_) {}
      // "OpenGL ES GLSL ES 1.00" / "WebGL GLSL ES 1.0" are ES; "1.10" is not.
      gl.__wineIsES = /ES|WebGL/.test(v);
    }
    return gl.__wineIsES;
  }

  // Rewrite an ESSL shader into something desktop GLSL 110 also accepts. Only
  // the divergences our own shaders actually hit are handled, and each one is
  // a construct that is legal in ES and absent from 110:
  //   - precision declarations and lowp/mediump/highp qualifiers do not exist
  //     in 110 at all.
  // (mat3(mat4) sub-matrix constructors were the other one; those are fixed at
  // the source in lib/gl-compat.js instead, because writing the columns out is
  // valid in both dialects and needs no rewriting.)
  function portToDesktopGLSL(source) {
    // Not line-anchored: several of our shaders are written as a single line
    // (`'precision mediump float; varying vec2 uv; ...'`), and anchoring the
    // match to a whole line silently skipped exactly those.
    return String(source)
      // Fragment derivatives are core in desktop GLSL 1.10. The ESSL
      // extension name is unknown there and a `require` directive makes an
      // otherwise-valid mip-atlas shader fail before dFdx/dFdy are parsed.
      .replace(/^\s*#extension\s+GL_OES_standard_derivatives\s*:[^\n]*(?:\n|$)/gm, '')
      // Explicit-LOD fragment sampling is the ARB extension on desktop, with
      // the core-style function name; the ESSL EXT name is rejected outright
      // (OpenGL GL_CLAMP border sampling, Descent 3). lib/glide-backend.js
      // makes the same rewrite for its mip-clamping shader.
      .replace(/^(\s*#extension\s+GL_)EXT(_shader_texture_lod\s*:)/gm, '$1ARB$2')
      .replace(/\btexture2DLodEXT\b/g, 'texture2DLod')
      .replace(/\bprecision\s+(?:lowp|mediump|highp)\s+\w+\s*;/g, '')
      .replace(/\b(?:lowp|mediump|highp)\b/g, '');
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader allocation failed');
    if (!isGLSLES(gl) && !/^#version/.test(source)) source = portToDesktopGLSL(source);
    try {
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) || 'shader compilation failed');
      return shader;
    } catch (error) {
      gl.deleteShader(shader);
      throw error;
    }
  }

  class WebGLBackend {
    constructor(canvas, options) {
      this.canvas = canvas;
      const opts = Object.assign({
        alpha: false,
        antialias: false,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: true,
      }, options || {});
      const version=opts.apiVersion===undefined?1:opts.apiVersion;
      delete opts.apiVersion;
      if(![1,2,'auto'].includes(version))throw new Error('Invalid WebGL API version');
      let gl=canvas&&version!==1?canvas.getContext('webgl2',opts):null;
      this.version=gl?2:1;
      if(!gl&&version!==2)gl=canvas&&(canvas.getContext('webgl',opts)||canvas.getContext('experimental-webgl',opts));
      if (!gl) throw new Error('WebGL is unavailable');
      if (opts.stencil && gl.getContextAttributes && !gl.getContextAttributes()?.stencil)
        throw new Error('WebGL stencil attachment is unavailable');
      this.gl = gl;
      // WebGL draws directly into its context canvas. The guest may yield in
      // the middle of a frame, so exposing that canvas to the window
      // compositor would let an unrelated repaint display a half-built frame.
      // Keep presentation ownership in the generic backend and publish only a
      // snapshot copied by present()/SwapBuffers.
      this.presentationCanvas = null;
      this.presentationContext = null;
      const ownerDocument = canvas && canvas.ownerDocument;
      if ((ownerDocument && typeof ownerDocument.createElement === 'function') || typeof OffscreenCanvas === 'function') {
        const presentationCanvas = ownerDocument ? ownerDocument.createElement('canvas')
          : new OffscreenCanvas(Math.max(1, canvas.width | 0), Math.max(1, canvas.height | 0));
        presentationCanvas.width = Math.max(1, canvas.width | 0);
        presentationCanvas.height = Math.max(1, canvas.height | 0);
        const presentationContext = presentationCanvas.getContext &&
          presentationCanvas.getContext('2d', { alpha: false });
        if (presentationContext) {
          presentationContext.imageSmoothingEnabled = false;
          this.presentationCanvas = presentationCanvas;
          this.presentationContext = presentationContext;
        }
      }
      this._buffers = new Set();
      this._textures = new Set();
      this._programs = new Set();
      this._boundBuffers = new Map();
      this._activeTextureUnit = -1;
      this._boundTextures = new Map();
      this._textureParams = new WeakMap();
      this._currentProgram = null;
      this._uniformValues = new WeakMap();
      this._attributeState = new Map();
      this._enabledAttributes = new Set();
      this._stateValues = new Map();
      this._targets = new Map();
      this._depthStores = new Map();
      this._colorResources = new Map();
      this._implicitTarget = null;
      this._target = null;
      this._targetBytes = 0;
      this.targetBudget = 256 * 1024 * 1024;
    }

    // GL window attachments belong to a drawable, independently of frontend
    // contexts. MRT runs fragment tests once and blends against each image.
    enableDrawableBuffers() {
      if (this._drawables) return;
      const gl = this.gl;
      this._drawBuffersExtension = this.version === 1 ? gl.getExtension('WEBGL_draw_buffers') : null;
      if (this.version === 1 && !this._drawBuffersExtension)
        throw new Error('GL drawable buffers require WEBGL_draw_buffers');
      this._drawables = new Map();
    }
    _drawBuffers(values) {
      if (this.version === 2) this.gl.drawBuffers(values);
      else this._drawBuffersExtension.drawBuffersWEBGL(values);
    }
    createDrawable(id, width, height, single = false) {
      const gl = this.gl;
      if (this._drawables.has(id)) throw new Error('Duplicate GL drawable');
      if (!(width > 0 && height > 0) || width * height > 16777216)
        throw new Error('Invalid GL drawable size');
      const bytes = width * height * (single ? 8 : 12);
      if (this._targetBytes + bytes > this.targetBudget) throw new Error('GL drawable budget exceeded');
      const d = { id, width, height, single, bytes, colors: [], frames: [], depth: null };
      try {
        for (let i = 0; i < (single ? 1 : 2); i++) {
          const texture = this.createTexture(); d.colors.push(texture);
          for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
            [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) this.setTextureParameter(texture,key,value);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }
        d.depth = gl.createRenderbuffer();
        if (!d.depth) throw new Error('GL drawable depth allocation failed');
        gl.bindRenderbuffer(gl.RENDERBUFFER, d.depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, this.version === 2 ? gl.DEPTH24_STENCIL8 : gl.DEPTH_STENCIL, width, height);
        for (let i = 0; i < (single ? 1 : 3); i++) {
          const frame = gl.createFramebuffer(); d.frames.push(frame);
          if (!frame) throw new Error('GL drawable framebuffer allocation failed');
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, d.colors[i === 1 ? 1 : 0], 0);
          if (i === 2) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + 1, gl.TEXTURE_2D, d.colors[1], 0);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, d.depth);
          this._drawBuffers(i === 2 ? [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT0 + 1] : [gl.COLOR_ATTACHMENT0]);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE || gl.getError() !== gl.NO_ERROR)
            throw new Error('GL drawable framebuffer unavailable');
        }
        this._drawables.set(id, d); this._targetBytes += bytes;
        return d;
      } catch (error) { this._freeDrawable(d); throw error; }
      finally { gl.bindFramebuffer(gl.FRAMEBUFFER, this._target?.framebuffer || null); }
    }
    _freeDrawable(d) {
      for (const frame of d.frames) if (frame) this.gl.deleteFramebuffer(frame);
      for (const color of d.colors) this.deleteTexture(color);
      if (d.depth) this.gl.deleteRenderbuffer(d.depth);
    }
    releaseDrawable(id) {
      const d = this._drawables?.get(id);
      if (!d) return;
      if (this._drawable === d) { this._drawable = null; this._target = null; this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null); }
      this._freeDrawable(d); this._targetBytes -= d.bytes; this._drawables.delete(id);
    }
    resizeDrawable(id, width, height) {
      const old = this._drawables.get(id);
      if (old.width === width && old.height === height) return old;
      // Keep the old images usable if replacement allocation fails.
      const token = {};
      const next = this.createDrawable(token,width,height,old.single);
      this.releaseDrawable(id); this._drawables.delete(token); next.id=id; this._drawables.set(id,next);
      return next;
    }
    bindDrawable(id, drawBuffer = 0x405, readBuffer = 0x405) {
      const d = this._drawables.get(id);
      if (!d) throw new Error('Unknown GL drawable');
      this._drawable = d; this._drawableReadBuffer = readBuffer;
      if (this.canvas.width !== d.width) this.canvas.width = d.width;
      if (this.canvas.height !== d.height) this.canvas.height = d.height;
      this.setDrawBuffer(drawBuffer);
    }
    setDrawBuffer(mode) {
      const d = this._drawable, gl = this.gl;
      if (!d) return;
      const both = mode === 0x408 || mode === 0x406;
      const front = mode === 0x400 || mode === 0x404;
      const index = both && !d.single ? 2 : front || d.single ? 0 : 1;
      const frame = d.frames[index];
      gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
      this._drawBuffers(mode === 0 ? [gl.NONE] : index === 2 ? [gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT0+1] : [gl.COLOR_ATTACHMENT0]);
      this._target = { width:d.width,height:d.height,framebuffer:frame,color:d.colors[index===1?1:0] };
      this._drawableDrawBuffer = mode;
    }
    setReadBuffer(mode) { this._drawableReadBuffer = mode; }
    swapDrawable() {
      const d = this._drawable;
      if (!d || d.single) return;
      [d.colors[0],d.colors[1]]=[d.colors[1],d.colors[0]];
      [d.frames[0],d.frames[1]]=[d.frames[1],d.frames[0]];
      const gl=this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER,d.frames[2]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,d.colors[0],0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+1,gl.TEXTURE_2D,d.colors[1],0);
      this.setDrawBuffer(this._drawableDrawBuffer);
    }
    invalidateRasterState() { this._stateValues.clear(); }
    // Contexts share the execution device, but each owns its API resources and
    // raster-state snapshot. Switching never imports another context's state.
    createContextBackend(width, height) {
      const backend=this, state=new Map(), resources={buffers:new Set(),textures:new Set(),programs:new Set()};
      const defaults={setViewport:[0,0,width,height],setScissor:[0,0,width,height],setDepthFunc:[0x201],
        setDepthMask:[true],setColorMask:[true,true,true,true],setStencilMask:[0xffffffff],
        setStencilFunc:[0x408,0x207,0,0xffffffff],setStencilOp:[0x408,0x1e00,0x1e00,0x1e00],
        setDepthRange:[0,1],setPolygonOffset:[0,0],setBlendFunc:[1,0],setCullFace:[0x405],setFrontFace:[0x901],setLineWidth:[1]};
      for (const [name,args] of Object.entries(defaults)) state.set(name,{name,args});
      for (const cap of [0x0be2,0x0b71,0x0b90,0x0b44,0x0c11,0x8037]) state.set('cap:'+cap,{name:'setCapability',args:[cap,false]});
      const errors=[];
      const validState=(name,args)=>{
        if(name==='setViewport'||name==='setScissor')return (args[2]|0)>=0&&(args[3]|0)>=0;
        if(name==='setDepthFunc')return args[0]>=0x200&&args[0]<=0x207;
        if(name==='setCullFace')return [0x404,0x405,0x408].includes(args[0]);
        if(name==='setFrontFace')return [0x900,0x901].includes(args[0]);
        if(name==='setLineWidth')return args[0]>0;
        if(name==='setBlendFunc')return args.every((v,i)=>v===0||v===1||(v>=0x300&&v<=0x307)||(i===0&&v===0x308));
        return true;
      };
      let facade;
      const local={
        captureErrors() { let error;while((error=backend.getError()))if(!errors.includes(error))errors.push(error); },
        getError() { return errors.length?errors.shift():backend.getError(); },
        activate() { for(const {name,args} of state.values()) backend[name](...args); },
        destroy() {
          for(const b of resources.buffers){backend.gl.deleteBuffer(b);backend._buffers.delete(b);}
          for(const t of resources.textures)backend.deleteTexture(t);
          for(const p of resources.programs){backend.gl.deleteProgram(p.handle);backend._programs.delete(p.handle);}
          for(const values of Object.values(resources))values.clear();
        },
      };
      facade=new Proxy(local,{get(target,key){
        if(key in target)return target[key];
        const value=backend[key];
        if(typeof value!=='function')return value;
        if(key==='createBuffer'||key==='createTexture'||key==='createProgram')return (...args)=>{
          const value=backend[key](...args);resources[key==='createBuffer'?'buffers':key==='createTexture'?'textures':'programs'].add(value);return value;
        };
        if(Object.hasOwn(defaults,key)||key==='setCapability')return (...args)=>{
          const valid=validState(key,args);
          if(valid)state.set(key==='setCapability'?'cap:'+args[0]:key,{name:key,args:args.slice()});
          const result=backend[key](...args);
          if(!valid)backend.invalidateRasterState();
          return result;
        };
        return value.bind(backend);
      }});
      return facade;
    }

    // Opt-in offscreen targets. Each depth identity owns persistent storage;
    // color follows the logical target by GPU copy when attachments change.
    // Matching color storage also supports depth surfaces larger than the RT.
    bindRenderTarget(key, width, height, depthBits = 0, logicalWidth=this.canvas.width, logicalHeight=this.canvas.height) {
      this.bindImplicitTarget();
      const gl = this.gl, old = this._target;
      let target = this._targets.get(key);
      if (target && (target.width !== width || target.height !== height || target.depthBits !== depthBits))
        throw new Error('Render target identity changed');
      if (!target) {
        const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
        const bytes = width * height * 4;
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < logicalWidth || height < logicalHeight ||
            width > limit || height > limit || ![0,16,24].includes(depthBits) || bytes > this.targetBudget - this._targetBytes)
          throw new Error('Render target dimensions or budget exceeded');
        target = { key, width, height, depthBits, bytes, framebuffer: null, color: null, depth: null };
        try {
          target.framebuffer = gl.createFramebuffer();
          if (!target.framebuffer) throw new Error('Framebuffer allocation failed');
          target.color = this.createTexture();
          this.uploadTexture2D(target.color, {width,height,internalFormat:gl.RGBA,format:gl.RGBA,type:gl.UNSIGNED_BYTE});
          for (const pname of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) this.setTextureParameter(target.color,pname,gl.NEAREST);
          for (const pname of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) this.setTextureParameter(target.color,pname,gl.CLAMP_TO_EDGE);
          gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
          gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.color,0);
          if (depthBits) {
            target.depthCreated=!this._depthStores.has(key);
            target.depthStore=this._depthStorage(key,width,height,depthBits,bytes);
            target.depth=target.depthStore.object;
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER,depthBits===16?gl.DEPTH_ATTACHMENT:gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,target.depth);
          }
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete render target');
          this.setCapability(gl.SCISSOR_TEST,false); this.setDepthMask(true);
          this.setColorMask(true,true,true,true);
          this.setStencilMask(255);
          const fresh=target.depthStore?.fresh;
          this.clear([0,0,0,0],gl.COLOR_BUFFER_BIT|(fresh?gl.DEPTH_BUFFER_BIT:0)|(fresh&&depthBits===24?gl.STENCIL_BUFFER_BIT:0),1,0);
          if(target.depthStore)target.depthStore.fresh=false;
          if (gl.getError()!==gl.NO_ERROR) throw new Error('Render target allocation failed');
          this._targets.set(key,target); this._targetBytes += bytes;
        } catch (error) {
          this._deleteRenderTarget(target);
          if(target.depthCreated&&target.depthStore){gl.deleteRenderbuffer(target.depthStore.object);this._targetBytes-=target.depthStore.bytes;this._depthStores.delete(key);}
          gl.bindFramebuffer(gl.FRAMEBUFFER,old?old.framebuffer:null);
          throw error;
        }
      }
      if (target !== old && old) {
        gl.bindFramebuffer(gl.FRAMEBUFFER,old.framebuffer);
        this.bindTexture(target.color,0);
        gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,height-this.canvas.height,0,old.height-this.canvas.height,this.canvas.width,this.canvas.height);
        if(gl.getError()!==gl.NO_ERROR)throw new Error('Render target color transfer failed');
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
      this._target = target;
      this._implicitTarget = target;
      return target;
    }

    get renderHeight() { return this._target ? this._target.height : this.canvas.height; }

    _depthStorage(key,width,height,bits,reserved=0) {
      const gl=this.gl,old=this._depthStores.get(key);
      if(old){if(old.width!==width||old.height!==height||old.bits!==bits)throw Error('Depth identity changed');return old;}
      const bytes=width*height*4;
      if(bytes+reserved>this.targetBudget-this._targetBytes)throw Error('Depth budget exceeded');
      const object=gl.createRenderbuffer();if(!object)throw Error('Depth allocation failed');
      try{gl.bindRenderbuffer(gl.RENDERBUFFER,object);
        gl.renderbufferStorage(gl.RENDERBUFFER,bits===16?gl.DEPTH_COMPONENT16:this.version===2?gl.DEPTH24_STENCIL8:gl.DEPTH_STENCIL,width,height);
        if(gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_DEPTH_SIZE)!==bits||
          bits===24&&gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_STENCIL_SIZE)!==8||gl.getError()!==gl.NO_ERROR)throw Error('Depth precision/allocation unavailable');
      }catch(e){gl.deleteRenderbuffer(object);throw e;}
      const store={object,width,height,bits,bytes,fresh:true};this._depthStores.set(key,store);this._targetBytes+=bytes;return store;
    }
    _colorStorage(width,height,pixels=null) {
      const gl=this.gl,bytes=width*height*4;
      if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>gl.getParameter(gl.MAX_TEXTURE_SIZE)||height>gl.getParameter(gl.MAX_TEXTURE_SIZE)||bytes>this.targetBudget-this._targetBytes)throw Error('Color dimensions/budget exceeded');
      const target={width,height,bytes,color:null,framebuffer:null,depth:null};
      try{target.color=this.createTexture();this.uploadTexture2D(target.color,{width,height,pixels,internalFormat:gl.RGBA,format:gl.RGBA,type:gl.UNSIGNED_BYTE});
        for(const p of[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])this.setTextureParameter(target.color,p,gl.NEAREST);
        for(const p of[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])this.setTextureParameter(target.color,p,gl.CLAMP_TO_EDGE);
        target.framebuffer=gl.createFramebuffer();if(!target.framebuffer)throw Error('Color framebuffer allocation failed');
        gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.color,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE||gl.getError()!==gl.NO_ERROR)throw Error('Color framebuffer unavailable');
      }catch(e){this._deleteRenderTarget(target);throw e;}
      finally{gl.bindFramebuffer(gl.FRAMEBUFFER,this._target?.framebuffer||null);}
      this._targetBytes+=bytes;return target;
    }
    createColorResource(id,width,height,pixels) {
      if(this._colorResources.has(id))throw Error('Duplicate color resource');
      const target=this._colorStorage(width,height,pixels);target.variants=new Map();this._colorResources.set(id,target);return target;
    }
    _saveExplicitTarget() {
      const target=this._target,resource=target?.explicit;if(!resource)return;
      const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);this.bindTexture(resource.color,0);
      gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,target.height-resource.height,resource.width,resource.height);
      if(gl.getError()!==gl.NO_ERROR)throw Error('Color target store failed');
    }
    bindImplicitTarget() {
      if (this._drawable) return;
      if(this._target?.explicit){this._saveExplicitTarget();this._target=this._implicitTarget;this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,this._target?.framebuffer||null);}
    }
    bindColorResource(id,depth) {
      const resource=this._colorResources.get(id);if(!resource)throw Error('Unknown color resource');
      const gl=this.gl,key=depth.key,width=depth.width,height=depth.height;
      if(width<resource.width||height<resource.height)throw Error('Depth smaller than color');
      this.bindImplicitTarget();this._implicitTarget=this._target;
      let target=resource.variants.get(key);
      if(target&&(target.width!==width||target.height!==height||target.depthBits!==depth.bits))throw Error('Color/depth attachment identity changed');
      if(!target){
        target=this._colorStorage(width,height);target.explicit=resource;target.depthBits=depth.bits;target.key=key;
        try{
          if(depth.bits){target.depthCreated=!this._depthStores.has(key);target.depthStore=this._depthStorage(key,width,height,depth.bits);target.depth=target.depthStore.object;
            gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER,depth.bits===16?gl.DEPTH_ATTACHMENT:gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,target.depth);
            if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Color/depth attachment incomplete');
            if(target.depthStore.fresh){this.setCapability(gl.SCISSOR_TEST,false);this.setDepthMask(true);this.setStencilMask(255);
              // Initialization shares the clear-value cache with every frontend.
              this.clear(null,gl.DEPTH_BUFFER_BIT|(depth.bits===24?gl.STENCIL_BUFFER_BIT:0),1,0);target.depthStore.fresh=false;}
          }
          if(gl.getError()!==gl.NO_ERROR)throw Error('Color attachment initialization failed');
          resource.variants.set(key,target);
        }catch(e){this._deleteRenderTarget(target);this._targetBytes-=target.bytes;
          if(target.depthCreated&&target.depthStore){gl.deleteRenderbuffer(target.depthStore.object);this._targetBytes-=target.depthStore.bytes;this._depthStores.delete(key);}
          gl.bindFramebuffer(gl.FRAMEBUFFER,this._target?.framebuffer||null);throw e;}
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,resource.framebuffer);this.bindTexture(target.color,0);
      gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,target.height-resource.height,0,0,resource.width,resource.height);
      if(gl.getError()!==gl.NO_ERROR)throw Error('Color target load failed');
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);this._target=target;
    }
    updateColorResource(id,pixels,rect) {
      const implicit=id==null;
      if(implicit){this.bindImplicitTarget();if(!this._implicitTarget)this.bindRenderTarget(null,this.canvas.width,this.canvas.height,0);}
      const target=implicit?this._implicitTarget:this._colorResources.get(id);if(!target)throw Error('Unknown color resource');
      const width=implicit?this.canvas.width:target.width,height=implicit?this.canvas.height:target.height;
      const r=rect??{x:0,y:0,width,height};
      if(![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width<=0||r.height<=0||
        r.width>width-r.x||r.height>height-r.y||!(pixels instanceof Uint8Array)||
        pixels.length!==r.width*r.height*4)throw Error('Invalid color resource upload');
      this.bindImplicitTarget();this.bindTexture(target.color,0);this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT,1);
      this.gl.texSubImage2D(this.gl.TEXTURE_2D,0,r.x,target.height-r.y-r.height,r.width,r.height,this.gl.RGBA,this.gl.UNSIGNED_BYTE,pixels);
      if(this.gl.getError()!==this.gl.NO_ERROR)throw Error('Color update failed');
    }
    readColorResource(id) {
      const target=this._colorResources.get(id);if(!target)throw Error('Unknown color resource');
      this._saveExplicitTarget();const gl=this.gl,pixels=new Uint8Array(target.width*target.height*4);
      try{gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.readPixels(0,0,target.width,target.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        if(gl.getError()!==gl.NO_ERROR)throw Error('Color readback failed');return pixels;
      }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,this._target?.framebuffer||null);}
    }
    copyColorToTexture(id,texture,{target=this.gl.TEXTURE_2D,face=0,level=0,x=0,y=0}={}) {
      const source=this._colorResources.get(id);if(!source)throw Error('Unknown sampled color resource');
      this._saveExplicitTarget();const gl=this.gl;
      // WebGL1 cannot attach a nonzero mip. Render the vertical inversion into
      // level0 scratch, then GPU-copy it into any destination mip/cube face.
      const scratch=this._colorStorage(source.width,source.height);
      try{
        if(!this._copyProgram){
          this._copyProgram=this.createProgram('attribute vec2 p; varying vec2 uv; uniform vec4 area; void main(){gl_Position=vec4(p,0.,1.);uv=(p*.5+.5)*area.xy+area.zw;}',
            'precision mediump float; varying vec2 uv; uniform sampler2D image; void main(){gl_FragColor=texture2D(image,uv);}', ['p'],['area','image']);
          this._copyBuffer=this.createBuffer();this.updateBuffer(this._copyBuffer,gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]));
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,scratch.framebuffer);
        for(const cap of[gl.DEPTH_TEST,gl.STENCIL_TEST,gl.BLEND,gl.CULL_FACE,gl.SCISSOR_TEST])this.setCapability(cap,false);
        this.setColorMask(true,true,true,true);this.setViewport(0,0,source.width,source.height);
        this.bindTexture(source.color,0);this.setUniform(this._copyProgram,'image','1i',0);this.setUniform(this._copyProgram,'area','4f',[1,-1,0,1]);
        this.draw({program:this._copyProgram,vertexBuffer:this._copyBuffer,stride:8,attributes:[{name:'p',size:2,offset:0}],mode:gl.TRIANGLE_STRIP,count:4});
        this.bindTexture(texture,0,target);
        gl.copyTexSubImage2D(target===gl.TEXTURE_CUBE_MAP?gl.TEXTURE_CUBE_MAP_POSITIVE_X+face:target,level,x,y,0,0,source.width,source.height);
        if(gl.getError()!==gl.NO_ERROR)throw Error('Resource texture copy failed');
      }finally{this._deleteRenderTarget(scratch);this._targetBytes-=scratch.bytes;gl.bindFramebuffer(gl.FRAMEBUFFER,this._target?.framebuffer||null);}
    }
    releaseColorResource(id) {
      const target=this._colorResources.get(id);if(!target)return;
      if(this._target?.explicit===target)this.bindImplicitTarget();
      for(const variant of target.variants.values()){this._deleteRenderTarget(variant);this._targetBytes-=variant.bytes;}
      this._deleteRenderTarget(target);this._targetBytes-=target.bytes;this._colorResources.delete(id);
    }

    _deleteRenderTarget(target) {
      const gl = this.gl;
      if (target.depth&&!target.depthStore) gl.deleteRenderbuffer(target.depth);
      if (target.framebuffer) gl.deleteFramebuffer(target.framebuffer);
      this.deleteTexture(target.color);
    }

    releaseRenderTarget(key) {
      this.bindImplicitTarget();
      for(const color of this._colorResources.values()){
        const variant=color.variants.get(key);if(variant){this._deleteRenderTarget(variant);this._targetBytes-=variant.bytes;color.variants.delete(key);}
      }
      const target = this._targets.get(key);
      if(target){
        if (this._target===target) this.bindRenderTarget(null,this.canvas.width,this.canvas.height,0);
        this._targets.delete(key); this._targetBytes -= target.bytes;
        this._deleteRenderTarget(target);
      }
      const store=this._depthStores.get(key);if(store){this.gl.deleteRenderbuffer(store.object);this._targetBytes-=store.bytes;this._depthStores.delete(key);}
    }

    resetRenderTargets(width,height,depth) {
      this.bindImplicitTarget();
      const oldMap=this._targets, oldTarget=this._target, oldBytes=this._targetBytes;
      const oldColors=this._colorResources,oldDepths=this._depthStores;
      // Stage with the old allocation charged against the budget. Canvas resize
      // happens only after successful allocation, so failure preserves pixels.
      if (!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1) throw new Error('Invalid target size');
      this._targets=new Map(); this._target=null;this._implicitTarget=null;this._colorResources=new Map();this._depthStores=new Map();
      try {
        this.bindRenderTarget(depth?.key??null,depth?.width??width,depth?.height??height,depth?.bits??0,width,height);
      } catch(error) {
        for(const store of this._depthStores.values())this.gl.deleteRenderbuffer(store.object);
        this._targets=oldMap; this._target=oldTarget; this._implicitTarget=oldTarget;this._targetBytes=oldBytes;this._colorResources=oldColors;this._depthStores=oldDepths;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,oldTarget?oldTarget.framebuffer:null);
        throw error;
      }
      this.canvas.width=width; this.canvas.height=height;
      this._stateValues.clear();
      for(const target of oldMap.values()) this._deleteRenderTarget(target);
      for(const color of oldColors.values()){for(const target of color.variants.values())this._deleteRenderTarget(target);this._deleteRenderTarget(color);}
      for(const store of oldDepths.values())this.gl.deleteRenderbuffer(store.object);
      this._targetBytes-=oldBytes;
    }

    _presentRenderTarget() {
      this.bindImplicitTarget();
      const gl=this.gl,target=this._target;
      if(!target)return;
      const savedColorMask=this._stateValues.get('colorMask') || [true,true,true,true];
      if(!this._copyProgram){
        this._copyProgram=this.createProgram('attribute vec2 p; varying vec2 uv; uniform vec4 area; void main(){gl_Position=vec4(p,0.,1.);uv=(p*.5+.5)*area.xy+area.zw;}',
          'precision mediump float; varying vec2 uv; uniform sampler2D image; void main(){gl_FragColor=texture2D(image,uv);}', ['p'],['area','image']);
        this._copyBuffer=this.createBuffer();
        this.updateBuffer(this._copyBuffer,gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]));
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      for(const cap of [gl.DEPTH_TEST,gl.STENCIL_TEST,gl.BLEND,gl.CULL_FACE,gl.SCISSOR_TEST])this.setCapability(cap,false);
      this.setColorMask(true,true,true,true);
      this.setViewport(0,0,this.canvas.width,this.canvas.height);
      this.bindTexture(target.color,0);
      this.setUniform(this._copyProgram,'image','1i',0);
      this.setUniform(this._copyProgram,'area','4f',[this.canvas.width/target.width,this.canvas.height/target.height,0,1-this.canvas.height/target.height]);
      this.draw({program:this._copyProgram,vertexBuffer:this._copyBuffer,stride:8,attributes:[{name:'p',size:2,offset:0}],mode:gl.TRIANGLE_STRIP,count:4});
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
      this.setColorMask(...savedColorMask);
    }

    _bindBuffer(target, buffer) {
      if (this._boundBuffers.get(target) === buffer) return;
      this.gl.bindBuffer(target, buffer);
      this._boundBuffers.set(target, buffer);
    }

    _setState(name, values, apply) {
      const previous = this._stateValues.get(name);
      if (previous && previous.length === values.length
          && values.every((value, index) => Object.is(value, previous[index]))) return;
      apply();
      this._stateValues.set(name, values.slice());
    }

    createBuffer() {
      const value = this.gl.createBuffer();
      if (!value) throw new Error('WebGL buffer allocation failed');
      this._buffers.add(value);
      return value;
    }

    updateBuffer(buffer, target, data, usage) {
      const gl = this.gl;
      const actualTarget = target || gl.ARRAY_BUFFER;
      this._bindBuffer(actualTarget, buffer);
      gl.bufferData(actualTarget, data, usage || gl.STREAM_DRAW);
    }

    deleteBuffer(buffer) {
      if (!buffer) return;
      this.gl.deleteBuffer(buffer);
      this._buffers.delete(buffer);
      for (const [target, bound] of this._boundBuffers) {
        if (bound === buffer) this._boundBuffers.delete(target);
      }
      for (const [location, state] of this._attributeState) {
        if (state.buffer === buffer) this._attributeState.delete(location);
      }
    }

    createTexture() {
      const value = this.gl.createTexture();
      if (!value) throw new Error('WebGL texture allocation failed');
      this._textures.add(value);
      return value;
    }

    bindTexture(texture, unit, target = this.gl.TEXTURE_2D) {
      const gl = this.gl;
      const index = unit || 0;
      if (this._activeTextureUnit !== index) {
        gl.activeTexture(gl.TEXTURE0 + index);
        this._activeTextureUnit = index;
      }
      const value = texture || null;
      const key = target === gl.TEXTURE_2D ? index : index + ':' + target;
      if (this._boundTextures.get(key) === value) return;
      gl.bindTexture(target, value);
      this._boundTextures.set(key, value);
    }

    uploadTexture2D(texture, image) {
      const gl = this.gl;
      this.bindTexture(texture, image.unit || 0);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, image.alignment || 1);
      gl.texImage2D(gl.TEXTURE_2D, image.level || 0, image.internalFormat,
        image.width, image.height, image.border || 0, image.format, image.type,
        image.pixels || null);
    }

    uploadCubeFace(texture, face, image) {
      const gl = this.gl;
      if (!Number.isInteger(face) || face < 0 || face >= 6) throw new Error('Invalid cube face');
      this.bindTexture(texture, image.unit || 0, gl.TEXTURE_CUBE_MAP);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, image.alignment || 1);
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, image.level || 0, image.internalFormat,
        image.width, image.height, 0, image.format, image.type, image.pixels || null);
    }

    updateTexture2D(texture, image) {
      const gl = this.gl;
      this.bindTexture(texture, image.unit || 0);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, image.alignment || 1);
      gl.texSubImage2D(gl.TEXTURE_2D, image.level || 0, image.x || 0,
        image.y || 0, image.width, image.height, image.format, image.type,
        image.pixels);
    }

    generateMipmaps(texture) {
      this.bindTexture(texture, 0);
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }

    setTextureParameter(texture, pname, value, target = this.gl.TEXTURE_2D) {
      const gl = this.gl;
      // D3D9 re-states every sampler parameter on every draw of a reused
      // texture; skip the ones the texture already holds. Only this method
      // sets parameters on backend textures, so the cache cannot go stale.
      // A null texture is GL's default object: never cached.
      let held = texture ? this._textureParams.get(texture) : null;
      if (texture && !held) this._textureParams.set(texture, held = new Map());
      const key = target === gl.TEXTURE_2D ? pname : target + ':' + pname;
      if (held && held.get(key) === value) return;
      this.bindTexture(texture, 0, target);
      gl.texParameteri(target, pname, value);
      if (held) held.set(key, value);
    }

    deleteTexture(texture) {
      if (!texture) return;
      this.gl.deleteTexture(texture);
      this._textures.delete(texture);
      for (const [unit, bound] of this._boundTextures) {
        if (bound === texture) this._boundTextures.delete(unit);
      }
    }

    createProgram(vertexSource, fragmentSource, attributeNames, uniformNames, options = {}) {
      const gl = this.gl;
      const feedback = options.transformFeedbackVaryings;
      if (feedback !== undefined && (this.version !== 2 || !Array.isArray(feedback)
          || !feedback.length || feedback.some(name => typeof name !== 'string' || !name.length)
          || new Set(feedback).size !== feedback.length))
        throw new Error('Transform feedback requires WebGL2 and unique varying names');
      if(this.version===2){vertexSource=shader300(vertexSource,false);fragmentSource=shader300(fragmentSource,true);}
      if (this._drawables && /gl_FragColor|wa_FragColor/.test(fragmentSource)) {
        if (this.version === 2) {
          fragmentSource=fragmentSource.replace('out highp vec4 wa_FragColor;',
            'layout(location=0) out highp vec4 wa_FragColor;\nlayout(location=1) out highp vec4 wa_FragColor1;')
            .replace(/void\s+main\s*\(\s*\)/,'void waDrawableMain()')
            + '\nvoid main(){waDrawableMain();wa_FragColor1=wa_FragColor;}';
        } else {
          fragmentSource='#extension GL_EXT_draw_buffers : require\n'+fragmentSource
            .replace(/gl_FragColor/g,'waDrawableColor').replace(/void\s+main\s*\(\s*\)/,'highp vec4 waDrawableColor;\nvoid waDrawableMain()')
            + '\nvoid main(){waDrawableMain();gl_FragData[0]=waDrawableColor;gl_FragData[1]=waDrawableColor;}';
        }
      }
      let vs = null, fs = null, program = null;
      try {
        vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
        fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        program = gl.createProgram();
        if (!program) throw new Error('WebGL program allocation failed');
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        if (feedback) gl.transformFeedbackVaryings(program, feedback, gl.INTERLEAVED_ATTRIBS);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          throw new Error(gl.getProgramInfoLog(program) || 'program link failed');
        const result = { handle: program, attributes: {}, uniforms: {} };
        for (const name of attributeNames || [])
          result.attributes[name] = gl.getAttribLocation(program, name);
        for (const name of uniformNames || [])
          result.uniforms[name] = gl.getUniformLocation(program, name);
        this._programs.add(program);
        return result;
      } catch (error) {
        if (program) gl.deleteProgram(program);
        throw error;
      } finally {
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
      }
    }

    useProgram(program) {
      const handle = program && program.handle || null;
      if (this._currentProgram === handle) return;
      this.gl.useProgram(handle);
      this._currentProgram = handle;
    }

    setUniform(program, name, kind, value) {
      const gl = this.gl;
      const location = program.uniforms[name];
      if (location == null) return;
      let cache = this._uniformValues.get(program);
      if (!cache) {
        cache = new Map();
        this._uniformValues.set(program, cache);
      }
      const values = kind === 'matrix4' || kind === '4f' || kind === '4i' ? Array.from(value)
        : [kind === '1i' ? value | 0 : +value];
      const previous = cache.get(name);
      if (previous && previous.kind === kind && previous.values.length === values.length
          && values.every((entry, index) => Object.is(entry, previous.values[index]))) return;
      this.useProgram(program);
      if (kind === 'matrix4') gl.uniformMatrix4fv(location, false, value);
      else if (kind === '1i') gl.uniform1i(location, value | 0);
      else if (kind === '1f') gl.uniform1f(location, +value);
      else if (kind === '4f') gl.uniform4fv(location, value);
      else if (kind === '4i') gl.uniform4iv(location, value);
      cache.set(name, { kind, values });
    }

    setCapability(capability, enabled) {
      this._setState(`cap:${capability}`, [!!enabled], () => {
        if (enabled) this.gl.enable(capability); else this.gl.disable(capability);
      });
    }

    setViewport(x, y, width, height) { this._setState('viewport', [x, y, width, height], () => this.gl.viewport(x, y, width, height)); }
    setScissor(x, y, width, height) { this._setState('scissor', [x, y, width, height], () => this.gl.scissor(x, y, width, height)); }
    setDepthFunc(value) { this._setState('depthFunc', [value], () => this.gl.depthFunc(value)); }
    setDepthMask(value) { this._setState('depthMask', [!!value], () => this.gl.depthMask(!!value)); }
    setColorMask(r,g,b,a) {
      // D3D9 also writes this shared context state directly; never skip a
      // required mask update based on a potentially stale cache entry.
      const values=[!!r,!!g,!!b,!!a];
      this.gl.colorMask(...values); this._stateValues.set('colorMask',values);
    }
    setStencilMask(value) { this._setState('stencilMask',[value>>>0],()=>this.gl.stencilMask(value>>>0)); }
    setStencilFunc(face,func,ref,mask) { this._setState('stencilFunc:'+face,[func,ref,mask>>>0],()=>this.gl.stencilFuncSeparate(face,func,ref,mask>>>0)); }
    setStencilOp(face,fail,zfail,pass) { this._setState('stencilOp:'+face,[fail,zfail,pass],()=>this.gl.stencilOpSeparate(face,fail,zfail,pass)); }
    setDepthRange(nearValue, farValue) { this._setState('depthRange', [nearValue, farValue], () => this.gl.depthRange(nearValue, farValue)); }
    setPolygonOffset(factor, units) { this._setState('polygonOffset', [factor, units], () => this.gl.polygonOffset(factor, units)); }
    setBlendFunc(src, dst) { this._setState('blendFunc', [src, dst], () => this.gl.blendFunc(src, dst)); }
    setCullFace(value) { this._setState('cullFace', [value], () => this.gl.cullFace(value)); }
    setFrontFace(value) { this._setState('frontFace', [value], () => this.gl.frontFace(value)); }
    setLineWidth(value) { this._setState('lineWidth', [value], () => this.gl.lineWidth(value)); }

    clear(color, mask, depth, stencil) {
      const gl = this.gl;
      if (color) this._setState('clearColor', color, () => gl.clearColor(color[0], color[1], color[2], color[3]));
      // glClearDepth's value; GL's default is 1.
      const d = depth === undefined ? 1 : depth;
      this._setState('clearDepth', [d], () => gl.clearDepth(d));
      if (stencil !== undefined) this._setState('clearStencil', [stencil], () => gl.clearStencil(stencil));
      gl.clear(mask);
    }

    // Paint a block of top-down RGBA over the whole colour buffer, leaving
    // depth and stencil alone. A single-buffered GL context whose drawable is
    // a DIB (PFD_DRAW_TO_BITMAP) renders *into* the bitmap the application is
    // also drawing on with GDI, so the pixels already there are the starting
    // contents of the colour buffer — without this the emulated drawable
    // starts every frame black and the application's own background is lost
    // wherever GL happens to rasterize nothing.
    seedColorBuffer(pixels, width, height) {
      const gl = this.gl;
      this.bindImplicitTarget();
      if (!this._seedProgram) {
        // The DIB's first row is the top of the picture and the quad's +y is
        // the top of the screen, so the texture coordinate runs the other way
        // from _presentRenderTarget's.
        this._seedProgram = this.createProgram(
          'attribute vec2 p; varying vec2 uv; void main(){gl_Position=vec4(p,0.,1.);uv=vec2(p.x*.5+.5,.5-p.y*.5);}',
          'precision mediump float; varying vec2 uv; uniform sampler2D image; void main(){gl_FragColor=texture2D(image,uv);}',
          ['p'], ['image']);
        this._seedBuffer = this.createBuffer();
        this.updateBuffer(this._seedBuffer, gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
        this._seedTexture = this.createTexture();
        this.bindTexture(this._seedTexture, 0);
        for (const [pname, value] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST],
          [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
          [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) {
          gl.texParameteri(gl.TEXTURE_2D, pname, value);
        }
      }
      this.bindTexture(this._seedTexture, 0);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA,
        gl.UNSIGNED_BYTE, pixels instanceof Uint8Array ? pixels : new Uint8Array(
          pixels.buffer, pixels.byteOffset, pixels.length));
      // This runs in the middle of the guest's own rendering, so every piece of
      // state it touches goes back exactly as it was found. The cache is the
      // record of what the guest asked for; anything it has not set yet is
      // left unset rather than pinned to a default of ours.
      const caps = [gl.DEPTH_TEST, gl.STENCIL_TEST, gl.BLEND, gl.CULL_FACE,
        gl.SCISSOR_TEST];
      const savedCaps = caps.map(cap => this._stateValues.get(`cap:${cap}`));
      const savedDepthMask = this._stateValues.get('depthMask');
      const savedColorMask = this._stateValues.get('colorMask');
      const savedViewport = this._stateValues.get('viewport');
      for (const cap of caps) this.setCapability(cap, false);
      this.setDepthMask(false);
      this.setColorMask(true,true,true,true);
      this.setViewport(0, 0, this.canvas.width, this.canvas.height);
      this.setUniform(this._seedProgram, 'image', '1i', 0);
      this.draw({ program: this._seedProgram, vertexBuffer: this._seedBuffer,
        stride: 8, attributes: [{ name: 'p', size: 2, offset: 0 }],
        mode: gl.TRIANGLE_STRIP, count: 4 });
      caps.forEach((cap, index) => {
        this.setCapability(cap, savedCaps[index] ? savedCaps[index][0] : false);
      });
      this.setDepthMask(savedDepthMask ? savedDepthMask[0] : true);
      this.setColorMask(...(savedColorMask || [true,true,true,true]));
      if (savedViewport) this.setViewport(...savedViewport);
    }

    // Native bitmap records contain integer WINDOW pixels and window depth.
    // They bypass object transforms and point-size state. Fragment state stays
    // installed, including blend/depth/stencil/scissor and colour masks.
    drawBitmapPoints(vertices, alphaEnabled, alphaFunc, alphaRef) {
      const gl = this.gl;
      if (!this._bitmapProgram) {
        this._bitmapProgram = this.createProgram(`
          attribute vec3 p;
          attribute vec4 color;
          uniform vec4 size;
          varying vec4 rgba;
          void main() {
            gl_Position = vec4((p.xy + vec2(0.5)) / size.xy * 2.0 - 1.0, p.z * 2.0 - 1.0, 1.0);
            gl_PointSize = 1.0;
            rgba = color;
          }`, `
          precision mediump float;
          varying vec4 rgba;
          uniform int alphaEnabled;
          uniform int alphaFunc;
          uniform float alphaRef;
          bool passAlpha(float a) {
            if (alphaFunc == 0) return false;
            if (alphaFunc == 1) return a < alphaRef;
            if (alphaFunc == 2) return abs(a - alphaRef) < 0.00392157;
            if (alphaFunc == 3) return a <= alphaRef;
            if (alphaFunc == 4) return a > alphaRef;
            if (alphaFunc == 5) return abs(a - alphaRef) >= 0.00392157;
            if (alphaFunc == 6) return a >= alphaRef;
            return true;
          }
          void main() {
            if (alphaEnabled != 0 && !passAlpha(rgba.a)) discard;
            gl_FragColor = rgba;
          }`, ['p', 'color'], ['size', 'alphaEnabled', 'alphaFunc', 'alphaRef']);
        this._bitmapBuffer = this.createBuffer();
      }
      const viewport = this._stateValues.get('viewport') || [0, 0, this.canvas.width, this.canvas.height];
      const depthRange = this._stateValues.get('depthRange') || [0, 1];
      try {
        this.setViewport(0, 0, this.canvas.width, this.canvas.height);
        this.setDepthRange(0, 1);
        this.updateBuffer(this._bitmapBuffer, gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
        this.setUniform(this._bitmapProgram, 'size', '4f', [this.canvas.width, this.canvas.height, 0, 0]);
        this.setUniform(this._bitmapProgram, 'alphaEnabled', '1i', alphaEnabled ? 1 : 0);
        this.setUniform(this._bitmapProgram, 'alphaFunc', '1i', alphaFunc - 0x0200);
        this.setUniform(this._bitmapProgram, 'alphaRef', '1f', alphaRef);
        this.draw({ program: this._bitmapProgram, vertexBuffer: this._bitmapBuffer,
          stride: 76, attributes: [{ name: 'p', size: 3, offset: 0 }, { name: 'color', size: 4, offset: 12 }],
          mode: gl.POINTS, count: vertices.length / 19 });
      } finally {
        this.setViewport(...viewport);
        this.setDepthRange(...depthRange);
      }
    }

    draw(command) {
      const gl = this.gl;
      const program = command.program;
      this.useProgram(program);
      this._bindBuffer(gl.ARRAY_BUFFER, command.vertexBuffer);
      const stride = command.stride;
      const used = new Set();
      for (const attribute of command.attributes) {
        const location = program.attributes[attribute.name];
        if (location < 0) continue;
        used.add(location);
        if (!this._enabledAttributes.has(location)) {
          gl.enableVertexAttribArray(location);
          this._enabledAttributes.add(location);
        }
        const type = attribute.type || gl.FLOAT;
        const normalized = !!attribute.normalized;
        const divisor = attribute.divisor || 0;
        const state = this._attributeState.get(location);
        if ((!state || state.divisor!==divisor) && this.version===2) gl.vertexAttribDivisor(location,divisor);
        if (!state || state.buffer !== command.vertexBuffer || state.size !== attribute.size
            || state.type !== type || state.normalized !== normalized
            || state.stride !== stride || state.offset !== attribute.offset) {
          gl.vertexAttribPointer(location, attribute.size, type,
            normalized, stride, attribute.offset);
          this._attributeState.set(location, {
            buffer: command.vertexBuffer, size: attribute.size, type,
            normalized, stride, offset: attribute.offset, divisor,
          });
        }
        else if(state)state.divisor=divisor;
      }
      for (const location of this._enabledAttributes) {
        if (!used.has(location)) {
          gl.disableVertexAttribArray(location);
          this._enabledAttributes.delete(location);
        }
      }
      if (command.indexBuffer) {
        this._bindBuffer(gl.ELEMENT_ARRAY_BUFFER, command.indexBuffer);
        gl.drawElements(command.mode, command.count, command.indexType || gl.UNSIGNED_SHORT, 0);
      } else {
        if(command.instances!==undefined)gl.drawArraysInstanced(command.mode,0,command.count,command.instances);
        else gl.drawArrays(command.mode, 0, command.count);
      }
    }

    transformVertices(command,output,byteLength) {
      const gl=this.gl;
      if(this.version!==2)throw new Error('Transform feedback requires WebGL2');
      if(!Number.isSafeInteger(byteLength)||byteLength<0||byteLength>64*1024*1024)throw new Error('Transform feedback budget exceeded');
      this.updateBuffer(output,gl.ARRAY_BUFFER,byteLength);
      const feedback=gl.createTransformFeedback();
      if(!feedback)throw new Error('Transform feedback allocation failed');
      const vao=gl.createVertexArray();
      if(!vao){gl.deleteTransformFeedback(feedback);throw new Error('Transform vertex array allocation failed');}
      const attributes=this._attributeState,enabled=this._enabledAttributes,previousVAO=gl.getParameter(gl.VERTEX_ARRAY_BINDING);
      gl.bindVertexArray(vao);this._attributeState=new Map();this._enabledAttributes=new Set();
      let begun=false;
      try{
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
        this.setCapability(gl.RASTERIZER_DISCARD,true);
        this.useProgram(command.program);
        gl.beginTransformFeedback(gl.POINTS);begun=true;
        this.draw({...command,mode:gl.POINTS});
        gl.endTransformFeedback();begun=false;
        if(gl.getError()!==gl.NO_ERROR)throw new Error('Transform feedback execution failed');
      }finally{
        if(begun)gl.endTransformFeedback();
        this.setCapability(gl.RASTERIZER_DISCARD,false);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);
        gl.deleteTransformFeedback(feedback);
        gl.bindVertexArray(previousVAO);gl.deleteVertexArray(vao);
        this._attributeState=attributes;this._enabledAttributes=enabled;
      }
    }

    readPixels(x, y, width, height, format, type, output) {
      if (this._drawable) {
        const d=this._drawable, gl=this.gl;
        const front=d.single || this._drawableReadBuffer===0x400 || this._drawableReadBuffer===0x404 || this._drawableReadBuffer===0x406;
        try { gl.bindFramebuffer(gl.FRAMEBUFFER,d.frames[front?0:1]);
          gl.readPixels(x,y,width,height,format,type,output); return output;
        } finally { gl.bindFramebuffer(gl.FRAMEBUFFER,this._target.framebuffer); }
      }
      this.gl.readPixels(x, y + this.renderHeight - this.canvas.height, width, height, format, type, output);
      return output;
    }

    finish() { this.gl.finish(); }
    flush() { this.gl.flush(); }
    getParameter(name) { return this.gl.getParameter(name); }
    getError() { return this.gl.getError(); }

    getPresentationSurface() { return this.presentationCanvas || this.canvas; }

    present() {
      const drawable=this._drawable, selected=this._drawableDrawBuffer;
      const saved=drawable?new Map(this._stateValues):null;
      if(drawable)this._target={width:drawable.width,height:drawable.height,framebuffer:drawable.frames[0],color:drawable.colors[0]};
      this._presentRenderTarget();
      if(drawable){
        this.setDrawBuffer(selected);
        for(const [key,args] of saved){
          const methods={viewport:'setViewport',scissor:'setScissor',depthFunc:'setDepthFunc',depthMask:'setDepthMask',
            colorMask:'setColorMask',stencilMask:'setStencilMask',depthRange:'setDepthRange',polygonOffset:'setPolygonOffset',
            blendFunc:'setBlendFunc',cullFace:'setCullFace',frontFace:'setFrontFace',lineWidth:'setLineWidth'};
          if(key.startsWith('cap:'))this.setCapability(+key.slice(4),args[0]);
          else if(methods[key])this[methods[key]](...args);
        }
      }
      this.flush();
      const target = this.presentationCanvas;
      const context = this.presentationContext;
      if (target && context) {
        const width = Math.max(1, this.canvas.width | 0);
        const height = Math.max(1, this.canvas.height | 0);
        if (target.width !== width) target.width = width;
        if (target.height !== height) target.height = height;
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, width, height);
        context.drawImage(this.canvas, 0, 0, width, height);
      }
      // Headless: there is no 2D presentation canvas to copy into, because the
      // frame is still sitting in the driver's drawing buffer. Mark it so the
      // next read of the canvas's pixels pulls it back with readPixels. This is
      // the one point in the frame where doing so is correct -- see the _data
      // getter in lib/raster-canvas.js.
      else if (this.canvas && typeof this.canvas.markGlPresented === 'function') {
        this.canvas.markGlPresented();
      }
      return this.getPresentationSurface();
    }

    destroy() {
      if(this._drawables)for(const id of [...this._drawables.keys()])this.releaseDrawable(id);
      for(const color of this._colorResources.values()){for(const target of color.variants.values())this._deleteRenderTarget(target);this._deleteRenderTarget(color);}
      this._colorResources.clear();
      for(const target of this._targets.values()) this._deleteRenderTarget(target);
      for(const store of this._depthStores.values())this.gl.deleteRenderbuffer(store.object);
      this._depthStores.clear();this._implicitTarget=null;
      this._targets.clear(); this._target=null; this._targetBytes=0;
      for (const value of this._buffers) this.gl.deleteBuffer(value);
      for (const value of this._textures) this.gl.deleteTexture(value);
      for (const value of this._programs) this.gl.deleteProgram(value);
      this._buffers.clear();
      this._textures.clear();
      this._programs.clear();
      this._boundBuffers.clear();
      this._boundTextures.clear();
      this._attributeState.clear();
      this._enabledAttributes.clear();
      this._stateValues.clear();
      this._currentProgram = null;
    }
  }

  return { WebGLBackend };
});
