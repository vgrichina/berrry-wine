# Reserved-page observer source candidate (2026-10-19)

This candidate descends from main6cfc0d936 (Surface and debugger watch fix)
through merge166f84855. The held Dungeon `reservedPageFaults` registration
remains a candidate, not a qualified startup fix. No original bytes changed.
The prior resolver-first capture found an intact SHFOLDER table; it did not
observe the later failing fault. Existing MSVC controls passed before this
new instrumentation, not after it.

## Hook and observation contract

`g2w_miss` adds a disabled-by-default per-instance observer inside mode5.
`set_reserved_fault_observer(1)` arms at most256 reserved-page misses;
`set_reserved_fault_observer(0)` disables it. It does not select fault mode,
flush/change JIT policy, modify reservations, or change exception disposition.
No guest address is hardcoded. Reservation membership releases its lock before
the synchronous host callback. Original eligibility/handler/translation/sentinel
paths remain; their successful early return emits its outcome first when armed.

The existing two-argument `unmapped_trace` import carries tagged observations;
`get_reserved_fault_observer(field)` exposes phase, ID, API depth, raising,
sync-active, sync epoch (fields0..5), and count (other fields). The host routes
tagged events to `ctx.reservedFaultObserver`; missing callbacks fail explicitly.
Ordinary untagged fault census behavior remains. No import/Win32 API ID changes.

Phase1 precedes the eligibility check and handler. Phase2 means mapped after
the synchronous handler returned true; phase3 means it returned false (including
its own sync/thunk eligibility refusal); phase4 means true but still unmapped;
phase5 means API-depth skip; phase6 means raise skip (takes precedence if both).
Pre-event gates and sync epoch disambiguate phase3; it must not be described as
proof that a guest filter ran. IDs/EIP are locals across nested handler calls.

`tools/reserved-fault-observer.js` reads registers, four64-byte contexts (fault,
stack, ESI, EDI), existing PTEs, at most16 FS frames with four candidate MSVC
scope levels each, and at most128 matching reservation records. Missing bytes
remain holes. It never calls `g2w`, guest execution, allocation or commit APIs.
Shared PTE reads use Atomics; reservation observations are not a global atomic
snapshot and report count changes. PTEs are reloaded per byte; page summaries
hold the last observed PTE, not a single stable mapping for all captured bytes.
Reservation replacement at the same count is undetected. Registers, bytes and
metadata need not represent one instant; outputs explicitly say `atomic:false`.
Scope interpretation is explicitly candidate. Reads continue beyond holes and
retain address/offset-tagged mapped fragments; incomplete reads have `bytes:null`
and exact missing spans, never a fabricated full buffer. Direct mappings below
GUEST_BASE, including wasm offset zero, match the production fast path.

The paired collector checkpoints pre-state before handling (so a nonreturning
handler leaves evidence), retains at most64 pending ancestors and16 successful
summaries, and stops on the first nonmapped outcome. Success does not consume
the observation. Reaching event256 successfully instead saves an explicit
budget-exhausted outcome. Saving then throws `RESERVED_FAULT_CAPTURED`; the
caller must terminate this instance, never catch-and-resume it. This applies to
**every** observer, snapshot, checkpoint, save or protocol exception, not just
the distinguished capture error: SEH globals can remain unrestored after any
host throw. The collector poisons itself on every exception and rejects later
events. IDs must increase without reuse and outcomes must follow LIFO nesting.
The future controller must unconditionally terminate the instance on any such
error; catching/logging and continuing is forbidden. Ordinary code
does not install or arm this hook. The collector is per instance; combining
multiple Workers would require separate identities and is not claimed here.

## Review and validation boundaries

Source tests: `node tools/check-reserved-fault-observer.js` exercises pairing,
successful retention, nested ancestors, all failure categories, exhaustion,
pending checkpoints, malformed protocol, byte-exact mapped reads, missing PTEs,
FS/scope cycles and reservation bounds, unchanged memory, and the extracted
production host import's ordinary/diagnostic/missing-callback routes.
WAT fragment, boolean operand and callback census gates also pass. The census
updates only the held app registration and new synchronous read-only host
boundary hashes; it does not claim guest nonlocal lifetime support. The merged
debugger watch regression passes; its handler remains unchanged.

