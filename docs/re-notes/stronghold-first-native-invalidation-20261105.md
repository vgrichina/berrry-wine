# Stronghold first native coverage invalidation

The released original `d2d4cfa9940d3dde7a62fd3ecc3a32eb8c7913d1` reached
Choose Type / Custom Game hover, then failed before Custom Game DOWN with
profile 2, image `0x400000`, epoch `346889932`, callback ABI 1, reason 5,
depth 1. Its first invalidating site/time was not retained. That historical
failure and its seal are unchanged. Setup, world and hostile engagement were
not established by that run.

Evidence for this continuation is
`scratch/runs/20261105-stronghold-first-native-invalidation/`. Canonical media
is referenced by existing path and SHA-256, without copies:
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`,
`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
Git SHA, relevant binary diff and owned new-file patches provide source recovery;
there is no source archive or staged source tree.

Preparation remained scratch-only until keyedmip1230 FINAL at 13:40:29Z and
Lords1310 FINAL at 13:48:35Z, both ALLBUILDSFINISHED. The independent release
gate checked 17 recorded processes absent, four profiles absent, seven refused
ports, four free locks, no heavy runtime and over 9.6 GB free disk. D3D's four
early browser exit statuses remain unknown; resource absence does not supply
normal-exit evidence. Lords1310 removed its unvalidated implementation and
released without any original launch after an ordinary repository census review
gate. No successful Lords build is inferred. Shared ownership began 13:56:55Z.

The implementation adds only an immutable first native coverage failure record.
Existing reason stores pass through a recorder that copies state before the
store. The synchronous marker import runs after the store, so an import error
cannot leave coverage valid. The owning observer installs its marker hook before
instantiation and captures UTC and the actual Wasm caller/offset, independently
of whether block observation has started. Later failures, setters, callbacks,
thread/epoch checks and arm attempts cannot replace the record. No coverage
predicate, target set, callback ABI, guest control flow, readiness or pixel
acceptance is relaxed. No causal emulator repair is claimed at this stage.

`pending_context_first_failure_version()` is 1.
`pending_context_first_failure(field)` returns an unsigned 32-bit word when read
by JS; out-of-range fields return zero. Reason zero means no retained failure.
The record is diagnostic and never constitutes coverage proof. Its fields are:

| Fields | Meaning |
| --- | --- |
| 0–3 | first reason, predicate site, guest EIP, guest ESP |
| 4–10 | current thread, armed thread, depth, observation epoch, profile, actual image base, active-run bit |
| 11–15 | callback entries/returns, compiled PC/EIP, yield reason |
| 16–19 | rejecting predicate's local a/b/c, reason before the store |
| 20–27 | exact eight words of the top native frame, or zeros without a frame |
| 28–31 | current native process epoch low/high, invocation root low/high |
| 32–35 | dispatcher local return, thunk index, metadata, current thunk EIP |

Site 0 uses the retained native caller/offset. Sites 1–6 identify, in source
order, the rejecting predicates in `pending_entry`; a/b are its PC/ESP. Sites
101–108 identify those in `pending_dispatch_callback`; a/b/c are entry EIP,
return EIP and parent ESP. Dispatcher locals remain distinct from the redirected
callback EIP and the saved top frame. The diagnostic schema is also retained in
the run's `diagnostic-schema.json`.

The focused generated regression passes all 14 cases across the two shipped
modules: untracked target entry, tracked-call stack escape, host setter, bad RET,
foreign epoch, diagnostic import exception during execution, and an unarmed
control. It checks immutable native/host records with zero observed blocks,
pre-store state, actual native stack, fail-closed consumer rejection, later
events and getter bounds. The first test attempt incorrectly entered a callback
after switching to a foreign thread; that existing ownership trap was retained
in the failed log and the test order was corrected. No emulator workaround was
introduced for it. Accepted startup prerequisite qualification was not repeated.

The exact census scanner reports no changed inventoried producers. Its file is
unchanged; the lifetime review records scalar copies and synchronous forwarding
without guest context, token, lease, scheduling or continuation changes. Existing
callback ownership remains pending. The named current runtime binding is dated
for this assignment and the two exact predecessors; historical bindings remain
closed. Command/review/native/input/pixel limits remain unchanged. The full `flock /tmp/wine-build.lock bash tools/build.sh` passed. The actual
composed-entry check passed with 2429 filesystem and HTTP rows, all 45 negative
controls, zero Chrome/original launches, and server closure. The single finite
original observation awaits publication of this diagnostic.

No box is assigned (ID/state/expiry N/A); coordinator owns box lifecycle. The
task delegates normal teardown of its own local runtime. No subworkers or public
deployment are used.
