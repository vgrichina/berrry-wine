#!/usr/bin/env python3
"""Focused source-derived declaration laws; no compiler/native execution."""
import hashlib, importlib.util, pathlib, sys, unittest
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('abi',H/'static-abi.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

def fixture(clauses='',globals='',size=256):
 source=f'(region.declare $R (size {size}) {clauses})\n'+globals
 text=f'R:00000100:{size:08X}\n'
 mirror="const REGIONS = {\n    R: { name: 'R', base: 0x100, size: 0x%x, end: 0x%x, within: null },\n  };\nconst LAYOUT_HASH = '%s';"%(size,256+size,hashlib.sha256(text.encode()).hexdigest()[:16])
 return source,mirror

class Laws(unittest.TestCase):
 def good(self,clauses='',globals='',size=256):
  source,mirror=fixture(clauses,globals,size)
  result=a.inventory(source,mirror)
  self.assertEqual(result[0][0]['size'],size)
  self.assertEqual(a.inventory('(module '+source+')',mirror),result)
 def bad(self,clauses='',globals='',size=256,reason=None):
  source,mirror=fixture(clauses,globals,size)
  with self.assertRaisesRegex((AssertionError,ValueError,KeyError),reason or '.*'):a.inventory(source,mirror)
 def test_stride_literals_and_constant_operands(self):
  self.good('(stride 4 (count 64))')
  self.good('(stride $S (count $N))','(global $S i32 (i32.const 4)) (global $N i32 (i32.const 64))')
  self.good('(stride +0X4 (count 0x4_0))')
  self.good('(stride 256 (count 1))')
 def test_stride_size_mismatch(self):
  for clause in ('(stride 8 (count 64))','(stride 4 (count 63))','(stride 4 (count 65))'):
   with self.subTest(clause=clause):self.bad(clause,reason='stride/count size law')
 def test_stride_count_zero_negative(self):
  for clause in ('(stride 0 (count 64))','(stride 4 (count 0))'):
   with self.subTest(clause=clause):self.bad(clause,reason='positivity law')
  for clause in ('(stride $Z (count 64))','(stride 4 (count $Z))'):
   for v in ('0','-1','-0x80000000'):
    with self.subTest(clause=clause,value=v):self.bad(clause,f'(global $Z i32 (i32.const {v}))',reason='positivity law')
  self.bad('(stride -4 (count 64))',reason='u32 bounds')
 def test_overflow_never_wraps(self):
  self.bad('(stride 0x80000001 (count 256))',reason='stride/count size law') # i32 wrap would equal256
  self.bad('(stride 0xffffffff (count 0xffffffff))',reason='stride/count size law')
  self.bad('(stride 0x100000000 (count 1))',reason='bounds')
  self.bad('(stride $S (count 1))','(global $S i32 (i32.const 9007199254740993))',reason='immutable i32 constant')
 def test_stride_count_global_identity(self):
  for clause in ('(stride $X (count 64))','(stride 4 (count $X))'):
   for g in ('','(global $X (mut i32) (i32.const 4))','(global $X i64 (i32.const 4))','(global $X i32 (global.get $Y))','(global $X i32 (i32.const 4 9))','(global $X i32 (i32.const 4_))'):
    with self.subTest(clause=clause,g=g):self.bad(clause,g,reason='immutable i32 constant')
 def test_mask_byte_cardinality_and_one_slot(self):
  self.good('(mask $M)','(global $M i32 (i32.const 255))')
  self.good('(mask $M) (size-is-power-of-2)','(global $M i32 (i32.const 0))',size=1)
 def test_mask_stride_cardinality(self):
  self.good('(stride 4 (count 64)) (mask $M) (size-is-power-of-2)','(global $M i32 (i32.const 63))')
  self.good('(stride 3 (count 64)) (mask $M)','(global $M i32 (i32.const 63))',size=192)
  self.bad('(stride 4 (count 64)) (mask $M)','(global $M i32 (i32.const 255))',reason='mask slots-1 law')
 def test_mask_requires_actual_immutable_i32_global(self):
  for g in ('','(global $M (mut i32) (i32.const 255))','(global $M i64 (i64.const 255))','(global $M f32 (i32.const 255))','(global $M i32 (i32.add (i32.const 254) (i32.const 1)))','(global $M i32 (i32.const 255) extra)','(global $M i32 (i32.const 255 0))'):
   with self.subTest(g=g):self.bad('(mask $M)',g,reason='immutable i32 constant')
  self.bad('(mask 255)',reason='name required')
 def test_mask_exact_value_and_slots_power(self):
  for v in ('254','256','-1','0xffffffff'):
   with self.subTest(v=v):self.bad('(mask $M)',f'(global $M i32 (i32.const {v}))',reason='mask slots-1 law')
  self.bad('(mask $M)','(global $M i32 (i32.const 191))',size=192,reason='mask power-of-two slots law')
  self.bad('(stride 4 (count 48)) (mask $M)','(global $M i32 (i32.const 47))',size=192,reason='mask power-of-two slots law')
 def test_power_law(self):
  for size in (1,2,256,0x10000000):self.good('(size-is-power-of-2)',size=size)
  for size in (3,192,255):self.bad('(size-is-power-of-2)',size=size,reason='size-is-power-of-2 law')
  self.bad('(size-is-power-of-2)',size=0,reason='positive region extent required')
 def test_clause_schema(self):
  for clause in ('(stride 4)','(stride 4 64)','(stride 4 (count))','(stride 4 (count 64 1))','(stride 4 (slots 64))','(stride 4 (count 64) 0)','(mask)','(mask $M $N)','(size-is-power-of-2 1)','(align 4 8)','(within R)','(base 0x100 1)','(owner "one" "two")','(count 64)','(stride (i32.const 4) (count 64))'):
   with self.subTest(clause=clause):self.bad(clause)
 def test_constant_spoof_duplicate_and_comments(self):
  self.bad('(mask $M)','(global $M i32 (i32.const 255)) (global $M i32 (i32.const 0))',reason='duplicate global')
  self.bad('(mask $M)',';; (global $M i32 (i32.const 255))',reason='immutable i32 constant')
  self.bad('(mask $M)','(; (global $M i32 (i32.const 255)) ;)',reason='immutable i32 constant')
  self.bad('(mask $M)','(func $fake (global $M i32 (i32.const 255)))',reason='unsupported nested declaration')
  self.good('(mask $M)','(; fake (; nested ;) ;) (global $M i32 (i32.const 255))')
 def test_supported_scope_and_literal_grammar(self):
  for suffix in ('(region.image-base 0x500000)','(region.gap 4 (reason "gap"))'):
   source,mirror=fixture()
   with self.assertRaisesRegex(AssertionError,'unsupported declaration'):a.inventory(source+suffix,mirror)
  for token in ('4_','0x_4','0x4__0','4oops','1.0'):
   self.bad(f'(stride {token} (count 64))',reason='unsupported integer')
 def test_all_heads_use_laws_and_extent(self):
  source,mirror=fixture('(stride 8 (count 64))')
  source=source.replace('region.declare $R','region.declare-fixed $R (base 0x100)')
  with self.assertRaisesRegex(AssertionError,'stride/count size law'):a.inventory(source,mirror)
  with self.assertRaisesRegex(AssertionError,'stride/count size law'):a.inventory(source.replace('(size 256)','(end 0x200)'),mirror)
  for c in ('(stride 4 (count 64))','(mask $M)','(size-is-power-of-2)'):
   with self.assertRaises(AssertionError):a.declarations(f'(region.declare-span $S (base 0) (size 256) (owner "limit") {c})')

if __name__=='__main__':unittest.main(verbosity=2)
