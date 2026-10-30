#!/usr/bin/env node
'use strict';
// Execute the production decimal parser and cdecl handlers. Lua 4 checks
// *endptr == '\0' after strtod, so a numeric return alone is insufficient.
const assert = require('assert'), fs = require('fs'), path = require('path');
const { compile } = require('../tools/watx');
const source = fs.readFileSync(process.env.CRT_STRTOD_SOURCE || path.join(__dirname, '../src/09a6-handlers-crt.wat'), 'utf8');
function fn(name) {
  const start = source.indexOf(`(func $${name} `); assert(start >= 0, name);
  let depth = 0, result = '';
  for (const line of source.slice(start).split('\n')) {
    for (const c of line.replace(/;;.*/, '') + '\n') {
      result += c;
      if (c === '(') depth++;
      if (c === ')' && --depth === 0) return result;
    }
  }
  throw Error('unterminated '+name);
}
const names=['crt_digit_value','crt_is_space','crt_strtod_simple','handle_strtod','handle_atof'];
if (source.includes('(func $crt_strtod_parse ')) names.push('crt_strtod_parse');
const built=compile(`
(memory 1) (export "memory" (memory 0))
(global $reg_base i32 (i32.const 256))
(global $fp (mut f64) (f64.const 99))
(func $g2w (param $p i32) (result i32) (i32.add (local.get $p) (i32.const 4096)))
(func $gs32 (param $p i32) (param $v i32) (i32.store (call $g2w (local.get $p)) (local.get $v)))
(func $fpu_push (param $v f64) (global.set $fp (local.get $v)))
(func (export "value") (result f64) (global.get $fp))
${names.map(fn).join('\n')}
(export "strtod" (func $handle_strtod))
(export "atof" (func $handle_atof))`,new Map(),{mode:'production'});
assert(built.success,built.error);
const e=new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary)).exports;
const bytes=new Uint8Array(e.memory.buffer),v=new DataView(e.memory.buffer);
function check(text,value,consumed,endptr=true,method='strtod') {
  bytes.fill(0x5a); bytes.set(Buffer.from(text+'\0'),4096+1024);
  v.setUint32(272,8192,true); v.setUint32(4096+2048,0xabcdef01,true);
  const before=bytes.slice();
  e[method](1024,endptr?2048:0,0,0,0,0);
  const actual=e.value();
  assert(Math.abs(actual-value)<=Math.max(1e-15,Math.abs(value)*1e-14),`${text}: numeric result ${actual}`);
  if (Object.is(value,-0)) assert(Object.is(actual,-0),'negative zero');
  if(endptr) {
    assert.equal(v.getUint32(4096+2048,true),1024+consumed,`${text}: consumed end pointer`);
    // This is the original Lua lexer's distinguishing acceptance boundary.
    if(consumed===text.length) assert.equal(bytes[4096+v.getUint32(4096+2048,true)],0,'Lua accepts complete numeric token');
  }
  assert.equal(v.getUint32(272,true),8196,'cdecl pops return address only');
  const after=bytes.slice(); after.set(before.slice(272,276),272);
  if(endptr) after.set(before.slice(4096+2048,4096+2052),4096+2048);
  assert.deepEqual(after,before,'input, registers, stack and neighboring bytes unchanged');
}
check('1',1,1); check('0.05',0.05,4); // exact original GLTron tokens
check(' \t-12.5e+2tail',-1250,10); check('.5x',.5,2); check('1.',1,2);
check('2E-3!',.002,4); check('1e+',1,1); check('1e',1,1);
check('',0,0); check('  -x',0,0); check(' .',0,0); check('-.',0,0);
check('-0',-0,2); check('42',42,2,false); check('3.25',3.25,4,false,'atof');
console.log('PASS production strtod: original Lua numeric tokens, consumed guest endptr, partial exponent, no conversion, NULL endptr, atof, cdecl and memory preservation');
