# Lords II recovered original setup — 2026-11-05

Goal NEW-GAME-LORDS2-DEMO-20261015 reached a new, precise setup failure.
One original run reached Main Menu, Install, System Test Yes, and Sound Card
Test - Wave. Answering No to the voice question crashed child T1. No installed
game or gameplay was established. No new review rejection or original rerun.

Canonical media is `scratch/game-media/lords2-demo-20261105/original/`.
The static-recovery worker verified all 181 files (14,382,323 bytes) against
`test/candidate-corpus/lords2-demo-files.json`, with no differences. Its findings
and absolute hash manifest are in `scratch/runs/20261105-lords2-static-media-recovery/`.
Archive SHA-256: `afef0f0dd7012c46f483ab09d785431ba5813c2080d8468a52e8ec32c745f49d`.

README directs users to unpack with INSTALL.BAT, then run SETUP.EXE. INSTALL.BAT
contains `L2demo.EXE -d`; recovery already produced the original distribution.
SIERRA.INF asks for a destination, copies FILES into it, creates LORDS2.EXE's
program item, and displays the DirectX 2 requirement. FILES is not evidence of
an installed game. No guest byte or setup decision has been changed.

Run evidence and prepared caller:
`scratch/runs/20261105-lords2-recovered-original-gameplay/recipe.md`.
After the queue gate, `prepare-route.cjs` verified all 181 originals, created
one original-directory symlink under the registered candidate fixture, and
called the production browser-manifest writer. It avoided the existing helper's
recursive media copy. Its 180-support-file manifest SHA-256 is
`a1749143a2de176c4f3fdf314337a1767f6101eed4a88b6d5b0dee4d59012f8e`.
The browser used `lords2_demo_setup`, the existing input harness and an observer
of exact compiled bytes. The distribution FILES directory was not flattened
into an installed game, and the guest's install copy step was never reached.

Required queue order: stronghold-native-coverage-prerequisite-0950, then
d3d7-processvertices-clip-extents-1010, then return-fire-worker-body-transport-1020;
each must publish exact FINAL runtime AND file RELEASE ALLBUILDSFINISHED with
normal cleanup/free locks. No tests, builds, or runtime before that gate.
Deadline is 16:00 UTC. No boxes assigned; box ID/state/expiry N/A.
Coordinator owns shutdown and Telegram reporting.

Coordinator sequencing override at 11:33:38 UTC inserts CPU-SMC1120 before
RFworker1020 because CPU shared edits were already present. Current order is
CPU1120 -> RF1020 -> Lords1105 -> Strong1135. Acknowledged 11:46 UTC.
Strong0950 FINAL 11:08:27 and D3Dclip1010 FINAL 11:32:43 were observed;
CPU1120 FINAL 12:26:47 and RF1020 FINAL 12:52:32 were then observed.
Fresh 12:53:39 verification found named predecessor process identities absent,
profiles removed, ports refused, and build/runtime locks free. No test, build,
or runtime ran before that gate.

The existing USER230/262 repair bedaaaa7f is prior history and is not a new
failure. Further emulator changes require an actual current mismatch.

## Actual original run

Runtime main commit `cf5e9c1631a8593a9b553bec248c12650e3050c2`;
301 relevant physical source files unchanged at postflight, empty
`runtime-relevant.binarydiff`. Git remains the source archive.
Actual browser-compiled module: 2,171,349 bytes, SHA-256
`bc4cabf7745ac4644c3d8cc1f5b70d798277c2a4525e3c665b98d08d6577894b`.
Chrome 151.0.7922.108, Node v24.18.1, cooperative backend, fresh profile,
900x720 page and 640x571 guest canvas. Media/module identities and exact argv
are preserved without source archives or repeated media copies.

Personally reviewed `startup.png`, `after-install.png`, `after-system-test.png`,
and `after-wave-no.png`. Ordinary renderer inputs, with saved replies, were
Install (509,147), System Test Yes (510,235), and wave-question No (130,284).
Audio was not verified in this headless run; no audio-success answer was faked.
The results window's Phantasmagoria template does not prove a completed test.
The wave dialog clips lower text and the No button: read-only enumeration
found dialog 0x1804f at (69,189), 502x103, and child ID7 at client (16,64),
100x28. The last click used its exposed portion through ordinary pointer input.

After No, T1 trapped `unreachable` at EIP `0x1aa26c`, previous2 `0x1a9cf8`,
ESP `0x1f8550`, CS `005f`/base `1a0000`, SS=DS `0087`/base `1f0000`,
ES `005f`, BX `869c`, SI `88a4`. `crash-detail.json` retains all captured
registers, segment bases, 128 stack bytes, and WASM stack. Stack starts
`97a25f00a4888700`: return 005f:a297, then object pointer 0087:88a4.
The child exited with code1; setup windows disappeared into teal desktop.

The ordinary combined.wat function-index scan was rejected as inaccurate for
this macro-expanded module. A diagnostic name-section compilation reproduced
the actual canonical module SHA exactly; all noncustom sections of named and
canonical modules match. Verified stack: 848 `win16_set_sreg` (actual trap),
858 `win16_far_transfer`, 863 `th_call_far_mem`, 13880 `run`.
This is an unmapped CS rejection during an indirect far call. Its selector
value was not retained because the route's integer diagnostics were not verbose.

Runtime-generated `_setup.exe` was preserved from VFS for read-only mapping:
528,080 bytes, SHA-256
`7dbf696d4f08464ca1e187686368fe89c5b71b3162c094f463d0e5ec4eaca567`.
Original segment4:a26c contains the prologue; a290 loads ES:BX from ES:[SI],
a293 calls far ES:[BX+64h], returning to a297. Segment4:9cf8 calls that method.
These matches imply module arena0x170000 for this run; the actual live module
table was not captured. This is an inference. The initial historical-base
disassembly is retained and superseded by the explicitly corrected mapping.

The registers point to the far-call operand at 005f:8700. Its actual relocated
bytes and the object's writer were not captured. Raw original relocation-chain
bytes cannot substitute for runtime memory. No emulator repair is justified
yet. Next warranted diagnostic: retain that four-byte target, object0087:88a4,
its vtable pointer, selector/module ownership table and rejected selector at
the existing far-call failure. Distinguish relocation, pointer lifetime or
operand translation before changing code; do not relax CS validation or alter
the guest target.

## Validation and cleanup

All181 media hash/size checks and manifest assertions passed. Diagnostic
canonical/compat/named compilation passed, with canonical bytes matching the
loaded module. Four captures were reviewed. No shared emulator code or tests
changed; no emulator repair/full-build acceptance is claimed.

The caller unexpectedly returned143, observed by12:58:14; cause unknown,
normal terminal/cleanup receipts absent. This is separate from the captured
guest trap. The surviving owned browser was reconnected only for Browser.close,
which resolved12:58:46; its eventual exit code is unavailable. At13:02:15
caller/probe/Chrome PIDs were absent, port46261 refused, profile removed and
build/local-runtime locks free. See recovered-browser-close.json and
runtime-cleanup.json. No review rejection was received and no original rerun
occurred. The fixture symlink/manifest and runnable recipe are retained.
