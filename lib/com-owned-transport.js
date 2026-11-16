'use strict';
const {HResult,HR}=require('./com-standard-marshaler');
const LIMIT=512*1024;
function observe(command,request,value) {
 const directory=process.env.WINE_COM_PROTOCOL_DIR;if(!directory)return;
 if((command==='take'||command==='poll')&&!value)return;
 const fs=require('node:fs'),path=require('node:path'),tid=require('node:worker_threads').threadId;
 // No endpoint credential or guest address enters these records. Byte bodies
 // are bounded by the transport and are run-specific protocol evidence.
 fs.appendFileSync(path.join(directory,'com-'+process.pid+'-'+tid+'.jsonl'),
  JSON.stringify({pid:process.pid,threadId:tid,at:performance.now(),command,request,value})+'\n');
}
function toWire(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>LIMIT)throw new HResult(HR.INVALID);
 return Buffer.from(bytes).toString('base64');
}
function fromWire(text){
 if(typeof text!=='string'||text.length>Math.ceil(LIMIT/3)*4||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw Object.assign(new Error('invalid COM bytes'),{code:'EINVAL'});
 const result=Uint8Array.from(Buffer.from(text,'base64'));
 if(result.length>LIMIT||Buffer.from(result).toString('base64')!==text)throw Object.assign(new Error('invalid COM bytes'),{code:'EINVAL'});
 return result;
}
// Used only by the already-authenticated ProcessDesktop authority. 'session'
// is the socket's private session, never a request field or an OBJREF address.
function dispatchCom(authority,session,request) {
 const owner=request.owner,reference=request.reference;
 switch(request.command) {
 case 'classAvailable': {
  authority.check(session);
  if(typeof request.clsid!=='string'||!/^[0-9a-f]{32}$/.test(request.clsid)||
     !Number.isInteger(request.context))throw Object.assign(new Error('invalid class query'),{code:'EINVAL'});
  return !!authority.activation.classFor(request.clsid,request.context,session);
 }
 case 'classPublish':return authority.activation.publish(session,owner,request.clsid,request.context,request.flags,request.cookie);
 case 'classRevoke':return authority.activation.revoke(session,owner,request.registration);
 case 'classFinishRevoke':return authority.activation.finishRevoke(session,owner,request.registration);
 case 'activationLocal':return authority.activation.local(session,owner,request.clsid,request.context);
 case 'activationFinishLocal':return authority.activation.finishLocal(session,owner,request.ticket);
 case 'activationBegin':return authority.activation.begin(session,owner,request.activation);
 case 'activationPoll':return authority.activation.poll(session,owner,request.ticket);
 case 'activationFinish':return authority.activation.finish(session,owner,request.ticket);
 case 'activationTake':return authority.activation.take(session,owner);
 case 'activationComplete':return authority.activation.complete(session,owner,request.ticket,request.hresult,request.reference);
 case 'activationCancel':return authority.activation.cancel(session,owner,request.ticket);
 case 'activationLaunchFailed':return authority.activation.launchFailed(session,owner,request.clsid,request.launch,request.hresult);
 case 'register':return authority.registerOwner(session,owner);
 case 'prepare':return authority.prepareExport(session,owner,request.iid,request.mode,request.objectIdentity);
 case 'commit':return authority.commitExport(session,owner,reference);
 case 'abandon':return authority.abandonExport(session,owner,reference);
 case 'consume':return authority.consume(session,owner,reference);
 case 'releaseProxy':return authority.releaseProxy(session,owner,reference,request.leaseToken);
 case 'releaseData':return authority.releaseData(session,owner,reference);
 case 'probe':authority.proxy(session,owner,reference,request.leaseToken);return true;
 case 'submit':return authority.submit(session,owner,reference,request.leaseToken,
   {...request.call,bytes:fromWire(request.call?.bytes)});
 case 'poll':{const response=authority.poll(session,owner,request.ticket);return response?{...response,bytes:toWire(response.bytes)}:null;}
 case 'take':{const row=authority.take(session,owner);return row?{...row,bytes:toWire(row.bytes)}:null;}
 case 'complete':return authority.complete(session,owner,request.ticket,request.response?
   {...request.response,bytes:fromWire(request.response.bytes)}:undefined);
 case 'retire':return authority.retireOwner(session,owner);
 default:throw Object.assign(new Error('unknown COM command'),{code:'EINVAL'});
 }
}
class ComOwnedTransport {
 constructor(desktop,owner) {this.desktop=desktop;this.owner=Object.freeze({...owner});this.call('register');}
 call(command,fields={}) {
  try{const request={op:'com',command,owner:this.owner,...fields};
   const value=this.desktop.call(request);observe(command,request,value);return value;}
  catch(error){
   if(['ESTALE','EDISCONNECTED','ECLOSED','ECONNECTION','ETIMEDOUT'].includes(error.code))throw new HResult(HR.DISCONNECTED);
   if(error.code==='ENOTSUP')throw new HResult(HR.NOTIMPL);
   if(error.code==='ENOSPC')throw new HResult(HR.OOM);
   if(error.code==='EINVAL')throw new HResult(HR.INVALID);
   throw error;
  }
 }
 prepare(iid,mode,objectIdentity){return this.call('prepare',{iid,mode,objectIdentity});}
 commit(reference){return this.call('commit',{reference});}
 abandon(reference){return this.call('abandon',{reference});}
 consume(reference){return this.call('consume',{reference});}
 releaseProxy(lease){return this.call('releaseProxy',{reference:lease.reference,leaseToken:lease.token});}
 releaseData(reference){return this.call('releaseData',{reference});}
 probe(reference,lease){return this.call('probe',{reference,leaseToken:lease.token});}
 submit(reference,lease,call){return this.call('submit',{reference,leaseToken:lease.token,call:{...call,bytes:toWire(call.bytes)}});}
 poll(ticket){const row=this.call('poll',{ticket});return row?{...row,bytes:fromWire(row.bytes)}:null;}
 take(){const row=this.call('take');return row?{...row,bytes:fromWire(row.bytes)}:null;}
 complete(ticket,response){return this.call('complete',{ticket,response:response?{...response,bytes:toWire(response.bytes)}:undefined});}
 retire(){return this.call('retire');}
}
module.exports={ComOwnedTransport,dispatchCom,fromWire,toWire};
