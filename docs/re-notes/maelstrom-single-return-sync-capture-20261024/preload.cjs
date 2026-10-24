const fs=require('fs'),Module=require('module'),crypto=require('crypto'),assert=require('assert');
const root=__dirname,original=Module.prototype._compile;
Module.prototype._compile=function(source,file) {
 if(file===root+'/runner/test/run.js') {
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809');
  const anchor='    // Handle COM DLL loading yield (yield_reason=3). The pump itself is shared';
  assert.equal(source.split(anchor).length,2);
  const hook=`    globalThis.__maelstromObserver ??= require(${JSON.stringify(root+'/observer.cjs')}).createObserver(line=>console.log('[SELECT-OBS] '+line));
    globalThis.__maelstromObserver(batch,instance.exports,memory,g2w,tickState);
`;
  source=source.replace(anchor,hook+anchor);
 }
 return original.call(this,source,file);
};
require('./capture.cjs');
