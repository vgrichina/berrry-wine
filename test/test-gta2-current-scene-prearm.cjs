'use strict';
// No repository runtime imports at load time. Pixel checks may run during the
// ordered light phase; native fixture creation/execution requires the lane.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function decodePNG(bytes) {
  assert(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
  let offset = 8, width, height, channels, ended = false;
  const chunks = [];
  while (offset < bytes.length) {
    assert(offset + 12 <= bytes.length, 'PNG chunk header');
    const size = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    assert(size <= bytes.length - offset - 12, 'PNG chunk bounds');
    const body = bytes.subarray(offset + 8, offset + 8 + size);
    assert.equal(crc32(bytes.subarray(offset + 4, offset + 8 + size)), bytes.readUInt32BE(offset + 8 + size), 'PNG CRC');
    if (type === 'IHDR') {
      assert.equal(offset, 8);assert.equal(size, 13);
      width = body.readUInt32BE(0);height = body.readUInt32BE(4);
      assert(width > 0 && height > 0 && width * height <= 16000000);
      assert.equal(body[8], 8, '8-bit PNG');assert([2, 6].includes(body[9]), 'RGB/RGBA PNG');
      channels = body[9] === 2 ? 3 : 4;
      assert(body.subarray(10).equals(Buffer.alloc(3)), 'standard noninterlaced PNG');
    } else if (type === 'IDAT') {
      assert(channels);chunks.push(body);
    } else if (type === 'IEND') {
      assert.equal(size, 0);ended = true;
    }
    offset += size + 12;
    if (ended) break;
  }
  assert(ended && offset === bytes.length && chunks.length, 'complete PNG');
  const stride = width * channels;
  const packed = zlib.inflateSync(Buffer.concat(chunks), {maxOutputLength:(stride + 1) * height});
  assert.equal(packed.length, (stride + 1) * height);
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)];assert(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y ? pixels[(y - 1) * stride + x] : 0;
      const c = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = [0, a, b, Math.floor((a + b) / 2), pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      pixels[y * stride + x] = (packed[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return {width, height, channels, pixels, pixel(x, y) {
    assert(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height);
    return [...pixels.subarray((y * width + x) * channels, (y * width + x) * channels + 3)];
  }};
}
function literalSamples(bytes, points) {
  const png = decodePNG(bytes);
  const samples = points.map(({x, y, rgb, meaning}) => {
    const actual = png.pixel(x, y);assert.deepEqual(actual, rgb, meaning);
    return {x, y, rgb:actual, meaning};
  });
  return {pngSHA256:sha(bytes), width:png.width, height:png.height, samples,
    meaning:'Independent literal raw-byte pixel evidence, no OCR or input authorization'};
}
function historicalPixels(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(sha(bytes), '99a7452e192345a310ed68c0d3b4a4ac562a43d4ef3f44d8dc6dbf6c5c7d50f9');
  return literalSamples(bytes, [
    {x:50,y:500,rgb:[0,128,128],meaning:'desktop teal'},
    {x:180,y:500,rgb:[255,255,255],meaning:'main native client white'},
    {x:180,y:350,rgb:[192,192,192],meaning:'first modal native client gray'},
    {x:400,y:284,rgb:[177,177,177],meaning:'first modal gray caption gradient'},
  ]);
}
// Keep the literal sample below the centered native modal, so publication
// checks observe the main client rather than an occluding dialog.
const SWATCH = Object.freeze({rect:[16,340,56,380],x:32,y:356,colorref:0x35a7e1,rgb:[225,167,53]});
function authoredPE() {
  // Lazy import: the current native harness is never executed during light work.
  const bytes = require('./test-gta2-fresh-attestation-prearm.cjs').authoredPE();
  const raw = rva => rva - 0x1000 + 0x400, base = 0x400000;
  const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
  const apis = {UpdateWindow:0x1328,GetDC:0x131c,ReleaseDC:0x1320,FillRect:0x1324,
    SetWindowTextA:0x132c,CreateSolidBrush:0x1400,DeleteObject:0x1404,GetPixel:0x1408};
  assert.equal(bytes.readUInt32LE(raw(apis.GetPixel)), 0);
  bytes.writeUInt32LE(0x1e80, raw(apis.GetPixel));bytes.write('GetPixel\0', raw(0x1e82));
  SWATCH.rect.forEach((value, i) => bytes.writeUInt32LE(value, raw(0x3640 + i * 4)));
  const title = 'Native input binding fixture DOWN=0 UP=0 QUIT=0 PIXEL=????????';
  for (const rva of [0x3060, 0x3340]) bytes.write(title + '\0', raw(rva));
  const code = [], emit = (...b) => code.push(...b), push = n => emit(0x68, ...u32(n));
  const call = name => emit(0xff, 0x15, ...u32(base + apis[name]));
  // Replace the initial ordinary UpdateWindow call with an authored routine
  // that calls it once, then paints one literal swatch through public GDI.
  emit(0x55,0x89,0xe5,0x53,0x56,0x57,0xff,0x75,8);call('UpdateWindow');
  emit(0xff,0x75,8);call('GetDC');emit(0x89,0xc6);
  push(SWATCH.colorref);call('CreateSolidBrush');emit(0x89,0xc7);
  emit(0x57);push(base+0x3640);emit(0x56);call('FillRect');
  push(SWATCH.y);push(SWATCH.x);emit(0x56);call('GetPixel');
  // Publish the actual full native API return as eight hex digits; no private
  // memory counter or expected-value substitution is used by the observer.
  emit(0x89,0xc3);
  const resultAt = base + 0x3340 + title.indexOf('????????');
  for (let i = 0; i < 8; i++) {
    emit(0x89,0xd8,0xc1,0xe8,28-i*4,0x83,0xe0,15,0x3c,10,0x72,2,0x04,7,0x04,48,
      0xa2,...u32(resultAt+i));
  }
  emit(0x56,0xff,0x75,8);call('ReleaseDC');emit(0x57);call('DeleteObject');
  push(base+0x3340);emit(0xff,0x75,8);call('SetWindowTextA');
  emit(0x5f,0x5e,0x5b,0x5d,0xc2,0x04,0);
  assert(code.length < 0x200);Buffer.from(code).copy(bytes, raw(0x2a00));
  const old = Buffer.from([0xff,0x15,...u32(base+apis.UpdateWindow)]);
  let count = 0;
  for (let at = raw(0x2000); at < raw(0x2600); at++) if (bytes.subarray(at,at+6).equals(old)) {
    bytes[at]=0xe8;bytes.writeInt32LE(raw(0x2a00)-at-5,at+1);bytes[at+5]=0x90;count++;
  }
  assert.equal(count,1);return bytes;
}
async function readPublishedPixels(evaluate) {
  return evaluate(`(()=>{
    const wine=globalThis.__freshAttestationFixtureOwner,r=wine?.renderer;
    if(!r)throw Error('missing authored renderer');
    const win=Object.values(r.windows).find(w=>/Native input binding fixture/.test(w.title));
    if(!win||!win.visible||!win.clientRect)throw Error('missing visible authored main');
    const x=win.clientRect.x+${SWATCH.x},y=win.clientRect.y+${SWATCH.y};
    const color=(ctx,px,py)=>ctx?Array.from(ctx.getImageData(px,py,1,1).data):null;
    const outputs=[r.canvas,r.presentationCanvas].filter(Boolean).map(canvas=>{
      const css=getComputedStyle(canvas),bounds=canvas.getBoundingClientRect();
      const px=Math.floor(x*canvas.width/r.canvas.width),py=Math.floor(y*canvas.height/r.canvas.height);
      return {width:canvas.width,height:canvas.height,display:css.display,visibility:css.visibility,
        opacity:css.opacity,bounds:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},
        pixel:color(canvas.getContext('2d'),px,py),sample:{x:px,y:py},
        screenshot:{x:Math.floor(bounds.x+px*bounds.width/canvas.width),
          y:Math.floor(bounds.y+py*bounds.height/canvas.height)}};
    });
    return {title:win.title,hwnd:win.hwnd,processId:win.processId,visible:win.visible,
      clientRect:win.clientRect,position:{x:win.x,y:win.y},literal:${JSON.stringify(SWATCH)},
      backing:{width:win._backCanvas?.width,height:win._backCanvas?.height,
        contextOwnsCanvas:win._backCtx?.canvas===win._backCanvas,canonicalOwnSurface:win._canonicalOwnSurface,
        clientPainted:win.clientPainted,gdiWriteSeq:win._gdiWriteSeq,
        pixel:color(win._backCtx,x-win.x,y-win.y)},
      logical:{width:r.canvas.width,height:r.canvas.height,pixel:color(r.ctx,x,y)},
      publication:{scheduled:r._repaintScheduled,workerSliceDepth:r._workerGuestSliceDepth,
        workerPaintDepth:r._workerGdiPaintDepth,deferred:r._workerRepaintDeferred,
        lastCompositeAt:r._workerLastCompositeAt},
      outputs,dpr:devicePixelRatio,physicalUp:!Object.values(r._physicalKeys||{}).some(Boolean)};
  })()`);
}
function verifyPublishedPixels(bytes, witness) {
  assert(witness.physicalUp && witness.visible && witness.backing.contextOwnsCanvas);
  assert.equal(witness.dpr,1,'literal fixture capture uses DPR 1');
  assert.equal(witness.title.match(/PIXEL=([A-F0-9]{8})/)?.[1],'0035A7E1','actual public native GetPixel COLORREF');
  const rgb=SWATCH.rgb;
  assert.deepEqual(witness.backing.pixel,[...rgb,255],'literal native backing pixel');
  assert.deepEqual(witness.logical.pixel,[...rgb,255],'literal composed logical pixel');
  const displayed=witness.outputs.filter(o=>o.display!=='none'&&o.visibility==='visible'&&Number(o.opacity)>0&&o.bounds.width>0);
  assert.equal(displayed.length,1,'one visible display owner');
  assert.deepEqual(displayed[0].pixel,[...rgb,255],'literal published display pixel');
  const proof=literalSamples(bytes,[{...displayed[0].screenshot,rgb,meaning:'native public GetPixel swatch in raw full screenshot'}]);
  return {...proof,nativePublicGetPixel:'0035A7E1',physicalUp:true,hwnd:witness.hwnd,processId:witness.processId};
}
async function browserFixture(out, mode, options = {}) {
  const previous=require('./test-gta2-fresh-attestation-prearm.cjs');
  assert.equal(previous.FIXTURE_WITNESS_VERSION,1,'current native harness must consume literal witness hooks');
  return previous.browserFixture(out,mode,{...options,fixtureFactory:authoredPE,
    extraPins:['test/test-gta2-current-scene-prearm.cjs'],
    captureWitness:async({label,png,evaluate,record})=>{
      if(label!=='first-modal')return;
      const witness=await readPublishedPixels(evaluate);
      record(label+'-pixel-witness.json',witness);
      record(label+'-pixels.json',{witness,proof:verifyPublishedPixels(png,witness)});
    }});
}
function pixelModels() {
  const chunk = (type, body) => {
    const name = Buffer.from(type), header = Buffer.alloc(4), crc = Buffer.alloc(4);
    header.writeUInt32BE(body.length);crc.writeUInt32BE(crc32(Buffer.concat([name,body])));
    return Buffer.concat([header,name,body,crc]);
  };
  const expected = Buffer.from([225,167,53, 3,25,250, 8,17,28, 242,4,116]);
  let controlPNG;
  for (let filter = 0; filter <= 4; filter++) {
    const packed = [];
    for (let y = 0; y < 2; y++) {
      packed.push(filter);
      for (let x = 0; x < 6; x++) {
        const a=x>=3?expected[y*6+x-3]:0,b=y?expected[x]:0,c=y&&x>=3?expected[x-3]:0;
        const p=a+b-c, da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
        const pred=[0,a,b,Math.floor((a+b)/2),da<=db&&da<=dc?a:db<=dc?b:c][filter];
        packed.push((expected[y*6+x]-pred)&255);
      }
    }
    const header=Buffer.alloc(13);header.writeUInt32BE(2);header.writeUInt32BE(2,4);header[8]=8;header[9]=2;
    const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),
      chunk('IDAT',zlib.deflateSync(Buffer.from(packed))),chunk('IEND',Buffer.alloc(0))]);
    assert(decodePNG(png).pixels.equals(expected));
    controlPNG=png;
    const bad=Buffer.from(png);bad[bad.length-1]^=1;assert.throws(()=>decodePNG(bad),/CRC/);
    assert.throws(()=>literalSamples(png,[{x:0,y:0,rgb:[0,0,0],meaning:'altered literal'}]));
  }
  const witness={physicalUp:true,visible:true,dpr:1,title:'PIXEL=0035A7E1',hwnd:1,processId:2,
    backing:{contextOwnsCanvas:true,pixel:[...SWATCH.rgb,255]},logical:{pixel:[...SWATCH.rgb,255]},
    outputs:[{display:'block',visibility:'visible',opacity:'1',bounds:{width:2},
      pixel:[...SWATCH.rgb,255],screenshot:{x:0,y:0}}]};
  verifyPublishedPixels(controlPNG,witness);
  const mutations=[
    s=>s.physicalUp=false,s=>s.visible=false,s=>s.dpr=2,s=>s.title='PIXEL=FFFFFFFF',
    s=>s.backing.contextOwnsCanvas=false,s=>s.backing.pixel=[0,0,0,255],
    s=>s.logical.pixel=[0,0,0,255],s=>s.outputs[0].pixel=[0,0,0,255],
    s=>s.outputs[0].display='none',s=>s.outputs[0].opacity='0',
    s=>s.outputs.push(structuredClone(s.outputs[0])),s=>s.outputs[0].screenshot={x:1,y:1},
  ];
  for(const mutate of mutations){const changed=structuredClone(witness);mutate(changed);
    assert.throws(()=>verifyPublishedPixels(controlPNG,changed));}
  return {cases:28,status:'PASS',scope:'Independent authored PNG decoder/publication controls only; no native qualification'};
}
async function preinitControls(out) {
  const path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
  assert(path.isAbsolute(out));fs.mkdirSync(out,{recursive:false});
  const controller=require('../tools/gta2-paired-controller.cjs');
  const root=path.resolve(__dirname,'..'),server=http.createServer(),sockets=new Set();let bytesAfterUpgrade=0;
  server.on('upgrade',(request,socket)=>{
    sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
    const accept=crypto.createHash('sha1').update(request.headers['sec-websocket-key']+
      '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
    // Only a close control frame is allowed: initialization performs no CDP
    // observation, attachment, module recovery or input request.
    socket.on('data',body=>{if((body[0]&15)===8)socket.end(Buffer.from([0x88,0]));else bytesAfterUpgrade+=body.length;});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8');
  const startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],results=[];
  try {
    for(const kind of ['parent-eof','changed-source-pin','changed-pid-start','initialization-deadline']){
      const dir=path.join(out,kind);fs.mkdirSync(dir);const operationStartedAt=Date.now();
      const setup={name:'probe',operationStartedAt,pid:process.pid,startToken,
        url:'ws://127.0.0.1:'+server.address().port};
      fs.writeFileSync(dir+'/setup.json',JSON.stringify(setup));
      const child=cp.spawn(process.execPath,[path.join(root,'tools/gta2-paired-controller.cjs'),
        'release-preinit',dir,dir+'/setup.json'],{stdio:['pipe','pipe','pipe']});
      fs.writeFileSync(dir+'/pid.json',JSON.stringify({pid:child.pid}));
      let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
      child.stdin.on('error',()=>{});
      const joined=new Promise(resolve=>child.once('close',(exit,signal)=>resolve({pid:child.pid,exit,signal})));
      const deadline=Date.now()+1500;
      while(!stdout.includes('\n')){assert(Date.now()<deadline,'bounded initialization receipt');await new Promise(r=>setTimeout(r,5));}
      const ready=JSON.parse(stdout.split('\n')[0]);assert.equal(ready.state,'INITIALIZED');
      assert.equal(ready.loadedFromExactBytes,true);assert.equal(ready.pid,child.pid);
      for(const item of ready.loadedSources)assert.equal(item.sha256,sha(fs.readFileSync(path.join(root,item.path))));
      assert.equal(ready.loadedSources.length,2);
      assert.equal(ready.nativeObservationsCached,false);assert.equal(ready.sourceInventoriesCached,false);assert.equal(ready.moduleBytesCached,false);
      if(kind==='parent-eof')child.stdin.end();
      else if(kind!=='initialization-deadline'){
        const config={...setup,keys:['Enter'],mode:'native',startedAt:Date.now(),
          pins:{files:ready.loadedSources.map(row=>({...row}))}};
        if(kind==='changed-source-pin')config.pins.files[0].sha256='0'.repeat(64);
        else config.startToken='replaced-process-start';
        fs.writeFileSync(dir+'/config.json',JSON.stringify(config));
        child.stdin.write(JSON.stringify({file:dir+'/config.json'})+'\n');
      }
      let killed=false;const timer=setTimeout(()=>{killed=true;child.kill('SIGKILL');},4500);
      const waited=await joined;clearTimeout(timer);
      fs.writeFileSync(dir+'/wait.json',JSON.stringify({...waited,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr}));
      assert(!killed,'bounded actual preinitialization closure');
      assert.equal(waited.exit,1,stderr);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
      if(kind==='initialization-deadline')assert(stderr.includes('initialization exceeded aggregate 3000ms'));
      if(kind==='changed-source-pin')assert(stderr.includes('initialized executed helper source changed'));
      if(kind==='changed-pid-start')assert(stderr.includes('process start identity changed'));
      assert(!fs.existsSync(dir+'/probe-attestation.json'));assert(!fs.existsSync(dir+'/probe-up.json'));
      const receipt={...waited,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout,stderr,
        aggregateMs:Date.now()-operationStartedAt};
      fs.writeFileSync(dir+'/wait.json',JSON.stringify(receipt));results.push({kind,exit:waited.exit,aggregateMs:receipt.aggregateMs});
    }
    assert.equal(bytesAfterUpgrade,0,'zero CDP observations or physical requests in initialization/refusals');
    return {status:'PASS',results,actualNativeQualification:false,bytesAfterUpgrade};
  } finally {for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
}
if (require.main === module) {
  if (process.argv[2] === '--pixels') console.log(JSON.stringify(historicalPixels(process.argv[3]),null,2));
  else if (process.argv[2] === '--pixel-models') console.log(JSON.stringify(pixelModels()));
  else if(process.argv[2]==='--preinit-controls')preinitControls(process.argv[3]).then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1;});
  else if(process.argv[2]==='--browser')browserFixture(process.argv[3],process.argv[4],{
    dlls:process.argv.includes('--dlls'),prepareDebugger:process.argv.includes('--prepare-debugger'),
    tamperSource:process.argv.includes('--tamper-source')}).catch(error=>{console.error(error);process.exitCode=1;});
  else throw Error('Explicit mode required');
}
module.exports={decodePNG,literalSamples,historicalPixels,authoredPE,SWATCH,pixelModels,
  readPublishedPixels,verifyPublishedPixels,browserFixture,preinitControls};