Native fixture preparation adds `--observe` to the existing authentic MSVCRT
fixture. Planned commands (ONLY inside a separately granted bounded controller):

```
node tools/dungeon-siege-msvc-seh-fixture.js --root=COHERENT_ROOT --observe
node tools/dungeon-siege-msvc-seh-fixture.js --root=COHERENT_ROOT --observe --compat
```

These check real MSVC search/commit/file-read pre-hole to post-bytes, matched
IDs, declined-search result, explicit API/raise skips with no filter invocation,
and disabled-hook behavior. Added cases return ContinueExecution without commit
(phase4), and execute a real guest MOV from a second reserved page inside the
MSVC filter (phases1,1,6,2, distinct nested IDs, outer real file read completes).
These cases are authored/syntax-checked, NOT run. Mocks do not prove WAT order.

No native/build/game execution is authorized by this checkpoint. Main ancestry
changed and WAT changed: existing7fd/a72 are invalid candidate pins. Required
next steps are independent source review, a normal coherent build and bounded
native controls in both dispatch modes, then review of narrow CLI/controller
installation and source/module pin updates. Old controls/preflight intentionally
refuse this mixed candidate. There is no ready original-game command yet.
Keep90/105/120-second original bounds,250ms hardfloor,32MiB aggregate output,
4MiB raw log,3MiB response and512MiB admission reserve. A capture must preserve
pre-checkpoints and terminal output and kill the instance after diagnostic stop;
it is not a gameplay retry or a mode workaround.


## Terminal CLI and coherent validation preparation

Source now includes main76be219e0 via mergeabb527d9f, including42ae full-path
and509b slash normalization fixes. Root held worktree remains unchanged.

The narrow runner option `--reserved-fault-observer=ABSOLUTE_DIRECTORY` requires
explicit `--no-threads`, existing mode5 and no spawned processes. It observes
only the main instance; cooperative secondary instances are not instrumented.
It changes no fault mode or optimizer policy. Its adapter exits directly on
**every** observer exception, before any guest-aware runner crash handler.
Capture exits0; snapshot/protocol/checkpoint/save/terminal-write failure exits1.
There is no catch-and-resume path. The outer controller kills residual groups.
Pending snapshots use bounded temporary writes and rename, retaining the last
complete pre-state if replacement fails. Successful post events update pending
status, avoiding a stale claim that an already handled fault remains pending.

`dungeon-siege-observer-plan.js SOURCE_REF ROOT PLAN_FILE` prepares a source-only
plan pinning exact Git blobs for every src/lib/tools/data file, every test JS
file, host/package files, CLAUDE/index and both committed toy-VM browser bundles
needed by normal build gates, plus authentic notepad/MSVCRT hashes. The complete
27-file pngjs package is hash-pinned from the existing held runtime, with explicit
local provenance; no dependency installation or transfer occurs during plan
preparation. Verification checks the exact dependency file set and bytes.
Verification
reconstructs the full selected tree and rejects omitted or mismatched files.
The historical5441 controller is not relaxed. New observer controls require
this complete candidate plan; the old preflight path remains historical.

`dungeon-siege-observer-controls.js PLAN_FILE UNIQUE_ID` runs seven serial jobs
only under a separate grant: normal build (both modules), MSVC --observe
tail/compat, reserved-sync tail/compat, reserved-page-cross tail/compat. Each has
a180-second outer process-group deadline,250ms guards and4MiB raw-log cap.
First failure stops the sequence. Admission must exceed2,986,344,448B:
2GiB +128MiB baseline +32MiB evidence +128MiB build growth +512MiB transient.
Hard floor is2,214,592,512B. Evidence and positive test/output growth share32MiB;
positive build/ growth has a separate128MiB cap. TMPDIR/TMP/TEMP use the guarded
run/tmp. Harness extraWat compilation remains in memory. Prior modules are
copied and hash-retained before build (combined backup limit8MiB). No game runs.

