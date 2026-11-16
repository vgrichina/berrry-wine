#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
  const browser=await puppeteer.launch({headless:true,
    executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args:['--no-first-run','--no-default-browser-check']});
  try{
    const page=await browser.newPage();
    for(const file of['gpu-backend.js','d3d9-shader.js','render-clear.js','d3d9-backend.js'])
      await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
    const result=await page.evaluate(()=>{
      const outputs=[];
      for(const version of[1,2]){
        const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
        const d=new D3D9Backend.Device(canvas,{webglVersion:version}),g=d.gpu,gl=g.gl;
        if(version===1){gl.getExtension('OES_standard_derivatives');gl.getExtension('EXT_frag_depth');}
        const sources=[],original=gl.shaderSource.bind(gl);
        gl.shaderSource=(shader,source)=>{sources.push(source);original(shader,source);};
        g.bindRenderTarget('test',4,4,16);g.setViewport(0,0,4,4);
        g.setCapability(gl.DEPTH_TEST,true);g.setDepthMask(true);gl.depthFunc(gl.LESS);
        const vertex='attribute vec2 p; varying vec2 uv; void main(){uv=p;gl_Position=vec4(p,0.,1.);}';
        const fragment='#extension GL_OES_standard_derivatives : require\n#extension GL_EXT_frag_depth : require\n'+
          'precision highp float; varying vec2 uv; void main(){gl_FragDepthEXT=.25;gl_FragColor=vec4(1.,abs(dFdx(uv.x))>0.?0.:1.,0.,1.);}';
        const program=g.createProgram(vertex,fragment,['p'],[]),buffer=g.createBuffer();
        g.updateBuffer(buffer,gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]));
        const draw={program,vertexBuffer:buffer,stride:8,attributes:[{name:'p',size:2,offset:0}],mode:gl.TRIANGLES,count:3};
        g.draw(draw);
        const later=g.createProgram(vertex,'#extension GL_EXT_frag_depth : require\nprecision highp float; void main(){gl_FragDepthEXT=.5;gl_FragColor=vec4(0.,0.,1.,1.);}', ['p'],[]);
        g.draw({...draw,program:later});
        let feedbackValues=null,feedbackRejected=false;
        try {
          const capture=g.createProgram(vertex,fragment,['p'],[],{transformFeedbackVaryings:['uv']});
          const target=gl.createBuffer(),feedback=gl.createTransformFeedback();
          gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);
          gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,target);
          gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,24,gl.STREAM_READ);
          gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,target);
          g.useProgram(capture);gl.enable(gl.RASTERIZER_DISCARD);
          gl.beginTransformFeedback(gl.POINTS);
          g.draw({...draw,program:capture,mode:gl.POINTS});
          gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
          const values=new Float32Array(6);
          gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);
          feedbackValues=Array.from(values);
          gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);
          gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);
          gl.deleteTransformFeedback(feedback);gl.deleteBuffer(target);
        } catch(error) {
          if(version===2)throw error;
          feedbackRejected=/Transform feedback requires WebGL2/.test(error.message);
        }
        outputs.push({version:g.version,pixel:Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))),
          feedbackValues,feedbackRejected,
          error:gl.getError(),dialect:sources.every(s=>version===2?s.startsWith('#version 300 es'):!s.startsWith('#version 300 es'))});
        d.destroy();
      }
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const fallback={width:4,height:4,getContext:(name,opts)=>name==='webgl2'?null:canvas.getContext(name,opts)};
      const auto=new D3D9Backend.Device(fallback);const fallbackVersion=auto.gpu.version;auto.destroy();
      let forcedRejected=false;
      try{new D3D9Backend.Device({getContext:()=>null},{webglVersion:2});}catch(e){forcedRejected=true;}
      const legacy=new GpuBackend.WebGLBackend(document.createElement('canvas'));
      const legacyVersion=legacy.version;legacy.destroy();
      const npot=[];
      for(const version of[1,2]){
        const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
        const d=new D3D9Backend.Device(canvas,{webglVersion:version}),g=d.gpu,gl=g.gl;
        const program=g.createProgram('attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}',
          'precision highp float; uniform sampler2D image; uniform vec4 uv; void main(){gl_FragColor=texture2D(image,uv.xy);}', ['p'],['image','uv']);
        const buffer=g.createBuffer();g.updateBuffer(buffer,gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]));
        const base={width:3,height:1,pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255])};
        const samples=[],errors=[];
        for(const address of[1,2,3]){
          try {
            d.uploadTexture(0,{...base,sampler:{addressU:address,addressV:3,min:1,mag:1}});
            g.bindTexture(d.textures.get(0),0);g.setUniform(program,'image','1i',0);
            g.setUniform(program,'uv','4f',[1.2,.5,0,0]);
            g.draw({program,vertexBuffer:buffer,stride:8,attributes:[{name:'p',size:2,offset:0}],mode:gl.TRIANGLES,count:3});
            samples.push(Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))));errors.push('');
          }catch(error){samples.push(null);errors.push(error.message);}
        }
        const mip={...base,levels:[base,{width:1,height:1,pixels:new Uint8Array([255,255,0,255])}],
          sampler:{addressU:3,addressV:3,min:1,mag:1,mip:1}};
        let mipPixel=null,mipError='';
        try {
          d.uploadTexture(0,mip);
          // Explicit GLSL300 LOD isolates native NPOT mip storage/filtering.
          const lod=g.createProgram('#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}',
            '#version 300 es\nprecision highp float;uniform sampler2D image;out vec4 color;void main(){color=textureLod(image,vec2(.5),1.);}', ['p'],['image']);
          g.bindTexture(d.textures.get(0),0);g.setUniform(lod,'image','1i',0);
          g.draw({program:lod,vertexBuffer:buffer,stride:8,attributes:[{name:'p',size:2,offset:0}],mode:gl.TRIANGLES,count:3});
          mipPixel=Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
        }catch(error){mipError=error.message;}
        const signedProgram=g.createProgram('attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}',
          'precision highp float;uniform sampler2D image;uniform float bias;void main(){gl_FragColor=.5+.5*texture2D(image,vec2(.5),bias);}', ['p'],['image','bias']);
        const signedSamples=[];
        for(const format of [63,62,63]) {
          d.uploadTexture(0,{width:2,height:1,key:'signed-shared',format,
            pixels:new Uint8Array([128,127,128,128,127,128,128,128]),sampler:{addressU:3,addressV:3,min:2,mag:2}});
          g.bindTexture(d.textures.get(0),0);g.setUniform(signedProgram,'image','1i',0);
          g.draw({program:signedProgram,vertexBuffer:buffer,stride:8,attributes:[{name:'p',size:2,offset:0}],mode:gl.TRIANGLES,count:3});
          signedSamples.push(Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))));
        }
        const signedLevels=[4,2].map(width=>({width,height:width,
          pixels:Uint8Array.from({length:width*width*4},(_,i)=>i%4===0?(i%8===0?128:127):i%4===1?(i%8===1?127:128):128)}));
        d.uploadTexture(0,{...signedLevels[0],format:63,levels:signedLevels,
          sampler:{addressU:3,addressV:3,min:2,mag:2,mip:1}});
        g.bindTexture(d.textures.get(0),0);g.setUniform(signedProgram,'bias','1f',8);
        g.draw({program:signedProgram,vertexBuffer:buffer,stride:8,attributes:[{name:'p',size:2,offset:0}],mode:gl.TRIANGLES,count:3});
        signedSamples.push(Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))));
        npot.push({version,samples,errors,mipPixel,mipError,signedSamples,error:gl.getError()});d.destroy();
      }
      return {outputs,fallbackVersion,forcedRejected,legacyVersion,npot};
    });
    for(const [i,entry]of result.outputs.entries()){
      assert.strictEqual(entry.version,i+1);assert(entry.dialect);assert.strictEqual(entry.error,0);
      assert.deepStrictEqual(entry.pixel,[255,0,0,255],'core/extension fragment depth preserves the nearer red draw');
      if(entry.version===1)assert(entry.feedbackRejected);
      else assert.deepStrictEqual(entry.feedbackValues,[-1,-1,3,-1,-1,3],'transform feedback captures real vertex shader outputs');
    }
    assert.strictEqual(result.fallbackVersion,1);assert(result.forcedRejected);assert.strictEqual(result.legacyVersion,1);
    for(const entry of result.npot){
      assert.strictEqual(entry.error,0);
      assert.deepStrictEqual(entry.signedSamples,[[128,128,0,0],[128,128,192,255],[128,128,0,0],[128,128,0,0]],
        'signed filtering and format-specific GPU cache identity');
      if(entry.version===1){
        assert(entry.errors.slice(0,2).every(message=>/NPOT.*clamp/.test(message)));
        assert.match(entry.mipError,/NPOT.*mip/);
      }else{
        assert.deepStrictEqual(entry.errors,['','','']);assert.strictEqual(entry.mipError,'');
        assert.deepStrictEqual(entry.samples[0],[255,0,0,255]);
        assert.deepStrictEqual(entry.samples[1],[0,0,255,255]);
        assert.deepStrictEqual(entry.mipPixel,[255,255,0,255]);
      }
      assert.deepStrictEqual(entry.samples[2],[0,0,255,255]);
    }
    console.log('PASS explicit WebGL1/2 shader dialect, derivatives/depth pixels, auto fallback and legacy default');
    console.log('PASS WebGL2 NPOT repeat/mirror/clamp and real lower mip; WebGL1 explicit restrictions');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
