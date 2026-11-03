'use strict';
// Real resolved-ABI source preservation, framebuffer boundaries and owned transport.
// Use --worker for the actual queued consumer; --group=NAME selects a focused set.
// Uses the existing harness directly, without making a fixture/source copy.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
const groups=['unsigned','arrays','signed','float','nested','lighting','provoking','transport','interleaved','clipping','replacement'];
for(const arg of process.argv.filter(x=>x.startsWith('--group=')))assert(groups.includes(arg.slice(8)),'unknown control group '+arg);
if(process.argv.includes('--group=transport')&&!process.argv.includes('--worker')&&!process.argv.includes('--check-expanded'))throw Error('transport group requires --worker');
const root=process.cwd(),target=path.join(root,'test/test-gl-bitmap-boundary-native.js');
let text=fs.readFileSync(target,'utf8');
const pixelAssertion="if(actual===literal)changes++;else assert.strictEqual(actual,words[x],'untouched literal word');";
assert.strictEqual(text.split(pixelAssertion).length,2,'unique framebuffer assertion');
text=text.replace(pixelAssertion,"if(actual!==words[x]){assert.strictEqual(actual,literal,'covered literal word');changes++;}");
const anchor="  assert.strictEqual(call('glGetError'),0);observations.push({bpp,topDown,alphaBits:query(0xd55),passed:true});";
assert.strictEqual(text.split(anchor).length,2,'unique current harness insertion');
const controls=String.raw`
  const selected=name=>!process.argv.some(x=>x.startsWith('--group='))||process.argv.includes('--group='+name);
  // Literal expectations are independent of production conversion functions.
  // Test uint first to preserve the predecessor's intended old-failure identity.
  const pairs=bpp===16?[
    ['ui',32,0x07ffffff,134217728 /* unsigned color value */,0x8000,0x8421],
    ['us',16,0x07ff,0x0800,0x8000,0x8421],
    ['ub',8,7,8,0x8000,0x8421]
  ]:[
    ['ui',32,0x7fffffff,0x80000000,0xff7f7f7f,0xff808080],
    ['us',16,0x7fff,0x8000,0xff7f7f7f,0xff808080],
    ['ub',8,127,128,0xff7f7f7f,0xff808080]
  ];
  const src=e.guest_alloc(64)>>>0,srcWa=wa(src);
  function queryColor(){
    new Uint8Array(memory.buffer,outWa,32).fill(0xcc);
    call('glGetFloatv',[0xb00,output]);
    assert(new Uint8Array(memory.buffer,outWa+16,16).every(x=>x===0xcc),'query canary');
    return Array.from({length:4},(_,i)=>dv.getFloat32(outWa+4*i,true));
  }
  async function drawCurrent(literal,label){
    reset();call('glColorMask',[1,1,1,1]);call('glBegin',[0]);
    call('glVertex3f',[f(-2/3),f(-.5),0]);call('glEnd');call('glFinish');if(encoder)encoder.fence();
    try{oneChangedPixel(literal);}catch(error){error.message=label+': '+error.message;throw error;}
    assert.strictEqual(call('glGetError'),0,label+' no error');
    if(encoder)await new Promise(resolve=>setImmediate(resolve));
  }
  if(selected('unsigned')) for(const [suffix,width,lo,hi,expectedLo,expectedHi] of pairs){
    const max=width===32?0xffffffff:width===16?65535:255;
    for(const vector of [false,true])for(const components of [3,4]){
      function set(value){
        if(!vector)return call('glColor'+components+suffix,Array.from({length:components},(_,i)=>i===3?max:value));
        new Uint8Array(memory.buffer,srcWa,64).fill(0xa7);
        for(let i=0;i<components;i++){
          const v=i===3?max:value,p=srcWa+i*width/8;
          width===32?dv.setUint32(p,v,true):width===16?dv.setUint16(p,v,true):dv.setUint8(p,v);
        }
        const before=Buffer.from(new Uint8Array(memory.buffer,srcWa,64));
        call('glColor'+components+suffix+'v',[src]);
        assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,srcWa,64)),before,'color input canaries');
      }
      const label='literal '+suffix+' '+components+(vector?'v':'');
      set(lo);const qLo=queryColor();await drawCurrent(expectedLo,label+' low');
      set(hi);const qHi=queryColor();await drawCurrent(expectedHi,label+' high');
      if(width===32)assert.deepStrictEqual(qLo,qHi,'uint f32 collision is allowed');
      const list=call('glGenLists',[1]);assert(list);
      set(hi);call('glNewList',[list,0x1300]);set(lo);call('glEndList');
      assert.deepStrictEqual(queryColor(),qHi,'compile-only does not change live color');
      new Uint8Array(memory.buffer,srcWa,64).fill(0);set(hi);call('glCallList',[list]);
      await drawCurrent(expectedLo,label+' list owns exact value');
      call('glNewList',[list,0x1301]);set(hi);call('glEndList');
      await drawCurrent(expectedHi,label+' compile-and-execute');set(lo);call('glCallList',[list]);
      await drawCurrent(expectedHi,label+' replay compile-and-execute');call('glDeleteLists',[list,1]);
      for(const mask of [1,0xfffff,0x2000]){
        set(lo);call('glPushAttrib',[mask]);set(hi);call('glPopAttrib');
        await drawCurrent(mask===0x2000?expectedHi:expectedLo,label+' attribute mask '+mask);
      }
      const second=call('wglCreateContext',[dc]);assert(second);set(lo);
      assert.strictEqual(call('wglMakeCurrent',[dc,second]),1);
      call('glViewport',[0,0,3,2]);call('glDisable',[0xbd0]);
      call('glDrawBuffer',[0x404]);call('glReadBuffer',[0x404]);set(hi);
      assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);await drawCurrent(expectedLo,label+' first context');
      assert.strictEqual(call('wglMakeCurrent',[dc,second]),1);await drawCurrent(expectedHi,label+' second context');
      assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);call('wglDeleteContext',[second]);
    }
  }
`;
const arrays=String.raw`
  const vertex=e.guest_alloc(32)>>>0,vertexWa=wa(vertex),indices=e.guest_alloc(16)>>>0;
  new Uint8Array(memory.buffer,vertexWa,32).fill(0xb6);
  [-2/3,-.5,0].forEach((v,i)=>dv.setFloat32(vertexWa+i*4,v,true));
  new Uint8Array(memory.buffer,wa(indices),16).fill(0xc9);dv.setUint16(wa(indices),0,true);
  call('glVertexPointer',[3,0x1406,32,vertex]);call('glEnableClientState',[0x8074]);
  if(selected('arrays')) for(const [suffix,width,lo,hi,expectedLo,expectedHi] of pairs){
    const type=width===32?0x1405:width===16?0x1403:0x1401;
    const max=width===32?0xffffffff:width===16?65535:255;
    for(const components of [3,4]){
      function fillColor(value){
        new Uint8Array(memory.buffer,srcWa,64).fill(0xa7);
        for(let i=0;i<components;i++){
          const p=srcWa+i*width/8,v=i===3?max:value;
          width===32?dv.setUint32(p,v,true):width===16?dv.setUint16(p,v,true):dv.setUint8(p,v);
        }
      }
      call('glColorPointer',[components,type,32,src]);call('glEnableClientState',[0x8076]);
      for(const elements of [false,true]){
        function submit(){call(elements?'glDrawElements':'glDrawArrays',elements?[0,1,0x1403,indices]:[0,0,1]);}
        fillColor(lo);reset();submit();call('glFinish');if(encoder)encoder.fence();
        oneChangedPixel(expectedLo);
        fillColor(hi);reset();submit();call('glFinish');if(encoder)encoder.fence();
        oneChangedPixel(expectedHi);
        const list=call('glGenLists',[1]);assert(list);
        fillColor(lo);call('glNewList',[list,0x1300]);submit();call('glEndList');
        fillColor(hi);reset();call('glCallList',[list]);call('glFinish');if(encoder)encoder.fence();
        oneChangedPixel(expectedLo);call('glDeleteLists',[list,1]);
      }
      fillColor(lo);call('glDisableClientState',[0x8076]);call('glColor4ui',[0xffffffff,0,0,0xffffffff]);
      reset();call('glDrawArrays',[0,0,1]);call('glFinish');if(encoder)encoder.fence();
      oneChangedPixel(bpp===16?0xfc00:0xffff0000);
    }
  }
  call('glDisableClientState',[0x8074]);call('glDisableClientState',[0x8076]);
`;
const signedTables=require('./gl-exact-source-cases').signedQuery;
const queries=String.raw`
  const signedTables=SIGNED_TABLES;
  if(selected('signed')) for(const table of signedTables){
    const bits=table.bits,suffix=bits===8?'b':bits===16?'s':'i',type=bits===8?0x1400:bits===16?0x1402:0x1404;
    for(const vector of [false,true])for(const n of [3,4])for(let at=0;at<table.rawSigned.length;at++){
      const value=table.rawSigned[at],expected=table.queryF32[at];
      new Uint8Array(memory.buffer,srcWa,64).fill(0xa7);
      for(let i=0;i<n;i++){
        const p=srcWa+i*bits/8;
        bits===32?dv.setInt32(p,value,true):bits===16?dv.setInt16(p,value,true):dv.setInt8(p,value);
      }
      const before=Buffer.from(new Uint8Array(memory.buffer,srcWa,64));
      call('glColor'+n+suffix+(vector?'v':''),vector?[src]:Array(n).fill(value));
      assert.deepStrictEqual(queryColor(),[expected,expected,expected,n===3?1:expected],'signed literal scalar/vector query');
      assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,srcWa,64)),before,'signed input extent/canaries');
      if(vector){
        call('glColorPointer',[n,type,32,src]);call('glEnableClientState',[0x8076]);
        call('glArrayElement',[0]);
        assert.deepStrictEqual(queryColor(),[expected,expected,expected,n===3?1:expected],'signed color-array offset normalization');
        call('glDisableClientState',[0x8076]);
      }
    }
  }
  if(selected('float')) for(const value of [0,.03125,.5,1,-.5,1.5]){
    // Identical current f32 after an integer call must still replace provenance.
    call('glColor4ui',[0x07ffffff,0x7fffffff,0x80000000,0xffffffff]);
    call('glColor4f',[f(value),f(value),f(value),f(value)]);
    assert.deepStrictEqual(queryColor(),Array(4).fill(value),'literal float query retains unclamped current');
    for(let i=0;i<4;i++)dv.setFloat64(srcWa+i*8,value,true);
    call('glColor4dv',[src]);assert.deepStrictEqual(queryColor(),Array(4).fill(value),'literal double vector current');
  }
`.replace('SIGNED_TABLES',JSON.stringify(signedTables));

