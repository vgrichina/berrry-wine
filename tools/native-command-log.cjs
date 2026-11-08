'use strict';

// Every append is a complete gzip member. Even an interrupted process retains
// a verifiable compressed prefix, without a raw staging file or async backlog.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
function createLogs(directory) {
  const logs=new Map(),streams=[];
  let closed=false;
  function append(name, data) {
    if(closed)throw Error('compressed logs already closed');
    if(!/^[a-zA-Z0-9_.-]+$/.test(name))throw Error('invalid log name');
    let row=logs.get(name);
    if(!row){
      row={path:name+'.gz',fd:fs.openSync(path.join(directory,name+'.gz'),'wx',0o600),sha:crypto.createHash('sha256'),originalBytes:0,members:0};
      logs.set(name,row);
    }
    const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);
    const member=zlib.gzipSync(bytes);
    // writeSync can return a short write. Never advance the original hash until
    // the entire member is stored, or report an incomplete member as success.
    for(let offset=0;offset<member.length;){
      const n=fs.writeSync(row.fd,member,offset,member.length-offset);
      if(n<=0)throw Error('compressed log made no write progress');
      offset+=n;
    }
    row.sha.update(bytes);row.originalBytes+=bytes.length;row.members++;
  }
  function attach(name, readable) {
    if(closed||logs.has(name))throw Error('duplicate or closed stream log');
    append(name,Buffer.alloc(0));
    let error;
    const done=new Promise(resolve=>{
      readable.on('data',data=>{try{append(name,data);}catch(e){error=e;readable.destroy(e);}});
      readable.once('error',e=>{error=e;});
      readable.once('close',resolve);
    });
    streams.push({done,check(){if(error)throw error;if(!readable.readableEnded)throw Error('stream EOF UNKNOWN: '+name);}});
  }
  async function drainStreams(){await Promise.all(streams.map(s=>s.done));for(const s of streams)s.check();return {streams:streams.length,eof:true};}
  function close(){
    if(closed)return;
    closed=true;const rows=[];
    for(const row of logs.values()){
      fs.fsyncSync(row.fd);fs.closeSync(row.fd);
      rows.push({path:row.path,originalBytes:row.originalBytes,originalSha256:row.sha.digest('hex'),members:row.members});
    }
    fs.writeFileSync(path.join(directory,'compressed-logs.json'),JSON.stringify({logs:rows}),{flag:'wx'});
    return rows;
  }
  return {append,attach,drainStreams,close};
}
module.exports={createLogs};
