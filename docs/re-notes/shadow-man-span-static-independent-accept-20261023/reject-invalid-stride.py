#!/usr/bin/env python3
"""One independent declaration-law regression; Python only, no compilation."""
import hashlib, importlib.util, json, pathlib, sys
sys.dont_write_bytecode = True
H = pathlib.Path(__file__).resolve().parent
s = importlib.util.spec_from_file_location('abi', H/'static-abi.py')
a = importlib.util.module_from_spec(s); s.loader.exec_module(a)
# Exact pinned CS_RING declaration, with only stride 0x4 changed to 0x8.
# Compiler law: stride * count MUST equal size (codegen.js:2176).
source = '''(region.declare $CS_RING (size 0x00000100) (align 0x00000100)
    (stride 0x8 (count 64)) (mask $CS_MASK) (size-is-power-of-2)
    (owner "05-alu.wat:$cs_push"))'''
serialization = 'CS_RING:00000100:00000100\n'
fingerprint = hashlib.sha256(serialization.encode()).hexdigest()[:16]
mirror = """const REGIONS = {
    CS_RING: { name: 'CS_RING', base: 0x100, size: 0x100, end: 0x200, within: null },
  };
const LAYOUT_HASH = '%s';""" % fingerprint
assert 8 * 64 != 0x100
try:
    result = a.inventory(source, mirror)
except (AssertionError, ValueError, KeyError) as e:
    print(json.dumps({'invalidStrideRejected': True, 'exception': str(e)}))
else:
    print(json.dumps({'invalidStrideRejected': False, 'compilerRequiredSize': 512,
                      'declaredSize': 256, 'acceptedFingerprint': result[2],
                      'serialization': result[1], 'native': False}))
    raise SystemExit(1)
