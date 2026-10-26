const fs=require('fs');
console.log(JSON.stringify({executable:process.execPath,version:process.version,execArgv:process.execArgv,env:process.env,limits:fs.readFileSync('/proc/self/limits','utf8'),raster:require('./source/lib/canvas-compat').createCanvas(1,1).width,pngjs:require.resolve('pngjs')}));
