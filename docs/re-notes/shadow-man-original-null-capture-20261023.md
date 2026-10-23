# Original Shadow Man Beenden boundary: first precise capture blocker

**BLOCKED_FIRST_ZERO_BEFORE_REQUIRED_BLOCK.** Exactly one original-game CLI
session ran on `bx_jxut8krh`, PID/PGID **28583**, for **0.980741 seconds**.
The unchanged accepted adapter durably stopped with
`capture-failed: first-zero before required block`, OS exit86. This is an
evaluated original trace, **not an accepted capture**. No second session,
synthetic replacement, native-fixture replay, build, source repair, direct game
launch, Play action or worker was attempted.

[Raw capture](shadow-man-original-null-capture-20261023/original-evidence/null-capture.jsonl),
[offline evaluation](shadow-man-original-null-capture-20261023/evaluation.json),
[session result](shadow-man-original-null-capture-20261023/original-evidence/session-result.json)
and [complete actual output](shadow-man-original-null-capture-20261023/session-summary.json)
are retained. The evaluator verifies envelope hashes, actual process/module,
action receipts, state and every required capture condition without executing
the guest or changing its acceptance criteria.

| Required original capture condition | Actual observation |
| --- | --- |
| Genuine reviewed CLI / exact module / one instance | PASS, actual argv and canonical compile/instantiate receipts, PID28583 |
| Fixed512MiB arena | PASS, one shared Memory initial=maximum8192 pages; no extra arena/Worker/child |
| Fresh launcher → Configuration → OK → fresh launcher | PASS, actual snapshots, control records and three PNG receipts |
| Counted prior ordinary actions | Configuration sequence1/batch5585/HWND0x10001; OK sequence2/batch14859/HWND0x10006; both returned |
| Final ordinary Beenden command3 | Sequence3/batch24720, freshly resolved HWND0x1001c; no historical batch/HWND selector |
| Durable pre-arm context before arm/send | Present, prior eventCount0/syncDepth0; pinned retain calls real fsync synchronously before diagnostic mutation |
| Actual decoded block0x4015d4 | **MISSING** |
| Modal consume / completion | **BOTH MISSING** |
| First-zero record | Present, EIP0, stop=true, continuation forbidden |
| Successful first-zero terminal | **FAIL**: terminal explicitly rejects first-zero before required block |
| Reap / OS versus guest exit | All owned groups reaped, remaining[]; OS86, guest exit unproven |

The first two diagnostic records are `sender-pre`, then `first-zero`, with
event counts1→2, token13/root2 and syncDepth1. At pre-arm the original modal
pump/shared pump are HWND0x1001c and returnAddress0x4015d4. The first-zero
record has ended/sharedEnded1, while the pump and return address persist.
These retained values do not supply a missing decoded-block or modal event.
Classification remains **ordinary-or-unknown; zero-writer unproven**.
No source-cause inference or speculative fix follows this first blocker.

The genuine runner path is
`/home/user/shadow-man-original-null-capture-oct23/immutable/runtime/test/run.js`.
A Python launcher sets the target PID then `execvpe`s Node; it never assigns
`process.argv`. The actual Node entry record and pinned preload bind PID,
runner realpath/hash, module bytes and one compile/instance. Compiler fallback
is rejected by the actual Module loader guard, not only by environment flags.
PNG capture used the actual ctl `pipe` action:png route; snapshots/eval/png
operate between batches and enqueue no scheduled input. Therefore the only
three dequeued actions are the three ordinary dialog commands. The final
live intent and current state were fsynced before dispatch. Pre-arm receipt
fsync behavior reuses the accepted exact source; no extra runtime fsync wrapper
or synthetic oracle was installed.

Initial Spielen is observed disabled and the fresh launcher control is enabled
after OK. This does not establish persistence or gameplay. Configuration and
OK each retain an ABANDONED synchronous callback warning; they are not claimed
as normal callback completions. Expected COMCTL32/OLE32 fallback warnings were
not treated as fatal. No optional DLL/cfg/registry/capability injection occurred.
No generated config was injected or exported as a new input.

## Exact accepted identities

Accepted source candidate remains `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`,
read from the candidate Git objects and the read-only fresh-selection donor.
Static acceptance `cf5612a1482cbfead91450b679a58b18958f53dc`, native subject
`2de825962dc45ac541ee9e0849bff2273eb5f4c8` and independent scoped acceptance
`41801c5fc195861b0049b64a9a1169a3fc3840d2` were reused without replay.
Main `32c0b9bcf4cbaeee3102a5944ca905ca9298169a` and Claude's heap changes were
read-only context and were not used to rebuild this diagnostic.

| Input | Bytes / SHA256 |
| --- | --- |
| test/run.js | 685960 / `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809` |
| tools/shadow-man-null-preload.cjs | 5299 / `78dcac659f82f4c93325d126d072d006e0c6995bac53f9a182431a956eb8e42b` |
| tools/shadow-man-null-capture.cjs | 8196 / `3440377e102575906809bb36a1ba10c291a00f87ae63f05dac5ae24394529cea` |
| Canonical retained module | 1879746 / `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| Original registry | 17088 / `d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3` |
| Original D3DConfigUtility | 573440 / `850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0` |
| Original mss32 seed | 328704 / `09e2dec3d1e996571fb2c95e5de393410d486f1728c86473b550282edd83588c` |
| Original DSETUP | 135680 / `5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f` |

Module standing donor:
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm`.
No old ccd5b0 module or compatibility module was loaded. The historical module
identity appearing inside pinned metadata is a reference, not the actual input.

