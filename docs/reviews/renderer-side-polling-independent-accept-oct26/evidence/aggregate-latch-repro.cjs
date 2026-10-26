'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {installInputHandlers}=require(require('node:path').resolve('lib/renderer-input.js'));
class Input {constructor(){this.inputQueue=[];this.windows={};this.wasm=null;this.mainWasm=null;}}
installInputHandlers(Input);
for(const [vk,name] of [[16,'Shift'],[17,'Control'],[18,'Alt']]) {
 test(`${name}: strict consumed aggregate press must not rearm on delivery (known unchanged limitation)`,()=>{
  const r=new Input();r.handleKeyDown(vk,{code:name+'Left'});r.handleKeyDown(vk,{code:name+'Right'});
  assert.equal(r.getAsyncKeyState(vk),0x8001);assert.equal(r.getAsyncKeyState(vk),0x8000);
  assert.ok(r.takeInput());
  assert.equal(r.getAsyncKeyState(vk),0x8000,'same physical press already consumed before delivery');
 });
}