Only seven clean results with absent groups and unchanged pins produce
qualification.json, including exact new primary/compat module hashes. The new
optional qualification argument to original preflight verifies the whole source
tree, both module hashes and all seven clean results. It cannot skip old5441
verification without replacing it with the exact qualified source reference.

The original retry controller's `--capture-fault QUALIFICATION_FILE` route
requires that receipt, removes control HTTP/stdin, and installs the observer.
Its outer guards preserve90/105/120 bounds; soft deadline terminates this
noninteractive diagnostic at105 seconds. Success additionally requires the
terminal and first-nonmapped capture artifacts. Event-budget exhaustion is
retained but fails the diagnostic success check. No EULA/menu inputs are sent.

The qualification controller also requires
`WA_DUNGEON_OBSERVER_GRANT=UNIQUE_ID` and exclusively creates the shared
`/tmp/wine-assembly-local-runtime.lock`. Existing leases are never reclaimed.
It releases only its exact lease content after absent groups; unproven cleanup
retains the lock. Its root realpath must be `/tmp/wa-dungeon-thread-oct19`, so
these jobs cannot replace the held recovery modules. Source-only ready recipe,
after independent review and explicit staging of missing fixture/dependency closure:

```
node tools/dungeon-siege-observer-plan.js SOURCE_REF /tmp/wa-dungeon-thread-oct19 PLAN_FILE
# Separate sole-runtime grant:
WA_DUNGEON_OBSERVER_GRANT=20261019-dungeon-siege-observer-controls-1 node tools/dungeon-siege-observer-controls.js PLAN_FILE 20261019-dungeon-siege-observer-controls-1
```

Qualification remains bound to the isolated root. The hardcoded recovery-root
original controller explicitly rejects this receipt's root, even if someone
passes it by hand; it also requires its own exact grant token. Before an original
run, a separately reviewed explicit coherent staging step must copy/verify the
qualified source/module bundle into recovery and produce matching staging proof.
That step and original command are not silently authorized or ready here.

Source tests execute the actual CLI adapter with snapshot/checkpoint/save/
terminal-write failures and verify process termination plus retained pre-state.
Whole-controller mocks cover seven jobs, admission refusal without a child,
source mismatch, disk/deadline/log/evidence/build-growth kills and no retries.
Plan tests reject omitted pins, relaxed limits, changed source, failed or missing
jobs, wrong root and module mismatch. Runner wiring/restrictions, the prior CRC
protocol and debugger watch regression pass. Native fixture remains syntax-only.
No build, native or original run was performed during this preparation.

## Remote source staging, no runtime (2026-10-19)

After the exact local closure restoration, source4734a41fe9b8f271d5fb453fe4a23c388e89a2fc
adds sampled numeric free bytes to both admission refusals. Local preparation
restored only43 authorized files (5,892,572 bytes); source tests pass and plan-v3
verifies3146 source files, two authentic fixtures and27 pngjs files. Local free
2,917,974,016 was68,370,433 bytes short of strict admission; no local run started.

Root authorized source/dependency staging in temporary box bx_rqnkhrnr. Normal
HTTPS Git clone/checkout pins exact4734 at `/tmp/wa-dungeon-thread-oct19`.
The documented `boat push` command failed once with403 `api_key_action_forbidden`
("This API key cannot perform ssh"); no SSH/scp or encoded transfer retry was
attempted. Root then authorized the separately documented Files API:
`POST /sandboxes/{id}/files/upload-url`, followed by raw signed-URL PUT, using
only the existing Boat config token. That route succeeded200. Credentials and
signed URLs were neither printed nor saved. The459,859-byte archive contains
only the pinned two fixtures,27 pngjs files and plan/path metadata; SHA256
`c18c8bb6366db771bd074f9d6b18a7edb8cc6033c8f06b9a8fcc2d0abec89595`.

