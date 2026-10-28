const fs=require('fs'),crypto=require('crypto');
console.log(JSON.stringify({execPath:process.execPath,version:process.version,argv:process.execArgv,sha256:crypto.createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex'),cwd:process.cwd(),limits:fs.readFileSync('/proc/self/limits','utf8'),memory:process.memoryUsage()}));
