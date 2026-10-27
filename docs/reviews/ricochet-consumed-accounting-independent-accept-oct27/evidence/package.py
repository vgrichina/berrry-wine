import ast,base64,hashlib,json,pathlib,shutil,time
O=pathlib.Path(__file__).parent;R=O.parent/'repo';D=pathlib.Path('/tmp/ricochet-consumed-control-accounting-repair-oct27/repo');P=D.parent/'ops'
doc=R/'docs/reviews/ricochet-consumed-accounting-independent-accept-oct27';ev=doc/'evidence';ev.mkdir(parents=True,exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def save(p,j):p.write_text(json.dumps(j,indent=2,default=str)+'\n')
checkpoint=json.loads((D/'docs/reviews/ricochet-consumed-control-accounting-repair-oct27/checkpoint.json').read_text())
pins=json.loads((O/'verified-pins.json').read_text());assert pins==checkpoint['pins']
source=(D/'test/ricochet-runtime-accounting.test.py').read_text();tree=ast.parse(source);methods={n.name:sha(ast.get_source_segment(source,n).encode()) for n in ast.walk(tree) if isinstance(n,ast.FunctionDef)}
reuse=[]
for name,group in checkpoint['groups'].items():
 assert methods[name]==group['methodSHA256'],name
 tag=group['receipt'].split('.')[0];receipt=json.loads((P/(tag+'.result.json')).read_text());assert receipt['exit']==0 and receipt['stopReason'] is None and receipt['cleanupComplete'],name
 reuse.append(dict(method=name,methodSHA256=methods[name],receipt=tag))
for tag in sorted({r['receipt'] for r in reuse}):
 for suffix in ('command.json','result.json','stdout','stderr'):
  p=P/(tag+'.'+suffix);b=p.read_bytes();(ev/('reused-'+p.name+'.b64')).write_bytes(base64.b64encode(b)+b'\n')
save(doc/'reused-22-methods.json',dict(candidate='e8cfe229416c4076f68f18c9806a07dd50848cd7',pins=pins,methods=reuse,rerun='only required exact boundary; all other original passing groups reused by method and source identity'))
for name in ('boundary-original.json','publication.json'):
 shutil.copyfile(P/name,ev/('candidate-'+name))
historical=pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27/repo/docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/evidence')
for name in ('api-1793092841347248549-command.json','cpu-accounting.json'):
 shutil.copyfile(historical/name,ev/('historical-'+name))
# Retain the candidate's original checkpoint/recipe as evidence, not executable
# replacement source, and preserve its failed first implementation supervision.
for name in ('checkpoint.json','README.md'):
 shutil.copyfile(D/'docs/reviews/ricochet-consumed-control-accounting-repair-oct27'/name,ev/('candidate-'+name))
for suffix in ('command.json','result.json','stdout','stderr'):
 p=P/('1793093761818542474.'+suffix);(ev/('candidate-first-implementation-'+suffix+'.b64')).write_bytes(base64.b64encode(p.read_bytes())+b'\n')
for p in sorted(O.iterdir()):
 if not p.is_file():continue
 if p.suffix in ('.stdout','.stderr'):(ev/(p.name+'.b64')).write_bytes(base64.b64encode(p.read_bytes())+b'\n')
 elif p.suffix in ('.json','.py'):shutil.copyfile(p,ev/p.name)
admission=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/ricochet-consumed-accounting-independent-accept-oct27-admission.json')
shutil.copyfile(admission,ev/'launcher-admission.json')
shutil.copyfile(admission.parent/'ricochet-consumed-accounting-independent-accept-oct27/root-ref-digest.json',ev/'initial-root-ref-digest.json')
status=dict(status='REJECT',candidate='e8cfe229416c4076f68f18c9806a07dd50848cd7',sourcePins=pins,firstBehavioralReceipt='1793094423373928474',completeRemainingConsumptionWindowsReceipt='1793094495062072046',independentPassedMethods=9,originalReusableMethods=22,rejections=[dict(case='final-inventory symlink and hardlink',receipt='1793094508467405778',acceptedBytes=25178112,assertion='inventory must reject; unchanged strict assertions fail'),dict(case='exact historical API publication prefix follows raced symlink',receipt='1793094594520332898',assertion='retained contents must remain unchanged; strict assertion fails')],minimalReproducer=dict(path='test/ricochet-late-link-minimal.py',receipt='1793094536198190798',expectedExit=1),missingPrerequisite='Production wiring enforcing single outstanding bounded regular single-link JSON, logical+allocated <=24MiB and writer RLIMIT_FSIZE <=24MiB for ALL producers including API-side writers before publication',incidents=['Initial read-only source displays exceeded requested8192B display bound; subsequent operation wrapper bounded display7500B, cumulative initial read output remains below1MiB','Initial final-swap evidence serialization could not encode Path dict keys; original two errors retained; only diagnostic key serialization fixed; exact strict assertions then failed','WAL baseline unavailable: entire current WAL conservatively charged once, not an exact growth claim'],remaining=['candidate repair and fresh independent affected acceptance','all-producer production publication contract and immutable closure verified before any integration','coordinator scoped integration only; orphan report must never be merged whole','fresh authorized actual gameplay completed post-input response and ordinary Quit'],noImplementationRepair=True,noIntegration=True,noRuntime=True,noBoxes=True,noWorkers=True,root='tracked/index/refs read-only; initial digest reused, no later comparison claimed')
save(doc/'checkpoint.json',status);save(O/'checkpoint.json',status)
readme='''# Ricochet independent acceptance: REJECT

Candidate `e8cfe229416c4076f68f18c9806a07dd50848cd7` is rejected. No implementation or recipe was changed and no integration is authorized by this report. This branch is an orphan report containing only independent tests and evidence; never merge its whole tree.

The first behavioral operation ran unchanged `AccountingTests.test_00_exact_transformed_production_boundary` after checking all six supplied SHA-256 pins. It reproduced the original production ENOENT and passed the exact transform through the complete trusted supervisor. Independent complete-entry tests then consumed only `serial/continue.json` immediately after descriptor open and before final pathname validation. Both passed, with generated runner hashes, immutable manifests, supervision receipts and PID/start absence checks retained. Synthetic tiny Python children only; no Node, guest or platform operations.

## Rejection 1: final inventory accepts links

`RuntimeAccounting._walk` excludes every named ephemeral entry from final namespace validation. It does not validate an extant control entry at that final boundary. Replacing the previously validated control with a symlink or hardlink immediately before the final directory enumeration returns an accepted inventory of **25,178,112 bytes** with `lastBytes` set, while that link is still present. This is a deterministic operation during the sample, not a claim about arbitrary future writes after return. Earlier descriptor validation rejects the same link attacks; the new final-boundary case exposes a different unchecked window.

Smallest executable reproducer (expected exit1 on the pinned candidate):

```sh
python3 -S test/ricochet-late-link-minimal.py
```

Full strict adversarial assertions:

```sh
python3 -S test/ricochet-consumed-independent.test.py Independent.test_10_final_inventory_link_swap_must_reject
```

Receipt `1793094508467405778` records both strict assertion failures. Minimal receipt `1793094536198190798` prints `symlink_at_return=True accepted_bytes=25178112`. No attack assertion was weakened. Initial diagnostics failed to serialize Path keys; that separate two-error receipt is retained, followed by a diagnostics-only correction and the actual failures.

## Rejection 2: publisher contract is not wired

Recipe step4 states the required contract but supplies no bounded publisher implementation. The exact historical API-side publisher command `api-1793092841347248549-command.json` checks `not p.exists()` then calls `p.write_text(json.dumps(j))`. The independent test executes only that unchanged publication prefix in an owned fixture, without API polling or remote execution. A symlink inserted after the existence check causes the actual prefix to overwrite a retained file. Receipt `1793094594520332898` preserves the strict failed retained-content assertion, exact command/prefix hashes and diagnostic.

That publisher does not atomically enforce one outstanding command or verify regular/single-link identity, logical AND allocated size before publication. Its remote writer has no explicit RLIMIT_FSIZE wiring in the command. The saved command receipt's limits belong to the local API client; serial.py's limit and trusted-supervisor descendant limits do not prove the separately API-launched writer inherits them. No all-producer bounded writer closure has been established. Therefore acceptance cannot be inferred from absent-control or helper tests. Resume requires actual production wiring and evidence for every publisher; this review does not repair it.

## Independent checks and preserved evidence

Nine additional independent methods passed: complete production consumption windows; absent/open-unlinked full24MiB reserve; reserve within unchanged256MiB cap (11 sparse23MiB files reject without large materialization); unknown disappearance and pathname replacement; late links before descriptor validation; immutable mutation and no partial accepted inventory on live/sparse ceiling failure; mandatory-root identity; failing storage supervision cleans a synthetic descendant tree with exact PID/start proof; and three rejecting in-memory mutation controls (remove reservation, ceiling, hash check). These are distinct from the retained22 original methods. Four original successful group receipts and method/source hashes are verified and reused, not rerun, except the explicitly required unchanged first boundary.

All exact pins are in checkpoint.json. Original production failure, first repair failure, own failed diagnostics, distinct stdout/stderr from creation and all supervisor receipts remain. `.b64` evidence decodes with standard base64 to the exact original bytes; manifests hash encoded artifacts. Evidence scripts are recovery recipes, not production replacements. The trusted supervisor hash is `9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`; original production hash is `eebc983956aa092b71a527f41f5516c51376c1acf19872cb808025833953ba63`.

Git uses immutable read-only donor alternates, an isolated sparse orphan report, strict supplied SSH, child-only DATA512MiB/physical256MiB under two permits and the Git flock. Python uses one permit and trusted physical128MiB/CPU90/wall120/file24MiB/output2MiB supervision. Fresh aggregate admission counts live clients in MemAvailable once. No mount argv, Node startup or module execution is applicable to this source-only task. No boxes were assigned/accessed; lifecycle remains with the coordinator. Root tracked/index/refs and donor stores remain read-only, with the launcher initial root digest reused without a final-comparison claim.

Remaining gates: repair the rejected final-boundary behavior; establish all-producer bounded publication; independent affected acceptance; coordinator scoped integration; fresh admitted actual gameplay response and ordinary in-game Quit. This source report claims none of those outcomes.
'''
(doc/'README.md').write_text(readme)
manifest={str(p.relative_to(R)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(R.rglob('*')) if p.is_file() and '.git' not in p.parts and p.name!='manifest.json'}
save(doc/'manifest.json',manifest)
print(json.dumps(dict(status=status['status'],payloads=len(manifest),independentPass=9,rejectedCases=3,report=str(doc))))
