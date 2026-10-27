'use strict';
require('./helpers/directinput-independent-accept-oct27')(String.raw`
e.unacquire(obj);
const contexts=Array.from({length:16},()=>createWindowHost({renderer},{}).imports);
const lease=0x13579;
// Same numerical device ID in distinct contexts; inactive staging must reserve
// the same global slots as active clients, without admitting any early input.
for(let i=0;i<16;i++){
 assert.equal(contexts[i].di_keyboard_buffer(lease,8,4096),0);
 contexts[i].di_keyboard_buffer(lease,9,i%2?65:32);
 if(i%2)assert.equal(contexts[i].di_keyboard_buffer(lease,10,0),0);
}
const tail=createWindowHost({renderer},{}).imports;
assert.equal(tail.di_keyboard_buffer(lease,8,17),0,'65536 exact aggregate slots allowed');
const spill=createWindowHost({renderer},{}).imports;
assert.equal(spill.di_keyboard_buffer(lease,8,2),1,'one extra slot rejected while inactive leases own capacity');
assert.equal(tail.di_keyboard_buffer(lease,8,18),1,'oversized replacement cannot consume extra global slot');
tail.di_keyboard_buffer(lease,9,13);assert.equal(tail.di_keyboard_buffer(lease,10,0),0,'rejected replacement preserves original staged lease');
for(const vk of [13,32,65]){renderer.handleKeyDown(vk);renderer.handleKeyUp(vk);}
while(renderer.checkInput()){};
for(let i=0;i<16;i++)assert.equal(contexts[i].di_keyboard_buffer(lease,2,0),i%2?2:0);
assert.equal(tail.di_keyboard_buffer(lease,2,0),2);
assert.equal(tail.di_keyboard_buffer(lease,3,0),13|256);
assert.equal(tail.di_keyboard_buffer(lease,8,0),0,'zero-sized stage releases capacity and old events');
assert.equal(tail.di_keyboard_buffer(lease,10,0),1,'removed zero-sized stage cannot activate');
assert.equal(spill.di_keyboard_buffer(lease,8,17),0,'released reservation reusable exactly');
for(const h of [...contexts,tail,spill])h.di_keyboard_buffer(lease,1,0);
assert.equal(host.di_keyboard_buffer(lease,8,4096),0,'reset releases all context reservations');
host.di_keyboard_buffer(lease,1,0);
console.log(JSON.stringify({group:'global staged/active exact quota, rejected transactional replacement, same IDs across16contexts and zero-stage release',slots:65536,pass:true,coverage:'production renderer/host ABI; synthetic lease IDs, no WAT device allocation'}));
`);
