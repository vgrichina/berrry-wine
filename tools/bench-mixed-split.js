'use strict';
// Isolated alternative: ordinary islands retain the original evaluator.
// Bit 28 is outside H451's operand/first-handler/count fields (0..27).
const assert=require('assert');
const {transform:mixed}=require('./bench-mw3-mixed-build');
function once(s,a,b){assert.equal(s.split(a).length,2,`unique seam ${a.slice(0,80)}`);return s.replace(a,b);}
function part(text,fn){
  const a=text.search(new RegExp('\\(func \\$'+fn+'\\s'));assert(a>=0,fn);
  // Same string/line-comment handling as tools/wat-func.js. Stop at the
  // function's closing paren, not the next function: macros can lie between.
  let depth=0;
  for(let i=a;i<text.length;i++){
    const c=text[i];
    if(c==='"'){while(++i<text.length&&text[i]!=='"')if(text[i]==='\\')i++;continue;}
    if(c===';'&&text[i+1]===';'){while(i<text.length&&text[i]!=='\n')i++;continue;}
    if(c==='(')depth++;
    else if(c===')'&&!--depth)return {a,b:i+1,s:text.slice(a,i+1)};
  }
  throw Error('unbalanced function '+fn);
}
function transform(name,original){
  let text=mixed(name,original);if(name!=='07b-loop-match.wat')return text;
  const f=part(text,'x87_island_fuse_block');let s=f.s;
  s=once(s,'(local $mi_last i32)','(local $mi_last i32) (local $mi_saw i32) (local $mi_last_mix i32)');
  s=once(s,'(local.set $mi_last (i32.const 0))','(local.set $mi_last (i32.const 0)) (local.set $mi_saw (i32.const 0)) (local.set $mi_last_mix (i32.const 0))');
  s=once(s,'(local.set $count (i32.add (local.get $count) (i32.const 1)))',
    '(if (i32.lt_u (local.get $fn) (i32.const 66)) (then (local.set $mi_saw (i32.const 1))))\n            (local.set $count (i32.add (local.get $count) (i32.const 1)))');
  s=once(s,'(then (local.set $mi_last (local.get $count))))',
    '(then (local.set $mi_last (local.get $count)) (local.set $mi_last_mix (local.get $mi_saw))))');
  s=once(s,'(i32.shl (local.get $count) (i32.const 20))',
    '(i32.or (i32.shl (local.get $count) (i32.const 20)) (i32.shl (local.get $mi_last_mix) (i32.const 28)))');
  text=text.slice(0,f.a)+s+text.slice(f.b);
  for(const fn of ['x87_island_generic','x87_island_fast']){
    const m=part(text,fn);const helper=once(m.s,'(func $'+fn+' ','(func $'+fn+'_mixed ');
    const pure=once(part(original,fn).s,'(local.set $cursor (global.get $ip))',
      `(if (i32.and (local.get $packed) (i32.const 0x10000000)) (then (return (call $${fn}_mixed (local.get $packed)))))\n    (local.set $cursor (global.get $ip))`);
    text=text.slice(0,m.a)+pure+'\n\n  '+helper+text.slice(m.b);
  }
  return text;
}
module.exports={transform};
