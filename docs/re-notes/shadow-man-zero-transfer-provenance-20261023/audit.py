#!/usr/bin/env python3
"""Source identity and focused diff checks; no compiler/runtime dependencies."""
import hashlib, json, pathlib, re, subprocess
H = pathlib.Path(__file__).resolve().parent
R = H.parents[2]
BASE = 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
OWNED = ['src/05-alu.wat', 'src/09b-dispatch.wat', 'src/13-exports.wat',
         'tools/shadow-man-null-capture.cjs', 'tools/shadow-man-null-preload.cjs']
def git(*args):
    return subprocess.check_output(['git', *args], cwd=R)
def sha(b):
    return hashlib.sha256(b).hexdigest()
assert git('rev-parse', 'HEAD').decode().strip() == BASE or git('merge-base', 'HEAD', BASE).decode().strip() == BASE
changed = git('diff', '--name-only', BASE, '--', 'src', 'tools', 'test').decode().splitlines()
assert sorted(changed) == sorted(OWNED), changed
identities = {}
for p in OWNED + ['test/run.js']:
    before, after = git('show', BASE+':'+p), (R/p).read_bytes()
    identities[p] = dict(baseBlob=git('rev-parse', BASE+':'+p).decode().strip(),
                         baseBytes=len(before), baseSha256=sha(before),
                         patchedBytes=len(after), patchedSha256=sha(after))
    if p == 'test/run.js':
        assert before == after
    if p.endswith('.wat'):
        assert re.findall(rb'\(export "[^"]+"', before) == re.findall(rb'\(export "[^"]+"', after), 'named export census changed'
        assert re.findall(rb'\(import [^\n]+', before) == re.findall(rb'\(import [^\n]+', after), 'import census changed'
after = (R/'src/13-exports.wat').read_text()
decls = re.findall(r'\(global (\$null_transfer_\w+) \(mut (i32|i64)\)', after)
assert len(decls) == len(set(n for n, _ in decls))
assert all(typ in ('i32', 'i64') for _, typ in decls)
record = after[after.index('  (func $null_transfer_record'):after.index('  (func $null_transfer_check')]
assert 'i32.store' not in record and 'host_log' not in record and '(global.set $eip' not in record
# Zero context avoids whitespace-only context lines in the retained patch file
# itself; apply this artifact with git apply --unidiff-zero.
patch = git('diff', '--unified=0', BASE, '--', *OWNED)
(H/'focused-source.patch').write_bytes(patch)
git('diff', '--check', BASE, '--', *OWNED)
(H/'source-identities.json').write_text(json.dumps(dict(base=BASE, files=identities,
    newMutableGlobals=decls, newMutableGlobalValueBytes=sum(8 if t=='i64' else 4 for _, t in decls),
    namedImportExportCensus='unchanged in all edited native fragments; source check only',
    storageRegions='no region declarations or linear memory allocation changed',
    producerHashes='not refreshed; new candidate needs independent review and canonical/native qualification',
    patchBytes=len(patch), patchSha256=sha(patch)), indent=2)+'\n')
# Retain initial mistaken tier filename in the first receipt/audit; correct it
# here using candidate's actual tree paths, not a different checkout's files.
paths = ['src/04-cache.wat','src/05c-seg16-ops.wat','src/06b-core-handlers.wat',
         'src/07d-uop-engine.wat','src/07e-uop-compiler.wat','src/09c3a-dialog-runtime.wat']
audit = {}
for p in paths:
    b = git('show', BASE+':'+p)
    audit[p] = dict(blob=git('rev-parse', BASE+':'+p).decode().strip(),bytes=len(b),sha256=sha(b),
        selectedLines=[dict(line=i,text=l) for i,l in enumerate(b.decode().splitlines(),1)
        if any(s in l for s in ['global.set $eip','func $branch_end','dbg_chain_guard','dbg_tier_guard','null_diag_event','func $th_ret'])])
(H/'transfer-path-audit-corrected.json').write_text(json.dumps(audit, indent=2)+'\n')
print(json.dumps(dict(exit=0, exactBase=BASE, changed=changed, cliUnchanged=True,
                     newMutableGlobalValueBytes=sum(8 if t=='i64' else 4 for _,t in decls),
                     patchBytes=len(patch), qualification='offline source/identity only')))
