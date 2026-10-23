#!/usr/bin/env python3
"""Exact-revision source receipt only. Does not compile or load any module."""
import hashlib,json,pathlib,re,subprocess
H=pathlib.Path(__file__).resolve().parent
D=pathlib.Path('/home/user/wine-assembly-shadow-man-zero-transfer-provenance-oct23')
C='2e6f5984d3f64d7781fb02da09bbb8d564302123'
B='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
def git(*a): return subprocess.check_output(['git',*a],cwd=D)
def source(p): return git('show',C+':'+p)
def sha(b): return hashlib.sha256(b).hexdigest()
assert git('rev-parse',C+'^').decode().strip()==B
paths=['src/05-alu.wat','src/09b-dispatch.wat','src/13-exports.wat','tools/shadow-man-null-capture.cjs','tools/shadow-man-null-preload.cjs']
assert sorted(git('diff','--name-only',B,C,'--','src','tools','test').decode().splitlines())==sorted(paths)
patch=git('diff','--unified=0',B,C,'--',*paths)
assert patch==(D/'docs/re-notes/shadow-man-zero-transfer-provenance-20261023/focused-source.patch').read_bytes()
identities={}
for p in paths+['test/run.js']:
 b=source(p); assert b==(D/p).read_bytes(),p
 before=git('show',B+':'+p)
 identities[p]={'blob':git('rev-parse',C+':'+p).decode().strip(),'sha256':sha(b),'bytes':len(b),'baseSha256':sha(before)}
 if p.endswith('.wat'):
  for pattern in [rb'\(export "[^"]+"',rb'\(import [^\n]+',rb'\(region\.[^\n]+']:
   assert re.findall(pattern,before)==re.findall(pattern,b),p
assert identities['test/run.js']['sha256']=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
assert source('test/run.js')==git('show',B+':test/run.js')
ex=source('src/13-exports.wat').decode()
decls=re.findall(r'\(global (\$null_transfer_\w+) \(mut (i32|i64)\)',ex)
assert len(decls)==22 and sum(8 if t=='i64' else 4 for _,t in decls)==96
sites={p:[{'line':i,'text':line} for i,line in enumerate(source(p).decode().splitlines(),1) if '$null_transfer_' in line] for p in paths if p.endswith('.wat')}
assert sum(line['text'].count('(call $null_transfer_record') for lines in sites.values() for line in lines)==4
assert sum(line['text'].count('(call $null_transfer_check') for lines in sites.values() for line in lines)==1
windows={'src/05-alu.wat':[(266,281),(650,690),(700,789),(812,832)],'src/09b-dispatch.wat':[(100,175),(218,237),(1333,1344)],'src/13-exports.wat':[(1,131),(161,211),(417,442),(2649,2681),(2716,2723)],'src/04-cache.wat':[(2119,2122),(2150,2180),(2336,2357)],'src/10-helpers.wat':[(3367,3393)],'src/06b-core-handlers.wat':[(173,199)],'src/09c3a-dialog-runtime.wat':[(182,209),(227,281)]}
excerpts={}
for p,ranges in windows.items():
 b=source(p); lines=b.decode().splitlines(); excerpts[p]={'blob':git('rev-parse',C+':'+p).decode().strip(),'sha256':sha(b),'ranges':[{'first':a,'last':z,'text':'\n'.join(f'{i}: {lines[i-1]}' for i in range(a,z+1))} for a,z in ranges]}
(H/'source-excerpts.json').write_text(json.dumps(excerpts,indent=2)+'\n')
receipt={'candidate':C,'exactParent':B,'sourceIdentities':identities,'focusedPatchSha256':sha(patch),'focusedPatchBytes':len(patch),'allNewHelperSites':sites,'newInstanceGlobalValueBytes':96,'globals':decls,'namedImportExportRegionSourceCensus':'unchanged; compiled ABI UNQUALIFIED','mode':2,'protocolVersion':1,'acceptedPackagingReused':'scratch/usage-watch/shadow-man-zero-transfer-provenance-oct23/coordinator-review.json (48 seals; not repeated)','historicalModule':'8fac3993 is NOT proof for this candidate; not copied or instantiated'}
(H/'source-review.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'exactCandidate':C,'exactBase':B,'changedSourceFiles':len(paths),'helperRecordSites':4,'helperCheckSites':1,'instanceGlobalBytes':96,'cliUnchanged':True,'verdict':'PASS_SOURCE_ONLY'}))
