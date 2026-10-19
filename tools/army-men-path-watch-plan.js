'use strict';
const boundary=require('./army-men-path-boundary-plan');
const watchedAddress=0xe43df0;
const flags=[...boundary.flags,'--watch-byte=0xe43df0','--watch-value=0x0','--watch-log','--watch-stack'];
module.exports={flags,watchedAddress,qualification:'Attribute only after a same-run trace at43c7ee identifies *EBX as0xe43df0 with leading43. Absolute heap address is an observation candidate, not a guaranteed allocation. Watch reports block boundary EIP/prev_eip, not an exact store instruction.'};
if(require.main===module)console.log(JSON.stringify(module.exports,null,2));
