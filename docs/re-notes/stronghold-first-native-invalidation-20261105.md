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
acceptance is relaxed. No causal emulator repair is claimed.

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
original observation completed below.

No box is assigned (ID/state/expiry N/A); coordinator owns box lifecycle. The
task delegates normal teardown of its own local runtime. No subworkers or public
deployment are used.


The diagnostic was committed and published as
`c11e415e02f0dfbe6f7f38a18a5d0fa5e2833ef7`. Explicit strict-SSH pull/push
passed; an initial configured pull used HTTPS, which was corrected by using the
explicit SSH URL. The first launch command at 14:04:07Z failed closed on a stale
Git identity before runtime preparation, release issuance, browser creation or
original-attempt creation: concurrent published `2b2e9ac48` changed only
`TODOS.md`. Both manifests and that refusal remain in evidence. Binding the
unchanged diagnostic to published HEAD `2b2e9ac48b764ed36833efcbdd8ea12199929f14`
allowed the **one** original at 14:04:42Z. Its finite caller completed normally
at 14:09:48Z after the first concrete command failure. No second original ran.

The first native invalidation is now established at **2026-11-05T14:05:22.292Z**,
during startup, before the later title/menu observation. The immutable raw
`first-failure.json` has SHA-256
`5e98b15702c02a40c469dc2d7b5a4e6c00e4d9bc4ed817bfe845c3d28b0c6a33`.
`decoded-first-cause.json`, `first-failure-retention.json` and the original
attachment reports retain its interpretation and subsequent equality checks.
The synchronous native stack is retained verbatim, including function indices
496/497/501/13884/14973 and offsets 0x1d78d/0x1d7b3/0x1da6f/0x1ded22/0x1e4821.
The line-regex function-name utility does not account for this compiled WATX
module's function layout; its attempted mappings are not used as evidence.

| Captured fact | Value |
| --- | --- |
| First reason / site / previous reason | 5 / `pending_entry` site 4 / 0 |
| Rejecting predicate | unsigned current ESP greater than top-frame entry ESP |
| Guest EIP / ESP | `0x0057c707` / `0x074fff20` |
| Current / armed thread; depth | 1 / 1; 1 |
| Profile / image / callback ABI | 2 / `0x00400000` / 1 |
| Observation epoch | `2574209027` (`0x996f5003`) |
| Native process epoch / invocation root | 1 / 2 |
| Top-frame target / return / entry ESP / kind | `0x07500210` / `0x0057c707` / `0x074fff08` / 1 |
| Top-frame parent EIP / ESP / token | `0x0057c707` / `0x074fff20` / 0 |
| Callback entries / returns | 3 / 2 |
| Current thunk EIP / active / yield | `0x07500210` / 1 / 0 |
| Compiled PC / EIP | 0 / 0 |

Unmodified original disassembly resolves the call at `0x57c701` through IAT
`0x584130` to **KERNEL32!ReadFile**; `0x57c707` is its immediate successor.
The original pushes five arguments, with a NULL OVERLAPPED argument. The captured
ESP delta is 24 bytes: return address plus five arguments. This is consistent
with the documented [x86 stdcall callee cleanup](https://learn.microsoft.com/en-us/cpp/cpp/stdcall?view=msvc-170).
Microsoft's [ReadFile contract](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile)
distinguishes synchronous completion from overlapped I/O; an internal lazy-fill
retry is not itself a guest callback or completed read.

Source comparison identifies a concrete candidate: `handle_ReadFile` calls
`io_block` for internal lazy-fill result 997. `io_block` restores the exact
stdcall frame, redirects to `current_thunk_eip`, sets yield 12 and stops the
slice. `pending_dispatch_callback` can record a redirected thunk as a kind-1
callback; ordinary API completion does not execute the guest RET path that
changes that kind to 4. The captured kind-1 target equals the retained current
thunk, and the current EIP/ESP equal its stored parent EIP/ESP. This supports an
internal-retry classification mismatch, **but the record does not include the
preceding dispatcher entry, ReadFile host result, park transition or frame
creation**. Those missing facts prevent proving that exact lifecycle in this
original, or certifying a coverage-preserving repair. `lib/dll-loader.js`'s
native-token DllMain path was inspected; this record does not establish a
DllMain sentinel/token mismatch. No speculative callback exemption, shadow-frame
pop, epoch reset or coverage relaxation was applied. The causal repair remains
unestablished, so this task stops with the exact diagnostic retained.

All 21 screenshots were personally inspected, including all eight requested
reviews before their deadlines. Ordinary controls reached title at 8448, main
menu at 8576, Choose Type at 8768 and Custom Game hover at 8832. Command 10
failed **before CustomGameDOWN** on continuous coverage rejection. The retained
first record remained identical in three owning attachment reports and in the
terminal native getter copy. Native blocks/publications remain zero; ordinary
setup, world and visible hostile engagement remain unestablished. No readiness,
presentation or pixel certification is inferred from the screenshots.

`closure-after.json` verifies all 2429 sealed dependency rows still match,
including the canonical original media and both built modules. Module SHA-256:
`006b2e5adeb4d05e4647fd5581f87c4caeb3b2bc038fb4a945307be8240b2afe`
and compatibility
`c652f4eb35f380ffdb5f77ea1e210397028993e64ba726716f592862f7266753`.
No source archive, media copy or staged tree was produced.

Normal own-runtime teardown requested Browser.close at 14:09:48.047Z and retained
actual Chrome exit **0, signal null** at 14:09:48.295Z. `final-cleanup.json` at
14:14:08Z independently checks ten recorded processes absent, the own profile
removed after no users remained, three refused ports, four free locks, no heavy
runtime and over 9.5 GB free disk. The own watcher was already absent when
cleanup began; its exit status is unknown and no kill was sent. No broad kills
occurred. Box ID/state/expiry remain N/A. All builds and local runtime work are
finished. The next causal work needs a generated ReadFile park/retry lifecycle
reproduction and exact ownership proof before any repair or further original;
this task performs neither a workaround nor another original observation.
