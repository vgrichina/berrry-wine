# Original The Incredible Machine installer: first screen and one key

The original INSTALL.COM reached its **Smart Start installer menu** through
the canonical `tools/toyvm/run-dos.js` initial-floppy path on 2026-11-14.
Both actual screenshots were viewed. One fresh-frame-reviewed Down-arrow
press moved the highlight from **1. Change Graphics** to **2. Change
Sounds/Music**. Execution continued after owned key/mouse release to the next
blocking BIOS keyboard read. This proves the first installer screen and that
single menu-navigation consequence; it is not a puzzle or gameplay result.

Evidence: `scratch/runs/20261114-tim-first-frame/result.json`, with only
`first-installer-screen.png` and `post-up-installer-screen.png` retained.
Read with the original DOS launch, startup-probe and install-copy-config notes
dated 2026-11-13, and the controlled-session1120 report at
`scratch/runs/20261113-tim-session-prep-1120/report.md`.

## Actual route and identity

The borrowed `/dev/shm/wine-owner187-tim-disk.img` was read-only and hashed
before and after execution:
`d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657`.
Its original 30,830-byte INSTALL.COM, parsed in memory with the current FAT12
reader, was independently checked as
`a2a609fa8aab61e950c00e3b59f98edf03a26ff183665eb813a3a60b94cfa531`.
The runner loaded `A:/INSTALL.COM` itself; no host-extracted COM, alternate
loader, unpacked executable, memory patch, configuration or menu-answer chain
was supplied. A: remained a detached read-only FAT12 volume; C: was an empty
private `Map` overlay without a host fileRoot. At settlement the current drive
was A:, cwd its root, and the writable overlay was still empty.

The run used Node v24.18.1, ToyVM tailcall defaults with CPU386, no automatic
keys, a 2-billion-dispatch budget, 10,000-dispatch slices and a 75-second runner
limit. Persistent controls had one fixed 110-second absolute deadline armed
before guest construction. Review was deferred until the first keyboard wait
(the dispatch threshold was 1.9 billion). Exactly one action was delivered.
The second fresh review stopped the session without another input.

The actual dynamically compiled ToyVM module was 346,059 bytes, SHA-256
`239f6584b458eb0b9c5f2916bd63b29681d2a446d1b821ea45a1cace6b823060`;
generated WAT SHA-256 was
`efc00c876b8482006b03df72c24e3ea4056adc55ef47e1702737f7420bcf3c61`.
These identify the module actually instantiated, not `build/wine-assembly.wasm`.
No module dump was retained. Source recovery is Git
`7e45f17ab5cc17351cc76402880342b9eb6e09a1` plus `relevant-wip.patch` and
`new-sources.patch`; `source-pins.json` and `validation.json` check exact source
bytes before/after the run. Concurrent unrelated main commits are recorded in
the final result; none changes the pinned ToyVM inputs.

## Observed screen and input

Both 640×300 captures show mode-3 text rendered by the existing framebuffer
and tracked Terminal.fon. The five menu actions are Change Graphics, Change
Sounds/Music, Copy The Incredible Machine to hard drive, Make a backup copy,
and Play The Incredible Machine. Current Selections shows **VGA 16 Colors**
and **Sound Blaster**. This records the emulator's ordinary detection result,
not verified audio output or installed hardware configuration.

`review.json` binds the actual first image, program/target/frame identities,
digest and execution progress 5,796,229. After viewing it, `command.json`
authorized only `ArrowDown`. The controller armed release before DOWN,
executed one actual step, released keys and mouse, and executed another step
before the fresh `consequence.json` observation at progress 5,796,231. That
immediate observation still had the original pixels. Continued input-free
execution reached progress 5,796,397 and the next keyboard wait; the second
review's actual screenshot shows the highlight on item 2. The two observations
are distinguished rather than claiming the immediate handback had redrawn.

`runtime.json` reports STOPPED, one delivered action, two consumed reviews,
`held:false`, `blockedOnKey:true`, `exited:false`, no unimplemented services,
no stuck address/protected-transfer stop/bad selector, and no time expiration.
Final guest CS:IP is 0110:433A, after the blocking keyboard interrupt in the
original installer. The run retired 20,381,162 dispatches. No runtime error was
reported. Existing FCB, disk-reset, loader, EXEC flags, CD and other DOS WIP was
used as present and preserved; no production source was changed or qualified
for publication by this observation alone.

## Lifecycle, validation and boundary

`supervise.py` held `/tmp/wine-heavy-runtime.lock` for the entire guest process.
Its independent 120-second monotonic deadline owned termination of the new
process group. The canonical controller additionally forked its immutable
deadline watchdog, required balanced release before disarming, and awaited
that watchdog's exit. The external supervisor used Linux subreaper ownership,
actually waited for child PID **3142514**, drained **both stdout and stderr to
EOF**, and found no remaining adopted children. Supervisor PID **3142262** and
the guest owner were absent after settlement. Both watchdog paths completed
without deadline killing. The internal controller watchdog PID was not
separately saved; its awaited closure and the supervisor's empty child set are
the cleanup evidence. Box ID NONE, state NOT_CREATED, expiry null, stop receipt
N/A; no remote box or public service was created.

Validation checked media/source preservation, exactly one action with held
input false, fresh progress after release, changed settled screenshot bytes,
owned-PID absence, and all retained evidence references. Only the two named
screenshots remain. No frame series, capture archive, binary/module dump or
source archive was created. Disk remained about 15 GB free. This is a docs-only
change, so no full build or production-code commit was needed.

The next boundary is an actual reviewed installer choice, ordinary copy to C:,
installer-generated RESOURCE.CFG and installed-output hashes, followed by the
original packed TIM.EXE and a real puzzle frame. None was attempted here.
No manual/password answers, solver writes or gameplay claims are supplied.
