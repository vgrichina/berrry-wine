'use strict';
// Ordinary PE control: a pre-main NULL-owner MessageBox followed by a real
// RegisterClass/CreateWindowEx/ShowWindow path, without host focus injection.
function fixture({show=5, style=0x00ca0000, delay=500}={}) {
 const b=require('../test/test-sims-child-mount-native.cjs').untitledModal();
 const raw=r=>r-0x1000+0x200, u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 let at=0x1b00;
 b.writeUInt32LE(0x1c00,raw(0x1904));b.write('GetTickCount\0',raw(0x1c02));
 for(const [i,n] of ['RegisterClassA','DefWindowProcA','CreateWindowExA','MessageBoxA','ShowWindow','GetFocus','PeekMessageA','TranslateMessage','DispatchMessageA'].entries()){
  b.writeUInt32LE(at,raw(0x1940+i*4));b.write(n+'\0',raw(at+2));at+=n.length+3;
 }
 b.writeUInt32LE(0,raw(0x1964));
 b.write('Authored retired-modal focus\0',raw(0x2540));
 b.write('First NULL-owner warning before main.\0',raw(0x2580));
 b.write('Authored main after warning\0',raw(0x2700));
 b.write('STALE GetFocus after retired modal\0',raw(0x2740));
 const code=[],emit=(...a)=>code.push(...a),push=n=>emit(0x68,...u(n)),call=i=>emit(0xff,0x15,...u(0x401940+i*4));
 for(const n of [0x30,0x402540,0x402580,0])push(n);call(3);
 call(5);emit(0xa3,...u(0x402800),0xbf,...u(0x402700),0x85,0xc0,0x74,5,0xbf,...u(0x402740));
 if(delay){
  const tick=()=>emit(0xff,0x15,...u(0x401904));tick();emit(0x89,0xc3);const loop=code.length;
  tick();emit(0x29,0xd8,0x3d,...u(delay),0x72,0);code[code.length-1]=(loop-code.length)&255;
 }
 // A normal guest WNDPROC delegates to the imported DefWindowProc.
 emit(0xb8,...u(0x402900),0xa3,...u(0x402604));push(0x402600);call(0);
 for(const n of [0,0x400000,0,0,360,640,100,80,style])push(n);emit(0x57);push(0x402500);push(0);call(2);emit(0x89,0xc6);
 push(show);emit(0x56);call(4);call(5);emit(0xa3,...u(0x402804));
 const loop=code.length;for(const n of [1,0,0,0,0x402840])push(n);call(6);
 emit(0x85,0xc0,0x74,0);const idle=code.length-1;
 push(0x402840);call(7);push(0x402840);call(8);
 emit(0xe9,...u(loop-(code.length+5)));code[idle]=(code.length-idle-1)&255;
 emit(0xe9,...u(loop-(code.length+5)));
 b.fill(0,raw(0x2000),raw(0x2500));b.set(code,raw(0x2000));
 // Tail-call USER with the original callback frame and stdcall return slot.
 b.set([0xff,0x25,...u(0x401944)],raw(0x2900));return b;
}
module.exports={fixture};
