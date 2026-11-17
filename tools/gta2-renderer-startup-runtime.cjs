'use strict';
// Extend the audited immutable Git view with one transient sealed build input.
// No module bytes or source tree are persisted in the evidence directory.
require('./gta2-verified-source-view.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const original=fs.createReadStream.bind(fs),modulePath=path.resolve(__dirname,'../build/wine-assembly.wasm');
const readSync=fs.readFileSync.bind(fs),readAsync=fs.readFile.bind(fs),readPromise=fs.promises.readFile.bind(fs.promises);
const statSync=fs.statSync.bind(fs),statAsync=fs.stat.bind(fs),statPromise=fs.promises.stat.bind(fs.promises);
const bytes=readSync(process.env.GTA2_FROZEN_MODULE_FD);
if(crypto.createHash('sha256').update(bytes).digest('hex')!==process.env.GTA2_FROZEN_MODULE_SHA256)
  throw Error('frozen native module identity differs');
const selected=file=>typeof file==='string'&&path.resolve(file)===modulePath;
const decode=options=>{const encoding=typeof options==='string'?options:options?.encoding;return encoding?bytes.toString(encoding):Buffer.from(bytes);};
// Static servers derive Content-Length from stat before opening the stream.
// Metadata must name the same sealed object as the bytes, even while another
// lane rebuilds the shared pathname. Recover real Stats from that sealed FD.
fs.statSync=function(file,options){return statSync(selected(file)?process.env.GTA2_FROZEN_MODULE_FD:file,options);};
fs.stat=function(file,options,callback){
  if(typeof options==='function'){callback=options;options=undefined;}
  return statAsync(selected(file)?process.env.GTA2_FROZEN_MODULE_FD:file,options,callback);
};
fs.promises.stat=async function(file,options){return statPromise(selected(file)?process.env.GTA2_FROZEN_MODULE_FD:file,options);};
// The module is deliberately absent from immutableDigest(). Every final
// module check still obtains and hashes its bytes anew. The ordinary shared
// build file may change only after this independent run has sealed its input.
fs.readFileSync=function(file,options){return selected(file)?decode(options):readSync(file,options);};
fs.readFile=function(file,options,callback){
  if(typeof options==='function'){callback=options;options=undefined;}
  if(!selected(file))return readAsync(file,options,callback);
  queueMicrotask(()=>callback(null,decode(options)));
};
fs.promises.readFile=async function(file,options){return selected(file)?decode(options):readPromise(file,options);};
fs.createReadStream=function(file,options){
  if(!selected(file))return original(file,options);
  if(options?.start!==undefined||options?.end!==undefined)throw Error('partial frozen module stream unsupported');
  return require('node:stream').Readable.from([Buffer.from(bytes)]);
};
