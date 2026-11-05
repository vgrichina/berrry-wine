# Aranna passive resource boundary, 2026-11-05

The sole original session reached normal mss32 initialization and the EULA,
then ordinary Accept reproduced the Logic.dsres critical error `0x17`.
The targeted production RPC completions show a successful canonical 788-byte
read and correct cursors for all three seeks. No read/cursor divergence or
causal emulator defect was demonstrated. Gameplay remains blocked by the
unresolved guest resource rejection; no speculative repair was made.

Evidence is retained in
`scratch/runs/20261105-aranna-passive-resource/`. Personally reviewed captures
are `startup.png` (EULA), `after-accept.png` (black game window), and
`terminal.png` (critical-error dialog). `terminal-state.json` retains the
matching window titles and complete dialog text. FPS and audio are unknown.

## Passive implementation and validation

Run-owned `observer.js` derives from the earlier ordered observer's
`BrokerObserver.table` boundary. It wraps `fs_create_file_result`,
`fs_read_file_result`, and `fs_seek_result` synchronously, before the normal
broker response/wake. It preserves the original status and exception behavior.
A successful read copies mapped bytes transiently, hashes them, compares them
with the VFS bytes at the recorded offset, and discards the copy. The Node
receiver independently hashes the canonical file offset. Persisted read
observations contain offsets, counts, mapping spans, hashes and mismatch
metadata; no payload bytes are serialized.

The adapter retains the production `lib/guest-worker.js?v=dev` URL and transport.
There is no custom Worker, WorkerObserver, live `get_image_base`, CPU export
facade, fault setter, breakpoint, sparse-fault mode, block invalidation, or
execution-state write. The preferred EXE base `0x400000` is derived from the
existing `loadPe` input PE header; the JS memory reader uses the existing
page-aware mapping helper. This observes an I/O completion, not a globally
atomic snapshot of every concurrently running guest thread.

Before the original, real generated standard and compatibility Workers passed
the changed observer controls and normal PE DLL initialization (`EAX=1`).
Controls cover cross-page 16,397-byte delivery, signed end seek, short EOF read,
real access-denied ReadFile BOOL/error/count, cursor changes, and a mismatch
introduced only into a copied observation. They assert that real returns and
previous hashes remain intact. Synchronous SHA-256 was compared with Node
crypto across padding/page boundaries and the full Logic file length.
`browser-controls.json` records PASS for both modes and no page errors.
Two earlier generated fixture attempts failed because the test fixture omitted
the normal shell's renderer initialization; their logs and process identities
remain under `control-attempt1/` and `control-attempt2/`. The fixture was fixed
before the original. No production behavior was changed for those failures.

`flock /tmp/wine-build.lock bash tools/build.sh` passed (`build.log`), including
both production modules and the data-overlap check. The generated modules have
fixture-only dispatch exports and distinct hashes, retained with their inputs;
they are not substituted into the original session.

## Original identity and ordered observations

Source SHA: `86735e76c107949947ca60e213fb3c68a9353ee2`.
The 304 tracked relevant runtime file hashes were identical at validation and
immediately before original startup. `validation-source.json`,
`before-original-source.json`, `runtime-source.json`, their relevant binary
diffs, and phase-specific owned helper/new-source patches pin the actual tree.
No shared production source was edited. Git is the source archive.

The actual compiled module handed to both production owning Workers was
2,174,134 bytes, SHA-256
`b6c36db2aa538aa8c6e411d1cbe421d7898f791d65003b5ed54b8564495289d2`.
It is retained as `browser-module-<sha>.wasm`. Recorded Worker starts are slot 0 /
endpoint 1 at 20:48:52.320Z and slot 1 / endpoint 2 at 20:50:24.711Z, both with
that module. The targeted completions report broker slot 0 / endpoint 1;
open/read import thread IDs are 1 and seek has no thread-ID argument. These
identities are retained separately, without equating the raw import thread ID
to a Worker slot. Chrome 151 used `defaultViewport:null` and a fresh profile.

`mss32.dll` mapped at `0x9c0000`, DllMain `0x9ef6c5`; its normal return `EAX=1`
and successful `loadDlls` completion were recorded at 20:48:55Z. The startup
capture was reviewed before input. Fresh `commands/0.json` clicked the observed
Accept center (173,588), using the current canvas rectangle (10,160,660,602).
No pending commands were replayed.

