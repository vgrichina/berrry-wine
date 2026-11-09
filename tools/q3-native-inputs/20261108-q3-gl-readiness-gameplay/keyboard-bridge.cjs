'use strict';
// Ordinary CDP keyboard events for a canvas app whose input is keypress based.
exports.type=async(send,session,text)=>{if(!/^[A-Z]{1,12}$/.test(text))throw Error('bounded uppercase name');for(const ch of text){const key=ch,code='Key'+ch,windowsVirtualKeyCode=ch.charCodeAt(0);await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,text:ch,unmodifiedText:ch},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},session);}};
// Typing is admitted only by browser-run.cjs; no side-channel CLI.
