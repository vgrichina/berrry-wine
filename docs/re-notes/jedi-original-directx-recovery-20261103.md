# Jedi original recovery and launcher predicate — 2026-11-03

The bounded assignment finished with a current, causal launcher blocker. One
ordinary installed `Jedi.exe` session and Play click reached the original
DirectX 5.0 requirement dialog. `FindFirstFileA` for
`C:\WINDOWS\SYSTEM\DSOUND.VXD` returned `0xffffffff`; the original failure
branch selected the dialog. Engine launch and gameplay remain unqualified.
No production repair is justified by this missing-environment-file result.

The acquisition blocker changed. On the new task-owned boat, the accepted
Archive.org URL supplied exactly 21,195,858 bytes, SHA-256
`8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e`.
The actual download redirected to `dn721808.ca.archive.org`. Historical failed
requests and saved-box resume403 do not describe this new acquisition.

The preserved layout archive at revision `4f0844c013c46afd446428578d75f5ec8afca515`
matches SHA-256 `fea97ead7fe1b0f4f9bba0264d8073e5956857150dba2d97a2b1a4a62190f9cb`;
all 87 seals pass. All 105 source mappings resolve to 27 existing files whose
full size/SHA match the current shared checkout. The 82 payload mappings also
match. No historical source checkout or repository copy was needed.

The accepted `recover-layout.py` recovered all 39 distribution originals, and
its `--check` replay passed. Flat original filenames retain the inventory's
exact spelling. The accepted `restore.py` recovered all **361 observed mappings**:
96 faithful-capture, 132 installed VFS, and 133 post-launch VFS. A separate
rehash of every restored mapping passes, including all **28 installed originals,
39,900,850 bytes**. The retained installer registry export is unchanged.
Historical ordinary licence acceptance/installation remains accepted; no
installer was replayed.

Static inspection uses original installed `Jedi.exe`, 305,664 bytes, SHA-256
`ab3c7c41153284aa9632fae871296ce266d2323defb5a20c987356d082ede1a1`,
preferred image base `0x400000`. The Play handler at `0x402840` calls predicate
`0x402dd0` at `0x4028aa`. A nonzero return opens the original requirement dialog;
zero follows the `JE` at `0x4028b1` to `0x402905` and continues the launch route.

The NULL-terminated pointer table at `0x423540` has four names, in order:
`DDRAW.DLL`, `DSOUND.DLL`, `DSOUND.VXD`, `DDHELP.EXE`. The predicate obtains the
system directory with `GetSystemDirectoryA`, then calls `FindFirstFileA` for each
required name. `INVALID_HANDLE_VALUE` at `0x402eb1` takes `JE 0x402f1a`, which
sets the failure flag to 1. An optional second lookup and `CompareFileTime`
can also set failure on a negative result (`0x402f04`–`0x402f08`). The loop stops
after the first failure. Static PE parsing independently verifies the actual
import slots: `0x42a7c4` GetSystemDirectoryA, `0x42a7dc` FindFirstFileA, and
`0x42a7d8` CompareFileTime. The executable imports no VERSION APIs; this routine
does not query a DirectX version number or registry version.

The current trace confirms the first two required DLL lookups succeeded with
1024-byte files. Their optional `CompareFileTime` calls both returned +1,
which did not select the negative-result failure branch. The third lookup,
`C:\WINDOWS\SYSTEM\DSOUND.VXD`, failed at API #1123. At batch 898199,
`EIP=0x402eb1`, `EAX=0xffffffff`; batch 898201 reached `0x402f1a` and then
`[ebp-0x10]=1`. At batch 898233, Play received `EAX=1` at `0x4028af`, then
entered `0x4028b3` rather than `0x402905`. The fourth required name,
`DDHELP.EXE`, was never queried because the loop stopped at the first failure.
Expected: a valid find handle for each required system file, then predicate
return 0. Actual: missing third file, predicate return 1, original requirement
dialog. This establishes a missing environment prerequisite, not an incorrect
DirectX version API or a proven `FindFirstFileA` defect.

The inspected launcher PNG shows the original Play button. Ordinary
`click:320:284` at batch 896711 selected it once. The immediately requested
post-click PNG was caught before its controls painted; the inspected final PNG
shows the complete original DirectX 5.0 message and Cancel button. There was
no `JkDemo.exe` handoff. Controller quit ended the harness with exit 0 after
19.62 seconds; this is not a normal guest exit claim. Registry export retains
76 entries, and the overlay flushed zero records.

All 4,129 releasing GL source inputs were rehashed against the shared checkout
immediately before runtime and matched. The tested canonical module is
2,079,536 bytes, SHA-256
`24880b0ebdf170b2443d977074bc80f12b3959647dee69114cb09965a70c4741`,
from the locked build at `bd1a15a25bf2b053e473214e94cfad46dac1e130`.
Actual compile and instantiate receipts match that module. No rebuild occurred.
The tested checkout was `debc24bfc46a9d1882b29be1b6e563816ac79498`;
subsequent concurrent changes were notes only. Runtime was Node v24.22.1,
headless CLI renderer, 640×480.

A first harness startup compiled/instantiated the same module but exited before
the guest loop because the prepared closure omitted `tools/disasm.js`. Its log
and receipts are preserved under `session/pre-guest-failure`. Adding the current
`tools/disasm.js` and `tools/simd-ops.js` corrected only the staged harness;
no guest had executed or received input before the one actual session.
The module was unchanged. Both added helper hashes were verified remotely.

Next bounded work: establish a genuine, supported DirectX system-file
provisioning route for the required `DSOUND.VXD` and `DDHELP.EXE`, with original
provenance and any necessary implementation evidence, before another ordinary
launcher test. Do not add fabricated marker files or change the original
predicate. Neither driver implementation nor a broad emulator repair follows
from this trace alone. No driver, version, registry value, launcher bypass,
direct engine or direct-level route was fabricated or used.

Evidence and replay recipes: `scratch/runs/20261103-jedi-original-directx-recovery/`.
All 38 remote evidence members were retrieved with full size/SHA matches before
shutdown; the archive SHA-256 is
`c4fbc3e2d402a878d89c00aff8989549ee829e335935beeafcdb7b36d3703035`.
The delegated boat `bx_bkn8mbm5` was stopped at
`2026-11-03T03:32:55.577Z`, before its unchanged original expiry
`2026-11-03T03:35:00.488Z`; API state `archived`, stop operation completed,
error null. Scoped guest/controller/supervisor processes and ports 8143/8144
were absent before shutdown. No boat was resumed or replaced.
