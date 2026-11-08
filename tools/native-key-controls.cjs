'use strict';
// Shared by ordinary CDP request admission and the independently released hold
// executor. Keep their accepted keys and physical event encoding in one place.
const assert = require('node:assert/strict');
const virtualKeys = Object.freeze({
  Backspace:8, '0':48, ArrowLeft:37, ArrowUp:38, ArrowRight:39, ArrowDown:40,
  Alt:18, Control:17, Space:32, Escape:27, Enter:13, Tab:9,
  a:65, p:80, ',':188, '.':190,
});
const codes = Object.freeze({
  '0':'Digit0', Alt:'AltLeft', Control:'ControlLeft', Space:'Space',
  a:'KeyA', p:'KeyP', ',':'Comma', '.':'Period',
});
function validate(key, holdMs) {
  assert(Object.hasOwn(virtualKeys,key), 'unsupported ordinary key');
  assert(Number.isInteger(holdMs) && holdMs>=50 && holdMs<=2000,
    'bounded physical hold');
}
function validateCombo(keys, holdMs) {
  assert(Array.isArray(keys) && keys.length===2 && keys[0]==='a' &&
    ['Control','Space'].includes(keys[1]), 'ordinary throttle plus one steering key');
  for (const key of keys) validate(key,holdMs);
}
function validateHold(keys, holdMs) {
  assert(Array.isArray(keys), 'ordinary keys required');
  if (keys.length===1) validate(keys[0],holdMs);
  else validateCombo(keys,holdMs);
}
function eventForKey(key) {
  assert(Object.hasOwn(virtualKeys,key), 'unsupported ordinary key');
  return {key:key==='Space'?' ':key, code:codes[key]||key,
    windowsVirtualKeyCode:virtualKeys[key]};
}
module.exports = {validate, validateCombo, validateHold, eventForKey};