Remote source and full physical closure verified with missing[]/changed[],
Nodev24.18.1, free49,148,592,128B, no native/build/game execution. Ready command
handle `cmd_xx9lnwdyvmn3` records the result. Plan is
`/home/user/dungeon-observer-stage-1/plan-v3.json`, SHA256
`1897a1f7ed3ccbe51603509ac1286bcefa306bb290d64a4313a91fcdf357543c`.
Local receipts live in
`scratch/runs/20261019-dungeon-siege-observer-prepared-1/{closure-restoration,readiness-v3,remote-upload,remote-ready}.json`.
The box belongs to root; Army holds the next runtime slot. Dungeon remains idle
until a new sole-runtime grant. Held local recovery modules are untouched.

Prepared command, **not executed**:

```
boat exec --detach --cwd /tmp/wa-dungeon-thread-oct19 bx_rqnkhrnr -- env WA_DUNGEON_OBSERVER_GRANT=20261019-dungeon-siege-observer-controls-1 node tools/dungeon-siege-observer-controls.js /home/user/dungeon-observer-stage-1/plan-v3.json 20261019-dungeon-siege-observer-controls-1
```

## First remote qualification: terminal build-closure failure

Root granted that exact command after Army released the slot. Boat command
`cmd_e4lsr4oxyv5k`, controller PID20497, started02:40:17.551UTC and exited1 at
02:40:26.401UTC. Only normal-build ran:8,656ms,3,918 raw log bytes, minimum
free48,771,842,048B, no guard reason, unchanged pins, child group absent.
The timeout source gate failed ENOENT for `test/run-all.sh`: the plan selected
test JavaScript but omitted the shell runner whose timeout declaration this
gate reads. Earlier manifest/region/RPC/test-tier gates passed. Compilation was
not reached; no primary/compat module exists and none of the six native controls
ran. This is a preparation defect, not a native hook or original-game result.

No retry occurred. Independent postflight `cmd_iuuhctgsxtxm` verifies controller
20497 and child20511 absent, group absent, lease absent, Git clean at4734.
The approved Files API recovered all seven evidence files plus their manifest
to local `scratch/runs/20261019-dungeon-siege-observer-controls-1` and retained
the117,798-byte tar archive SHA256
`bc61eafa31221ba87f943d018d1bbdae0fb1864d442c5041645e5d23022c74aa`.
All manifest hashes verify. Runtime is released; the temporary box remains
root-owned and local held modules remain unchanged.

Source-only correction explicitly includes `test/run-all.sh` in both prepared
and reconstructed source trees. A regression asserts it is selected and rejects
its absence before any controller child can start. The timeout gate itself is
checked as source-only validation. This does not authorize another build or run;
new source/plan review and a new grant are required.

### Broader build-input audit before restaging

Source-only review of normal `tools/build.sh`, its shell manifest gate and
the gate readers found one further tracked input omitted from plan-v4:
`fonts/Terminal.fon` (5,168 bytes), named in the toy-VM browser bundler's ASSETS.
It is now explicitly pinned. The review covered41 literal node/bash entry
scripts (including `if ! node` entries in the manifest shell), baseline/spec
readers under fully pinned tools/src/lib/data, test JS scanners, the two committed
bundles, index cache graph, CLAUDE size gate and timeout runner input. Generated
combined.wat and modules remain outputs, not missing source dependencies.

`check-dungeon-siege-build-inputs.js` reads source only and checks those41
entry scripts plus six external inputs against the physical plan. Negative
tests remove the shell runner, Terminal font, nested timeout gate script and
committed JIT bundle and require refusal. It neither executes gate programs nor
compiles/instantiates WAT. This audit improves the reviewed closure but is not
a normal-build PASS. Plan-v4 must not be used for another build; restaging uses
the refreshed plan and exact source after review. Failed controls-1 evidence
remains unchanged, and no native retry is authorized by this source correction.
