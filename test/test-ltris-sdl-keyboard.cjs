'use strict';
// Authored PE: actual bundled SDL keyboard consumer, never original gameplay.
// Reuse only the SDL fixture's PE/import header; replace its entire program.
const {fixture}=require('./test-ltris-sdl-latency.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
function prepare(){
 const b=fixture(),base=0x400000,raw=r=>r-0x1000+0x400;
 b.fill(0,raw(0x2000),raw(0x3000));b.fill(0,raw(0x3000),raw(0x3100));
 b.write('Authored SDL Keyboard Menu Board Pause Release Quit\0',raw(0x3000));
 const names=['SDL_Init','SDL_SetVideoMode','SDL_WM_SetCaption','SDL_PollEvent','SDL_Delay','SDL_GetMouseState','SDL_FillRect','SDL_Flip','SDL_Quit'];
 const apis=new Map(names.map((n,i)=>[n,base+0x1300+i*4]));apis.set('ExitProcess',base+0x1200);
 const c=[],labels=new Map(),fix=[],u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24],emit=(...v)=>c.push(...v),push=n=>emit(0x68,...u(n));
 const call=(n,args=[])=>{for(const a of args.slice().reverse())typeof a==='string'?emit(0xff,0x35,...u(base+Number(a))):push(a);emit(0xff,0x15,...u(apis.get(n)));if(n!=='ExitProcess'&&args.length)emit(0x83,0xc4,args.length*4);};
 const label=n=>labels.set(n,c.length),jump=(n,cc)=>{emit(...(cc?[0x0f,cc]:[0xe9]));fix.push([c.length,n]);emit(0,0,0,0);};
 const cmp=(r,v)=>emit(0x81,0x3d,...u(base+r),...u(v));
 const set=(r,v)=>emit(0xc7,0x05,...u(base+r),...u(v));
 call('SDL_Init',[0x20]);call('SDL_WM_SetCaption',[base+0x3000,0]);call('SDL_SetVideoMode',[640,480,16,0]);emit(0xa3,...u(base+0x3500));
 label('paint');call('SDL_FillRect',['0x3500',0,'0x3504']);call('SDL_Flip',['0x3500']);
 label('loop');call('SDL_PollEvent',[base+0x3540]);emit(0x85,0xc0);jump('idle',0x84);
 emit(0x80,0x3d,...u(base+0x3540),3);jump('down',0x85);
 // Only a real matching SDL_KEYUP unlocks another keydown.
 emit(0xa1,...u(base+0x3548),0x3b,0x05,...u(base+0x3508));jump('loop',0x85);set(0x3508,0);jump('loop');
 label('down');emit(0x80,0x3d,...u(base+0x3540),2);jump('loop',0x85);cmp(0x3508,0);jump('loop',0x85);
 emit(0xa1,...u(base+0x3548),0xa3,...u(base+0x3508));
 cmp(0x3548,27);jump('exit',0x84);
 cmp(0x3548,13);jump('pause',0x85);cmp(0x3504,0);jump('loop',0x85);set(0x3504,0x7e0);jump('paint');
 label('pause');cmp(0x3548,112);jump('left',0x85);cmp(0x3504,0xf800);jump('resume',0x84);cmp(0x3504,0);jump('loop',0x84);set(0x3504,0xf800);jump('paint');
 label('resume');set(0x3504,0x7e0);jump('paint');
 label('left');cmp(0x3548,276);jump('right',0x85);cmp(0x3504,0x7e0);jump('loop',0x85);set(0x3504,0x1f);jump('paint');
 label('right');cmp(0x3548,275);jump('loop',0x85);cmp(0x3504,0x1f);jump('loop',0x85);set(0x3504,0x7e0);jump('paint');
 label('idle');call('SDL_Delay',[10]);jump('loop');
 label('exit');call('SDL_Quit');call('ExitProcess',[0]);emit(0xcc);
 const code=Buffer.from(c);for(const[at,n]of fix){assert(labels.has(n));code.writeInt32LE(labels.get(n)-at-4,at);}assert(code.length<0x1000);code.copy(b,raw(0x2000));
 const sha256=crypto.createHash('sha256').update(b).digest('hex'),dir=path.join(__dirname,'binaries/ltris-parallel-native-20261116'),file=path.join(dir,'sdl-keyboard-'+sha256.slice(0,12)+'.exe');
 fs.mkdirSync(dir,{recursive:true});if(fs.existsSync(file))assert.deepEqual(fs.readFileSync(file),b);else fs.writeFileSync(file,b,{flag:'wx'});
 return {file,sha256,size:b.length};
}
if(require.main===module)console.log(JSON.stringify(prepare()));module.exports={prepare};
