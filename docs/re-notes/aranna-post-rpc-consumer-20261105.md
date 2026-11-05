# Aranna: owning return, resource consumer and default reserved-page access

Run: `scratch/runs/20261105-aranna-post-rpc-consumer/` (ignored evidence).
Task: `NEW-GAME-ARANNA-DEMO-20261010`; worker `aranna-post-rpc-consumer2055`.

The owning CPU receives a successful Logic.dsres ReadFile return. The first
guest SetLastError(23) is the call at **0x6555a1**, returning to **0x6555a7**,
after the resource validator computes **0xec8d39b4** over an unmapped
113,820-byte stream buffer. That value is exactly CRC32 of 113,820 zeros.
The stored expected value, **0x6ff071d1**, matches the canonical file's
113,820-byte extent starting at offset 4,093,060.

The causal emulator boundary is production-default access to an uncommitted
MEM_RESERVE page: it returned the quiet zero sentinel without offering the
access to the guest's page-in handler. The source fix enables the existing
synchronous reserved-page SEH path under the production default. No guest
bytes, archive bytes, checksum result, API success value, or launch option is
changed. A generated ordinary program reproduces the missing handler before
the fix and resumes with real committed data after it, in both production
owning-Worker module variants with normal DLL initialization.

The sole original session preceded the causal fix. Its reviewed terminal is
the error dialog, not gameplay. There is no claim that repaired Aranna has
loaded its stream or reached player control; the next original boundary is
its real paging handler's commit/read/resume sequence. FPS and audio remain
unknown.

## Gate, source and actual module

SOURCEONLY was maintained until Conan first-draw's FINAL at 21:18:34Z,
legacy alpha16's FINAL at 21:29:42Z and AoW2 joined-callback's FINAL at
21:50:39Z, in that order. Independent cleanup checked 561 absent PIDs,
205 refused ports, 69 absent profiles, four free locks and no heavy runtime.
The execution window began **21:51:03.704342Z**, with deadline **22:36:03Z**.
No subworkers, boxes, media downloads, extraction or public deployment were
used.

The runtime source for the original was Git
`91a6a13b8810d52db7034d4b2466effe1d028dc1`.
`validation-source.json`, `before-original.json` and `launch-source.json`
pin runtime/compiler files; the relevant runtime hashes stayed identical
through the passing observation controls and first locked build. Their
binary diffs, untracked relevant patches and owned helper new-file patches
are retained. Git is the source archive; no source-tree snapshot was made.

The original used the actual production `lib/guest-worker.js?v=dev` and
GuestThreadHost. The diagnostic WASM was compiled from the canonical source
closure with a run-owned in-memory transform; it did not edit shared source
and added no control export. The fetched, compiled and handed-to-Worker
module was **2,175,190 bytes**, SHA-256
`864c524dd17acde45d3680a3ec203ee4a16a0855b8c0c9d4c4c0a62667ab3301`,
for slots 0/1, endpoints 1/2. `served-responses.jsonl`,
`browser-modules.json` and the unique `browser-module-864c…3301.wasm` retain
the actual served/used identity. The corresponding WAT changes are in
`diagnostic-standard.wasm.source.patch`; compat diagnostic/control modules
and hashes are also retained.

All 28 canonical inputs were verified in place using existing paths under
`scratch/game-media/aranna-demo-20261105/extracted/`. The earlier launch and
registry mapping was reused by path/hash. Logic.dsres is 4,206,880 bytes,
SHA-256 `90b26f179364a4d25f7053e8aa41932d51fcd0e563e37820894c3dbfdcf9d0e5`.
There are no media copies. The prior successful 788-byte RPC byte comparison
remains evidence from [the preceding note](aranna-passive-resource-20261105.md);
this run observes the owning return and consumer instead of repeating it.

## Passive observation and reviewed original

The compiler transform copies register-file words, lazy-flag operands, stack,
bounded resource-object words and bounded mapped buffer words through scalar
records on the existing asynchronous production dx_trace channel. Its private
observation counter is capped at 4,096. The copy reader uses direct/DIB/PTE
translation without calling g2w/gl32, invoking an export, faulting, changing
guest bytes, evaluating flags, changing step budgets or selecting a fault or
breakpoint mode. An unavailable word is explicitly `0xfeedf00d`, never a
claim about the guest's data. The original emitted 755 complete snapshots,
with no observer errors, incomplete packets or cap exhaustion.

Events distinguish API entry, handler completion, completed Win32 dispatch
after pending-I/O/callback/unload bookkeeping, and ordinary/chained consumer
block entry. Real generated owning-Worker controls compare unchanged and
instrumented modules in standard and compat modes. They verify normal DLL
DllMain EAX=1, actual successful/short/denied reads and counts, signed seek,
error assignment, actual return EIP, stdcall cleanup, nonvolatile registers,
immutable copies, lazy flags and consumer object/buffer values. Baseline has
no added observation; the instrumented controls capture the missing boundary
while returning identical API results. The first generated control attempt
ended its fixture with ExitProcess and retired its owner before slice reply;
that failed fixture/log is preserved in `control-attempt1/`. The corrected
fixture finishes its bounded slice in an ordinary loop, outside the observed
range. No original was consumed by that correction.

