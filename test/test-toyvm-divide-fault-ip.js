'use strict';
const assert=require('node:assert/strict');
const {decodeOne,setCpuLevel}=require('../tools/toyvm/decode');
const {makeVm}=require('../tools/toyvm/vm');

// Intel 80386 PRM 14.7: #DE saves the faulting instruction, including prefixes.
// The 8086/80186 instead save the following instruction. Exercise the native
// IVT frame and a guest handler that skips the failed divide and IRETs.
async function main(){
 const vm=await makeVm('tailcall');let cases=0;
 for(const cpu of [86,186,286,386])for(const signed of [false,true])for(const width of [8,16,32])for(const memory of [false,true])for(const overflow of [false,true]){
  if(width===32&&cpu<386)continue;
  const bytes=[...(width===32?[0x66]:[]),...(memory?[0x3e]:[]),width===8?0xf6:0xf7,
   memory?(signed?0x3e:0x36):(signed?0xf9:0xf1),...(memory?[0,5]:[])];
  const ip=0x120,expected=cpu>=286?ip:ip+bytes.length;
  setCpuLevel(cpu);vm.exports.set_cpu(cpu);vm.mem.fill(0,0,0x40000);
  vm.mem.set([...bytes,0xbb,0xef,0xbe],0x1000+ip);
  vm.mem.set([0,1,0,0x30],0); // INT 0 -> 3000:0100
  vm.mem.set(cpu>=286?[0x55,0x8b,0xec,0x83,0x46,2,bytes.length,0x5d,0xcf]:[0xcf],0x30100);
  const divisor=overflow?1:0;vm.mem[0x500]=divisor;
  vm.setAll({cs:0x100,ip,ss:0x2000,sp:0x800,ds:0,es:0,ax:width===8?0x100:0,dx:width===8?0:1,cx:divisor,bx:0x4567,bp:0x6789,flags:0x202});
  const before={ax:vm.raw('ax'),dx:vm.raw('dx')};
  // For 32-bit quotient overflow use EDX:EAX = 1:0xffffffff.
  if(width===32&&overflow){vm.exports.set_ax(-1);vm.exports.set_dx(signed?0x7fffffff:1);before.ax=vm.raw('ax');before.dx=vm.raw('dx');}
  const d=decodeOne(a=>vm.mem[a],0x100,ip);
  assert.equal(d.words.at(-1),expected,`CPU ${cpu} ${signed?'I':''}DIV${width} encoded fault IP`);
  assert(vm.stepOne());assert.equal(vm.get('cs'),0x3000);assert.equal(vm.get('gip'),0x100);
  const frame=(0x2000<<4)+vm.get('sp');assert.equal(vm.get('sp'),0x7fa);
  assert.equal(vm.mem[frame]|vm.mem[frame+1]<<8,expected,'native saved IP');
  assert.equal(vm.mem[frame+2]|vm.mem[frame+3]<<8,0x100,'native saved CS');
  assert.equal(vm.raw('ax'),before.ax,'fault preserves dividend AX/EAX');assert.equal(vm.raw('dx'),before.dx,'fault preserves dividend DX/EDX');
  for(let n=0;n<(cpu>=286?5:1);n++)assert(vm.stepOne());
  assert.equal(vm.get('cs'),0x100);assert.equal(vm.get('gip'),ip+bytes.length,'guest handler resumes at complete next instruction');
  assert.equal(vm.get('sp'),0x800);assert.equal(vm.get('bp'),0x6789);assert(vm.stepOne());assert.equal(vm.get('bx'),0xbeef);
  cases++;
 }
 // AAM zero uses the same model-dependent #DE return address contract.
 for(const cpu of [86,186,286,386]){setCpuLevel(cpu);const bytes=[0xd4,0];const d=decodeOne(a=>bytes[a-0x100]||0,0,0x100);assert.equal(d.words.at(-1),cpu>=286?0x100:0x102);cases++;}
 setCpuLevel(86);console.log(`PASS ${cases} divide-error CPU/form/width/zero/overflow and guest IRET cases`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
