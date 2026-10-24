const fs=require('fs'),Module=require('module'),crypto=require('crypto'),assert=require('assert');
const root=__dirname,original=Module.prototype._compile;
Module.prototype._compile=function(source,file) {
 if(file===root+'/runner/test/run.js') {
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809');
  const anchor='  const pushApi = line => {'; assert.equal(source.split(anchor).length,2);
  source=source.replace(anchor,'  let diagnosticRecords=0;\n'+anchor+'\n    if(diagnosticRecords++ >= 16) return;');
  const gate='if (TRACE_API && (!TRACE_API_FILTER || TRACE_API_FILTER.has(t))) {';
  assert.equal(source.split(gate).length,2);
  source=source.replace(gate,'if (diagnosticRecords < 16 && TRACE_API && (!TRACE_API_FILTER || TRACE_API_FILTER.has(t))) {');
 }
 return original.call(this,source,file);
};
require('./capture.cjs');
