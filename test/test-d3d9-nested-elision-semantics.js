'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const Module = require('node:module');
const {create, instrument} = require('../tools/d3d9-operation-observer');
let serial = 0;

// Compile and measure the actual loaded module, rather than evaluating only
// instrument() output. Each invocation creates its own iterator and event log.
function compare(body) {
  const filename = __filename + '.loaded-' + serial++;
  const code = `'use strict';module.exports=function(){
    const log=[],src=new Uint8Array([3,7]),marker={};let value,other,result,error;
    try { ${body} } catch(e) { error=e===marker?'marker':e.name; }
    return {log,value,other,result,error};
  };`;
  const m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m._compile(code, filename);
  const observed = create(filename), counts = {indexedSourceReads:0};
  const leave = observed.enter({counts,isSource:o=>o instanceof Uint8Array,allocation(){}});
  try {
    const native = m.exports(), actual = observed.exports();
    assert.deepEqual(actual, native);
    return {actual, counts};
  } finally { leave(); }
}

const iterator = (mode='normal') => `
  let step=0;
  const iter={
    [Symbol.iterator](){log.push('iterator');return this;},
    next(){log.push('next',++step);
      if('${mode}'==='next-throw'&&step===2)throw marker;
      if('${mode}'==='next-primitive'&&step===2)return 1;
      return {get done(){log.push('done',step);
        if('${mode}'==='done-throw'&&step===2)throw marker;
        return '${mode}'==='exhausted'||('${mode}'==='finish-second'&&step===2);},
        get value(){log.push('value',step);return undefined;}};},
    get return(){log.push('get-return');
      if('${mode}'==='return-get-throw')throw marker;
      return function(){log.push('return',this===iter);
        if('${mode}'==='return-throw')throw marker;
        return '${mode}'==='return-primitive'?1:{done:true};};}
  };`;

for (const pattern of ['[]','[,]','[,,]','[,,,]','[value]','[value,]','[value,,]','[,value,,]']) {
  for (const assignment of [false,true]) test(`${assignment?'assignment':'binding'} ${pattern}: native iterator effects`,()=>{
    const target = assignment ? `result=({a:${pattern}}=rhs);result=result===rhs;`
      : `{const {a:${pattern}}=rhs;result=true;}`;
    const {actual} = compare(iterator()+`const rhs={a:iter};${target}`);
    assert.equal(actual.log.filter(x=>x==='next').length,
      {'[]':0,'[,]':1,'[,,]':2,'[,,,]':3,'[value]':1,'[value,]':1,'[value,,]':2,'[,value,,]':3}[pattern]);
    assert.equal(actual.result,true);
  });
}
for (const mode of ['exhausted','finish-second','next-throw','next-primitive','done-throw',
  'return-get-throw','return-throw','return-primitive']) {
  for (const assignment of [false,true]) test(`${assignment?'assignment':'binding'} terminal hole: ${mode}`,()=>{
    compare(iterator(mode)+(assignment?'({a:[value,,]}={a:iter});':'const {a:[bound,,]}={a:iter};'));
  });
}
for (const mode of ['normal','return-throw','return-primitive']) {
  test(`throwing default retains IteratorClose and original exception: ${mode}`,()=>{
    const {actual}=compare(iterator(mode)+`({a:[value=(log.push('default'),(()=>{throw marker;})()),,]}={a:iter});`);
    assert.equal(actual.error,'marker');
    assert(actual.log.includes('return'));
  });
}
test('nested defaults, computed object key, source Get, object rest and assignment RHS identity',()=>{
  const {actual,counts}=compare(iterator()+`
    const rhs={a:undefined,keep:9};const key={toString(){log.push('key');return 'a';}};
    result=({[key]:[value=src[1],,]=(log.push('default-array'),iter),...other}=rhs);
    result=result===rhs;
  `);
  assert.equal(actual.value,7);assert.deepEqual(actual.other,{keep:9});
  assert.equal(actual.result,true);assert.equal(counts.indexedSourceReads,1);
  assert.equal(actual.log.filter(x=>x==='key').length,1);
});
test('nested array within array and object defaults preserve terminal holes',()=>{
  const {actual}=compare(iterator()+`
    const outer=[{x:iter}];const {a:[{x:[,,]}]}={a:outer};
    const {missing:{x:[,]}={x:iter}}={};result=true;
  `);
  assert.equal(actual.log.filter(x=>x==='next').length,3);
});
test('assignment target key and setter order stay native before trailing elision',()=>{
  compare(iterator()+`
    const target={set x(v){log.push('set',v);}};
    const key=()=>{log.push('target-key');return 'x';};
    ({a:[target[key()]=(log.push('default'),5),,]}={a:iter});
  `);
});
test('unsupported indexed/rest array grammar still fails closed before execution',()=>{
  for(const code of [
    'const {a:[...rest]}=rhs;',
    'const {a:[{[key]:value},,]}=rhs;',
    'const {a:[{0:value},,]}=rhs;'
  ]) assert.throws(()=>instrument(code),/outside the observer grammar/);
});