All five targeted completions occurred at 20:50:30Z on handle `1879048202`:

| Sequence | Operation | Result |
| --- | --- | --- |
| 1 | Open `C:\Resources\Logic.dsres` | success, access `0x80000000`, OPEN_EXISTING, flags `0x08000001`, cursor 0 |
| 2 | Seek current +0 | success, result/cursor 0 |
| 3 | Seek beginning +0 | success, result/cursor 0 |
| 4 | Read offset 0, requested 788 | success, count 788, cursor 788, no mismatching bytes |
| 5 | Seek current +4,093,060 | success, result/cursor 4,093,848 |

The 788 delivered bytes hash to
`02914d0ca66e1bd574cc3992e7615bb5286109d383562132a699aa81bcc3cf32`,
matching both VFS and canonical offset 0. The destination guest address was
`0x08b00000` (145752064), mapped host offset 146137088. `ordered-summary.json`
records zero import failures, observation errors, comparison errors, dropped
records, or count/cursor mismatches. No subsequent targeted read completion
was recorded before the terminal capture.

The error was visibly present by 20:50:38.775Z. A follow-up queue command
contained the run-owned `state-readout.js` eval step, but the queue permits only
`tools/capture-legacy-render-evidence.js`. Validation rejected the whole command
before executing it and closed the browser (driver exit 1 at 20:50:39Z).
The lifecycle hook still retained the terminal dialog, pure host state, module
and observations. This is a harness mistake, not a guest crash or platform
flag. The original was not repeated; no error-dialog OK input was sent.

## Causal limit and next discriminating boundary

These observations rule out corruption/count/cursor mismatch at the captured
broker read completion. They do not establish the guest-visible post-handler
BOOL/register values, subsequent consumption of those bytes, other unwrapped
I/O paths, or an archive/checksum/CPU cause. The guest's error `23` is not
evidence of a failed host ReadFile: every captured operation returned success.

Canonical executable disassembly, retained in `static-read-path.txt` and
`static-validation-path.txt`, still shows distinct guest `SetLastError(23)`
calls at `0x653498` and `0x6555a1`. Neither was dynamically selected here.
The latter follows a call at `0x65558f`, return `0x655594`, and compare at
`0x655597` against `[ESI+0xd8]`, with input buffer `[ESI+0xc]` and length
`[ESI+0x9c]`. This static structure does not prove that path caused this run.

The next useful boundary is the owning Worker's post-RPC Win32 return and
immediate resource consumer, including the successful seek return at 4,093,848,
then the first guest assignment of error 23. Distinguish the two static sites
before attributing the failure to validation or checksum computation. Any
future original needs separate authorization; this assignment consumed its
single original session. No causal CPU/Win32/memory fix is ready to commit.

## Inputs, recovery and cleanup

All 28 existing canonical inputs (281,799,760 bytes) were verified in place;
no media copy, download or extraction occurred. The existing canonical mapping
and registry/bootstrap inputs from the normal loader run were reused by path.
Both case-distinct setup DLLs remain preserved; the existing mapping selects
one and was not altered. `media-verification.json`, `input-mapping-review.json`,
`retained-pe-metadata.json`, and the run `README.md` give paths, hashes and the
recovery procedure. Logic.dsres is 4,206,880 bytes, SHA-256
`90b26f179364a4d25f7053e8aa41932d51fcd0e563e37820894c3dbfdcf9d0e5`.
No source tree archive or repeated media is included in evidence.

The ordered Conan1930, AoW2callback1945 and AoE3wow64setup1950 final releases
were independently checked before the 20:43:36Z gate: 458 absent PIDs,
183 refused ports, 57 absent profiles, four free locks and no heavy process.
The original ended at 20:50:39Z, within the 45-minute bound. Final independent
cleanup passed at 20:51:40Z: owned Node/Chrome descendants and watcher absent,
ports refused, profiles absent, four locks free, no heavy runtime, and 7.32 GB
free. Exact counts are in `final-cleanup.json`. No boxes, subworkers,
deployment, Heroes II use, or platform flag occurred; box ID/state/expiry N/A.
