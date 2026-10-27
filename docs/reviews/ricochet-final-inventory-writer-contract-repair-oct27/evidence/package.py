import ast,base64,hashlib,json,pathlib,shutil,os,time
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
B=R/'docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27';E=B/'evidence';E.mkdir(exist_ok=True)
I=pathlib.Path('/tmp/ricochet-consumed-accounting-independent-accept-oct27/repo');P=I/'docs/reviews/ricochet-consumed-accounting-independent-accept-oct27'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(p,j):p.write_text(json.dumps(j,indent=2,default=str)+'\n')
# Verify prior immutable report closure, never copy/merge its orphan tree.
prior=json.loads((P/'manifest.json').read_text())
for name,item in prior.items():
 b=(I/name).read_bytes();assert len(b)==item['bytes'] and sha(b)==item['sha256'],name
for name in ('checkpoint.json','manifest.json','reused-22-methods.json'):
 shutil.copyfile(P/name,E/('prior-'+name))
for p in (P/'evidence').glob('reused-*'):
 shutil.copyfile(p,E/p.name)
for p in (P/'evidence').glob('candidate-*'):
 shutil.copyfile(p,E/p.name)
reused=json.loads((P/'reused-22-methods.json').read_text())
tree=ast.parse((R/'test/ricochet-runtime-accounting.test.py').read_text())
text=(R/'test/ricochet-runtime-accounting.test.py').read_text()
methods={n.name:sha(ast.get_source_segment(text,n).encode()) for n in ast.walk(tree) if isinstance(n,ast.FunctionDef)}
assert len(reused['methods'])==22
for method in reused['methods']:assert methods[method['method']]==method['methodSHA256']
# Bound and preserve all own failures, process-creation streams and setup pins.
for p in sorted(O.iterdir()):
 if p.is_file() and p.suffix in ('.stdout','.stderr'):
  (E/(p.name+'.b64')).write_bytes(base64.b64encode(p.read_bytes())+b'\n')
 elif p.is_file() and p.suffix in ('.json','.py'):
  shutil.copyfile(p,E/p.name)
