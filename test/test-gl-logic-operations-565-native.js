'use strict';
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
const target=path.join(process.cwd(),'test/test-gl-bitmap-boundary-native.js');
let text=fs.readFileSync(target,'utf8');
function replace(a,b){assert.strictEqual(text.split(a).length,2,'unique anchor '+a);text=text.replace(a,b);}
replace('for(const bpp of [16,32])','for(const bpp of [16])');
replace('const bmi=e.guest_alloc(40)','const bmi=e.guest_alloc(52)');
replace('new Uint8Array(memory.buffer,wa(bmi),40).fill(0);','new Uint8Array(memory.buffer,wa(bmi),52).fill(0);');
replace('e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,bpp);',`e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,bpp);
  e.guest_write32(bmi+16,3);e.guest_write32(bmi+40,0xf800);e.guest_write32(bmi+44,0x07e0);e.guest_write32(bmi+48,0x001f);`);
replace('bpp===16?[5,5,5,0]:[8,8,8,8]','bpp===16?[5,6,5,0]:[8,8,8,8]');
replace('bpp===16?[82,49,58,255]:[40,56,72,60]','bpp===16?[173,24,58,255]:[40,56,72,60]');
replace('oneChangedPixel(bpp===16?0x83e0:0x3c00ff00);','oneChangedPixel(bpp===16?0x07e0:0x3c00ff00);');
replace("  assert.strictEqual(call('glGetError'),0);observations.push({bpp,topDown,alphaBits:query(0xd55),passed:true});",String.raw`
  // Let Manager consume completed transport acknowledgements between drawables.
  await new Promise(resolve=>setImmediate(resolve));
  const tables=LITERAL_TABLES;
  call('glColorMask',[1,1,1,1]);call('glEnable',[0xbf2]);
  const destination=0x9cd3;
  function seed(){storage.fill(0x6d);for(let y=0;y<height;y++)for(let x=0;x<width;x++)dv.setUint16(bits+y*stride+x*2,destination,true);}
  function point565(r,g,b){call('glColor4ui',[r,g,b,0xffffffff]);call('glBegin',[0]);call('glVertex3f',[f(-2/3),f(-.5),0]);call('glEnd');call('glFinish');if(encoder)encoder.fence();}
  function check(expected,label){
    let covered=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const actual=dv.getUint16(bits+y*stride+x*2,true);
      if(actual!==destination){assert.strictEqual(actual,expected,label);covered++;}
    }assert.strictEqual(covered,expected===destination?0:1,label+' covered point');
    for(let y=0;y<height;y++)for(let i=width*2;i<stride;i++)assert.strictEqual(storage[y*stride+i],0x6d,label+' row padding');
  }
  for(let op=0;op<16;op++){
    seed();call('glLogicOp',[0x1500+op]);point565(0x48000000,0x54000000,0x48000000);
    check((tables.five.expected[op]<<11)|(tables.six.expected[op]<<5)|tables.five.expected[op],tables.operations[op]+' RGB565 stored width');
    assert.strictEqual(call('glGetError'),0,'RGB565 operation error');
  }
  const bitmapBits=e.guest_alloc(4)>>>0,pixelBits=e.guest_alloc(16)>>>0;e.guest_write32(bitmapBits,0x80);
  for(const kind of ['bitmap','pixels'])for(let op=0;op<16;op++){
    seed();call('glLogicOp',[0x1500+op]);call('glColor4ui',[0x48000000,0x54000000,0x48000000,0xffffffff]);call('glRasterPos2f',[f(-.9),f(-.9)]);
    if(kind==='bitmap')call('glBitmap',[1,1,0,0,0,0,bitmapBits]);
    else {for(let c=0;c<4;c++)e.guest_write32(pixelBits+c*4,[0x48000000,0x54000000,0x48000000,0xffffffff][c]);call('glDrawPixels',[1,1,0x1908,0x1405,pixelBits]);}
    call('glFinish');if(encoder)encoder.fence();check((tables.five.expected[op]<<11)|(tables.six.expected[op]<<5)|tables.five.expected[op],'RGB565 '+kind+' '+tables.operations[op]);
  }
  call('glLogicOp',[0x1506]);
  for(let i=0;i<2;i++){
    seed();point565(tables.exactSourceXor.five.raw[i],tables.exactSourceXor.six.raw[i],tables.exactSourceXor.five.raw[i]);
    check((tables.exactSourceXor.five.expected[i]<<11)|(tables.exactSourceXor.six.expected[i]<<5)|tables.exactSourceXor.five.expected[i],'RGB565 exact source boundary '+i);
  }
  seed();call('glEnable',[0xbd0]);call('glLogicOp',[0x1506]);
  call('glColor4ui',[0x07000000,0x03000000,0x07000000,0xffffffff]);call('glBegin',[4]);
  for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])call('glVertex3f',[f(x),f(y),0]);
  call('glEnd');call('glFinish');if(encoder)encoder.fence();call('glReadPixels',[0,0,2,2,0x1908,0x1401,output]);
  assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer,outWa,16)),[156,154,156,255,148,158,148,255,148,158,148,255,148,158,148,255],'RGB565 dither before logic');
  call('glDisable',[0xbd0]);
  call('glDisable',[0xbf2]);
  assert.strictEqual(call('glGetError'),0);observations.push({bpp,format:'RGB565',topDown,logic16:true,passed:true});
`.replace('LITERAL_TABLES',JSON.stringify(require('./gl-logic-operation-literals.json'))));
if(process.argv.includes('--check-expanded')){new(require('vm').Script)(text,{filename:target});console.log('RGB565 syntax PASS; no native/guest execution');}
else {const m=new Module(target,module);m.filename=target;m.paths=Module._nodeModulePaths(path.dirname(target));m._compile(text,target);}
