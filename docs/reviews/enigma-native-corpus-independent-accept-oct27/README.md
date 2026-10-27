# Independent retained Enigma native corpus acceptance

**ACCEPT_SYNTHETIC_CANONICAL_CORPUS.** The exact retained corpus supports its
declared synthetic canonical-module coverage. No qualifying defect was found.
Full production-runner/native-game initialization and original-game behavior
remain unqualified. No production or donor harness repair, native instantiation,
build, generator, guest, browser, Boat query or main integration occurred here.

Candidate `425755ee5ee9be0734c7aca187521100f5487674`, source tree
`fb1ef0832eb9e0229cd272c67b8465c4fcbf4396`; source acceptance
`facebcb2e6d04b84e80211a7814654e528566b0f`. Native donor
`291e4b03f77c3957c0e14fe0077fe5d301882964`, tree
`f00667622b73b2d52f7ae1f7bf5309514db0c111`, normal-push receipt verified.
Build `c654f37bd6e3c17fd442bc38fbc189c1fb4b26bc` and the prior generator,
both builds, 2226-export ABI, five signature changes and 269-layout acceptance
are reused. None were rerun.

The first independent inspection verified the actual production `test/run.js`
SHA256 `55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e`,
the exact retained installation/qualification substrings and their source order
before the earliest PE loader and `init_dx_com_thunks`. The accepted source-only
CLI/default-off/loader-substitution results are reused, including their unchanged
reproducer identity. They do not execute a guest initializer. The native harness
uses an instance proxy in extracted installation statements; that is explicitly
different from running the whole production runner. `provenance-audit.json` binds
these boundaries, consumed receipt hashes and execution argv.

The unchanged final harness SHA256 is
`b62c76f898a8148c8f5a30d3fca774e2942cb3d7d64aa5bc6fdb2011b8f016c8`.
Acceptance also inspected the versions actually executed:

| Retained group, both backends | Pairs/backend | Harness SHA256 |
| --- | ---: | --- |
| core | 20 | `0f45d951978a59e9923a116459d5ac00a38c807f3d999fe7c5fc1b821fb27f54` |
| hooks-thread | 16 | `f9fac7abd314000427349714f79bda6b70c6aabbe51c07e1688ca93634c9021a` |
| hardware | 20 | `0f417592c42115a0a2bf494be2d906124d4779df201d02fd09c3548694f04b86` |
| unrelated | 4 | `b62c76f898a8148c8f5a30d3fca774e2942cb3d7d64aa5bc6fdb2011b8f016c8` |

The core version comes from the retained original harness archive. Its full
archive hash matches the original transfer receipt. Later versions are retained
separately; failed global-thread-zero hook and posted-key fixtures are not counted
as passing groups. The manifest and exact module pins were freshly verified by
the coordinator before dispatch; this task reuses that 276-payload admission and
checks consumed inputs, rather than copying or rerunning historical evidence.
Raw JSON envelopes are base64-decoded and checked against original length and
SHA256; original fixture/API/packaging incidents remain unchanged.

The inspected harnesses load a synthetic PE through the real `load_pe` export,
initialize canonical DX thunks, resolve loader-generated USER32 thunks and run
decoded indirect CALL/JMP snippets. No direct host-completion invocation supplies
the retained module observations. Actual module imports call the accepted owner;
real message handlers and guest hook continuation thunks run in the canonical
modules. Queue injection and a deterministic hardware input are fixture inputs.
The unrelated-callback lane schedules guest execution manually on another stack.
Unrelated imports remain signature-correct zero stubs, with clock 123 and no
general drawing/network services. These are explicit limits on the synthetic
claim, not new production qualifications.

## New offline checker and adversarial evidence

`test/enigma-native-corpus-check.py` reads the eight raw result files. It verifies
the expected case identities and candidate/backend/module identity independently
of `pass` booleans. Each backend must have 20 core, 16 hook, 20 hardware and four
unrelated pairs: **120 pairs / 240 primary executions**, plus the retained
omitted-observation control for each backend. The accepted ON observations contain
**136 completion records**, including 16 distinct nested completions.

The checker compares all persisted OFF/ON MSG, EAX, ESP, EIP, yield and queue
states, including first/parked/suspended/unrelated states. OFF must have zero
diagnostic import calls and records. It checks exact import schedules against
fixture intent and uses an independent invocation automaton to derive accepted
completion ownership/order, then checks the entire recorded completion payload.
Park/retry keeps token 1; nested PeekW uses token 2 before outer token 1. The
keyboard-to-WH_GETMESSAGE chain makes a completion attempt while bound: the owner
ignores it, then accepts one completion after kind-2 resume. Merely counting
`message_complete` imports would produce an incorrect rejection. False Peek has
no MSG; WM_QUIT Get returns zero with its valid MSG; PM_NOREMOVE retains its queue.

