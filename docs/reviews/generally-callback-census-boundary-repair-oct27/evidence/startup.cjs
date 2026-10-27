const fs=require('node:fs'),crypto=require('node:crypto');
const h=b=>crypto.createHash('sha256').update(b).digest('hex');
const limits=fs.readFileSync('/proc/self/limits','utf8');
if (!/^Max data size\s+unlimited\s+unlimited/m.test(limits) || !/^Max address space\s+unlimited\s+unlimited/m.test(limits)) throw Error('unexpected inherited DATA/AS');
console.log(JSON.stringify({executable:process.execPath,executableSHA256:h(fs.readFileSync(process.execPath)),version:process.version,flags:process.execArgv,NODE_OPTIONS:process.env.NODE_OPTIONS||null,cwd:process.cwd(),environmentSafeSHA256:h(JSON.stringify(Object.entries(process.env).sort())),limits,pass:true}));
