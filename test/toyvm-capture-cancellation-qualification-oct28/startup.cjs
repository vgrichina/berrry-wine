const fs=require('fs'),crypto=require('crypto');
const env={};for(const k of ['PATH','NODE_PATH','NODE_OPTIONS','DISPLAY','HOME'])env[k]=process.env[k]||null;
console.log(JSON.stringify({execPath:process.execPath,version:process.version,execArgv:process.execArgv,environment:env,limits:fs.readFileSync('/proc/self/limits','utf8'),cwd:process.cwd(),success:true}));
