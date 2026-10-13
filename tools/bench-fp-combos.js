'use strict';
// Frozen-source P/C/D factorial. C changes only the island loop counter.
// D uses compact address tags in owned island records, never guest addresses.
const assert=require('assert');
const {transform:split}=require('./bench-mixed-split');
const {transform:predecode}=require('./bench-fp-predecode');
function once(s,a,b){assert.equal(s.split(a).length,2,`unique seam ${a.slice(0,80)}`);return s.replace(a,b);}
function end(s,a){let n=0;for(let i=a;i<s.length;i++){if(s[i]==='"'){while(++i<s.length&&s[i]!=='"')if(s[i]==='\\')i++;continue;}if(s[i]===';'&&s[i+1]===';'){while(i<s.length&&s[i]!=='\n')i++;continue;}if(s[i]==='(')n++;else if(s[i]===')'&&!--n)return i+1;}throw Error('unbalanced');}
function edit(s,fn,f){const a=s.search(new RegExp('\\(func \\$'+fn+'\\s'));assert(a>=0,fn);const b=end(s,a);return s.slice(0,a)+f(s.slice(a,b))+s.slice(b);}
function transform(name,original){
  const mode=process.env.FP_COMBO||'pcd';assert(['control','p','c','pc','pcm','pcp','d','pd','cd','pcd'].includes(mode));
  const P=mode.includes('p'),C=mode!=='control'&&mode.includes('c'),D=mode.includes('d');
  let text;
  if(P){const saved=process.env.FP_PREDECODE;process.env.FP_PREDECODE='p';try{text=predecode(name,original);}finally{if(saved===undefined)delete process.env.FP_PREDECODE;else process.env.FP_PREDECODE=saved;}}
  else text=split(name,original);
  if(name==='07-decoder.wat'&&D){const seam=P?'(call $pd_prepare_islands)':'(call $x87_fuse_pass (local.get $start_eip))';return once(text,seam,seam+'\n    (call $cd_prepare_addresses)');}
  if(name!=='07b-loop-match.wat')return text;
  for(const fn of ['x87_island_generic','x87_island_generic_mixed','x87_island_fast','x87_island_fast_mixed'])text=edit(text,fn,s=>{
    // Isolate countdown effects: pcm changes mixed evaluators, pcp pure ones.
    const countThis=C&&(mode==='pcm'?fn.endsWith('_mixed'):mode==='pcp'?!fn.endsWith('_mixed'):true);
    if(countThis){
      s=once(s,'(local $i i32)','');
      s=once(s,'(local.set $i (i32.add (local.get $i) (i32.const 1)))','(local.set $count (i32.sub (local.get $count) (i32.const 1)))');
      s=once(s,'(br_if $done (i32.ge_u (local.get $i) (local.get $count)))','(br_if $done (i32.eqz (local.get $count)))');
      assert(!s.includes('(local.get $i)'));
    }
    if(!D)return s;
    // Integer bridges are H3/H64/H65; compact FP tags are 0/1/2.
    if(fn.endsWith('_mixed'))s=once(s,'(i32.lt_u (local.get $fn) (i32.const 66))','(i32.ge_u (local.get $fn) (i32.const 3))');
    // Canonical semantic helpers still receive group/reg decoded from op.
    s=s.replace(/\(i32.const 188\)/g,'(i32.const 0)').replace(/\(i32.const 189\)/g,'(i32.const 1)').replace(/\(i32.const 190\)/g,'(i32.const 2)');
    if(!fn.includes('_fast'))return s;
    const a=s.indexOf('(if (i32.eq (local.get $fn) (i32.const 1))');assert(a>=0);const b=end(s,a);
    const common='(local.set $r (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 15)))';
    const address=`(block $cd_addr_end (block $cd_mem_done (block $cd_base (block $cd_reg (block $cd_abs
      (br_table $cd_abs $cd_reg $cd_base $cd_addr_end (local.get $fn)))
      (local.set $addr (i32.load (local.get $cursor)))
      (if (i32.eq (local.get $addr) (global.get $SIB_SENTINEL)) (then (local.set $addr (global.get $ea_temp))))
      ${P?'':'(local.set $r (i32.and (local.get $op) (i32.const 15))) (local.set $g (i32.shr_u (local.get $op) (i32.const 4)))'}
      (br $cd_mem_done))
      (local.set $rm (i32.and (local.get $op) (i32.const 15)))
      ${P?'':common+' (local.set $g (i32.or (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 8)))'}
      (br $cd_addr_end))
      (local.set $addr (i32.add (i32.load (i32.add (global.get $reg_base)
        (i32.shl (i32.and (local.get $op) (i32.const 15)) (i32.const 2)))) (i32.load (local.get $cursor))))
      ${P?'':common+' (local.set $g (i32.shr_u (local.get $op) (i32.const 8)))'})
      (local.set $cursor (i32.add (local.get $cursor) (i32.const 4))))`;
    return s.slice(0,a)+address+s.slice(b);
  });
  if(D)text+=`\n(func $cd_prepare_addresses
    (local $i i32) (local $j i32) (local $p i32) (local $q i32)
    (local $packed i32) (local $count i32) (local $fn i32)
    (if (global.get $block_exec_enabled) (then (unreachable)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $op_index_n)))
      (local.set $p (call $loop_op_at (local.get $i)))
      (local.set $fn (i32.load (local.get $p)))
      (local.set $packed (i32.load offset=4 (local.get $p)))
      (local.set $count (call $x87_fused_span (local.get $fn) (local.get $packed)))
      (if (i32.eq (local.get $fn) (i32.const 451)) (then
        ${P?'':`(local.set $fn (i32.and (i32.shr_u (local.get $packed) (i32.const 12)) (i32.const 255)))
        (i32.store offset=4 (local.get $p) (i32.or (i32.and (local.get $packed) (i32.const 0xFFF00FFF))
          (i32.shl (i32.sub (local.get $fn) (i32.const 188)) (i32.const 12))))`}
        (local.set $j (i32.const 1))
        (block $end (loop $ops
          (br_if $end (i32.ge_u (local.get $j) (local.get $count)))
          (local.set $q (call $loop_op_at (i32.add (local.get $i) (local.get $j))))
          (local.set $fn (i32.load (local.get $q)))
          (if (i32.and (i32.ge_u (local.get $fn) (i32.const 188)) (i32.le_u (local.get $fn) (i32.const 190)))
            (then (i32.store (local.get $q) (i32.sub (local.get $fn) (i32.const 188)))))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $ops)))))
      ;; Skip all earlier fusers' owned spans, including dead nested islands.
      (local.set $i (i32.add (local.get $i) (select (local.get $count) (i32.const 1) (local.get $count))))
      (br $scan))))\n`;
  return text;
}
module.exports={transform};
