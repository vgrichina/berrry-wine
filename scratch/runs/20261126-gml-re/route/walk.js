// tl;dr: hold Right N batches, release, png  ->  node walk.js PORT N KEY OUT.png
'use strict';
const http = require('http');
const [port, n, key, out] = process.argv.slice(2);
const post = b => new Promise((res, rej) => { const p = JSON.stringify(b); const r = http.request({ host: '127.0.0.1', port, path: '/ctl', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) } }, s => { let d = ''; s.on('data', c => d += c); s.on('end', () => res(JSON.parse(d))); }); r.on('error', rej); r.end(p); });
(async () => {
  await post({ cmd: `keydown:${key}` }); await post({ action: 'step', n: +n }); await post({ cmd: `keyup:${key}` });
  await post({ action: 'step', n: 60 }); console.log(JSON.stringify(await post({ cmd: `png:${require('path').resolve(out)}` })));
})();
