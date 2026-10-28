const fs=require('fs');console.log(JSON.stringify({exec:process.execPath,flags:process.execArgv,environment:process.env,limits:fs.readFileSync('/proc/self/limits','utf8'),startup:true}));
