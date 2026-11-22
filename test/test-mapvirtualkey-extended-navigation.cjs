'use strict';
// Literal US Scan 1 Make / VK identities, independent of implementation tables.
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input#scan-codes
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// Type 3 accepts the E0 prefix in the high byte of uCode:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyw
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexa
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const oracle = [
  [0xe047,0x24,'Home'],
  [0xe048,0x26,'Up'],
  [0xe049,0x21,'PageUp'],
  [0xe04b,0x25,'Left'],
  [0xe04d,0x27,'Right'],
  [0xe04f,0x23,'End'],
  [0xe050,0x28,'Down'],
  [0xe051,0x22,'PageDown'],
  [0xe052,0x2d,'Insert'],
  [0xe053,0x2e,'Delete']
];
// Literal compatibility controls pinned to the published parent. The four
// ordinary arrows retain their legacy VKs; these are not new layout claims.
const ordinaryTwins = [
  [0x47,0x67,'Home'], [0x48,0x26,'Up'], [0x49,0x69,'PageUp'],
  [0x4b,0x25,'Left'], [0x4d,0x27,'Right'], [0x4f,0x61,'End'],
  [0x50,0x28,'Down'], [0x51,0x63,'PageDown'], [0x52,0x60,'Insert'],
  [0x53,0x6e,'Delete'],
];
const source = fs.readFileSync(path.join(root,'src/09a7-handlers-dispatch.wat'),'utf8');
function form(marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0,marker);
  let depth=0,quoted=false,comment=false;
  for (let i=start;i<source.length;i++) {
    const c=source[i];
    if (comment) { if(c==='\n') comment=false; continue; }
    if (quoted) { if(c==='\\') i++; else if(c==='"') quoted=false; continue; }
    if(c===';'&&source[i+1]===';') { comment=true; i++; continue; }
    if(c==='"') { quoted=true; continue; }
    if(c==='(') depth++;
    if(c===')'&&--depth===0) return source.slice(start,i+1);
  }
  assert.fail('unbalanced '+marker);
}
const names=['handle_MapVirtualKeyA','handle_MapVirtualKeyW','handle_MapVirtualKeyExA'];
const fixture=[
  '(memory 1) (export "memory" (memory 0))',
  '(region.declare $VK_SCAN_TABLES (size 128) (align 128))',
  '(region.declare $NAV_REGS (size 32) (align 32))',
  '(global $reg_base i32 (region.addr $NAV_REGS 0))',
  '(export "regs" (global $reg_base))',
  form('(func $vk_to_scan '),
  ...names.map(n=>form('(func $'+n+' ')),
  form('(data (region.addr $VK_SCAN_TABLES 0x00)'),
  form('(data (region.addr $VK_SCAN_TABLES 0x20)'),
  ...names.map(n=>'(export "'+n+'" (func $'+n+'))'),
].join('\n');
const {compile}=require(path.join(root,'tools/watx'));
const compiled=compile(fixture,new Map(),{mode:'production'});
assert.ok(compiled.success,compiled.error);
const api=new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
const regs=new DataView(api.memory.buffer,api.regs.value,32);
const failures=[];
let checks=0;
function check(code,type,expected,label) {
  for(const name of names) {
    for(let r=0;r<8;r++) regs.setUint32(r*4,0x43560000+r,true);
    api[name](code,type,0x04090409,0,0,0);
    const actual=regs.getUint32(0,true);
    if(actual!==expected) failures.push({name,code,type,label,expected,actual});
    assert.equal(regs.getUint32(16,true),0x43560004+(name.endsWith('ExA')?16:12),name+' ESP');
    for(const r of [1,2,3,5,6,7]) assert.equal(regs.getUint32(r*4,true),0x43560000+r,name+' register '+r);
    checks++;
  }
}
for(const [extended,vk,label] of oracle) check(extended,3,vk,label);
for(const [scan,vk,label] of ordinaryTwins) check(scan,3,vk,label+' retained ordinary twin');
for(const [code,vk,label] of [[0x2a,0xa0,'LShift'],[0x36,0xa1,'RShift'],[0x1d,0xa2,'LCtrl'],[0xe01d,0xa3,'RCtrl'],[0x38,0xa4,'LAlt'],[0xe038,0xa5,'RAlt'],[0x1e,0x41,'A'],[0x41,0x76,'F7']]) check(code,3,vk,label+' published control');
// Type4 returns the literal documented E0-prefixed US Scan 1 Make.
for(const [vk,scan] of [
  [0x24,0xe047], [0x26,0xe048], [0x21,0xe049], [0x25,0xe04b], [0x27,0xe04d],
  [0x23,0xe04f], [0x28,0xe050], [0x22,0xe051], [0x2d,0xe052], [0x2e,0xe053],
]) check(vk,4,scan,'documented type4 navigation');
for(const code of [0xe01e,0xe041]) check(code,3,0,'published ordinary prefix negative');
for(const [vk,scan] of [[0x41,0x1e],[0x10,0x2a],[0xa3,0xe01d],[0xa5,0xe038]]) check(vk,4,scan,'published type4 control');
console.log(JSON.stringify({checks,failures}));
assert.deepEqual(failures,[]);

