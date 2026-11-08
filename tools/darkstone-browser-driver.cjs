'use strict';

// Versioned, fail-closed adapter for the exact selected Darkstone driver. Keep
// historical run files immutable; no source copy or rewritten historical proof.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const selectedSha = '2535a4fea2ad1acbc245d10fd00cc6c583913095aacdc9cd92462c4d6b346a2f';

function repairDriver(source) {
  if (crypto.createHash('sha256').update(source).digest('hex') !== selectedSha) {
    throw Error('unrecognized Darkstone driver; review revision before repair');
  }
  const replace = (before, after) => {
    if (source.split(before).length !== 2) throw Error('ambiguous close repair anchor');
    source = source.replace(before, after);
  };
  replace('async function close(reason){if(closing)return;closing=true;',
    'let closePromise;function close(reason){return closePromise??=(async()=>{closing=true;');
  replace("console.log('TERMINAL '+reason);}", "console.log('TERMINAL '+reason);})();}");
  replace("try{if(ws?.readyState===1)await send('Browser.close');}catch(e){save('close-error.json',{error:String(e)});}if(browser){await Promise.race([new Promise(r=>browser.exitCode!==null?r():browser.once('exit',r)),wait(8000)]);if(browser.exitCode===null)browser.kill('SIGTERM');await Promise.race([new Promise(r=>browser.exitCode!==null?r():browser.once('exit',r)),wait(5000)]);if(browser.exitCode===null)browser.kill('SIGKILL');}",
    "if(browser){const receipt=await require(root+'/tools/native-browser-close.cjs').closeBrowser({browser,requestClose:()=>{if(ws?.readyState!==1)throw Error('CDP disconnected; no replay');return send('Browser.close');},record:r=>log('browser-close.jsonl',r)});save('browser-terminal.json',receipt);}");
  // Preserve the transport's sticky UNKNOWN and all independent input releases.
  // A finite failed drain must release network handles without deleting a live
  // profile or publishing cleanup / quit ACK. The top-level failure path closes
  // admission and keeps its nonzero status.
  replace("if(browser){const receipt=", "if(browser){let receipt;try{receipt=");
  replace("save('browser-terminal.json',receipt);}",
    "save('browser-terminal.json',receipt);}catch(e){process.exitCode=1;save('browser-drain-unknown.json',{error:String(e),receipt:e.receipt,noReplay:true});for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; no replay'));}pending.clear();ws?.close();server?.closeAllConnections();server?.close();throw e;}}");
  return source;
}

if (require.main === module) {
  const file = path.resolve(process.argv[2] || '');
  if (path.basename(file) !== 'browser.cjs') throw Error('explicit selected browser.cjs required');
  const source = repairDriver(fs.readFileSync(file, 'utf8'));
  const driver = new Module(file, module);
  driver.filename = file;
  driver.paths = Module._nodeModulePaths(path.dirname(file));
  driver._compile(source, file);
}

module.exports = {repairDriver, selectedSha};
