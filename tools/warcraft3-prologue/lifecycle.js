'use strict';
function createLifecycle(cleanup){
 let cancelled=false,finishPromise=null,pending=null,owned=null,guard=null;
 const check=()=>{if(cancelled)throw Error('lifecycle cancelled');if(guard)guard()};
 async function acquire(factory){check();if(pending||owned)throw Error('duplicate acquire');
  pending=Promise.resolve().then(factory).then(value=>{owned=value;return value});
  const value=await pending;check();return value;
 }
 function finish(reason){if(finishPromise)return finishPromise;cancelled=true;
  finishPromise=(async()=>{let startupError=null;try{if(pending)await pending}catch(e){startupError=String(e)}return cleanup({owned,reason,startupError})})();return finishPromise;
 }
 function watch(checkIdentity){check();if(guard)throw Error('duplicate lifecycle guard');guard=checkIdentity;check();}
 return{acquire,finish,check,watch,get cancelled(){return cancelled}};
}
module.exports={createLifecycle};
