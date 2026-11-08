# Recoil durable extent preallocation, 2026-11-08

Real extent preallocation is implemented and tested. **The complete unchanged
250 ms fence still refuses every measured trial.** The fresh-box preallocated
trials reached durable close at source ages 317 and 370 ms; final fsync alone
cost 122.56 and 130.39 ms. The fastest compound baseline closed at 233 ms,
then its independent post-probe census correctly refused at 260 ms. No original,
game, Resume, M, input or replay was run. Full27, parity, audio and FPS remain open.

Evidence R: `scratch/runs/20261108-recoil-preallocated-journal-1844/`.
Starting Git SHA: `f37f9c8827d3981a4c024a4e304d2c5be11b0661`.
The exact published compound baseline is `e71fbddbe`, described in
[the compound journal note](recoil-compound-journal-20261108.md).
`measured-preallocation.json`, `measurement-audit.log` and the retained complete
journals provide the measured results and independently checked source hashes.

## Supported helper and durability ordering

`tools/native-source-retention.cjs` uses an explicit supported normal helper:
Linux, `/usr/bin/python3 -I`, and Python's `os.posix_fallocate`. The already
exclusively opened journal file description is inherited as FD 3. No shell or
pathname reopen occurs. Missing interpreter/API, unsupported filesystem,
allocation error, abnormal helper exit or timeout refuses preparation. There
is no sparse-truncate or zero-fill replacement. A five-second preparation cap
kills an expired helper and waits for its close before file cleanup. The helper
exits before the existing file/name syncs and before compound timing. Its
stderr is bounded, and size plus allocated-block checks reject an unallocated
file. The normal adapter's existing error path makes refusal sticky UNKNOWN,
drains the writer, and prevents replay.

The default bound remains 32 MiB. Before the guarded compound window, preparation
reserves that file's real extents, syncs the file, and syncs/closes its directory.
The normal driver retains its existing prepare/abort callbacks. Immutable frames
stream by explicit positions captured at admission. A short write advances the
buffer offset and file position only by the returned count; zero/invalid progress
refuses. After the terminal seal and all queued writes, finalization truncates
the file to its exact sealed byte length, then performs the same final **fsync
and close**. All final owner, context, instance, script, retirement, independent
census, source/PNG <=250 ms and immutable five-second checks remain downstream.
Original response/copy timestamps and actual PNG decode/save are unchanged.

A crash before exact truncation leaves an exclusive diagnostic file, possibly
with a reserved zero tail; the diagnostic reader refuses partial/corrupt metadata.
No abandoned-file recovery can certify or replay. Error and timeout paths still
wait for queued writers and close. A complete seal describes content, never
qualification or successful durability by itself.

`allocation-syscall.*` independently records the real successful syscall
`fallocate(3, 0, 0, 33554432) = 0`, positioned writes, exact ftruncate, fsync and
close. The tested offset is deliberately advanced before admission to check that
frame writes ignore the shared seek position. `retrieved/external-helper.json`
records the remote interpreter path, resolved binary, SHA-256, size and version:
`/usr/bin/python3.12`, SHA-256
`1643dacd9feaedc58f3cc581e4d22577dfe25c09b10282936186ccf0f2e61118`.
The supported mechanism is intentionally fail closed outside this environment.

## Finite actual Chrome comparison

One fresh box executed exactly two alternating preallocated/compound pairs under
the same published kernel, production parent, normal native adapter/strict gate,
actual Chrome source transport and independent challenged clock producer. The
baseline reconstructs the exact published compound modules in memory from current
providers plus small verified reverse edits. The preallocated module uses its
normal default helper; neither trial changes fences or evidence callbacks.
Preparation costs 1526.88/678.38 ms for the preallocated trials, outside the
compound clock, versus 116.60/265.54 ms for the baseline. Preparation includes
normal kernel tracing and durable file/name work; it is not an allocation-only
microbenchmark.

| Fresh-box trial | Two-read source window | Exact truncate | Final fsync | Oldest source at durable close | Post-census age |
| --- | ---: | ---: | ---: | ---: | ---: |
| Preallocated 1 | 183 ms | 0.085 ms | 122.56 ms | 317 ms | refused before census |
| Compound 2 | 181 ms | unchanged baseline | 43.22 ms | 233 ms | 260 ms, refused |
| Preallocated 3 | 227 ms | 0.053 ms | 130.39 ms | 370 ms | refused before census |
| Compound 4 | 195 ms | unchanged baseline | 118.87 ms | 327 ms | refused before census |

Every trial retained six complete uncached source envelopes, six proofs, the five
phase payloads and the actual decoded PNG. Independent audit checks original CDP
timestamp brackets, byte counts and all accepted hashes: WASM `6cf120d0`, decoder
`f468ffce`, compositor `cb21daaf`. The 2,182,663-byte accepted WASM is reused by
existing path/hash; the current full-build module is not substituted.
The real Chrome/source/storage path is measured; ownership and the one-pixel PNG
belong to the causal VM fixture. These are not original-game ownership/HUD proofs.

A separate local pair comparison also refused all four trials. Preallocated
source windows were 241/246 ms, final fsyncs 15.49/12.71 ms and durable-close ages
271/270 ms. Baseline windows were 292/231 ms, syncs 18.55/13.00 ms and ages
321/254 ms. Local uses the current shared kernel and is kept distinct from the
fresh-box comparison's exact historical kernel. Across both runs, all **48
complete envelopes and 48 proofs**, eight complete journals and eight decoded
PNGs were independently audited. No trial passed the complete fence.

