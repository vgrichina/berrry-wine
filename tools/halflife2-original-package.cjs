'use strict';
// Read-only inspection of the archived original. Never calls WiseMain or runs
// an installer. Stream offsets are independently checked against the stub's
// header lengths and each stream's trailing CRC, not an archive-tool guess.
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const ORIGINAL={bytes:787701212,sha256:'24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c'};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const table=Array.from({length:256},(_,i)=>{for(let n=0;n<8;n++)i=(i>>>1)^((i&1)?0xedb88320:0);return i>>>0;});
function crc32(b){let c=0xffffffff;for(const n of b)c=(c>>>8)^table[(c^n)&255];return (c^0xffffffff)>>>0;}
function stream(bytes,offset,expectedSize){
  const r=zlib.inflateRawSync(bytes.subarray(offset),{info:true,maxOutputLength:2000000});
  const compressed=r.engine.bytesWritten,crcOffset=offset+compressed;
  if(crcOffset+4>bytes.length||crc32(r.buffer)!==bytes.readUInt32LE(crcOffset))throw Error('Wise stream CRC mismatch');
  if(expectedSize!==undefined&&r.buffer.length!==expectedSize)throw Error('Wise stream size mismatch');
  return {body:r.buffer,next:crcOffset+4,record:{offset,compressedBytes:compressed,bytes:r.buffer.length,crc32:crc32(r.buffer).toString(16).padStart(8,'0'),sha256:sha(r.buffer)}};
}
function inspect(file){
  const fd=fs.openSync(file,'r');
  try{
    const size=fs.fstatSync(fd).size,h=crypto.createHash('sha256'),chunk=Buffer.alloc(1024*1024);
    for(let at=0;at<size;){const n=fs.readSync(fd,chunk,0,Math.min(chunk.length,size-at),at);if(!n)throw Error('truncated package');h.update(chunk.subarray(0,n));at+=n;}
    const digest=h.digest('hex');if(size!==ORIGINAL.bytes||digest!==ORIGINAL.sha256)throw Error('original package identity mismatch');
    const b=Buffer.alloc(1024*1024);if(fs.readSync(fd,b,0,b.length,0)!==b.length)throw Error('truncated header');
    const p=b.readUInt32LE(60),o=p+24;
    if(b.readUInt32LE(p)!==0x4550||b.readUInt16LE(p+4)!==0x14c||b.readUInt16LE(o)!==0x10b)throw Error('not original PE32');
    let overlay=0;const sections=[];
    for(let i=0;i<b.readUInt16LE(p+6);i++){const s=o+b.readUInt16LE(p+20)+40*i,r=b.readUInt32LE(s+20),n=b.readUInt32LE(s+16);sections.push({name:b.subarray(s,s+8).toString().replace(/\0.*$/,''),rawOffset:r,rawBytes:n});overlay=Math.max(overlay,r+n);}
    if(overlay!==0x3a00||b[overlay]!==0)throw Error('unexpected Wise header');
    // Stub 0x4023c4 reads flags4, custom12, bitmap8, streamLengths64,
    // then three font bytes and its length-prefixed font name.
    const font=overlay+0x5c,stringsEnd=font+b[overlay+0x5b];
    const readString=at=>{const end=b.indexOf(0,at);if(end<at||end>=overlay+512)throw Error('bad Wise string');return {text:b.toString('latin1',at,end),next:end+1};};
    const title=readString(readString(font).next),initializing=readString(title.next);
    if(initializing.next!==stringsEnd)throw Error('Wise string block length mismatch');
    let at=initializing.next;const streams=[],bodies=[];
    for(const expected of [b.readUInt32LE(overlay+0x55),b.readUInt32LE(overlay+0x19),undefined,undefined]){const r=stream(b,at,expected);streams.push(r.record);bodies.push(r.body);at=r.next;}
    const lengths=[b.readUInt32LE(overlay+0x51),b.readUInt32LE(overlay+0x1d),b.readUInt32LE(overlay+0x21),b.readUInt32LE(overlay+0x31)];
    streams.forEach((s,i)=>{if(s.compressedBytes+4!==lengths[i])throw Error('Wise header compressed length mismatch');});
    if(bodies[2].subarray(0,2).toString()!=='MZ'||bodies[3].subarray(0,2).toString()!=='MZ'||!bodies[2].includes(Buffer.from('WiseMain\0')))throw Error('genuine bootstrap DLL identity missing');
    const supportingStreams=[];let internetDialog=null,steamClient=null;
    // Inspect only small startup/dialog/client streams. The next large content
    // stream is deliberately left compressed in the one retained installer.
    for(let i=0;i<16&&at<b.length;i++){
      let r;
      try{r=stream(b,at);}catch(e){
        if(e.code==='ERR_BUFFER_TOO_LARGE'||e.code==='Z_BUF_ERROR')break;
        throw e;
      }
      const strings=r.body.toString('latin1');
      supportingStreams.push({...r.record,pe:r.body.subarray(0,2).toString()==='MZ'});
      const instruction='If you do not have an Internet connection, press "Cancel" to exit this installer. Otherwise, click "Next" to continue.';
      if(strings.includes('Internet Connection Required')&&strings.includes(instruction))internetDialog={streamOffset:at,text:'Internet Connection Required',instruction};
      if(r.body.subarray(0,2).toString()==='MZ'&&strings.includes('Software\\Valve\\Steam')&&strings.includes('Steam.exe'))steamClient={...r.record,inferredRole:'Steam client',identityEvidence:['PE image','Software\\Valve\\Steam','Steam.exe'],installedFilename:null};
      at=r.next;
    }
    if(!internetDialog||!steamClient)throw Error('Steam startup dependency evidence missing');
    return {record:{file,bytes:size,sha256:digest,format:'PE32 Wise bootstrap with CRC-protected raw DEFLATE streams',entryRVA:b.readUInt32LE(o+16),imageBytes:b.readUInt32LE(o+56),overlay,sections,title:title.text,initializing:initializing.text,streams,supportingStreams,bootstrap:'WISE0132.dll',bootstrapExport:'WiseMain',internetDialog,steamClient,originalInvocations:0,installedGameLaunch:null,SteamRequirement:'installer explicitly requires Internet and includes Steam client; installed launch and authentication still unproved'},bootstrap:bodies[2]};
  }finally{fs.closeSync(fd);}
}
module.exports={inspect,stream,crc32,ORIGINAL};
if(require.main===module){const r=inspect(process.argv[2]);console.log(JSON.stringify(r.record,null,2));}
