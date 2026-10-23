#!/usr/bin/env python3
"""Independent derived-region controls with matching source and mirror extents."""
import hashlib,importlib.util,json,pathlib,sys
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('abi',H/'static-abi.py')
a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
lines='GUEST_BASE:00012000:00000100\nR:00013000:00000100\n'
fingerprint=hashlib.sha256(lines.encode()).hexdigest()[:16]
mirror="""const REGIONS = {
    GUEST_BASE: { name: 'GUEST_BASE', base: 0x12000, size: 0x100, end: 0x12100, within: null },
    R: { name: 'R', base: 0x13000, size: 0x100, end: 0x13100, within: null },
  };
const LAYOUT_HASH = '%s';"""%fingerprint
source='''(module
 (region.declare-fixed $GUEST_BASE (base 0x12000) (size 256))
 (region.declare-derived $R (base (g2w 0x401000)) (size 256)
   (stride $S (count $N)) (mask $M) (size-is-power-of-2))
 (global $S i32 (i32.const 2))
 (global $N i32 (i32.const 128))
 (global $M i32 (i32.const 127)))'''
assert a.inventory(source,mirror)[1:]==(lines,fingerprint)
controls=[('derived-global-product',source.replace('(i32.const 2)','(i32.const 4)'),'stride/count size law'),
 ('derived-mask-count-not-byte-size',source.replace('(i32.const 127)','(i32.const 255)'),'mask slots-1 law'),
 ('unsupported-exported-law-global',source.replace('$M i32','$M (export "mask") i32'),'immutable i32 constant global required')]
results=[]
for name,changed,law in controls:
 try:a.inventory(changed,mirror)
 except (AssertionError,ValueError,KeyError) as e:
  assert law in str(e),(name,str(e));results.append(dict(name=name,intendedLaw=law,exception=str(e),rejected=True))
 else:raise AssertionError(('negative control accepted',name))
print(json.dumps(dict(positiveDerivedGlobalControl=True,controls=results,native=False)))
