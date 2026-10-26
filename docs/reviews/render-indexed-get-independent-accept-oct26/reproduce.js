'use strict';
// Run from repository root: node --test --test-concurrency=1 docs/reviews/render-indexed-get-independent-accept-oct26/reproduce.js
const assert=require('node:assert/strict'),{test}=require('node:test'),Module=require('node:module');
const {create,instrument}=require('../../../tools/d3d9-operation-observer');
let serial=0;
function compare(pattern) {
  const filename=__filename+'.loaded-'+serial++;
  const code=`'use strict';module.exports=function(){const log=[];const iterator={next(){log.push('next');return {value:7,done:false};},return(){log.push('return');return {done:true};},[Symbol.iterator](){log.push('iterator');return this;}};const {a:${pattern}}={a:iterator};return log;};`;
  const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(code,filename);
  const observed=create(filename),counts={indexedSourceReads:0};
  const leave=observed.enter({counts,isSource(){return false;},allocation(){}});
  try {
    const native=m.exports(),actual=observed.exports();
    console.log(JSON.stringify({pattern,native,actual,transformed:instrument(code)}));
    assert.deepEqual(actual,native,'nested array elisions must retain every iterator step');
  } finally {leave();}
}
test('control: nested array binding with value preserves iterator effects',()=>compare('[value]'));
test('nested array single elision preserves iterator effects',()=>compare('[,]'));
test('nested array two elisions preserve iterator effects',()=>compare('[,,]'));
test('nested array trailing elision after value preserves iterator effects',()=>compare('[value,,]'));
