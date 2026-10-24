from setup import *
import re,struct,collections
exe=pathlib.Path('/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11/penguin-command.exe')
assert sha(exe.read_bytes())=='14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1'
for a,b in [('406df7','406e60'),('406e60','406ec4')]:
 out=subprocess.check_output(['objdump','-d','-Mintel','--start-address=0x'+a,'--stop-address=0x'+b,str(exe)]);assert len(out)<=8192;(E/('original-'+a+'-'+b+'.asm.txt')).write_bytes(out)
prior=pathlib.Path('/tmp/penguin-original-keypath-cause-oct24/repo/docs/re-notes/penguin-command-original-keypath-cause-20261024')
for n in ['penguin-command.exe-0x406d80.asm.txt','penguin-command.exe-0x406ec4.asm.txt']:(E/n).write_bytes((prior/n).read_bytes())
s=(E/'output.log').read_text();lines=s.splitlines();hits=[l for l in lines if l.startswith('[EIP]')]
addresses=[int(l.split()[1],16) for l in hits]
expected=[0x406d80,0x406d9c,0x406da5,0x406db2,0x406ddf,0x406dee,0x406df7,0x406e28,0x406eb0]
assert addresses[:9]==expected
assert all(a==0x406eb0 for a in addresses[8:])
assert len(s.encode())==524288 and not s.endswith('\n')
record=re.compile(r'mem\[0x004d0750:32\]=([0-9a-f ]+)')
before=bytes.fromhex(record.search(hits[0])[1]);after=bytes.fromhex(record.search(hits[8])[1])
assert before==bytes(32) and before!=after
assert struct.unpack('<ff',after[:8])==(50.0,515.0)
assert all('mem[0x004130a0:8]=00 00 00 00 00 00 00 00' in l for l in hits[:-1])
assert all('mem[0x00410110:12]=0a 00 00 00 0a 00 00 00 0a 00 00 00' in l for l in hits[:-1])
v=dict(path=[hex(x) for x in expected],hits=collections.Counter(hex(a) for a in addresses),rawBytes=len(s.encode()),captureAtCap=True,finalLinePartial=True,initialRejectionBranchesPassed=True,recordBefore=before.hex(),recordAfter=after.hex(),recordFloats=struct.unpack('<ffff',after[:16]),countAmmoChangesObserved=False,completedAcceptance=False,actualKeyDispatchBatch=None,scheduledKeydown=40000,SDLsymbolAtCannonEntry=0x61,inputDeliveryLimitation='keydown schedule retained; immediate dispatch/dequeue logs buffered behind stream, not retained before file cap; no batch borrowing from predecessor',noSecondRun=True,passEvidenceChecks=True)
save('verification.json',v)
j=py('''import pathlib,json,os
h=pathlib.Path('/tmp/penguin-cannon-block-decision-oct24');runner='/tmp/penguin-immediate-shot-state-oct24/runner/test/run.js';pids=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:a=(p/'cmdline').read_bytes().decode(errors='replace').split('\\0')
 except (FileNotFoundError,PermissionError,ProcessLookupError):continue
 if a and pathlib.Path(a[0]).name=='node' and runner in a:pids.append(int(p.name))
files=[p for p in h.rglob('*') if p.is_file()]
print(json.dumps(dict(ownedNodePids=pids,passCleanup=not pids,remoteOwned=sum(p.stat().st_size for p in files),maxFile=max(p.stat().st_size for p in files),free=os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize)))''');save('cleanup-api.json',j);assert json.loads(j['stdout'])['passCleanup']
state=subprocess.check_output(['/home/user/.ascii/boat','--no-update','--json','info','bx_rcsfy9bm']);save('box-final.json',json.loads(state));assert json.loads(state)['sandbox']['state']=='idle'
for n in ['admission.json','preguest-admission.json','static-checkpoint.json','fresh-preflight-api.json','verification.json','cleanup-api.json','box-before.json','box-final.json','decision-args.json','guest-launch-api.json','supervise.py','setup.py','execute.py','finish.py']:(E/n).write_bytes((H/n).read_bytes())
report='''# Penguin Command: bounded cannon block-entry decision trace, 2026-10-24

The original A action **passes all observed early cannon rejection tests and begins initializing shot record zero**. Completed acceptance remains **unproven**: the sole authorized trace exhausted its 524,288-byte output allowance in the initialization loop before count/ammo writes were retained. No exact rejecting branch was witnessed. No projectile, score, wave, or general gameplay claim is made.

The witnessed block path is `406d80 → 406d9c → 406da5 → 406db2 → 406ddf → 406dee → 406df7 → 406e28 → 406eb0`, then repeated `406eb0`. At `406d9c`, lazy subtraction operands are target Y177 minus510; at `406da5`, EDI1 minus3 confirms the invalid-cannon `jg 406f00` was not taken. Reverse at4130a0 is0, so `jne 406f08` was not taken. Active count at4130a4 is0; the duplicate-target test is bypassed by `je 406ddf`. Ammo is10, so `jle 406f00` is not taken. Count0 minus19 at406df7 confirms `jg 406f16` was not taken. Registers, lazy flags and exact memory bytes are in raw `output.log`; supporting original PE disassembly is retained beside it.

At first406eb0, record4d0750 changes from32zero bytes to `0000484200c000448da11e3e9c5c8fbe00000000000000000000000000000000`: floats50,515 and two velocity values. EDX points at4d0750. Count remains0 and ammo10/10/10 throughout the complete retained hits. This proves partial shot initialization, not the subsequent count increment406ece or ammo store406eec. There are1005 logged loop entries (the final line is partial). The file stops at exactly524288 bytes; natural supervisor returncode0 cannot establish full diagnostic completion after the output limit. The finite loop's detailed stream exceeds the allowance. No second execution, repair, rebuild, new instrumentation or forced game state was performed.

The exact predecessor menu/aim/A schedule is retained in `decision-args.json`: menu down34000/up34500, aim34800, A down40000/up40200. The raw log records scheduled A down40000 and cannon entry with EDX61 and prior compare61−61=0. **The actual A dequeue/DispatchMessage batch and key-up delivery are unavailable in this capture**: those messages use the runner's batch-buffered log while EIP lines stream immediately; the file fills first. Predecessor batch40033 is not substituted. This is an additional acceptance limitation.

The first checkpoint verified existing `--trace-eip-range=0x406d80-0x406f50`, `--trace-eip-from=39999`, detail, stream and five dumps8/12/4/4/32 against runner main5691793a58b4670fd2a621114d7926100a1e47de and historical sourceb41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a. Exact source slices, blob/file/excerpt identities and supporting imports/exports from the accepted retained contract are in `static-checkpoint.json`. Source dispatch guards disable chained execution while tracing and the historical run loop calls host.log_eip at block entry. The historical module is8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686; runner is3c59fd034391e069f24a6047cf96cd8dac84a791d7d7591d55e5f7cb6e161a5e; original PE is14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1. This is not current-main Wasm. Fresh preflight rehashed all291 existing staged files15760340 bytes without restaging, admitted7365206016 bytes available memory against2684354560 minimum, and found no runner process before launch.

Exactly one guest executed using the existing supervisor, with task output paths and strict file limit,512MiB arena/oldspace,90CPU/wall seconds,60guest seconds,43000batches,200ms/batch,840×660, no-build/quiet flags/no-close. It ran1.660seconds; supervisor reports no remaining process group. `command.json` and `terminal.json` retain exact argv, PID, timestamps and limits. The output limit prevented retaining normal batch-cap/exit summary, so no termination-cause inference is made from missing logs. No screenshot was needed.

The box bx_rcsfy9bm is left RUNNING/APIidle, healthok, expiry2026-10-24T06:12:03.889Z, with no owned Node process or guest group. Coordinator owns06:00 shutdown. Remote work completed before05:59 and guest before05:57. Root tracked files/index/refs and donors were read-only; only append-only messageboard coordination was shared. Private sparse task branch only; no main merge or public hosting/deployment. Artifact seals cover retained evidence; publication receipts and final resource accounting are alongside the private repo under `/tmp/penguin-cannon-block-decision-oct24/`.

Resume condition for the coordinator: acceptance requires a separately authorized bounded capture that observes the post-loop count/ammo decision and actual dispatch batch without repeating this overflowing detailed stream. This task stops at its one-run limit.
'''
(E.parent/(E.name+'.md')).write_text(report)
seals=[dict(path=str(p.relative_to(E)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(E.rglob('*')) if p.is_file() and p.name!='artifact-seals.json'];(E/'artifact-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
print(json.dumps(v,indent=2))
