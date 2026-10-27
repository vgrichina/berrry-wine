'use strict';
const fs=require('fs'), crypto=require('crypto');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>k!=='PALETTE_BROWSER_SUPERVISED').sort(([a],[b])=>a.localeCompare(b)));
console.log(JSON.stringify({node:process.execPath,version:process.version,flags:process.execArgv,cwd:process.cwd(),limits:fs.readFileSync('/proc/self/limits','utf8'),environmentSHA256:crypto.createHash('sha256').update(JSON.stringify(env)).digest('hex'),allowlist:Object.fromEntries(['NODE_OPTIONS','NODE_PATH','LANG','TZ'].map(k=>[k,process.env[k]??null]))},null,2));
