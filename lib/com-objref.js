'use strict';

// Standard OBJREF bytes, independent of guest address translation. Transport
// must resolve the exported identity in its authenticated endpoint namespace.
const MAX_BINDING_WORDS = 4096;
const error = code => { throw Object.assign(new Error(code), { code }); };
function hex(value, length, nonzero = true) {
  if (typeof value !== 'string' || value.length !== length * 2 || !/^[0-9a-f]+$/.test(value) ||
      (nonzero && /^0+$/.test(value))) error('RPC_E_INVALID_OBJREF');
  return Uint8Array.from(value.match(/../g).map(b=>parseInt(b,16)));
}
const toHex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
function bindings(words, security) {
  if (!(words instanceof Uint16Array) || words.length > MAX_BINDING_WORDS ||
      !Number.isInteger(security) || security < 0 || security > words.length) error('RPC_E_INVALID_OBJREF');
  if (!words.length) {
    if (security) error('RPC_E_INVALID_OBJREF');return;
  }
  if (!security || words[security - 1] || words[words.length - 1]) error('RPC_E_INVALID_OBJREF');
  // The string-binding list and security-binding list each end with a zero
  // tower/authentication id. Check structure without inventing a resolver.
  let at = 0;
  while (at < security && words[at]) {
    at++;
    while (at < security && words[at]) at++;
    if (at >= security) error('RPC_E_INVALID_OBJREF');at++;
  }
  if (at !== security - 1) error('RPC_E_INVALID_OBJREF');
  at = security;
  while (at < words.length && words[at]) {
    at += 2;
    while (at < words.length && words[at]) at++;
    if (at >= words.length) error('RPC_E_INVALID_OBJREF');at++;
  }
  if (at !== words.length - 1) error('RPC_E_INVALID_OBJREF');
}
function encodeStandard(reference, words = new Uint16Array(), security = 0) {
  bindings(words,security);
  if (!reference || !Number.isInteger(reference.publicRefs) || reference.publicRefs < 0 ||
      reference.publicRefs > 0xffffffff) error('RPC_E_INVALID_OBJREF');
  const result = new Uint8Array(68 + words.length * 2), view = new DataView(result.buffer);
  view.setUint32(0,0x574f454d,true);view.setUint32(4,1,true);
  result.set(hex(reference.iid,16),8);
  // Supported exporters do not use handler/custom/extended reference flags.
  view.setUint32(24,0,true);view.setUint32(28,reference.publicRefs,true);
  result.set(hex(reference.oxid,8),32);result.set(hex(reference.oid,8),40);result.set(hex(reference.ipid,16),48);
  view.setUint16(64,words.length,true);view.setUint16(66,security,true);
  for(let i=0;i<words.length;i++)view.setUint16(68+i*2,words[i],true);
  return result;
}
function standardExtent(prefix) {
  if (!(prefix instanceof Uint8Array) || prefix.byteLength < 68) error('STG_E_READFAULT');
  const v=new DataView(prefix.buffer,prefix.byteOffset,prefix.byteLength);
  if (v.getUint32(0,true)!==0x574f454d || v.getUint32(4,true)!==1) error('RPC_E_INVALID_OBJREF');
  const count=v.getUint16(64,true),security=v.getUint16(66,true);
  if(count>MAX_BINDING_WORDS||security>count)error('RPC_E_INVALID_OBJREF');
  return 68+count*2;
}
function decodeStandard(input) {
  const length=standardExtent(input);
  if(input.byteLength<length)error('STG_E_READFAULT');
  if(input.byteLength!==length)error('RPC_E_INVALID_OBJREF');
  const v=new DataView(input.buffer,input.byteOffset,input.byteLength),flags=v.getUint32(24,true);
  // Other formats and standard remoting extensions need their own services;
  // they never fall through to a process-local identity lookup.
  if(flags!==0)error('E_NOTIMPL');
  const count=v.getUint16(64,true),security=v.getUint16(66,true),words=new Uint16Array(count);
  for(let i=0;i<count;i++)words[i]=v.getUint16(68+i*2,true);
  bindings(words,security);
  const result={iid:toHex(input.subarray(8,24)),oxid:toHex(input.subarray(32,40)),
    oid:toHex(input.subarray(40,48)),ipid:toHex(input.subarray(48,64)),publicRefs:v.getUint32(28,true)};
  hex(result.iid,16);hex(result.oxid,8);hex(result.oid,8);hex(result.ipid,16);
  return {reference:Object.freeze(result),bindings:words,security};
}
module.exports={encodeStandard,decodeStandard,standardExtent,MAX_BINDING_WORDS};
