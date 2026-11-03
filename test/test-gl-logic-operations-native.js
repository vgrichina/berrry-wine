'use strict';
// Resolved-ABI stored-width logic controls. --check-expanded does syntax only.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
const root=process.cwd(),target=path.join(root,'test/test-gl-bitmap-boundary-native.js');
const literals=require('./gl-logic-operation-literals.json');
let text=fs.readFileSync(target,'utf8');
function replace(needle,replacement){assert.strictEqual(text.split(needle).length,2,'unique anchor '+needle);text=text.replace(needle,replacement);}
const anchor="  assert.strictEqual(call('glGetError'),0);observations.push({bpp,topDown,alphaBits:query(0xd55),passed:true});";
replace(anchor,String.raw`
  // Let Manager consume completed transport acknowledgements between drawables.
  await new Promise(resolve=>setImmediate(resolve));
  const tables=LITERAL_TABLES;
  const opTable=bpp===16?tables.five:tables.eight;
  const word=n=>bpp===16?(0x8000+n*0x421):((n*0x1010101)>>>0);
  function seed(n){storage.fill(0x6d);for(let y=0;y<height;y++)for(let x=0;x<width;x++)dv[bpp===16?'setUint16':'setUint32'](bits+y*stride+x*bpp/8,word(n),true);}
  function pointRaw(raw,count=1){
    call('glColor4ui',[raw,raw,raw,0xffffffff]);call('glBegin',[0]);
    for(let i=0;i<count;i++)call('glVertex3f',[f(-2/3),f(-.5),0]);
    call('glEnd');call('glFinish');if(encoder)encoder.fence();
  }
  function check(n,expected,label){
    let covered=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const actual=dv[bpp===16?'getUint16':'getUint32'](bits+y*stride+x*bpp/8,true);
      if(actual!==word(n)){assert.strictEqual(actual,expected,label);covered++;}
    }
    // NOOP, or an operation whose literal equals destination, has zero changes.
    assert.strictEqual(covered,expected===word(n)?0:1,label+' coverage');
    for(let y=0;y<height;y++)for(let i=width*bpp/8;i<stride;i++)assert.strictEqual(storage[y*stride+i],0x6d,label+' padding');
  }
  assert.strictEqual(query(0xbf0),0x1503,'COPY initial mode');
  assert.strictEqual(call('glIsEnabled',[0xbf1]),0,'INDEX initial disabled');
  assert.strictEqual(call('glIsEnabled',[0xbf2]),0,'COLOR initial disabled');
  call('glColorMask',[1,1,1,1]);
  call('glLogicOp',[0x1500]);seed(opTable.destination);pointRaw(bpp===16?0x48000000:0x35000000);
  check(opTable.destination,bpp===16?word(9):0xff353535,'disabled logic retains ordinary COPY behavior');
  for(const cap of [0xbf1,0xbf2]){
    call('glBegin',[0]);call('glEnable',[cap]);call('glEnd');
    assert.strictEqual(call('glGetError'),0x502,'Begin/End enable logic error');
    assert.strictEqual(call('glIsEnabled',[cap]),0,'Begin/End enable logic retains state');
  }
  call('glColorMask',[1,1,1,1]);call('glEnable',[0xbf2]);
  for(let op=0;op<16;op++){
    seed(opTable.destination);call('glLogicOp',[0x1500+op]);
    const raw=bpp===16?0x48000000:0x35000000;
    pointRaw(raw);
    const v=opTable.expected[op];
    // Integer alpha source is one. Destination alpha is 166 on RGBA8.
    const alpha=[0,166,89,255,0,166,89,255,0,166,89,255,0,166,89,255][op];
    check(opTable.destination,bpp===16?word(v):((alpha<<24)|(v<<16)|(v<<8)|v)>>>0,tables.operations[op]);
    assert.strictEqual(call('glGetError'),0,'operation error');
  }
  call('glLogicOp',[0x1506]);
  const collision=bpp===16?tables.exactSourceXor.five:tables.exactSourceXor.eight;
  for(let i=0;i<2;i++){
    seed(collision.destination);pointRaw(collision.raw[i]);
    check(collision.destination,bpp===16?word(collision.expected[i]):((89<<24)|(collision.expected[i]*0x10101))>>>0,'exact-source XOR '+i);
  }
  const bitmapBits=e.guest_alloc(4)>>>0;e.guest_write32(bitmapBits,0x80);
  call('glPixelStorei',[0xcf5,1]);
  function bitmapRaw(raw,currentRestore=false){
    call('glColor4ui',[raw,raw,raw,0xffffffff]);call('glRasterPos2f',[f(-.9),f(-.9)]);
    if(currentRestore){call('glPushAttrib',[1]);call('glColor4ui',[0xffffffff,0xffffffff,0xffffffff,0xffffffff]);call('glRasterPos2f',[0,0]);call('glPopAttrib');}
    call('glColor4ui',[0,0,0,0]);call('glBitmap',[1,1,0,0,0,0,bitmapBits]);call('glFinish');if(encoder)encoder.fence();
  }
  for(let op=0;op<16;op++){
    seed(opTable.destination);call('glLogicOp',[0x1500+op]);bitmapRaw(bpp===16?0x48000000:0x35000000);
    const a=bpp===16?255:[0,166,89,255,0,166,89,255,0,166,89,255,0,166,89,255][op];
    check(opTable.destination,bpp===16?word(opTable.expected[op]):((a<<24)|(opTable.expected[op]*0x10101))>>>0,'bitmap '+tables.operations[op]);
  }
  call('glLogicOp',[0x1506]);
  for(let i=0;i<2;i++){
    seed(opTable.destination);bitmapRaw(collision.raw[i],i===0);
    check(opTable.destination,bpp===16?word(collision.expected[i]):(0x59000000|collision.expected[i]*0x10101)>>>0,'bitmap exact source/raster CURRENT '+i);
  }
  const pixelSource=e.guest_alloc(16)>>>0;
  for(let op=0;op<16;op++){
    seed(opTable.destination);call('glLogicOp',[0x1500+op]);for(let c=0;c<4;c++)e.guest_write32(pixelSource+c*4,c===3?0xffffffff:bpp===16?0x48000000:0x35000000);
    call('glRasterPos2f',[f(-.9),f(-.9)]);call('glDrawPixels',[1,1,0x1908,0x1405,pixelSource]);call('glFinish');if(encoder)encoder.fence();
    const a=bpp===16?255:[0,166,89,255,0,166,89,255,0,166,89,255,0,166,89,255][op];check(opTable.destination,bpp===16?word(opTable.expected[op]):((a<<24)|opTable.expected[op]*0x10101)>>>0,'DrawPixels '+tables.operations[op]);
  }
  for(let i=0;i<2;i++){
    seed(opTable.destination);call('glLogicOp',[0x1506]);
    for(let c=0;c<4;c++)e.guest_write32(pixelSource+c*4,c===3?0xffffffff:collision.raw[i]);
    call('glRasterPos2f',[f(-.9),f(-.9)]);call('glDrawPixels',[1,1,0x1908,0x1405,pixelSource]);call('glFinish');if(encoder)encoder.fence();
    check(opTable.destination,bpp===16?word(collision.expected[i]):(0x59000000|collision.expected[i]*0x10101)>>>0,'DrawPixels integer source boundary '+i);
  }
  for(let i=0;i<2;i++){
    seed(opTable.destination);call('glLogicOp',[0x1506]);for(let c=0;c<4;c++)e.guest_write32(pixelSource+c*4,c===3?0xffffffff:[0x3fffffff,0x40000000][i]);
    for(const parameter of [0xd14,0xd18,0xd1a])call('glPixelTransferf',[parameter,f(2)]);
    call('glRasterPos2f',[f(-.9),f(-.9)]);call('glDrawPixels',[1,1,0x1908,0x1405,pixelSource]);call('glFinish');if(encoder)encoder.fence();
    check(opTable.destination,bpp===16?word([28,3][i]):[0x59d9d9d9,0x59262626][i],'DrawPixels exact source before computed scale '+i);
    for(const parameter of [0xd14,0xd18,0xd1a])call('glPixelTransferf',[parameter,f(1)]);
  }
  if(bpp===32)for(let i=0;i<2;i++){
    seed(opTable.destination);for(let c=0;c<4;c++)e.guest_write32(pixelSource+c*4,c===3?0x7fffffff:[0x3fffffff,0x40000000][i]);
    call('glRasterPos2f',[f(-.9),f(-.9)]);call('glDrawPixels',[1,1,0x1908,0x1404,pixelSource]);call('glFinish');if(encoder)encoder.fence();check(opTable.destination,[0x59d9d9d9,0x59262626][i],'DrawPixels signed exact source '+i);
  }
  seed(opTable.destination);call('glLogicOp',[0x1506]);e.guest_write32(pixelSource,0x7fffffff);
  call('glPixelTransferf',[0xd14,f(4294967296)]);call('glRasterPos2f',[f(-.9),f(-.9)]);
  call('glDrawPixels',[1,1,0x1906,0x1404,pixelSource]);call('glFinish');if(encoder)encoder.fence();
  check(opTable.destination,bpp===16?word(19):0x59a6a6a6,'signed ALPHA implicit RGB zero before scale');
  call('glPixelTransferf',[0xd14,f(1)]);
  call('glLogicOp',[0x150a]);
  for(const count of [1,2,3]){
    seed(opTable.destination);pointRaw(0,count);
    check(opTable.destination,word((bpp===16?tables.overlapInvert.five:tables.overlapInvert.eight)[count]),'ordered repeated point '+count);
  }
  call('glLogicOp',[0x1506]);call('glLogicOp',[0x14ff]);
  assert.strictEqual(call('glGetError'),0x500,'invalid enum');assert.strictEqual(query(0xbf0),0x1506,'invalid enum retains mode');
  call('glBegin',[0]);call('glLogicOp',[0x1500]);call('glEnd');
  assert.strictEqual(call('glGetError'),0x502,'Begin/End invalid operation');assert.strictEqual(query(0xbf0),0x1506,'Begin/End retains mode');
  for(let mask=0;mask<16;mask++){
    seed(opTable.destination);call('glColorMask',[mask&1,(mask>>1)&1,(mask>>2)&1,(mask>>3)&1]);pointRaw(bpp===16?0x48000000:0x35000000);
    const v=opTable.expected[6],d=opTable.destination;
    const expected=bpp===16?(0x8000|((mask&1?v:d)<<10)|((mask&2?v:d)<<5)|(mask&4?v:d)):
      (((mask&8?89:d)<<24)|((mask&1?v:d)<<16)|((mask&2?v:d)<<8)|(mask&4?v:d))>>>0;
    check(d,expected,'post-logic color mask '+mask);
  }
  call('glColorMask',[1,1,1,1]);
  for(const cap of [0xbf1,0xbf2]){
    call('glEnable',[cap]);call('glBegin',[0]);call('glDisable',[cap]);call('glEnd');
    assert.strictEqual(call('glGetError'),0x502,'Begin/End disable logic error');
    assert.strictEqual(call('glIsEnabled',[cap]),1,'Begin/End disable logic retains state');
  }
  call('glDisable',[0xbf1]);
  call('glEnable',[0xbe2]);call('glBlendFunc',[0,0]);call('glLogicOp',[0x1503]);
  seed(opTable.destination);pointRaw(0xffffffff);check(opTable.destination,bpp===16?0xffff:0xffffffff,'logic overrides zero blend');
  assert.strictEqual(call('glIsEnabled',[0xbe2]),1,'requested blend enable survives logic');
  assert.strictEqual(query(0xbe1),0,'requested blend source survives');assert.strictEqual(query(0xbe0),0,'requested blend destination survives');
  call('glDisable',[0xbf2]);call('glEnable',[0xbf1]);call('glLogicOp',[0x150f]);
  seed(opTable.destination);pointRaw(0xffffffff);check(opTable.destination,bpp===16?0x8000:0,'INDEX_LOGIC_OP distinct/no RGBA effect');
  call('glDisable',[0xbf1]);call('glDisable',[0xbe2]);call('glEnable',[0xbf2]);call('glLogicOp',[0x1506]);
  call('glPushAttrib',[0x4000]);call('glLogicOp',[0x1500]);call('glDisable',[0xbf2]);call('glEnable',[0xbf1]);call('glPopAttrib');
  assert.strictEqual(query(0xbf0),0x1506,'COLOR_BUFFER attribute mode');
  assert.strictEqual(call('glIsEnabled',[0xbf2]),1,'COLOR_BUFFER attribute color enable');assert.strictEqual(call('glIsEnabled',[0xbf1]),0,'COLOR_BUFFER attribute index enable');
  call('glPushAttrib',[1]);call('glLogicOp',[0x150a]);call('glDisable',[0xbf2]);call('glEnable',[0xbf1]);call('glEnable',[0xbd0]);call('glPopAttrib');
  assert.strictEqual(query(0xbf0),0x150a,'CURRENT attribute does not restore logic mode');
  assert.strictEqual(call('glIsEnabled',[0xbf2]),0,'CURRENT does not restore color logic enable');assert.strictEqual(call('glIsEnabled',[0xbf1]),1,'CURRENT does not restore index logic enable');assert.strictEqual(call('glIsEnabled',[0xbd0]),1,'CURRENT does not restore dither');
  call('glDisable',[0xbf1]);call('glDisable',[0xbd0]);call('glEnable',[0xbf2]);
  const list=call('glGenLists',[1]);assert(list);
  call('glNewList',[list,0x1300]);call('glLogicOp',[0x1506]);call('glEndList');
  assert.strictEqual(query(0xbf0),0x150a,'compile-only mode remains unchanged');call('glCallList',[list]);
  assert.strictEqual(query(0xbf0),0x1506,'list replays mode');call('glDeleteLists',[list,1]);
  const second=call('wglCreateContext',[dc]);assert(second);
  assert.strictEqual(call('wglMakeCurrent',[dc,second]),1);assert.strictEqual(query(0xbf0),0x1503,'new context COPY');
  call('glLogicOp',[0x150f]);assert.strictEqual(call('wglMakeCurrent',[dc,context]),1);assert.strictEqual(query(0xbf0),0x1506,'context restores XOR');
  assert.strictEqual(call('glIsEnabled',[0xbf2]),1,'context restores enable');call('wglDeleteContext',[second]);
  if(bpp===16){
    call('glColorMask',[1,1,1,1]);call('glEnable',[0xbf2]);call('glEnable',[0xbd0]);call('glLogicOp',[0x1506]);seed(19);
    call('glColor4ui',[0x07000000,0x07000000,0x07000000,0xffffffff]);call('glBegin',[4]);
    for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])call('glVertex3f',[f(x),f(y),0]);
    call('glEnd');call('glFinish');if(encoder)encoder.fence();
    call('glReadPixels',[0,0,2,2,0x1908,0x1401,output]);
    assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,outWa,16)),[156,156,156,255,148,148,148,255,148,148,148,255,148,148,148,255],'dither before logic literal 2x2');
    call('glDisable',[0xbd0]);
  }
  // These commands bypass logic even while the selected mode is INVERT.
  call('glLogicOp',[0x150a]);call('glClearColor',[0,0,0,0]);seed(opTable.destination);call('glClear',[0x4000]);call('glFinish');if(encoder)encoder.fence();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)assert.strictEqual(dv[bpp===16?'getUint16':'getUint32'](bits+y*stride+x*bpp/8,true),bpp===16?0x8000:0,'clear bypass');
  call('glClearAccum',[0,0,0,0]);call('glClear',[0x200]);seed(opTable.destination);call('glAccum',[0x102,f(1)]);call('glFinish');if(encoder)encoder.fence();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)assert.strictEqual(dv[bpp===16?'getUint16':'getUint32'](bits+y*stride+x*bpp/8,true),bpp===16?0x8000:0,'accum RETURN bypass');
  if(encoder){
    encoder.fence();const originalEnqueue=encoder.enqueueGl,originalSubmit=encoder._submit,poisoned=[];
    encoder.enqueueGl=function(descriptor){
      const snap=dv.getUint32(descriptor,true),snapBytes=dv.getUint32(descriptor+4,true),draw=dv.getUint32(descriptor+8,true),drawBytes=dv.getUint32(descriptor+12,true);
      assert(snapBytes>0&&drawBytes>32,'actual logic snapshot/draw ranges');this._submit=function(){};
      let accepted;try{accepted=originalEnqueue.call(this,descriptor);}finally{this._submit=originalSubmit;}
      assert.strictEqual(accepted,1,'queued logic admitted');
      const savedSnapshot=new Uint8Array(memory.buffer,snap,snapBytes).slice(),savedDraw=new Uint8Array(memory.buffer,draw+32,drawBytes-32).slice();
      new Uint8Array(memory.buffer,snap,snapBytes).fill(0xa5);new Uint8Array(memory.buffer,draw+32,drawBytes-32).fill(0x5a);
      originalSubmit.call(this);this.fence();
      new Uint8Array(memory.buffer,snap,snapBytes).set(savedSnapshot);new Uint8Array(memory.buffer,draw+32,drawBytes-32).set(savedDraw);
      poisoned.push({snapBytes,drawBytes});return accepted;
    };
    try{
      call('glLogicOp',[0x1506]);seed(opTable.destination);pointRaw(bpp===16?0x48000000:0x35000000);
      check(opTable.destination,bpp===16?word(26):0x59939393,'actual Worker owns logic mode/enable/exact source after producer poison');
      assert(poisoned.length>0,'logic Worker transport exercised');console.log('OWNED_LOGIC_SNAPSHOT_POISON',JSON.stringify({bpp,topDown,poisoned}));
    }finally{encoder.enqueueGl=originalEnqueue;encoder._submit=originalSubmit;}
  }
  call('glDisable',[0xbf2]);
  assert.strictEqual(call('glGetError'),0);observations.push({bpp,topDown,alphaBits:query(0xd55),logic16:true,passed:true});
`.replace('LITERAL_TABLES',JSON.stringify(literals)));
if(process.argv.includes('--check-expanded')){new(require('vm').Script)(text,{filename:target});console.log('syntax PASS; no native/guest execution');}
else {const m=new Module(target,module);m.filename=target;m.paths=Module._nodeModulePaths(path.dirname(target));m._compile(text,target);}