## Admission and restoration

[Initial admission](shadow-man-original-null-capture-20261023/admission.json)
projected50,093,840/67,108,864 bytes including private Git/index/new objects,
focused staging/temp/evidence, external launcher **and separate own session**,
future growth and8MiB reserve. Fresh preguest measurement projected41,855,007
bytes; host after growth4,830,945,280 >=2,982,150,144. Installed tools and
standing donor inputs are identified separately and executed/read in place.
No hidden links, nested alternate chains or donor metadata mutation was used.
The thin private index preserves candidate base paths and has one direct
alternate to the root object store. Only new report/helper/evidence paths are
published, without root/shared index or branch mutations.

Fresh assigned-box ordinary UID1000 read/write preflight passed, Node24.22.1,
free48,769,273,856 and MemAvailable7,235,801,088 bytes. Native admission reserved
2GiB across one512MiB guest arena,512MiB main oldspace,256MiB sequential ctl
oldspace, native/VFS allowance; no Worker or child arena was admitted or observed.
The module native-entry bound remains8MiB. No local native module ran.

One original folder stream from snapshot
`3ac9827f-20cf-4e1c-98a8-40b4edcd1b2f`, selected
`shadow-man-install-continue-oct22/retained-session`, restored2083 files /
186399681 bytes in229.486s. Sequential application buffers were <=64KiB;
190771200 archive bytes were streamed, never staged locally or as compressed
layers. Registry preflight passed end-to-end before bulk restoration. All2083
destination SHA/bytes/inventory checks and1959 accepted payload mappings /
100354053 bytes passed. There was no transfer failure or retry.

The actual candidate transitive closure contains166 source/package paths /
7267254 bytes. Combined with23 pinned PNG files,27 required data files and
the one canonical module,217 runtime files were staged and verified. Counts
were derived from the candidate, not copied from the historical stage plan.
The native closure resolves original DSETUP/MSS32/DDRAW and expected emulated
system dependencies. PNG round-trip, unchanged five compiler rejection controls
and ten forwarding controls passed. Missing optional GL/skia modes and forbidden
compiler/test paths are explicitly excluded in the final gate. Ordinary
dependency warnings alone are not capture failures.

One hard896MiB tmpfs was mounted with explicit UID/GID1000 ownership and
ordinary-user write/read/delete verification. Exactly one2045-file VFS clone
and original registry clone were created. The overlapping-copy projection is
885211136 bytes <=939524096. Fixed96MiB + tmpfs896MiB + reserve32MiB =1GiB;
immutable cap2GiB. Final immutable206159872, fixed249856, tmpfs184328192;
remote free48,559,239,168 bytes. Original registry clone remains unchanged.

Pre-guest review corrected two narrowly owned bookkeeping mistakes before the
one attempt: outer string interpolation introduced BEL in a Windows path, and
the draft gate JSON had a literal backslash-n trailer. Both drafts/receipts are
retained; the corrected gate constructs separators with chr(92), rejects control
bytes, and serializes exact bytes once. No production/helper pin or capture
oracle changed. These were not guest attempts or native admission retries.

Small Node commands used oldspace256; the original CLI used oldspace512,
CPU150, inner84s and an external84s TERM trigger/5s KILL allowance under90s.
The original process exited itself86 before watchdog termination was needed.
Session aggregate charge50,252/524,288 includes a conservative32,768-byte setup
carry; no cap reset occurred. Publication supervision carries a stricter327,680
charge for earlier setup/read outputs, adds actual retention/publication output,
uses file24MiB/CPU-wall60, failclosed125 and subreaper/full reap. Initial setup
and inspection tools were direct, not all under that publication supervisor.

## Recovery and lifecycle handoff

**bx_jxut8krh is left RUNNING** (API idle, health ok, stop null), expiry
**2026-10-23T09:37:37.793Z**. Coordinator owns shutdown/checkpoint09:20UTC;
this worker hands back before09:15. No lifecycle operation was issued. The old
stopped box and Claude's box were not accessed. No owned Node process remains.

Preserved remote root:
`/home/user/shadow-man-original-null-capture-oct23`.
Keep `immutable/` (complete original tree, actual candidate runtime and canonical
module), `mutable/` (ONE existing owned tmpfs/clone) and `fixed/` (exact commands,
durable session/capture evidence and evaluated first failure). **Do not restore,
retransfer, reclone, rebuild or rerun session.py from this handoff.** This task's
one-session allowance is consumed; coordinator assigns any subsequent work.

Three actual PNGs remain in `mutable/output/` with hashes in
[handback artifacts](shadow-man-original-null-capture-20261023/handback-artifacts.json):
launcher-before296310B, Configuration133536B, launcher-after-OK296309B.
PNG receipts and state/input records were retained locally; images were not
visually inspected or copied locally. One attempted Boat SCP retrieval was
denied403 `api_key_action_forbidden: This API key cannot perform ssh.` It was
not retried, nor was another SSH route used. Existing authorized API command
reads retained the bounded raw trace/state evidence. PNG bytes were kept remote
instead of encoding them into stdout and exceeding the aggregate capture cap.
The coordinator must preserve these remote artifacts before its own shutdown;
Git does not back up those remote originals/module/PNGs/tmpfs automatically.

This branch owns only this new report and adjacent focused helpers/evidence.
Claude B&W2, RichEdit, integrated POSITIONT, root/donor sources/refs, shared
integration, main and deployment were preserved. Stop after this first blocker;
no replacement task or scope expansion is authorized.
