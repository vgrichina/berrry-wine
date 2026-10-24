import pathlib,json,sys,subprocess,shutil,hashlib,time,os
from transport import *
O=H/'ops';R=H/'repo';OLD=pathlib.Path('/tmp/maelstrom-qualified-head-original-capture-oct24');E=R/'docs/re-notes/maelstrom-head-corrected-deadline-capture-20261024'
code='import pathlib,hashlib,json;h=pathlib.Path('+repr(str(OLD))+');p=h/"runner/test/run-head-observed.js";s=hashlib.sha256(p.read_bytes()).hexdigest();assert s=="2afeab8d3c053c8b23935b1b6fcd3ac1f01b1aa2609ce1b1b8a0337c23875f3b";print(json.dumps(dict(transformedSHA256=s,unchanged=True)))'
save('ops/observer-identity-api.json',py(code))
lines=(H/'collected/guest/output.log').read_text().splitlines(); records=[json.loads(s.split('] ',1)[1]) for s in lines if s.startswith('[MAELSTROM-HEAD] ')]
assert len(records)==14 and records[0]['kind']=='arm' and records[-1]['pairs']==6
pairs=[dict(batch=records[i]['batch'],before=records[i]['state'],after=records[i+1]['state'],observation=records[i+1]['observation']) for i in range(1,13,2)]
assert all(p['before']['headEntries']==p['after']['headEntries']==0 and p['before']['interiorEntries']==p['after']['interiorEntries']==0 for p in pairs)
analysis=dict(records=len(records),pairs=pairs,headTraceCaptured=False,headRegisters='UNKNOWN: no observed head boundary',finalCounters=dict(head=972,interior=972),movCallExecuted='UNKNOWN',headBreakpointVsPendingYield='UNKNOWN',historicalZeroCause='UNKNOWN',qualification='First two pairs yieldReason=0 halt=3; last four pairs unchanged with yieldReason=8 yieldFlag=0 halt=4. No pair reached head PC. Final counts do not establish instruction execution.',acceptedNativeComparison='Native reason1 halt5/4 example is not reproduced by these original pairs; do not apply its cause to yieldReason8.')
save('ops/analysis.json',analysis)
# Preserve exact inherited receipts and historical deficiencies by immutable publication references.
save('ops/recovery-references.json',dict(priorTaskCommit='0672db6f03260e69e24ff620fb807cce6d15bcf0',priorTaskBranch='task/maelstrom-qualified-head-original-capture-oct24',priorOps=str(OLD/'ops'),priorReadDeficiency=str(OLD/'ops/read-accounting-limit.json'),nativeCommit='4ba28bf1d8b0644f237e8a4f29f54241446b1bcd',historicalAccountingUnchanged=True))
for name in ['preflight-api.json','transform-tree-receipt.json']:
 shutil.copyfile(OLD/name,O/('reused-'+name))
for name in ['pacing.json','schedule-preserved.json','intended-originals.json','read-accounting-limit.json']:
 shutil.copyfile(OLD/'ops'/name,O/('reused-'+name))
