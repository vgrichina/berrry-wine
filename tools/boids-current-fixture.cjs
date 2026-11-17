'use strict';
// Newly authored input derived from the existing public-COM native fixture.
// Only the fixture uses Sleep before window creation and a native GetPixel oracle.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
function prepare(out, active = false, flip = false, device2 = false){
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
  if(flip){
    source=source.replace('C2(dd,20,hwnd,8)','C2(dd,20,hwnd,17)')
      .replace('U desc[31]={124,1};desc[26]=0x200;', 'check(C5(dd,21,640,480,32,0,0),40);U desc[31]={124,0x21};desc[5]=1;desc[26]=0x218;')
      .replace(/for\(U i=0;i<31;i\+\+\)desc\[i\]=0;[\s\S]*?check\(C3\(dd,6,desc,&target,0\),15\);/, 'U caps[4]={4};check(C2(primary,12,caps,&target),15);')
      .replace('C5(primary,5,0,target,0,0x1000000,0)','C2(primary,11,target,1)')
      .replace(/if\(!checked\)\{[\s\S]*?checked=1;\}/,'if(!checked){SetWindowTextA(hwnd,"AUTHORED native COM FLIP geometry");checked=1;}');
    if(flip==='black')source=source.replace('v[i*8+4]=0xff3344cc','v[i*8+4]=0xff000000');
  }
  if(device2)source=device2Source(device2);
  const imports={kernel32:['ExitProcess@4','Sleep@4','OutputDebugStringA@4','GetTickCount@0'],user32:['CreateWindowExA@48','SetFocus@4','SetForegroundWindow@4','SetWindowTextA@8'],gdi32:['GetPixel@12'],ddraw:['DirectDrawCreateEx@16']};
  if(device2){imports.user32.push('GetDC@4','ReleaseDC@8');imports.gdi32.push('TextOutA@20');}
  for(const [dll,names]of Object.entries(imports)){
    fs.writeFileSync(path.join(out,dll+'.def'),'LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n',{flag:'wx'});
    cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
  }
  fs.writeFileSync(path.join(out,'fixture.c'),source,{flag:'wx'});
  cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',path.join(out,'fixture.c'),'-o',path.join(out,'fixture.obj')]);
  cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp','-o',path.join(out,'fixture.exe'),path.join(out,'fixture.obj'),...Object.keys(imports).map(n=>path.join(out,n+'.lib'))]);
  const b=fs.readFileSync(path.join(out,'fixture.exe'));
  fs.writeFileSync(path.join(out,'reference.json'),JSON.stringify({sha256:crypto.createHash('sha256').update(b).digest('hex'),expectedRGB:device2?[0,0,device2==='black'?0:255]:[51,68,204],nativeGetPixel:device2?null:0xcc4433,delayedWindowMs:device2?0:1500,publicCOM:device2?'Device2':'Device7',device2:device2||null,active,original:false},null,2));
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
function qualifyFlip(snapshot,black=false){
  const assert=require('node:assert/strict'),m=snapshot.metadata;
  assert(snapshot.identity.guestWorker);assert(snapshot.identity.title.includes('native COM FLIP geometry'));
  assert.equal(snapshot.identity.bridgeDevice.stats.backend,'webgl1');
  assert(snapshot.identity.bridgeDevice.stats.draws>0);assert(snapshot.identity.bridgeDevice.stats.presents>0);
  assert.equal(m.source.width,640);assert.equal(m.source.height,480);
  const b=Buffer.from(snapshot.source,'base64');assert.equal(b.length,640*480*4);
  for(let y=0;y<480;y++)for(let x=0;x<640;x++){
    const expected=!black&&x<320&&y<240?[51,68,204,255]:[0,0,0,255],at=(y*640+x)*4;
    assert.deepEqual([...b.subarray(at,at+4)],expected,`native Flip pixel ${x},${y}`);
  }
  return {passed:true,black,sourcePixels:640*480,visibleGeometry:!black,actualBackend:'webgl1',publicCOM:true};
}
// Actual Device2 ABI, RGB565 flip chain, attached D16, SetViewport2 and
// indexed legacy LVERTEX geometry. Literal rectangle oracle is independent
// of the executor. Zero-alpha diffuse is intentional; blending is disabled.
function device2Source(color='blue'){
  let s=require('../test/test-revolt-software-capture-latency-cause.cjs').fixtureSource(1);
  s=s.replace('0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000','0x6aae1ec1,0x11d0662a,0xaa009d88,0x6ab7bb00')
    .replace('C4(d3d,8,hal,target,&device,0)','C3(d3d,8,hal,target,&device)')
    .replace('C2(dd,20,hwnd,8)','C2(dd,20,hwnd,17)')
    .replace('U desc[31]={124,1};desc[26]=0x200;','check(C5(dd,21,640,480,16,0,0),40);U desc[31]={124,0x21};desc[5]=1;desc[26]=0x218;')
    .replace(/for\(U i=0;i<31;i\+\+\)desc\[i\]=0;[\s\S]*?check\(C3\(dd,6,desc,&target,0\),15\);/,'U caps[4]={4};check(C2(primary,12,caps,&target),15);P depth=0;U zd[31]={124,0x47};zd[2]=480;zd[3]=640;zd[6]=16;zd[26]=0x24000;check(C3(dd,6,zd,&depth,0),41);check(C1(target,3,depth),42);')
    .replace('U viewport[11]={44,0,0,320,240};viewport[5]=bits(160);viewport[6]=bits(120);viewport[7]=bits(160);viewport[8]=bits(120);viewport[10]=bits(1);','U viewport[11]={44,0,0,640,480};viewport[5]=bits(-1);viewport[6]=bits(.75f);viewport[7]=bits(2);viewport[8]=bits(1.5f);viewport[10]=bits(1);')
    .replace('C1(vp,5,viewport)','C1(vp,17,viewport)')
    .replace('C1(device,5,vp)','C1(device,6,vp)').replace('C1(device,12,vp)','C1(device,13,vp)')
    .replace('C2(device,22,','C2(device,23,')
    .replace('U rs[6]={7,14,22,26,27,137},rv[6]={0,0,1,0,0,0};','U rs[6]={7,14,22,26,27,137},rv[6]={1,1,1,0,0,0};')
    .replace(/ check\(C3\(device,40,[\s\S]*?U started=GetTickCount\(\),checked=0;/,`\n U v[32]={0};unsigned short indices[6]={0,1,2,2,1,3};\n for(U i=0;i<4;i++){v[i*8]=bits((i&1)?0:-1);v[i*8+1]=bits((i&2)?0:.75f);v[i*8+2]=bits(.5f);v[i*8+4]=${color==='black'?'0':'0x000000ff'};}\n U rect[4]={0,0,640,480};U started=GetTickCount(),checked=0;`)
    .replace('if(!tid&&GetTickCount()-started>=3000){if(!CreateThread(0,0,auxiliary,0,0,&tid))ExitProcess(29);}','')
    .replace('check(C0(device,9),25);','check(C3(vp,12,1,rect,3),43);check(C0(device,10),25);')
    .replace('C0(device,10),27','C0(device,11),27')
    .replace('check(C5(device,28,4,0x1c4,v,3,0),26)','check(((int(S*)(P,U,U,P,U,P,U,U))(*(P**)device)[30])(device,4,2,v,4,indices,6,1),26)')
    .replace('C5(primary,5,0,target,0,0x1000000,0)','C2(primary,11,target,1)')
    .replace(/if\(!checked\)\{[\s\S]*?checked=1;\}/,'if(!checked){SetWindowTextA(hwnd,"AUTHORED Device2 indexed RGB565 D16");checked=1;}')
    .replace('if(GetAsyncKeyState(27)&0x8000){OutputDebugStringA("LATENCY fixture native Quit");ExitProcess(0);}Sleep(10);','Sleep(10);');
  s=s.replace('void start(void){',String.raw`I P S GetDC(P);I int S ReleaseDC(P,P);I int S TextOutA(P,int,int,char*,int);
static void descriptor(P target){U d[31]={124};check(C1(target,22,d),44);char line[280];U at=0;for(U i=0;i<31;i++){for(int j=7;j>=0;j--){U digit=(d[i]>>(j*4))&15;line[at++]=digit<10?'0'+digit:'a'+digit-10;}line[at++]=' ';}line[at]=0;OutputDebugStringA("DEVICE2 public GetSurfaceDesc");OutputDebugStringA(line);if(d[21]!=16)ExitProcess(45);}
void start(void){`)
    .replace('check(C1(device,13,vp),20);','check(C1(device,13,vp),20);descriptor(target);P dc=GetDC(hwnd);TextOutA(dc,20,20,"INITIAL GDI",11);ReleaseDC(hwnd,dc);');
  return s;
}
function qualifyDevice2(snapshot,black=false){
  const assert=require('node:assert/strict'),m=snapshot.metadata,v=m.presentationViewport;
  assert(snapshot.identity.guestWorker);assert.equal(snapshot.identity.bridgeDevice.stats.backend,'webgl1');
  assert.equal(m.source.width,640);assert.equal(m.source.height,480);
  assert.equal(v.cropW,640);assert.equal(v.cropH,480);assert.equal(v.cropX,0);assert.equal(v.cropY,0);
  const result={passed:true,black,sourcePixels:307200,geometryPixels:76800,actualBackend:'webgl1',zeroDiffuseAlpha:true,publicCOM:'Device2'};
  for(const k of ['source','output']){
    const b=Buffer.from(snapshot[k],'base64'),{width,height}=m[k];assert.equal(b.length,width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const inside=k==='source'||(x>=v.dstX&&x<v.dstX+v.dstW&&y>=v.dstY&&y<v.dstY+v.dstH);
      const sx=k==='source'?x:Math.floor((x+.5-v.dstX)*640/v.dstW),sy=k==='source'?y:Math.floor((y+.5-v.dstY)*480/v.dstH);
      // Stream integer centres become GL half-integer centres. The
      // upper horizontal edge excludes its centre, lower edge includes it.
      const expected=!inside?[0,0,0,255]:sx<320&&sy>=1&&sy<=240?[0,0,black?0:255,255]:[255,255,255,255];
      const at=(y*width+x)*4;if(expected.some((n,i)=>b[at+i]!==n))throw Error(`Device2 literal pixel mismatch ${k} ${x},${y}: ${[...b.subarray(at,at+4)]}`);
    }
    result[k+'Pixels']=width*height;
  }
  return result;
}
module.exports={prepare,qualify,qualifyFlip,device2Source,qualifyDevice2};
if(require.main===module)prepare(path.resolve(process.argv[2]),process.argv[3]==='active',process.argv[4]==='black'?'black':process.argv[4]==='flip');
