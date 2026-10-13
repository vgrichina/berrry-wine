'use strict';
// Isolated P/A factorial on the split-island prototype. No production edits.
const assert=require('assert');
const {transform:split}=require('./bench-mixed-split');
function once(s,a,b){assert.equal(s.split(a).length,2,`unique seam ${a.slice(0,70)}`);return s.replace(a,b);}
function endForm(s,a){let depth=0;for(let i=a;i<s.length;i++){const c=s[i];if(c==='"'){while(++i<s.length&&s[i]!=='"')if(s[i]==='\\')i++;continue;}if(c===';'&&s[i+1]===';'){while(i<s.length&&s[i]!=='\n')i++;continue;}if(c==='(')depth++;else if(c===')'&&!--depth)return i+1;}throw Error('unbalanced form');}
function part(s,fn){const a=s.search(new RegExp('\\(func \\$'+fn+'\\s'));assert(a>=0,fn);const b=endForm(s,a);return {a,b,s:s.slice(a,b)};}
function edit(s,fn,f){const p=part(s,fn);return s.slice(0,p.a)+f(p.s)+s.slice(p.b);}
const offset='(i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2))';
const preparedOffset='(i32.and (i32.shr_u (local.get $pd_meta) (i32.const 20)) (i32.const 60))';
function transform(name,original){
  const mode=process.env.FP_PREDECODE||'p';assert(['p','a','pa'].includes(mode));
  const P=mode.includes('p'),A=mode.includes('a');
  let text=split(name,original);
  if(name==='07-decoder.wat')return once(text,'(call $x87_fuse_pass (local.get $start_eip))',
    '(call $x87_fuse_pass (local.get $start_eip))\n    (call $pd_prepare_islands)');
  if(name!=='07b-loop-match.wat')return text;

  // Selector zero uses the existing canonical semantic helpers. Register
  // index and memory addressing remain dynamic; no guest address is cached.
  const cases=['(br $pd_fallback)'],selectors=[];
  function add(g,r,body){const id=cases.length;assert(id<64);selectors.push({g,r,id});cases.push(body+'\n(br $next_op)');}
  const arith=(r,a,b,dst,pop=false,ze=false)=>{
    let s='';if(r===2||r===3)s=`(call $fpu_compare ${a} ${b})`+(r===3?' (drop (x87i-pop))':'');
    else {const op={0:'add',1:'mul',4:'sub',5:'sub',6:'div',7:'div'}[r];const rev=r===5||r===7;
      if(ze&&r>=6)s=`(if (f64.eq ${rev?a:b} (f64.const 0)) (then (call $fpu_set_exc (i32.const 0x04))))\n`;
      s+=`(${dst} (f64.${op} ${rev?b:a} ${rev?a:b}))`;if(pop)s+=' (drop (x87i-pop))';}
    return s;
  };
  for(const [g,load]of [[0,'(f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $addr))))'],[4,'(f64.reinterpret_i64 (call $gl64 (local.get $addr)))'],[8,'(x87i-get-rm)']])
    for(let r=0;r<8;r++)add(g,r,`(local.set $v ${load})\n`+arith(r,'(local.get $st0)','(local.get $v)','x87i-set0',false,true));
  for(const [g,load,store]of [[1,'(f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $addr))))',v=>`(call $gs32 (local.get $addr) (i32.reinterpret_f32 (f32.demote_f64 ${v})))`],
    [5,'(f64.reinterpret_i64 (call $gl64 (local.get $addr)))',v=>`(call $gs64 (local.get $addr) (i64.reinterpret_f64 ${v}))`]]){
    add(g,0,`(x87i-push ${load})`);add(g,2,store('(local.get $st0)'));add(g,3,store('(x87i-pop)'));
  }
  add(9,0,'(x87i-push (x87i-get-rm))');
  // Reuse the exact existing FXCH body, including raw integer shadows.
  const fast=part(original,'x87_island_fast').s;
  const fx=fast.indexOf(';; FXCH ST(i)');assert(fx>=0);
  const then=fast.indexOf('(then',fx),thenEnd=endForm(fast,then);
  add(9,1,fast.slice(then+5,thenEnd-1).replace('(br $next_op)',''));
  add(13,2,'(x87i-set-rm (local.get $st0))');
  add(13,3,'(x87i-set-rm (local.get $st0)) (drop (x87i-pop))');
  for(const g of [12,14])for(const r of [0,1,4,5,6,7]){
    // DC/DE register SUB/DIV use the opposite r4/5, r6/7 direction to D8.
    const mapped=r<4?r:r^1;
    add(g,r,'(local.set $v (x87i-get-rm))\n'+arith(mapped,'(local.get $v)','(local.get $st0)','x87i-set-rm',g===14,false));
  }
  for(const [g,bits,load]of [[3,32,'(f64.convert_i32_s (call $gl32 (local.get $addr)))'],[7,16,'(f64.convert_i32_s (i32.extend16_s (call $gl16 (local.get $addr))))']]){
    add(g,0,`(x87i-push ${load})`);for(const r of [2,3])add(g,r,`(call $gs${bits} (local.get $addr) (call $fpu_to_i${bits} ${r===3?'(x87i-pop)':'(local.get $st0)'}))`);
  }
  const group=`(if (result i32) (i32.eq (local.get $fn) (i32.const 188))
    (then (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 7)))
    (else (i32.or (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 7))
      (select (i32.const 8) (i32.const 0) (i32.eq (local.get $fn) (i32.const 189))))))`;
  const reg=`(if (result i32) (i32.eq (local.get $fn) (i32.const 188))
    (then (i32.and (local.get $op) (i32.const 7)))
    (else (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 7))))`;
  text+=`\n(func $pd_selector (param $fn i32) (param $op i32) (result i32)
    (local $key i32) (local.set $key (i32.or (i32.shl ${group} (i32.const 3)) ${reg}))
    ${selectors.map(v=>`(if (i32.eq (local.get $key) (i32.const ${v.g*8+v.r})) (then (return (i32.const ${v.id}))))`).join('\n')}
    (i32.const 0))
  (func $pd_prepare_islands
    (local $i i32) (local $j i32) (local $p i32) (local $q i32)
    (local $packed i32) (local $count i32) (local $fn i32) (local $op i32)
    ;; Experimental encoding has not been integrated with the old executor's
    ;; pre-fusion region copies. Refuse that configuration rather than silently
    ;; interpreting an old descriptor as the new one. Benchmark uses uops.
    (if (global.get $block_exec_enabled) (then (unreachable)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $op_index_n)))
      (local.set $p (call $loop_op_at (local.get $i)))
      (if (i32.eq (i32.load (local.get $p)) (i32.const 451)) (then
        (local.set $packed (i32.load offset=4 (local.get $p)))
        (local.set $count (i32.and (i32.shr_u (local.get $packed) (i32.const 20)) (i32.const 255)))
        (local.set $fn (i32.and (i32.shr_u (local.get $packed) (i32.const 12)) (i32.const 255)))
        (local.set $op (i32.and (local.get $packed) (i32.const 4095)))
        ${P?`(i32.store offset=4 (local.get $p) (i32.or (i32.and (local.get $packed) (i32.const 0xFFF00FFF))
          (i32.shl (i32.or (i32.sub (local.get $fn) (i32.const 188))
            (i32.shl (call $pd_selector (local.get $fn) (local.get $op)) (i32.const 2))) (i32.const 12))))`:''}
        (local.set $j (i32.const 1))
        (block $end (loop $ops
          (br_if $end (i32.ge_u (local.get $j) (local.get $count)))
          (local.set $q (call $loop_op_at (i32.add (local.get $i) (local.get $j))))
          (local.set $fn (i32.load (local.get $q)))
          (local.set $op (i32.load offset=4 (local.get $q)))
          (if (i32.and (i32.ge_u (local.get $fn) (i32.const 188)) (i32.le_u (local.get $fn) (i32.const 190)))
            (then (i32.store offset=4 (local.get $q)
              (i32.or (i32.and (local.get $op) (i32.const 4095))
                (i32.or ${P?'(i32.shl (call $pd_selector (local.get $fn) (local.get $op)) (i32.const 12))':'(i32.const 0)'}
                  ${A?'(i32.shl (i32.and (local.get $op) (i32.const 15)) (i32.const 22))':'(i32.const 0)'})))))
          (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $ops)))
        (local.set $i (i32.add (local.get $i) (i32.sub (local.get $count) (i32.const 1)))))
        (else
          ;; Earlier fusers leave absorbed OP_INDEX records behind. A dead
          ;; H451 can begin inside their span and extend past it: preparing
          ;; that dead island would annotate live standalone FP operands.
          ;; Walk executable spans, not every original instruction record.
          (local.set $count (call $x87_fused_span (i32.load (local.get $p)) (i32.load offset=4 (local.get $p))))
          (if (local.get $count) (then
            (local.set $i (i32.add (local.get $i) (i32.sub (local.get $count) (i32.const 1))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan))))\n`;

  for(const fn of ['x87_island_generic','x87_island_generic_mixed','x87_island_fast','x87_island_fast_mixed'])text=edit(text,fn,s=>{
    const isFast=fn.includes('_fast');
    if(P)s=once(s,'(local.set $fn (i32.and (i32.shr_u (local.get $packed) (i32.const 12)) (i32.const 0xFF)))',
      '(local.set $fn (i32.add (i32.const 188) (i32.and (i32.shr_u (local.get $packed) (i32.const 12)) (i32.const 3))))');
    const next='(local.set $op (i32.load offset=4 (local.get $cursor)))';
    if(!isFast)return once(s,next,'(local.set $op (i32.and (i32.load offset=4 (local.get $cursor)) (i32.const 4095)))');
    s=once(s,'(local $g2w_wa i32)','(local $g2w_wa i32) (local $pd_meta i32) (local $pd_sel i32)');
    s=once(s,'(local.set $base (global.get $fpu_base))',
      `(local.set $pd_meta (i32.shl (i32.and (local.get $op) (i32.const 15)) (i32.const 22)))
       (local.set $pd_sel (i32.and (i32.shr_u (local.get $packed) (i32.const 14)) (i32.const 63)))
       (local.set $base (global.get $fpu_base))`);
    s=once(s,next,`(local.set $pd_meta (i32.load offset=4 (local.get $cursor)))
      (local.set $op (i32.and (local.get $pd_meta) (i32.const 4095)))
      (local.set $pd_sel (i32.and (i32.shr_u (local.get $pd_meta) (i32.const 12)) (i32.const 63)))`);
    if(!P)return once(s,offset,preparedOffset);
    const start=s.indexOf('      ;; ---- decode:'),end=s.indexOf('      ;; $next_op\n',start);assert(start>=0&&end>start);
    const address=`(if (i32.eq (local.get $fn) (i32.const 189))
      (then (local.set $rm (i32.and (local.get $op) (i32.const 15))))
      (else
        (if (i32.eq (local.get $fn) (i32.const 188))
          (then (local.set $addr (i32.load (local.get $cursor)))
            (if (i32.eq (local.get $addr) (global.get $SIB_SENTINEL)) (then (local.set $addr (global.get $ea_temp)))))
          (else (local.set $addr (i32.add (i32.load (i32.add (global.get $reg_base) ${A?preparedOffset:offset})) (i32.load (local.get $cursor))))))
        (local.set $cursor (i32.add (local.get $cursor) (i32.const 4)))))`;
    const dispatch=`(block $next_op (block $pd_fallback
      ${cases.map((_,i)=>`(block $pd${cases.length-1-i}`).join(' ')}
      (br_table ${cases.map((_,i)=>'$pd'+i).join(' ')} $pd_fallback (local.get $pd_sel))
      ${cases.map(body=>')\n'+body).join('\n')})
      (local.set $g ${group}) (local.set $r ${reg})
      (x87i-publish)
      (if (i32.ge_u (local.get $g) (i32.const 8))
        (then (call $fpu_exec_reg (i32.and (local.get $g) (i32.const 7)) (local.get $r) (local.get $rm)))
        (else (call $fpu_exec_mem (local.get $g) (local.get $r) (local.get $addr))))
      (x87i-reload))\n`;
    return s.slice(0,start)+address+'\n'+dispatch+s.slice(end);
  });
  return text;
}
module.exports={transform};
