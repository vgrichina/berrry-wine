'use strict';
const assert=require('node:assert/strict');
const keys={ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Alt:18,Control:17,Space:32,Escape:27,Enter:13,Tab:9, w:87, a:65, p:80, ',':188, '.':190};
exports.validate=(key,ms)=>{assert(Object.hasOwn(keys,key));assert(Number.isInteger(ms)&&ms>=50&&ms<=2000);};
exports.validateCombo=(combo,ms)=>{assert(Array.isArray(combo)&&combo.length===2&&combo[0]==='a'&&['Control','Space'].includes(combo[1]),'ordinary throttle + one steering key');for(const key of combo)exports.validate(key,ms);};
async function held(send,session,combo,ms){
 const attempted=[];let error;
 try{for(const key of combo){const base={key:key==='Space'?' ':key,code:key==='w'?'KeyW':key==='a'?'KeyA':key==='p'?'KeyP':key==='Alt'?'AltLeft':key==='Control'?'ControlLeft':key,windowsVirtualKeyCode:keys[key]};attempted.push(base);await send('Input.dispatchKeyEvent',{type:'keyDown',...base},session);}await new Promise(r=>setTimeout(r,ms));}
 catch(e){error=e;}
 finally{for(const base of attempted.reverse()){try{await send('Input.dispatchKeyEvent',{type:'keyUp',...base},session);}catch(e){error??=e;}}}
 if(error)throw error;
}
exports.hold=async(send,session,key,ms)=>{exports.validate(key,ms);return held(send,session,[key],ms);};
exports.combo=async(send,session,combo,ms)=>{exports.validateCombo(combo,ms);return held(send,session,combo,ms);};