All **86 adversarial controls reject** (43/backend): missing/duplicate cases,
coordinated wrong case identity, stale module/candidate, wrong backend/scope,
missing/duplicate/misordered import or record, wrong owner/API/thread/frame/MSG/
result/sequence, OFF diagnostics, each architectural state mismatch, stale retry,
missing park, nested alias/order, wrong resume context, chain order, missing bound
attempt, unrelated callback state/early record and broken omission controls.
Mutations operate on copies of actual retained parsed records; donor bytes never
change. Valid data with all summary `pass` flags false still accepts. Four
deliberately omitted checker guards are killed by meaningful controls; each
mutant first accepts the real corpus. See `checker-mutants.json` and control files.

`test/enigma-corpus-production-helper-replay.js` independently replays recorded
import sequences through the exact pinned production owner and trace helpers.
All 136 records match byte-for-byte JSON values, including order, ownership and
both omission controls. This is **offline host replay** using small supplied MSG
buffers, not additional native evidence or fabricated production-runtime proof.
The Python oracle never imports production JavaScript and never reads a module.

The retained schema has ordered import calls and completion records but no
unified event/state timestamps or recorded `message_begin` return values.
Phase assertions in the unchanged executed harness, source continuation audit,
recorded ownership and this independent owner replay support the declared cases;
they cannot prove arbitrary production scheduling, concurrency, or exact state
at every unrecorded instruction. Suspended/parked/unrelated snapshots are checked
where retained, and missing broader scope is not manufactured into a defect.

## Reproduction and controls

Donor data remains read-only under
`/tmp/enigma-retained-canonical-native-msg-qualification-oct26/`; its committed
`docs/reviews/enigma-retained-canonical-native-msg-qualification-oct26/remote/`
contains the eight result files. New `corpus-pins.json` binds their exact bytes.
Under a newly admitted unchanged light supervisor, run:

```sh
python3 test/enigma-native-corpus-check.py DONOR_REMOTE --pins REVIEW/corpus-pins.json
python3 test/test-enigma-native-corpus-check.py DONOR_REMOTE OUTPUT_DIRECTORY
node --max-old-space-size=32 test/enigma-corpus-production-helper-replay.js DONOR_TASK OUTPUT_JSON
```

Use the retained `control.py` wrapper recipe: every local test/controller reserves
one of two shared permits and supervises the full pool/supervisor/descendant RSS
under 128 MiB; Git takes two permits then the exclusive Git flock under 256 MiB.
Git DATA 512 MiB applies only to Git. CPU90/wall120/file24MiB/output2MiB/excerpt8192.
Node24.18.1 heap32 startup succeeds with DATA/AS unlimited and the exact recorded
environment. A heap flag is not a total RSS cap. Test/resource receipts bind the
actual commands; no old native Node environment is misrepresented as local.

Own setup incidents are preserved in `incidents.json`: initial read probe guessed
a nonexistent raw-log filename, and an unfortunate `inspect.py` name shadowed
Python's stdlib during exception handling; it was renamed. The first independent
schedule expectation conflated Peek entry ESP with continuation context; unchanged
WAT uses a saved callback frame at stack-20. A case-identity guard mutant initially
had only an inconsistent nested-identity challenge; the final coordinated control
changes all three identity copies. Startup initially hashed the whole Node binary
in one buffer and hit the physical cap; streaming fixed it without changing limits.
A mistakenly attempted helper command after that failure stopped on a missing
helper path before replay; it is not passing evidence. Startup then passed before
the corrected helper replay. One source-order inspection guessed `await` before
the synchronous PE loader; exact source inspection corrected the lookup.
No donor repair or production failure is concealed by these owned corrections.

Complete local allocation is 48 MiB: 16 MiB source/Git/tests/evidence,
16 MiB session/events/positive-WAL-once, 8 MiB publication and 8 MiB reserve.
Standing donors/modules/tools are read-only, without copies or alternates.
Current free space already includes materialized bytes; admissions subtract
remaining own and GL/Alien peer growth once. RAM is measured separately from
virtual reservations and resident client RSS already deducted in MemAvailable.
No heavy-runtime admission floor or individual client 128 MiB cap is inherited.

Only new checker/tests/review paths are committed on the task branch. Source,
donor harness, modules, main and root worktree remain unchanged. Git records
module recovery pins, not ignored binaries: tail 1,880,854 bytes SHA256
`af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b`, compat
1,883,427 bytes SHA256 `ed7635d508f7e842afd3c6b8489ba133ac3ddea2fa305439fca60284ea5613a8`.
They remain in `/tmp/enigma-reconciled-canonical-boat-build-oct26/modules/`.

No box was assigned or queried here. Coordinator board at 00:14:26Z reports
snapshot-stop completed for Enigma `bx_xw8d895f` and GL `bx_bwf4vkqh`; this worker
did not alter lifecycle. Enigma's retained expiry was 00:37:17.515Z. Coordinator
retains ownership. GL confinement and Alien terminal source ownership, dirtyroot,
Claude idle/Heroes II laptop and real CivII/Maelstrom/platform denials are preserved.

Remaining gates: actual full production runner/native-game initializers and
execution; bounded step ACK for every requested batch followed by a frozen
zero-credit snapshot before input; original-game acceptance. No gameplay or
exhaustive runtime claim, main merge, service/deploy or worker/refill authority.
