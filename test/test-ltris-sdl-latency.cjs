'use strict';
// Authored consumer of the exact original SDL DLL. No original EXE or game
// state. Uses SDL's ordinary WinDIB video, event pump, surface fill and delay.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function fixture(){
 const b=Buffer.alloc(0x6400),base=0x400000,raw=r=>r-0x1000+0x400;
 const w=(o,n)=>b.writeUInt16LE(n,o),d=(o,n)=>b.writeUInt32LE(n>>>0,o),p=0x80,o=p+24,s=o+224;
 w(0,0x5a4d);d(0x3c,p);d(p,0x4550);w(p+4,0x14c);w(p+6,1);w(p+20,224);w(p+22,0x10e);
 w(o,0x10b);d(o+16,0x2000);d(o+28,base);d(o+32,4096);d(o+36,1024);w(o+40,4);w(o+48,4);
 d(o+56,0x7000);d(o+60,1024);w(o+68,2);d(o+72,0x100000);d(o+76,4096);d(o+80,0x100000);d(o+84,4096);d(o+92,16);
 d(o+104,0x1000);d(o+108,60);b.write('.sdl',s);d(s+8,0x6000);d(s+12,0x1000);d(s+16,0x6000);d(s+20,1024);d(s+36,0xe0000060);
 const apis=new Map();let str=0x1600;
 for(const [i,[dll,names]]of [['kernel32.dll',['ExitProcess']],['SDL.dll',['SDL_Init','SDL_SetVideoMode','SDL_WM_SetCaption','SDL_PollEvent','SDL_Delay','SDL_GetMouseState','SDL_FillRect','SDL_Flip','SDL_Quit']]].entries()){
  const desc=raw(0x1000+i*20),thunk=0x1200+i*256;d(desc,thunk+0x200);d(desc+12,str);d(desc+16,thunk);b.write(dll+'\0',raw(str));str+=dll.length+1;
  for(const[j,n]of names.entries()){d(raw(thunk+j*4),str);d(raw(thunk+0x200+j*4),str);b.write(n+'\0',raw(str+2));str+=n.length+3;apis.set(n,base+thunk+j*4);}
 }
 const code=[],labels=new Map(),fix=[],u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 const emit=(...v)=>code.push(...v),push=n=>emit(0x68,...u(n)),ptr=n=>emit(0xff,0x35,...u(base+n));
 const call=(n,args=[])=>{for(const a of args.slice().reverse())typeof a==='string'?ptr(Number(a)):push(a);emit(0xff,0x15,...u(apis.get(n)));if(n!=='ExitProcess'&&args.length)emit(0x83,0xc4,args.length*4);};
 const label=n=>labels.set(n,code.length),jump=(n,cc)=>{emit(...(cc?[0x0f,cc]:[0xe9]));fix.push([code.length,n]);emit(0,0,0,0);};
 b.write('Authored SDL Controls / Player1 / Quit\0',raw(0x3000));
 // Public SDL_Rect {Sint16 x,y; Uint16 w,h}; coordinates match original menu.
 for(const [i,y]of [240,270,300,330].entries()){w(raw(0x3100+i*8),100);w(raw(0x3102+i*8),y);w(raw(0x3104+i*8),200);w(raw(0x3106+i*8),22);}
 for(const[i,color]of [0x18,0x7e0,0xf800].entries())d(raw(0x3180+i*4),color);
 call('SDL_Init',[0x20]);call('SDL_WM_SetCaption',[base+0x3000,0]);call('SDL_SetVideoMode',[640,480,16,0]);emit(0xa3,...u(base+0x3500));jump('paint');
 label('loop');call('SDL_PollEvent',[base+0x3540]);emit(0x85,0xc0);jump('idle',0x84);
 emit(0x80,0x3d,...u(base+0x3540),12);jump('exit',0x84);
 emit(0x80,0x3d,...u(base+0x3540),2);jump('mouse',0x85);
 emit(0x81,0x3d,...u(base+0x3548),27,0,0,0);jump('exit',0x84);jump('loop');
 label('mouse');emit(0x80,0x3d,...u(base+0x3540),4);jump('button',0x85);emit(0x0f,0xb7,0x05,...u(base+0x3546),0xa3,...u(base+0x3508));jump('loop');label('button');emit(0x80,0x3d,...u(base+0x3540),5);jump('loop',0x85);
 // Only the actual SDL button event at the expected public menu position
 // advances the fixture. No host-side state transitions or direct guest calls.
 emit(0x0f,0xb7,0x05,...u(base+0x3546),0x3b,0x05,...u(base+0x3508));jump('loop',0x85); // native SDL hover must arm this button
 emit(0x83,0x3d,...u(base+0x3504),0);jump('player',0x85);
 emit(0x3d,...u(260));jump('loop',0x82);emit(0x3d,...u(290));jump('loop',0x87);jump('advance');
 label('player');emit(0x83,0x3d,...u(base+0x3504),1);jump('exit',0x85);
 emit(0x3d,...u(245));jump('loop',0x82);emit(0x3d,...u(275));jump('loop',0x87);
 label('advance');emit(0xff,0x05,...u(base+0x3504));
 label('paint');call('SDL_GetMouseState',[base+0x3560,base+0x3564]);
 // Distinct full surfaces expose the SDL consumer's consequence in captures.
 emit(0xa1,...u(base+0x3504),0x8b,0x04,0x85,...u(base+0x3180));emit(0x50);push(0);ptr(0x3500);emit(0xff,0x15,...u(apis.get('SDL_FillRect')),0x83,0xc4,12);
 for(let i=0;i<4;i++)call('SDL_FillRect',['0x3500',base+0x3100+i*8,0x7e0]);call('SDL_Flip',['0x3500']);jump('loop');
 label('idle');call('SDL_Delay',[10]);jump('paint');
 label('exit');call('SDL_Quit');call('ExitProcess',[0]);emit(0xcc);
 const out=Buffer.from(code);for(const[at,n]of fix){assert(labels.has(n));out.writeInt32LE(labels.get(n)-at-4,at);}assert(out.length<0x1000);out.copy(b,raw(0x2000));return b;
}
function prepare(){const bytes=fixture(),sha256=crypto.createHash('sha256').update(bytes).digest('hex');const dir=path.join(root,'test/binaries/ltris-parallel-native-20261116');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'sdl-controls-'+sha256.slice(0,12)+'.exe');if(fs.existsSync(file))assert.deepEqual(fs.readFileSync(file),bytes);else fs.writeFileSync(file,bytes,{flag:'wx'});return {file,sha256,size:bytes.length};}
if(require.main===module)console.log(JSON.stringify(prepare()));module.exports={fixture,prepare};