a=json.load(open(O/'admission.json'));session=pathlib.Path(a['session']);launcher=pathlib.Path(a['launcher']);base=json.load(open(OLD/'ops/sqlite-baseline.json'));C=pathlib.Path('/home/user/.codex')
charges=dict(priorCumulative=a['charges']['priorCumulative'],newOwned=size(H),sessionFull=session.stat().st_size,launcherFull=size(launcher),sqlitePositiveCumulative=sum(max(0,max(p.stat().st_size,p.stat().st_blocks*512)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),newRemoteProjected=500000,transferOverlap=200000,externalFuture=6000000,futureSQLite=4194304,publicationFuture=1500000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage(H).free;save('ops/resource-publication.json',dict(charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,passAdmission=peak<=67108864 and free-peak>=2982150144));assert peak<=67108864 and free-peak>=2982150144
E.mkdir(parents=True)
for p in O.iterdir():
 if p.is_file() and p.suffix in ['.json','.py','.cjs']:shutil.copyfile(p,E/p.name)
for name in ['guest-args.json','supervise.py','api-history.jsonl','cleanup-api.json','capture-accounting.json','collect-inventory-api.json']:
 if (H/name).exists():shutil.copyfile(H/name,E/name)
shutil.copytree(H/'collected',E/'collected')
report='''# Original Maelstrom corrected-deadline observation — 2026-10-24

ONE original guest ran on bx_qp99542b, PID/PGID 27579, starting 16:49:48.847 UTC and finishing naturally about 11.52 seconds later, before the corrected 16:55 UTC cutoff. Exit 0; 42,000 batches; 9,670 output bytes. No second attempt, build, production repair, acquisition, schedule change, extra run, yield clearing, or lifecycle mutation. The process group was absent after wait/reap; task-owned Node count zero. Coordinator retains shutdown ownership; running box API state idle, expiry 17:05:44.432 UTC, watchdog 17:00 UTC.

The exact accepted observer produced 14 records: arm, six before/after pairs at batches 36163–36168, and summary. BP readback is 0x007a3362 throughout. No sampled pair reached that head; actual head EDI/EAX/EBP/ESP and breakpoint-vs-pending-yield cause remain UNKNOWN. No head trace line was emitted. Final hit counts are 972 at each address; these are not proof of executed MOV/CALL, nor proof those counts happened during the bounded observation window.

At arm: EIP=0x00688d5b, EDI=32, EAX=0, EBP=1, ESP=122682492, halt=3, reason/flag=0/0; counts 0/0; cache stores/clears/invalidations=5371/2/4552. The first two boundary pairs have reason=0 and halt=3. The final four pairs (36165–36168) are unchanged before/after: EIP=0x075040f8, EDI=0x0052e430, EAX=0x53000001, EBP=5, ESP=0x074ffb18; halt=4, reason=8, flag=0, counts=0/0, cache stores/clears/invalidations=5451/2/4552, blocks=1. All exact intermediate states are in analysis.json and the raw log. The accepted native pending-reason1/halt5↔4 example does not match these reason8 observations and cannot establish this original cause. MOV/CALL execution and historical zero cause remain UNKNOWN.

The historical runner SHA4d7b9587, exports SHA739397dc, wasm SHA8fac3993 and observer SHAfcb1ecac pins and accepted readiness were reused read-only from the prior task (remote commit0672db6f). The adjacent transformed runner remains SHA2afeab8d3c053c8b23935b1b6fcd3ac1f01b1aa2609ce1b1b8a0337c23875f3b. No old boundary-audit transform was layered. Fresh same-task admission, 247 materialized hashes, canonical argv parser and unchanged original 48-file comma-bearing tree/startup receipts passed. The exact command and Node512/linear512MiB/CPU90/wall60/output131072 limits are retained in collected/guest/command.json. BATCH_SIZE1000, 200ms clock, original P input schedule and requested trace/count profile remained unchanged.

Resource receipts preserve cumulative prior history, full old and new launcher/session charges, positive SQLite growth from the prior baseline, publication/transfer/future growth and 8MiB reserve within64MiB; both disk floors passed. Historical read-accounting deficiency is retained unchanged and not retroactively called compliant. Internal collection consumed11,676 new bytes with8192-byte slices, below the extra2MiB allowance. Raw API, command, terminal, source/transfer identities and cleanup receipts are adjacent. No screenshot or gameplay acceptance claim is made.
'''
# Derive displayed EIP rather than trust hand-transcribed value.
report=report.replace('0x00688d5b',f"0x{records[0]['state']['eip']:08x}")
pathlib.Path(str(E)+'.md').write_text(report)
seals=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in E.rglob('*') if p.is_file()]
(E/'evidence-seals.json').write_text(json.dumps(seals,indent=2))
subprocess.run(['git','-C',str(R),'add','-f',str(E),str(E)+'.md'],check=True)
subprocess.run(['git','-C',str(R),'diff','--cached','--check'],check=True)
print(json.dumps(dict(prepared=True,files=len(seals),peak=peak)))