Exactly one original browser session launched at **21:55:18.808Z**, with
`defaultViewport:null`. Normal mss32 DllMain returned EAX=1. `startup.png`
and `startup.state.json` were reviewed before the ordinary Accept click at
page coordinates (173,588). Supported fresh capture commands retained
`after-accept.png`, `error-dialog.png` and the terminal capture. No queued
evalfile, pending-command replay, live export call or second original was
used. The reviewed error dialog names Logic.dsres and last error 0x17.

The owning slot0/endpoint1 chronology is in `observations.jsonl` and
`boundary-summary.json`:

| Serial | Boundary | Observed result |
| --- | --- | --- |
| 690–692 | CreateFileA, C:\\Resources\\Logic.dsres | handle 1879048202 |
| 700–702 | ReadFile entry/handler/completed dispatch | EAX=1, count=788, last error=0; real caller return 0x43374a; ESP cleanup 24 bytes |
| 703–714 | Resource header consumer | header pointer 0x8b00000; DSig/Tank parsing continues |
| 715–717 | Final SetFilePointer | EAX=4093848, last error=0 |
| 718–721 | Stream mapping return and validator entry | object ESI=0x852c384; buffer +0xc=0x8b10000; length +0x9c=113820; expected +0xd8=0x6ff071d1; copied buffer words unavailable |
| 722 | Return from 0x41b19c to 0x655594 | EAX=0xec8d39b4; buffer remains unmapped |
| 723–725 | First SetLastError(23), before/after/dispatch | real return address 0x6555a7 selects call 0x6555a1; error changes 0→23 |

The second observed error-23 assignment returns to 0x6559ea during unwind.
No observed error-23 return is 0x65349e; the alternative static site
0x653498 is not assumed to have run. The first global and first post-Logic
owning-endpoint assignments coincide here; the report retains both separately.

Read-only disassembly in `static-consumer.txt`, `static-resource-map.txt`,
`static-mapping-consumer.txt` and `static-checksum.txt` explains the next
boundary. The stream constructor reserves storage with VirtualAlloc on its
lazy path. The validator calls 0x41b19c with (0, buffer, length); for this
length its first byte load is 0x41b1cb. The trace establishes entry/return and
the resulting value, not an instruction-by-instruction trace of that helper.
`canonical-consumer-reference.json` independently records canonical extent
and zero CRC values without copying the media or substituting any guest input.

Normal quit command 2 was acknowledged. Chrome exited **0** at
**21:58:21.141Z**, after terminal capture and actual-module retention. The
enclosing execution wrapper returned **143**; driver exit status is unknown
because its terminal.json was not written. This is recorded in
`original-wrapper-exit.json`, not represented as a successful driver exit.
No retry occurred; independent cleanup checks the actual PIDs/ports/profiles.

## Fix and validation

Microsoft's [page-state documentation](https://learn.microsoft.com/en-us/windows/win32/memory/page-state)
defines reserved pages as inaccessible until committed. Its
[reserve/commit example](https://learn.microsoft.com/en-us/windows/win32/memory/reserving-and-committing-memory)
uses an access-violation filter to commit a page and resume at the interrupted
access. Returning readable zero bytes without invoking that filter diverges
from this behavior.

`src/03-registers.wat` now routes default reserved-page misses through the same
existing synchronous SEH path used for reserved-page diagnostics. Its guards
against nested faults, API-handler translations and unreserved addresses,
and its CPU/decoded-stream restoration are unchanged. Committed translations
still return before this miss path. The existing explicit trace-only test
continues to exercise quiet misses; it no longer mistakes the production
default for that diagnostic behavior. This is a narrow reserved-page repair,
not a general unmapped/protection/exception-semantics overhaul. If no handler
commits the page, the existing sentinel fallback remains; unhandled access
violation termination is outside this repair.

`test/test-default-reserved-worker-web.js` generates its own PE, installs an
ordinary FS:[0] handler and calls VirtualAlloc through its real import. It
uses production owning Workers, normal DLL startup and normal slices, with
no execution/fault-mode setters. Before the repair, both modules read zero
and call the handler zero times; committed controls read 0x12345678. After
the repair, both modules invoke the handler once with the actual reserved
address, commit/fill the page and resume with 0x12345678. Committed controls
remain unchanged. Actual modules/results and failed-before assertion are
retained in `reserved-before/` and `reserved-after/`.

The first locked full build passed before the original. The repaired locked
full build also passed. Focused SEH state restoration, page-crossing
retranslation and g2w fast-path tests are recorded alongside the owning-Worker
regression. Repaired canonical module hashes are
`f8ad4ef002619f28d0ed22fd2212e655a4353a6ea69dbe6fcbf97ae1c582bb68`
(standard) and
`12450d6a0cb760b4551f78f855a120159809d2baa61130840b1032351a556e15`
(compat).

Recovery: use the recorded Git SHA plus relevant binary diff/new-file patches,
the existing media paths/hashes and the run-owned helper recipe in README.md.
The original launch guard prevents a second session. A future materially
changed original should observe its normal reserved-page handler, file load,
commit and resumed resource validation before proceeding to gameplay.

Independent cleanup at 22:06:14Z found 47 recorded PIDs absent, ten ports
refusing connections, five profiles absent, four free locks, no heavy runtime
and 6.57 GB free on /home; both owned watcher processes were absent. This is
within the 45-minute execution bound. All artifacts stay in the ignored run
directory. Aranna has no candidate-corpus entry, so the record is
`task-result.json` and this investigation note, not an unrelated dashboard
candidate. Box ID/state/expiry are not applicable.
