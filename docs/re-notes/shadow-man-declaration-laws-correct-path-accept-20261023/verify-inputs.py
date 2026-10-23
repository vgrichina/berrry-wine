#!/usr/bin/env python3
"""Bind exact read-only inputs and reviewed diff, without executing the compiler."""
import difflib,hashlib,json,pathlib,sys
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent
D=pathlib.Path('/home/user/wine-assembly-shadow-man-static-declaration-laws-repair-oct23')
DH=D/'docs/re-notes/shadow-man-static-declaration-laws-repair-20261023'
C=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
CH=C/'docs/re-notes/shadow-man-span-static-canonical-20261023'
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((CH/'manifest.json').read_text());bindings=json.loads((DH/'source-bindings.json').read_text())
assert manifest['candidate']==bindings['candidate']=='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
inputs=[]
for row in bindings['inputs']:
 b=(C/row['path']).read_bytes();m=next(r for r in manifest['files'] if r['path']==row['path'])
 assert len(b)==row['bytes']==m['bytes'] and sha(b)==row['sha256']==m['sha256']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==row['blob']==m['blob']
 inputs.append(row)
assert sha((H/'static-abi.py').read_bytes())=='2507d350af9a96cb7dea47ab03df36674f07bd89ecc6c740acd37b4fc85d1bd8'
for name in ['static-abi.py','test-static-abi.py','test-declaration-laws.py','reject-invalid-stride.py']:
 assert (H/name).read_bytes()==(DH/name).read_bytes()
assert (H/'test-static-abi.py').read_bytes()==(CH/'test-static-abi.py').read_bytes()
originalProbe=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-independent-accept-oct23/docs/re-notes/shadow-man-span-static-independent-accept-20261023/reject-invalid-stride.py')
assert (H/'reject-invalid-stride.py').read_bytes()==originalProbe.read_bytes()
old=(CH/'static-abi.py').read_text();new=(H/'static-abi.py').read_text()
diff=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),n=0))
retained=(DH/'helper.patch').read_text()
assert diff.splitlines()[2:]==retained.splitlines()[2:],'reviewed patch must describe entire exact helper delta'
compiler=(C/'tools/watx-src/compiler-codegen.js').read_text().splitlines(True)
schema=(DH/'compiler-schema-and-laws.txt').read_text()
assert schema==''.join(compiler[1758:2006]+compiler[2160:2200]),'exact compiler excerpt identity'
initial=json.loads((DH/'initial-declaration-law-tests.json').read_text())
assert initial['exit']==1
assert 'FAILED (failures=1)' in (DH/'initial-declaration-law-tests.stderr').read_text()
for name in ['helper.patch','compiler-schema-and-laws.txt','source-bindings.json','initial-declaration-law-tests.json','initial-declaration-law-tests.stderr','initial-declaration-law-tests.stdout']:
 b=(DH/name).read_bytes()
 # Preserve raw bytes as JSON strings, including diagnostic whitespace.
 (H/(name+'.raw.json')).write_text(json.dumps(dict(donorPath=str(DH/name),bytes=len(b),sha256=sha(b),text=b.decode()),indent=2)+'\n')
result=dict(state='INPUTS_AND_REVIEWED_DIFF_BOUND',repairCommit='9ceffa0c7927431fc0ea575ee5ad2318f68e494c',helperSHA256=sha(new.encode()),sourceInputs=inputs,compilerExcerptExact=True,entireHelperDeltaExact=True,original16Unchanged=True,new14Unchanged=True,originalRejectProbeUnchanged=True,initialRepairRun=dict(exit=1,meaning='failed diagnostic expectation; not a passing run'),native=False)
(H/'input-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
