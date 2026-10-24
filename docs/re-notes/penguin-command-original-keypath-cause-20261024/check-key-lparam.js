'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const crypto = require('crypto');
const source = fs.readFileSync(__dirname + '/5691793a-lib_renderer-input.js-37-126.txt', 'utf8');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'), 'dd8b8a1ad7681f63ba12a1b3e81dbf908aca13b2ed9ef5181b489e2358a6902a');
const ctx = vm.createContext({});
vm.runInContext(source, ctx, {timeout: 1000});
const cases = [
 ['A numeric down',0x41,undefined,false,false,0x001e0001],
 ['A numeric up',0x41,undefined,true,true,0xc01e0001],
 ['A physical down',0x41,{code:'KeyA'},false,false,0x001e0001],
 ['A repeat',0x41,{repeat:true},false,true,0x401e0001],
 ['S numeric down',0x53,undefined,false,false,0x001f0001],
 ['D numeric down',0x44,undefined,false,false,0x00200001],
 ['Left control down',0x25,undefined,false,false,0x014b0001],
 ['Left control up',0x25,undefined,true,true,0xc14b0001],
];
for (const [label,vk,info,up,previous,expected] of cases) {
 const actual = ctx.keyboardMessageLParam(vk,info,up,previous);
 assert.equal(actual,expected,label);
 console.log(`${label}: 0x${actual.toString(16)} PASS`);
}
console.log('8 production-source cases PASS; source-only JS, no SDL/guest/VM qualification');