Preallocation removes extent reservation from the timed window, but these finite
samples show no reliable end-to-end improvement. The fresh-box final durable
barrier remains 122–130 ms despite successful preallocation; truncate costs
<0.1 ms. This does not isolate filesystem internal causes or prove a particular
volume will be faster. The baseline's 233-to-260 ms interval demonstrates that
the independent census remains necessary even when the strict gate first passes.

## Remaining service need and safe next step

For preallocated trial 1, the measured budget is 183 ms through the final source,
about 11.4 ms other work, and 122.56 ms fsync. Adding the observed 26.53 ms
independent census would require final sync below about **29 ms merely to fit**
250 ms, before a safety margin. Trial 3 already uses 227+12.6+26.5 >250 ms without
any sync cost; storage alone cannot rescue that source window. Original/copy/PNG
ages and other checks can independently be tighter. This is a measured budget,
not a qualification guarantee.

The useful safe next step is a separately assigned comparison on an actually
different durable low-latency block service or improved durable I/O service
quality. Measure the same accepted Chrome sources, helper, kernel, final
fsync+close and independent census, targeting <=10 ms final fsync and consistently
short enough source windows (roughly <=200 ms with the observed remaining work;
less for usable margin). Retain producer-proof durability and every present
fence. This box had no separate volume measured; predecessor volume inspection
found `/home` and `/tmp` on the same device. A renamed same-device path, tmpfs,
restamping, omitted census, relaxed source fence or repeated original cannot
supply the missing durable service. No original attempt is warranted here.

## Validation, selection and recovery

Thirteen focused retention tests pass, including actual partial-frame process
crash, exclusive abandoned-file refusal, immutable frames, byte/row/time bounds,
explicit short/zero writes, open/allocation/write/truncate/sync/close/directory
failures, real readonly/closed-FD syscall refusal, helper timeout with child-close
drain, late writer/close drain, blocked timer races, prepared-census failure,
retirement/context changes and source/PNG/five-second expiry. Native13, strict46,
owner28 and lifecycle12+6 controls pass. Actual Chrome clock controls pass with
seven independent process proofs and the final physical driver binding. Physical
closure13, generation selection8 and the locked full build pass.

The full-suite strace invocation correctly hit the unchanged 250 ms timeout
under thousands of instrumented short writes. The targeted real-allocation trace
passes; the ordinary complete suite passes. Initial selection and standalone
watchdog test invocations lacked their required import/argument/environment
configuration; those failures are retained without being counted as passes.
Unchanged watchdog/clock/gate proofs are referenced and hash-checked in
`unchanged-proofs.json`; no redundant watchdog runtime was needed. The task's
allocation watchdog and measured runtime's watchdog were independently prearmed
and observable, and actual shutdown completed normally.

`selected-runtime-pins.json` and `position-runtime-pins.json` retain 1,067 providers
and relocate the normal 29-file physical helper closure. Only retention code
changes among shared providers. The two-callback and prepare/drain driver patches
are byte-identical to the predecessor. Original851, accepted1066 and historical
selected1067 remain immutable. The shared kernel changed during other work;
remote provision uses its exact `e71fbddbe` Git bytes, matching the predecessor's
`150822f3` hash, and leaves the shared newer file untouched. Every selected
provider was verified, using the recorded historical Git fallback when necessary.
Unchanged proofs are reused; no fixture churn or peer WIP is included.

Git holds the source archive. `starting-git-sha.txt`, `evidence-git-sha.txt`,
`relevant-uncommitted.patch`, baseline reverse edits, helper relocation patch and
small run scripts record exact recovery. Existing module/source paths and hashes
are retained rather than copied into evidence. There are no source-tree/media
archives, old-run deletion, box resume/delete, public deployment or subworkers.
The run remained above 1.5 GB free on `/home`, with no RAM gate.

## Retrieval and delegated shutdown

All **53 remote outputs / 27,707,189 transported bytes** were retrieved and
independently reopened/hash-verified before normal stop. The unique 25,249,889-byte
custody history is individually gzip-retained. Its original SHA-256 is
`0558adffff28cd7922867d22e223bcb754798e89baae247b70e622b6410303b1`;
`gzip-originals.json` records the recovery recipe. Independent streaming
decompression verified original size/hash without a durable uncompressed copy.
The final audit rereads every retained task artifact and every unique remote
output, including that decompressed SHA.

Kernel drain was **179/179**, exit 0, remaining empty and unresolved lineage
empty. Independent remote checks found **181** observed PID/start identities
absent, two ports closed, the Chrome profile absent, no runtime FD writers, no
held input and the runtime lock free. CLONE_UNTRACED is unaudited: this is not an
exhaustive process-history claim. Independent local drain checks **166** observed
identities absent, profiles/ports/writers drained, lock free and the allocation
supervisor empty. No board watcher was left running.

Box **bx_gbee99be** is **ARCHIVED**, current expiry **NULL**, initial expiry
**2026-11-08T19:10:12.489Z**. Delegated normal stop
**stop_1569916c99242c5e** completed **18:47:22.539Z**, forced FALSE, error NULL.
The independent 25-minute immutable watchdog was observable before the persisted
UUID allocation key and creation. Actual ID/expiry were retained before runtime.
The worker releases this task and stops; the selected generation remains
**unqualified for gameplay input**.
