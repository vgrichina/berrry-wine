'use strict';
// Newly authored input derived from the existing public-COM native fixture.
// Only the fixture uses Sleep before window creation and a native GetPixel oracle.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
function prepare(out, active = false){
  fs.mkdirSync(out,{recursive:true});
  let source=require('../test/test-revolt-software-capture-latency-cause.cjs').fixtureSource(1);
  source=source.replace(' P hwnd=CreateWindowExA',' Sleep(1500);\n P hwnd=CreateWindowExA')
    .replace('AUTHORED software capture latency fixture','AUTHORED Boids harness native public COM')
    .replace('if(!tid&&GetTickCount()-started>=3000){if(!CreateThread(0,0,auxiliary,0,0,&tid))ExitProcess(29);}','')
    .replace('if(GetAsyncKeyState(27)&0x8000){OutputDebugStringA("LATENCY fixture native Quit");ExitProcess(0);}Sleep(10);',active ? 'Sleep(10);' : 'for(;;)Sleep(100);');
  // Use the existing supported Device7 public ABI. Device3's legacy vertex
  // selector in the seed is a software-only path and cannot qualify GPU geometry.
  source=source.replace('0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000','0xf5049e77,0x11d24861,0xa00007a4,0xa82906c9')
    .replace('0xaa001681,0xb78a4700','0x00006f81,0x6e1520c0')
    .replace('C4(d3d,8,hal,target,&device,0)','C3(d3d,4,hal,target,&device)')
    .replace('check(C2(d3d,6,&vp,0),17);check(C1(device,5,vp),18);','')
    .replace('U viewport[11]={44,0,0,320,240};viewport[5]=bits(160);viewport[6]=bits(120);viewport[7]=bits(160);viewport[8]=bits(120);viewport[10]=bits(1);','U viewport[6]={0,0,320,240,0,0x3f800000};')
    .replace('check(C1(vp,5,viewport),19);check(C1(device,12,vp),20);','check(C1(device,13,viewport),19);')
    .replaceAll('C2(device,22,','C2(device,20,').replaceAll('C3(device,40,','C3(device,37,')
    .replace('C0(device,9)','C0(device,5)').replace('C0(device,10)','C0(device,6)')
    .replace('C5(device,28,','C5(device,25,')
    .replace('i==1?640:-320','i==1?1280:-320').replace('i==2?480:-240','i==2?960:-240');
  const imports={kernel32:['ExitProcess@4','Sleep@4','OutputDebugStringA@4','GetTickCount@0'],user32:['CreateWindowExA@48','SetFocus@4','SetForegroundWindow@4','SetWindowTextA@8'],gdi32:['GetPixel@12'],ddraw:['DirectDrawCreateEx@16']};
  for(const [dll,names]of Object.entries(imports)){
    fs.writeFileSync(path.join(out,dll+'.def'),'LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n',{flag:'wx'});
    cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
  }
  fs.writeFileSync(path.join(out,'fixture.c'),source,{flag:'wx'});
  cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',path.join(out,'fixture.c'),'-o',path.join(out,'fixture.obj')]);
  cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp','-o',path.join(out,'fixture.exe'),path.join(out,'fixture.obj'),...Object.keys(imports).map(n=>path.join(out,n+'.lib'))]);
  const b=fs.readFileSync(path.join(out,'fixture.exe'));
  fs.writeFileSync(path.join(out,'reference.json'),JSON.stringify({sha256:crypto.createHash('sha256').update(b).digest('hex'),expectedRGB:[51,68,204],nativeGetPixel:0xcc4433,delayedWindowMs:1500,publicCOM:true,active,original:false},null,2));
}
function qualify(snapshot,mode){
  const assert=require('node:assert/strict'),m=snapshot.metadata,v=m.presentationViewport;
  assert.equal(snapshot.identity.guestWorker,mode==='worker');assert(snapshot.identity.title.includes('GetPixel PASS 0xcc4433'));
  assert.equal(m.captureOwner.hwnd,snapshot.identity.hwnd);assert.equal(m.captureOwner.processId,snapshot.identity.processId);
  assert(v&&v.cropX===0&&v.cropY===0&&v.cropW===1280&&v.cropH===960,'complete authored native window');
  const proof={nativeGetPixel:0xcc4433,expectedRGB:[51,68,204],nativePrimaryExtent:[640,480],pixels:{}};
  for(const k of ['source','output']){
    const b=Buffer.from(snapshot[k],'base64'),{width,height}=m[k];assert.equal(b.length,width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      // Literal native primary size is authored above, independent of observed pixels.
      // Output coordinates come from the public complete-display viewport.
      const inside=k==='source'?x<640&&y<480:x>=v.dstX&&x<v.dstX+v.dstW&&y>=v.dstY&&y<v.dstY+v.dstH&&Math.floor((x+.5-v.dstX)*v.cropW/v.dstW)<640&&Math.floor((y+.5-v.dstY)*v.cropH/v.dstH)<480;
      const expected=inside?[51,68,204,255]:[0,0,0,k==='source'?0:255],at=(y*width+x)*4;
      if(expected.some((n,i)=>b[at+i]!==n))throw Error('literal full-frame oracle mismatch '+k+' '+x+','+y+' actual '+[...b.subarray(at,at+4)]+' expected '+expected);
    }
    proof.pixels[k]=width*height;
  }
  return proof;
}
module.exports={prepare,qualify};
if(require.main===module)prepare(path.resolve(process.argv[2]),process.argv[3]==='active');
