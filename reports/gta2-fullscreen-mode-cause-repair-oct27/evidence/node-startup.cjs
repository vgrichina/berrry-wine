const fs=require('fs'),crypto=require('crypto');
console.log(JSON.stringify({executable:process.execPath,version:process.version,flags:process.execArgv,cwd:process.cwd(),limits:fs.readFileSync('/proc/self/limits','utf8'),environmentIdentity:crypto.createHash('sha256').update(JSON.stringify(Object.keys(process.env).sort().map(k=>[k,process.env[k]]))).digest('hex'),ok:true}));
