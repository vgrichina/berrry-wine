'use strict';

// Called only from the scheduler of the actual owning guest instance. This
// class never creates an instance or runs another thread's exported CPU.
const {AsyncLocalStorage}=require('node:async_hooks');
const REGISTERS = ['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
const fault = message => { throw new Error(`COM continuation: ${message}`); };
class ComGuestContinuation {
  constructor({ exports, memory, identity, currentIdentity, currentExports,
      currentMemory, serviceYield, now = () => performance.now(),
      suspend = ms => new Promise(resolve => setTimeout(resolve, ms)), maxMs = 30000 }) {
    if (!exports || !memory || typeof identity !== 'string' || !identity ||
        typeof currentIdentity !== 'function' || typeof currentExports !== 'function' ||
        typeof currentMemory !== 'function' || typeof serviceYield !== 'function' ||
        !Number.isFinite(maxMs) || maxMs <= 0) fault('invalid owner');
    Object.assign(this,{exports,memory,identity,currentIdentity,currentExports,currentMemory,
      serviceYield,now,suspend,maxMs});this.frames=[];this.context=new AsyncLocalStorage();
  }
  check(token) {
    if (this.currentIdentity() !== this.identity || this.currentExports() !== this.exports ||
        this.currentMemory() !== this.memory) fault('owner replaced');
    if (token !== undefined) this.exports.com_callback_check(token);
  }
  view(address, count) {
    if (!Number.isInteger(address) || address <= 0 || address > 0xffffffff ||
        !Number.isInteger(count) || count < 0 || address + count > 0x100000000)
      fault('invalid guest range');
    const at=this.exports.guest_to_wasm(address)>>>0;
    if (!at || at + count > this.memory.byteLength) fault('unmapped guest range');
    return new DataView(this.memory,at,count);
  }
  word(address) {return this.view(address,4).getUint32(0,true);}
  putWord(address,value) {this.view(address,4).setUint32(0,value,true);}
  method(object,index) {
    if (!Number.isInteger(index)||index<0||index>65535) fault('invalid method');
    const vtable=this.word(object),method=this.word(vtable+index*4);
    if(!method)fault('null method');return method;
  }
  async invoke(method,args,parent=this.context.getStore()) {
    this.check();
    if (this.frames.length && this.frames[this.frames.length-1].token !== parent)
      fault('another continuation owns CPU');
    if (!Number.isInteger(method)||method<=0||method>0xffffffff||!Array.isArray(args)||args.length>16||
        args.some(x=>!Number.isInteger(x)||x<0||x>0xffffffff))fault('invalid call');
    const e=this.exports,token=e.com_callback_enter();this.check(token);
    const frame={token,registers:REGISTERS.map(r=>e['get_'+r]()>>>0),
      eip:e.get_eip(),ip:e.com_callback_get_ip(),thunk:e.com_callback_get_thunk(),
      handler:e.get_handler_set_eip(),steps:e.get_steps(),reason:e.get_yield_reason(),
      flag:e.get_yield_flag(),fs:e.get_fs_base(),deadline:this.now()+this.maxMs};
    frame.seh=frame.fs?this.word(frame.fs):0;this.frames.push(frame);
    let esp=frame.registers[4];
    for(const arg of [...args].reverse().concat(0)) {esp-=4;this.putWord(esp,arg);}
    e.set_esp(esp);e.set_eip(method);e.set_handler_set_eip(0);e.set_steps(0);e.set_yield_state(0,0);
    // No finally restoration: a trap, replacement, unsupported wait or failed
    // ABI leaves the child live. Only explicit owner retirement may discard it.
    for (;;) {
      this.check(token);
      if(this.now()>frame.deadline)fault('deadline exceeded');
      e.run(20000);this.check(token);
      const reason=e.get_yield_reason()>>>0;
      const slept=e.get_sleep_yielded()>>>0;
      if(reason) {
        const handled=await this.context.run(token,()=>this.serviceYield({reason,token,
          invoke:(address,values)=>this.invoke(address,values,token),
          check:()=>this.check(token),deadline:frame.deadline}));
        this.check(token);if(!handled)fault('unsupported yield '+reason);
        continue;
      }
      if(slept) {
        const ms=e.get_sleep_timeout()>>>0;
        if(this.now()+ms>frame.deadline)fault('sleep exceeds deadline');
        await this.suspend(ms);this.check(token);
      }
      if((e.get_eip()>>>0)===0)break;
      // Yield the host event loop so authenticated channel requests and owner
      // retirement are observable without changing the guest clock.
      await this.suspend(0);this.check(token);
    }
    if((e.get_esp()>>>0)!==frame.registers[4])fault('stdcall stack mismatch');
    for(const index of [3,5,6,7])
      if((e['get_'+REGISTERS[index]]()>>>0)!==frame.registers[index])fault('callee-saved register changed');
    const result=e.get_eax()>>>0;this.check(token);e.com_callback_leave(token);
    REGISTERS.forEach((r,i)=>e['set_'+r](frame.registers[i]));
    e.set_eip(frame.eip);e.com_callback_set_ip(frame.ip);e.com_callback_set_thunk(frame.thunk);
    e.set_handler_set_eip(frame.handler);e.set_steps(frame.steps);e.set_yield_state(frame.reason,frame.flag);
    if(frame.fs)this.putWord(frame.fs,frame.seh);
    this.frames.pop();return result;
  }
  call(object,index,args=[],parent) {return this.invoke(this.method(object,index),[object,...args],parent);}
}
module.exports={ComGuestContinuation};
