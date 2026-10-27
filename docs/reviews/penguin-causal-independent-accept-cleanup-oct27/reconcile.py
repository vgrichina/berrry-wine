import pathlib,json,hashlib,ast,time
from collections import Counter
H=pathlib.Path(__file__).parent
I=pathlib.Path('/tmp/penguin-streams-independent-accept-oct27')
D=pathlib.Path('/tmp/penguin-stream-open-causal-repair-oct27')
P=pathlib.Path('/tmp/penguin-causal-retained-publication-cleanup-oct27/ops')
sha=lambda b:hashlib.sha256(b).hexdigest()
old=json.loads((I/'ops/evidence-manifest.json').read_text())
for x in old:
 b=pathlib.Path(x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['path']
assert len(old)==158
retained=[]
for line in (D/'ops/evidence-manifest.sha256').read_text().splitlines():
 h,p=line.split('  ',1);b=pathlib.Path(p).read_bytes();assert sha(b)==h,p;retained.append(dict(path=p,sha256=h,bytes=len(b)))
assert len(retained)==124
compact=D/'repo/docs/reviews/penguin-stream-open-causal-repair-oct27'
man=json.loads((compact/'hashmanifest.json').read_text())
assert sha((compact/'hashmanifest.json').read_bytes())=='e7d91c8fd67512d02b00fc7be3e6b9d5323fd5916cdaccc70c7d30ef7fc42f5a'
for p,q in man.items():
 b=(compact/p).read_bytes();assert len(b)==q['bytes'] and sha(b)==q['sha256'],p
priorDocs=list((I/'repo/docs/reviews/penguin-streams-independent-accept-oct27').rglob('*'))
priorFiles=[p for p in priorDocs if p.is_file()]
# The 135-path collection is preserved in place, with its index identity bound
# independently of Git output; Git staging enumeration is verified at publication.
index=I/'repo/.git/index'
def purpose(p):
 name=pathlib.Path(p).name
 if 'account' in name or 'baseline' in name:return 'resource/accounting/checkpoint'
 if name.endswith('.py'):return 'reproducers and harness'
 if '/after/' in p:return 'original production CLI four-case evidence'
 if '/independent/' in p:return 'independent stream/fault seven-case evidence'
 if 'json' in name:return 'pins, acceptance decisions and operation receipts'
 return 'stdout/stderr/capture and publication diagnostics'
contentOld={q['sha256'] for q in old};contentRepair={q['sha256'] for q in retained}
report=dict(at=time.time(),result='PASS',priorOpsPayloads=len(old),priorOpsManifestSHA256=sha((I/'ops/evidence-manifest.json').read_bytes()),priorIndexSHA256=sha(index.read_bytes()),priorDocsFileCount=len(priorFiles),priorDocsFiles=[str(p.relative_to(I/'repo')) for p in priorFiles],priorPurposeCounts=dict(Counter(purpose(x['path']) for x in old)),repairPayloads=len(retained),repairCompactFiles=len(man),sharedContentHashes=len(contentOld&contentRepair),priorOnlyPurpose='Full original acceptance launch, independent stream and fault traces, resource/publication rejection and process cleanup; preserved intact in prior repo/ops, referenced without wholesale recopy.',repairOnlyPurpose='Causal stream-open fix, original rejection/reproducer subset, affected open/fallback and combined-diagnostic tests, repair diff and retained resource denial. Compact selection, not replacement of original full collection.',reused=json.loads((D/'ops/tested-checkpoint.json').read_text()),publicationReceiptSHA256=sha((P/'result.json').read_bytes()),mismatches=0)
# Guard, profile, transport and other functions remain byte-equivalent in AST;
# only supervise changed, already independently exercised at CLI boundary.
a=ast.parse((I/'repo/tools/penguin_capture_contract.py').read_bytes());b=ast.parse((H.parent/'repo/tools/penguin_capture_contract.py').read_bytes())
funcs=lambda t:{n.name:ast.dump(n,include_attributes=False) for n in t.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))}
aa,bb=funcs(a),funcs(b);changed=[n for n in aa if aa[n]!=bb.get(n)]
assert changed==['supervise'],changed
report['changedFunctions']=changed;report['unchangedFunctions']=[n for n in aa if aa[n]==bb.get(n)]
(H/'reuse-reconciliation.json').write_text(json.dumps(report,indent=2)+'\n')
print('158 prior payloads and124 repair payloads rehashed; compact file purposes reconciled; unchanged guard/transport accepted groups reused')