base=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
shutil.copyfile(base/'ricochet-final-inventory-writer-contract-repair-oct27-admission.json',E/'authoritative-admission.json')
shutil.copyfile(base/'ricochet-final-inventory-writer-contract-repair-oct27/root-ref-digest.json',E/'initial-root-ref-digest.json')
shutil.copyfile(base/'light-execution-pool-oct26.py',E/'light-execution-pool-oct26.py')
pins={str(p.relative_to(R)):sha(p.read_bytes()) for root in (R/'tools/ricochet',R/'test') for p in root.rglob('*.py')}
pins[str((B/'integrate.py').relative_to(R))]=sha((B/'integrate.py').read_bytes())
incidents=[
 'Initial policy/report/board displays exceeded8192B per operation; cumulative output remains below1MiB; subsequent displays capped7500B. Initial tool-only missing optional run.py and absent task-directory reads are retained in transcript, without separate on-disk startup streams; subsequent supervised operations retain distinct streams from creation.',
 'First unchanged independent tests defaulted to donor ops and overwrote three untracked diagnostics: late-final-symlink.json, late-final-hardlink.json, publisher-contract.json; transient fixtures cleaned. Donor tracked files/index/refs/objects and committed report unchanged. No attempt to edit/restore donor. Own first-failure receipts preserve outcomes. RICOCHET_ACCEPT_OPS then fixed to own ops.',
 'First retarget driver exec used a private namespace; unittest could not resolve Independent. Receipt1793095106854196868 retained; fixed module globals without changing assertions.',
 'First local O_TMPFILE AT_EMPTY_PATH publication returned ENOENT in four production prefixes receipt1793095174697213641. Changed implementation to a single source-descriptor linkat with AT_SYMLINK_FOLLOW, no production fallback/retry; successful exact transformed prefixes retained.',
 'Early local tests used automatically cleaned default /tmp fixture directories; subsequent TMPDIR is owned ops/fixtures and explicit24MiB unnamed-inode staging reservation charged inside task allocation. Prior temporary outputs no longer exist. First concurrency child streams were transient; final authoritative16-method run preserves each child stdout/stderr and command/PID/exit receipt.',
 'Shared WAL baseline unavailable; entire current allocated WAL conservatively charged once, not claimed as exact growth.'
]
checkpoint=dict(status='PASS_SOURCE_ONLY_REPAIR_PENDING_INDEPENDENT_ACCEPTANCE',candidate='e8cfe229416c4076f68f18c9806a07dd50848cd7',rejectionReport='a679a43e16ca71a761a2368a41784c4371c4a3b1',pins=pins,strictOriginalFailures=['1793094993505441677','1793094993660090218','1793094993817367055'],firstBoundary='unchanged minimal, independent test10, exact historical API publication prefix, before implementation changes',passing=dict(finalWriter16='1793095470715695403',finalIndependent10='1793095416450227320',finalAffectedOriginal6='1793095515847644545',minimalRetarget='1793095515677499607',originalProductionBoundary='1793095089777001182'),priorManifestVerified=len(prior),original22MethodHashesVerified=True,originalNineIndependentReceiptsReused=True,incidents=incidents,remaining=['fresh independent affected acceptance of final source and production writer closure','coordinator scoped integration only; never merge orphan tree','fresh authorized runtime closure/lifecycle and actual post-input gameplay response plus ordinary Quit'],noRuntime=True,noAPI=True,noNode=True,noBoxes=True,noWorkers=True,noIntegration=True)
checkpoint['passing']['finalProducerCommandsMetadataAndWiring']='1793095613358309985'
save(B/'checkpoint.json',checkpoint)
(B/'README.md').write_text('''# Ricochet final inventory and production writer repair

Source/test repair only; independent acceptance and integration remain required.
The isolated branch is an orphan scoped report. Extract the three tools, affected
tests and recipe; never merge its whole tree. Root tracked/index/refs were not
modified. No API, Node, guest, box, main or deployment operation ran.

The first behavioral checks retained all unchanged strict failures separately:
minimal late symlink (1793094993505441677), independent test10 symlink/hardlink
(1793094993660090218), and the exact historical API publisher prefix attack
(1793094993817367055). The originals remain byte-identical. The final helper
passes retargeted identical assertions; only source path and expected hash change.
Final test receipts and source SHA256 pins are in checkpoint.json.

The ledger now retains observed control descriptors until sampling finishes,
validates extant entries at final enumeration against original identity/version,
and rechecks regular/single-link/logical/allocated bounds. It accepts absence,
open/unlinked consumption and consumption before final enumeration; a newly
appearing or replaced extant control rejects, with lastBytes unset. The complete
24MiB control reserve remains inside the unchanged256MiB cap. This is a bounded
observation, not a filesystem quota or a guarantee against changes after return.

The production writer sets its OWN RLIMIT_FSIZE soft/hard to min(inherited,24MiB)
before encoding/open/writing. Directory-descriptor flock serializes writers;
every existing control (including dangling links) or terminal blocks publication.
One unnamed O_TMPFILE inode holds bounded UTF8 JSON, with both logical and
allocated-byte checks on each write and before publication. A single linkat
through the writer's own /proc descriptor publishes without replacing/opening
any destination. The inode has one link at publication; consumers may unlink it.
Failed encoding/writes/link publication close the unnamed inode. A directory
sync failure after atomic publication raises PublicationUncertain: retain the
complete outstanding command and never replay it. Consumer/supervisor limits
are not used as evidence of separately API-launched writer limits.

Producer closure is the FOUR actual continue.json publishers in the pinned
measured-cpu-round report: 1793092826212634802, 1793092833026763786,
1793092841347248549 and 1793092867150456577. serial.py consumes continue.json;
it does not produce it. Each original full API command and its SHA256 is retained
alongside a bounded-api command and transformed source SHA256 in producer-manifest.
Only its unsafe p.write_text statement is replaced, plus Python -B to avoid
import-cache writes; timeout, box, command payload, polling and no-replay tails
are preserved. Historical evidence is never edited. No claim covers unspecified
future producers: they must enter the same publisher and be added to the closure.

Actual production caller (it invokes the API; do not run in source-only work):

    python3 -B tools/ricochet/production-commands.py PRODUCER --bundle docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27

This CLI verifies pinned original bytes, builds the transformed argv and invokes
that argv. Tests intercept ONLY the outer API launch, assert all four exact
dispatches, then execute every exact transformed publication prefix in owned
local fixtures, including the historical exists/publication symlink attack.
They never execute a Boat/API command or its polling tail.

Executable staging recipe (requires task-owned pre-staged immutable closure):

    python3 -B docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27/integrate.py --destination STAGING --immutable INPUT-PINS.json --secondary-root SECONDARY

It verifies original supervisor and serial pins, stages accounting and publisher,
adds their immutable hashes, validates supplied inputs and transforms the exact
supervisor through the unchanged original recipe. Next owner must stage its
complete child/module/controller inputs, pin the entire closure, provide fresh
admission and lifecycle, and use this production caller for all four producers.
The historical box ID/cutoff is evidence, not authorization to reuse it.

Final authoritative writer suite has16 methods: all producer dispatch/prefix
gates, retained-file race, outstanding/link/terminal conflicts, four concurrent
process publishers, oversized streaming/sparse/allocated bounds, partial-write
cleanup, writer-limit ordering/setup failure, regular replacement/new entry,
full transformed supervisor staging entry, descriptor cleanup/content mutation,
old-inventory and unbounded-writer mutants, and committed uncertainty/no replay.
Ten affected independent methods pass, including strict link rejection and all
three consumption windows with no partial accepted inventory. Six affected
original methods rerun; unchanged22 prior method hashes and all95 prior manifest
payloads were verified, with successful original receipts reused. The final
retargeted minimal reproducer prints accepted_bytes=None.

Evidence preserves failed setup and distinct supervised stdout/stderr (.b64 is
standard base64), command/environment-safe hashes, inherited limits, supervisor
and Python identities, immutable pins and owned cleanup. checkpoint.json lists
all incidents, including the first test harness's unintended writes to three
predecessor untracked ops diagnostics. Donor tracked sources/objects and report
were unchanged; this does not claim perfect read-only handling of donor ops.

Git uses supplied strict SSH, two permits/flock, child-only DATA512MiB and
physical256MiB. Python uses one permit, trusted supervisor physical128MiB,
CPU90/wall120/file24MiB/output2MiB; no DATA/AS cap was added to Python. Owned
TMPDIR and24MiB unnamed-inode reservation keep local staging accounted. Initial
root-ref receipt is reused, without claiming a later root-ref comparison. No
mount or Node startup is applicable. No boxes assigned or accessed; lifecycle
remains with the coordinator. Independent review, scoped integration and actual
gameplay response/ordinary Quit remain unperformed.
''')
manifest={str(p.relative_to(R)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(R.rglob('*')) if p.is_file() and '.git' not in p.parts and p!=B/'manifest.json'}
save(B/'manifest.json',manifest)
print(json.dumps(dict(payloads=len(manifest),priorVerified=len(prior),originalMethods=len(reused['methods']),pins=pins)))