const independent=String.raw`
  // These endpoint oracles do not depend on the selected internal precision.
  if(selected('float')) for(const value of [0,1])for(const n of [3,4])for(const kind of ['f','fv','d','dv']){
    call('glColor4ui',[0x07ffffff,0x7fffffff,0x80000000,0xffffffff]);
    const isDouble=kind[0]==='d',isVector=kind.endsWith('v'),size=isDouble?8:4;
    new Uint8Array(memory.buffer,srcWa,64).fill(0xa7);
    for(let i=0;i<n;i++)dv[isDouble?'setFloat64':'setFloat32'](srcWa+i*size,value,true);
    const before=Buffer.from(new Uint8Array(memory.buffer,srcWa,64));
    const args=isVector?[src]:Array.from({length:n*(isDouble?2:1)},(_,i)=>dv.getUint32(srcWa+i*4,true));
    call('glColor'+n+kind,args);
    assert.deepStrictEqual(queryColor(),[value,value,value,n===3?1:value],'endpoint '+n+kind);
    assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,srcWa,64)),before,'float/double input canaries');
    await drawCurrent(bpp===16?(value?0xffff:0x8000):(value?0xffffffff:n===3?0xff000000:0),'float replacement endpoint '+n+kind);
  }
  if(selected('signed'))for(const width of [8,16,32])for(const n of [3,4]){
    const suffix=width===8?'b':width===16?'s':'i',min=-(2**(width-1)),max=2**(width-1)-1;
    for(const value of [min,max]){
      call('glColor'+n+suffix,Array(n).fill(value));
      await drawCurrent(bpp===16?(value===max?0xffff:0x8000):(value===max?0xffffffff:n===3?0xff000000:0),'signed endpoint '+n+suffix);
    }
  }
  if(selected('signed'))for(const [width,values,bytes]of [
    [8,[-128,-1,0,1,63,64,127],[0,0,1,3,127,129,255]],
    [16,[-32768,-1,0,1,16383,16384,32767],[0,0,0,0,127,128,255]],
    [32,[-2147483648,-1,0,1,1073741823,1073741824,2147483647],[0,0,0,0,127,128,255]]
  ])for(let j=0;j<values.length;j++)for(const n of [3,4]){
    const value=values[j],byte=bytes[j],suffix=width===8?'b':width===16?'s':'i';
    const literal=bpp===16?(0x8000|((byte>>>3)*0x421)):
      (((n===3?255:byte)<<24)|(byte<<16)|(byte<<8)|byte)>>>0;
    for(const vector of [false,true]){
      new Uint8Array(memory.buffer,srcWa,64).fill(0xa7);
      for(let c=0;c<n;c++)width===8?dv.setInt8(srcWa+c,value):width===16?dv.setInt16(srcWa+c*2,value,true):dv.setInt32(srcWa+c*4,value,true);
      const canary=Buffer.from(new Uint8Array(memory.buffer,srcWa,64));
      call('glColor'+n+suffix+(vector?'v':''),vector?[src]:Array(n).fill(value));
      await drawCurrent(literal,'signed m8 literal '+n+suffix+(vector?'v':'')+' '+value);
      assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,srcWa,64)),canary,'signed input canary');
    }
    call('glEnableClientState',[0x8074]);call('glEnableClientState',[0x8076]);
    call('glVertexPointer',[3,0x1406,0,vertex]);call('glColorPointer',[n,0x1400+(width===8?0:width===16?2:4),32,src]);
    reset();call('glColorMask',[1,1,1,1]);call('glDrawArrays',[0,0,1]);call('glFinish');if(encoder)encoder.fence();
    oneChangedPixel(literal);assert.strictEqual(call('glGetError'),0,'signed array fixed8');
    call('glDisableClientState',[0x8074]);call('glDisableClientState',[0x8076]);
    if(encoder)await new Promise(resolve=>setImmediate(resolve));
  }
  if(selected('nested')){
    const low=bpp===16?0x07ffffff:0x7fffffff,high=low+1;
    const expectedLow=bpp===16?0x8000:0xff7f7f7f,expectedHigh=bpp===16?0x8421:0xff808080;
    const first=call('glGenLists',[2]);assert(first);
    call('glNewList',[first,0x1300]);call('glColor4ui',[low,low,low,0xffffffff]);call('glEndList');
    call('glNewList',[first+1,0x1300]);call('glCallList',[first]);call('glEndList');
    call('glColor4ui',[high,high,high,0xffffffff]);call('glCallList',[first+1]);await drawCurrent(expectedLow,'nested captured exact');
    call('glNewList',[first,0x1300]);call('glColor4ui',[high,high,high,0xffffffff]);call('glEndList');
    call('glCallList',[first+1]);await drawCurrent(expectedHigh,'nested uses replaced definition');
    call('glDeleteLists',[first,2]);
  }
  if(selected('lighting')){
    // Explicit material emission produces green regardless of stale raw gray.
    // All ambient/diffuse/specular terms are zero; no implementation rounding
    // or approximate comparison is needed for the output oracle.
    function material(p,values){values.forEach((x,i)=>dv.setFloat32(srcWa+i*4,x,true));call('glMaterialfv',[0x408,p,src]);}
    call('glPushAttrib',[0xfffff]);
    material(0x1200,[0,0,0,1]);material(0x1201,[0,0,0,1]);material(0x1202,[0,0,0,1]);material(0x1600,[0,1,0,1]);
    call('glDisable',[0xb57]);call('glEnable',[0xb50]);
    call('glColor4ui',[0x07ffffff,0x7fffffff,0x80000000,0xffffffff]);
    await drawCurrent(bpp===16?0x83e0:0xff00ff00,'lighting retires raw source');
    call('glPopAttrib');
  }
  if(selected('provoking')){
    call('glShadeModel',[0x1d00]);
    const low=bpp===16?0x07ffffff:0x7fffffff,high=low+1;
    for(const last of [low,high]){
      reset();call('glColorMask',[1,1,1,1]);call('glBegin',[4]);
      const coords=[[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]];
      coords.forEach(([x,y],i)=>{
        const value=i%3===2?last:last===low?high:low;
        call('glColor4ui',[value,value,value,0xffffffff]);
        call('glVertex3f',[f(x),f(y),0]);
      });
      call('glEnd');call('glFinish');if(encoder)encoder.fence();
      const literal=bpp===16?(last===low?0x8000:0x8421):(last===low?0xff7f7f7f:0xff808080);
      for(let y=0;y<height;y++){
        for(let x=0;x<width;x++)assert.strictEqual(dv[bpp===16?'getUint16':'getUint32'](bits+y*stride+x*bpp/8,true),literal,'raw provoking color across two unclipped flat triangles');
        for(let i=width*bpp/8;i<stride;i++)assert.strictEqual(storage[y*stride+i],0x6d,'flat-triangle padding');
      }
      assert.strictEqual(call('glGetError'),0,'flat-triangle no error');
    }
    call('glShadeModel',[0x1d01]);
  }
  if(selected('transport')&&encoder){
    encoder.fence();
    const originalEnqueue=encoder.enqueueGl,originalSubmit=encoder._submit;
    const poisoned=[];
    encoder.enqueueGl=function(descriptor){
      const snap=dv.getUint32(descriptor,true),snapBytes=dv.getUint32(descriptor+4,true);
      const draw=dv.getUint32(descriptor+8,true),drawBytes=dv.getUint32(descriptor+12,true);
      assert(snapBytes>0&&drawBytes>32,'actual snapshot and packed draw present');
      // Keep the actual renderer Worker, but hold this send until after the
      // producer-owned source ranges have been overwritten. The normal
      // enqueueGl copy and normal _submit path must provide all worker data.
      this._submit=function(){};
      let accepted;
      try{accepted=originalEnqueue.call(this,descriptor);}finally{this._submit=originalSubmit;}
      assert.strictEqual(accepted,1,'actual enqueueGl admits without fallback');
      const savedSnapshot=new Uint8Array(memory.buffer,snap,snapBytes).slice();
      const savedDraw=new Uint8Array(memory.buffer,draw+32,drawBytes-32).slice();
      new Uint8Array(memory.buffer,snap,snapBytes).fill(0xa5);
      new Uint8Array(memory.buffer,draw+32,drawBytes-32).fill(0x5a);
      poisoned.push({snapshotBytes:snapBytes,drawBytes,producerSnapshotPoison:0xa5,producerVertexPoison:0x5a});
      originalSubmit.call(this);
      // Hold poison until the real raster Worker has finished reading its
      // owning queue record. Restore the separate GUI replay stream only after
      // that fence; the framebuffer result still proves the Worker copy.
      this.fence();
      new Uint8Array(memory.buffer,snap,snapBytes).set(savedSnapshot);
      new Uint8Array(memory.buffer,draw+32,drawBytes-32).set(savedDraw);
      return accepted;
    };
    try{
      const low=bpp===16?0x07ffffff:0x7fffffff;
      call('glColor4ui',[low,low,low,0xffffffff]);
      await drawCurrent(bpp===16?0x8000:0xff7f7f7f,'actual queued owned source after producer poison');
      assert(poisoned.length>0,'actual worker exercised poisoned source ranges');
      console.log('OWNED_TRANSPORT_SOURCE_POISON',JSON.stringify({bpp,topDown,poisoned}));
    }finally{encoder.enqueueGl=originalEnqueue;encoder._submit=originalSubmit;}
  }
  if(selected('interleaved')){
    const block=e.guest_alloc(64)>>>0,blockWa=wa(block);
    const choices=[{rgba:[7,8,255,255],word16:0x803f,word32:0xff0708ff},
      {rgba:[255,7,8,255],word16:0xfc01,word32:0xffff0708}];
    function fill(c){
      new Uint8Array(memory.buffer,blockWa,64).fill(0x9d);
      new Uint8Array(memory.buffer,blockWa,4).set(c.rgba);
      [-2/3,-.5,0].forEach((v,i)=>dv.setFloat32(blockWa+4+4*i,v,true));
    }
    call('glInterleavedArrays',[0x2a23,32,block]);
    for(const c of choices){
      fill(c);const before=Buffer.from(new Uint8Array(memory.buffer,blockWa,64));
      const literal=bpp===16?c.word16:c.word32;
      reset();call('glColorMask',[1,1,1,1]);call('glDrawArrays',[0,0,1]);call('glFinish');if(encoder)encoder.fence();
      oneChangedPixel(literal);
      assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,blockWa,64)),before,'interleaved draw input canaries');
      const list=call('glGenLists',[1]);assert(list);
      call('glNewList',[list,0x1300]);call('glBegin',[0]);call('glArrayElement',[0]);call('glEnd');call('glEndList');
      fill(choices.find(x=>x!==c));reset();call('glCallList',[list]);call('glFinish');if(encoder)encoder.fence();
      oneChangedPixel(literal);call('glDeleteLists',[list,1]);
    }
    call('glDisableClientState',[0x8074]);call('glDisableClientState',[0x8076]);
    assert.strictEqual(call('glGetError'),0,'interleaved exact-source controls no error');
  }
  if(selected('clipping')){
    // All original vertices lie outside the clip volume; the visible quad's
    // vertices are generated by clipping. With candidate internal m=8, their
    // computed constant color uses ordinary nearest conversion. Retaining raw
    // provenance on those generated vertices gives the opposite literal.
    // This test is conditional on selecting the explicit m=8 policy.
    const low=bpp===16?0x07ffffff:0x7fffffff;
    reset();call('glColorMask',[1,1,1,1]);call('glColor4ui',[low,low,low,0xffffffff]);
    call('glBegin',[4]);
    for(const [x,y]of[[-3,-3],[3,-3],[3,3],[-3,-3],[3,3],[-3,3]])call('glVertex3f',[f(x),f(y),0]);
    call('glEnd');call('glFinish');if(encoder)encoder.fence();
    const literal=bpp===16?0x8421:0xff808080;
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++)assert.strictEqual(dv[bpp===16?'getUint16':'getUint32'](bits+y*stride+x*bpp/8,true),literal,'generated clip color retires raw under explicit m8 policy');
      for(let i=width*bpp/8;i<stride;i++)assert.strictEqual(storage[y*stride+i],0x6d,'clipped-quad padding');
    }
    assert.strictEqual(call('glGetError'),0,'clipped raw color no error');
  }
  if(selected('replacement'))for(const kind of ['f','fv','d','dv']){
    const value=bpp===16?.03125:.5,low=bpp===16?0x07ffffff:0x7fffffff;
    const expectedRaw=bpp===16?0x8000:0xff7f7f7f,expectedFloat=bpp===16?0x8421:0xff808080;
    const isDouble=kind[0]==='d',isVector=kind.endsWith('v'),size=isDouble?8:4;
    call('glColor4ui',[low,low,low,0xffffffff]);const rawQuery=queryColor();await drawCurrent(expectedRaw,'integer before same-query '+kind);
    [value,value,value,1].forEach((v,i)=>dv[isDouble?'setFloat64':'setFloat32'](srcWa+i*size,v,true));
    const args=isVector?[src]:Array.from({length:4*(isDouble?2:1)},(_,i)=>dv.getUint32(srcWa+i*4,true));
    call('glColor4'+kind,args);assert.deepStrictEqual(queryColor(),rawQuery,'float setter has exactly identical f32 current color');
    await drawCurrent(expectedFloat,'same-query floating setter clears raw '+kind);
    call('glColor4ui',[low,low,low,0xffffffff]);await drawCurrent(expectedRaw,'integer restores exact source after '+kind);
  }

`;

text=text.replace(anchor,controls+'\n'+arrays+'\n'+queries+'\n'+independent+'\n'+anchor);
if(process.argv.includes('--check-expanded')){
  new (require('vm').Script)(text,{filename:target});
  console.log(JSON.stringify({phase:'syntax-only; no GL execution',template:target,
    templateSHA256:require('crypto').createHash('sha256').update(fs.readFileSync(target)).digest('hex'),
    expandedSHA256:require('crypto').createHash('sha256').update(text).digest('hex'),expandedBytes:Buffer.byteLength(text)}));
  process.exit(0);
}
// Keep resolution paths and __dirname identical to the real existing harness.
const child=new Module(target,module);child.filename=target;child.paths=Module._nodeModulePaths(path.dirname(target));
child._compile(text,target);
