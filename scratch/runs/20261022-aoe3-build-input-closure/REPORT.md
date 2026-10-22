# AoE3 exact-revision canonical input closure

Complete offline staging evidence for accepted candidate
`c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2`: **3,420 tracked inputs,
84,967,552 bytes**, each Git blob verified, SHA-256 recorded, individually
materialized and read back. `build-inputs.json` SHA-256:
`024af340bbe84e09b307c875c52c46c77d26906b0be8310ac041c0b7d5f256fb`.
No build, source/gate/census change, guest, runtime access, acquisition, worker,
merge, deployment, or box lifecycle action occurred.

Use [RECOVERY.md](RECOVERY.md) for concrete staging, historical-gate preflight,
and future normal-build commands. That recipe is not authorization to run them
in this task. The checker is invoked offline with:

```bash
python3 scratch/runs/20261022-aoe3-build-input-closure/closure.py \
  --repo /home/user/wine-assembly-aoe3-build-input-closure-oct22
```

`verification.json` records PASS, complete individual blob materialization,
Git SHA-1/size/SHA-256 verification, accepted ancestry/history, and two rejected
omissions. `cli-reject-controls.json` records actual separate checker processes
exiting 1 for omission of `fonts/Terminal.fon` and of imported module
`tools/toyvm/emit-decoder.js`. A passing manifest was subsequently rechecked.
There is no claim that a full staged directory or full build passed here.

## Why this closes the demonstrated staging failure

The last normal build failed before compile at toyVM browser bundling, opening
tracked `fonts/Terminal.fon` (5,168 bytes). The prior 1,078-row production source
manifest was not a build closure. All its rows still match this exact candidate;
the new manifest adds **2,342 files / 48,486,407 bytes**. `closure-delta.json`
records directory counts. No source acceptance/review/test suite was repeated.

The selection deliberately preserves the complete tracked `src`, `lib`,
`tools`, `test`, and `fonts` directories, both committed browser bundles, and
the small root metadata/JS inputs. This is a conservative superset, not a
minimal-file claim. The root census reads root JS and recursive lib JS;
region gates recursively read JS under lib/tools/test; source gates enumerate
src WAT/WATX; test membership and timeout gates enumerate/read test sources.
Whole directory membership prevents absent files from silently weakening these
gates. The complete test directory also retains fixtures and region-owner
references without running its test suite. Full fonts coverage includes the
explicit ASSETS array rather than reacting only to the first missing font.

`dependency-review.json` derives 44 unique build/nested entrypoints,
104 literal module-closure files and their edges, both toyVM root arrays and
ASSETS, region owner references, and explicit dynamic compiler/host inputs.
`filesystem-review.txt` retains read/require/enumeration/child-process locations.
Inspection covers the shell's nested check-test-manifest commands, union gate's
struct-offset-census subprocess, path-constructed host/compiler imports and
four vendored VM-loaded compiler stages. The directory supersets cover dynamic
paths independently of the literal graph. CLI-only file/PNG reads and optional
environment overrides are distinguished in the recipe. This is revision-bound
evidence, not a replacement build system or a general JS dependency resolver.

Tracked generated source, baselines, layout/provenance seals, and committed
toyVM bundles are pinned inputs. New combined WAT and wasm files are outputs.
Ignored dependencies are inventoried separately in `external-dependencies.json`.
Default canonical build uses Node builtins and vendored compiler; dynamic PNG
CLI branches are not called by the normal build. The historical environment was
Node v24.18.1 with retained runner NODE_PATH. Its current remote availability,
Node executable hash, and ignored/native dependency bytes are **unknown** here;
the stopped box was not accessed. No install is implied or performed.

## Exact refs, history, and original recovery

Canonical GitHub HTTPS refs were read directly: main is
`63d563df7a2b901d222a311ceaf55a0823a22261`, census task candidate is `c7fae5ac…`,
repair task is `cef99b250…`, and independent sparse review is `854f3bdd…`.
`remote-refs-before.txt` contains full SHAs. Ancestor checks confirm accepted
source `24220bf65…`, fixture `2977ba3bd…`, census `28379f3d…`, and main all lead
to this candidate. The shared root's HEAD is actually
`6aaf65235f367beb610931be83b4b1268ef35ad7`; its cached origin/main was
`d550de85ae9b46d23314d164a932d66478894999`. These local values were not mistaken
for actual remote main and were not changed/refetched.

The old expanded runtime tree lacked .git. Its API gate explicitly performed
index-only checks. This task does not retroactively claim full-gate success.
The recipe checks out the exact candidate with real parent/history, verifies
main's API table is available, runs an explicit main-base API preflight before
any later build, and preserves the clean-index/HEAD^ conditions for silent-stub
same-commit auditing. `history-inputs.json` records exact historical blobs and
hashes. No synthetic HEAD or copied API table is used as fake history.

Original 199 runtime + 174 installed pins remain immutable and distinct from
source-build inputs. Accepted identity/check records and the coordinator's
snapshot-stop receipt were copied byte-for-byte; `reference-seals.json` records
their donor paths and hashes. These historical records are not a fresh check of
remote original files. RECOVERY preserves module hash, runner/dependency path,
source/census/native donors, remote diagnostic handoffs and previous evidence.
No archive/rebuild of those retained inputs is needed.

Box `bx_32262dnp` remains coordinator snapshot-stopped, completed
12:46:20.151Z, receipt `stop_7760782b0c9f8bab`, error null. Former expiry
12:53:29.069Z is historical. No resume/fork/new/exec/stop was requested here.
Native OLEAUT8/parseURL/localization/gameplay qualification is still unknown.

## Isolation, validation and disclosure

Only this task's evidence directory is committed on isolated
`task/aoe3-build-input-closure-oct22`, based on the accepted candidate. Root
HEAD/index/config/TODOS/STATUS hash seals match before and after. Board claim
and release are append-only; the watcher is local only. No other agent was
spawned. Parent process verified fresh wine-worker/gpt-6.1-sol/medium,
200000 total compaction setting. Source/gate/census and donor refs/config/index
were not edited. Git objects were read in place through own read-only symlink
views of 22 donor object directories; the task's push is the durable backup.

Focused tree inventory was measured before materialization. This task used no
full checkout, archive, repack, or dependency install. All selected files total
84.97 MB but are verified sequentially: largest materialized file is 2,349,309
bytes, removed before the next. `allocation.json` records measured task/git/log
allocation plus 8 MiB reserve and one-blob peak allowance below 64 MiB, with
free bytes above 2,982,150,144. Recipe Bash and embedded Python syntax checks
pass without executing their commands. Only closure validation and its explicit
rejecting controls run; no production tests or gates run.

Local preparation failures, all resolved within this bounded task: one initial
read-tree failure due inherited alternating-object nesting limits (resolved
with read-only flat object views); two initial static-scanner assertions from
comment examples (`require('./tools/disasm')`, WAT owner `file:$symbol`), fixed
by excluding comment lines; one optional rg operand named an absent prepare.py
and exited 2 (the required files were present). Two later CLI exits 1 are
intentional omission controls. No failed runtime admission, build, or guest
occurred. No source fix was made in response to any checker failure.

Commit/push result and exact actual remote task SHA are recorded in the shared
append-only board and the task launcher's usage directory after publication.
Task stops at verified manifest/recipe delivery; coordinator owns any later
real build/runtime assignment.
