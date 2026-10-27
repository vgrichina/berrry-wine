'use strict';
const fs=require('fs'),crypto=require('crypto');
const hash=crypto.createHash('sha256'),fd=fs.openSync(process.execPath,'r'),chunk=Buffer.alloc(65536);
let n;while((n=fs.readSync(fd,chunk,0,chunk.length,null)))hash.update(chunk.subarray(0,n));fs.closeSync(fd);
const j={version:process.version,execPath:process.execPath,execArgv:process.execArgv,
  executableSHA256:hash.digest('hex'),
  environment:process.env,limits:fs.readFileSync('/proc/self/limits','utf8'),startup:true,
  purpose:'offline production JS helper replay only; no WebAssembly API'};
fs.writeFileSync(process.argv[2],JSON.stringify(j,null,2)+'\n');console.log(JSON.stringify({startup:true,version:j.version,execArgv:j.execArgv}));
