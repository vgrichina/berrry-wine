# NFS III: native D3D choice and race, guarded owner blocker

Original NFS III now reaches its cockpit race through ordinary native renderer
selection. The local catalogue and setup registration exited normally; the
second setup displayed Software Renderer and Direct3D Device 1. Selecting the
latter raised the original unsupported-card warning. After personally reviewing
and acknowledging that warning, the chooser displayed Direct3D Device 1.
Native OK committed that choice and exited normally.

The unchanged native export was imported into registered
`nfs3_chosen_renderer`. Its application key contains `Thrash Driver=d3d`,
`Group=D3D`, `3D Device Description=Direct3D Device 1`, `D3D Device=0` and
`Hardware Acceleration=1`. The exact export SHA-256 is
`e532c367bf58953a0d629ae0f3e5df93b8239daab0f713c1d8945e2dd92f087d`.
No registry, guest configuration, clock or AI data was edited.

Evidence is `scratch/runs/20261113-closed-native-nfs-1535/`.
Personally reviewed chooser images are `chooser/options.png`,
`chooser/selected.png` (warning), and `chooser/after-warning.png`.
`game/startup.png` shows original Corvette loading; `game/settled.png` shows
the race introduction; `game/race-frame.png` shows cockpit, Rocky Pass road,
0 MPH, 0:02.62 elapsed, 8th of 8 and 1/1 laps. No game input was sent.
The production D3DIM software Worker was ready with zero fallbacks; the final
live observation reports 2,805 submissions, 357 flips and 40,695 replayed
commands. `glTriangles=0`; this is local software-D3D application evidence,
not WebGL context-loss validation, physical-GPU evidence or 27-app acceptance.
Published renderer change `8321c5172` was read alongside prepared route
`b8ac865a5`, guard `418099fe9`, and the NFS1000 capacity outcome.

The changed blocker is the actual game's guarded owner. At loading and after
race introduction, `guarded-bind` returned `guarded input owner is unavailable`.
Three live observations show `exports.get_main_hwnd() == 0`, despite a visible
640x480 top-level NFS3CLASS window HWND `0x18001`, live EIP, quit flag zero,
empty input queue and ready D3DIM Worker. The production guard resolves its
window using `renderer.windows[get_main_hwnd()]` and requires it visible, so
these observations explain its refusal. The cause of the zero main HWND was
not traced. No replacement window was guessed, guard weakened, guest state
patched or unguarded input substituted. Native Pause/Continue, two settled
Pause frames and reviewed >=1500ms held driving remain **UNPROVED**.
Next: trace and repair the main-window/guard ownership contract with focused
checks and a locked build, then repeat native Pause and finite driving.

## Distinct resource phase

Initial disk was below the strict 1,500,000,000-byte floor. Only newly canonical
closed workers 1240/1305/1400/1405/1410/1435/1445 were qualified. Fourteen raw
rollouts/events contained 20,330,626 bytes; local gzip siblings contain
9,066,295 bytes and reclaimed 11,272,192 allocated bytes before run evidence.
The resource announcement sample was 1,506,480,128 available bytes. At sealing,
run evidence occupied 2,572,288 allocated bytes, leaving 8,699,904 bytes net
reclaimed and 1,502,318,592 available bytes.
No previously encoded stream, DB, auth, media, save, source or ISO was cleaned.

The NEW plan and identity proofs establish canonical completion, wrapper exit0,
nonempty final, completion notification, independent root review and exclusion
from current/pending registry identities. Privileged producer/cmdline, FD and
maps scans found no openers/errors before encoding, before each unlink and
at final verification; stable regular single-link metadata was checked.
Only initial identity metadata was interpreted; payloads remained opaque.
Every file passed complete raw/encoded hashes, external gzip decoding, and
actual RAM restoration before and after unlink, checking mode, nanosecond
mtime, overwrite refusal and symlink refusal. A further independent complete
decode/RAM restoration checked all fourteen files and 56 proof hashes.
Durable recovery indexes and instructions preceded raw unlink.

Keep all original-path `.gz` siblings, this run's indexes and helpers.
Restore raw before any history/event consumer or resume:

```sh
python3 scratch/runs/20261113-closed-native-nfs-1535/restore.py ABSOLUTE_INDEX_JSON
```

## Runtime and source identity

All four phases held `/tmp/wine-heavy-runtime.lock`, found no actual heavy
children and reread all 446 frozen source/module/media path hashes before
launch. The 135 original-media pins include 133 media files, executable and
manifest; all match the prepared route. Each phase checked actual disk and
observed an independent absolute deadline/disk watchdog armed before launch.
Four reviewed chooser pointer DOWN intents used actual production guarded
consumption, with independently prearmed release subprocesses. Every release
and all eight native/watchdog parent waits returned0 with both EOFs; all PIDs
are absent, no watchdog fired, and game quit acknowledged normally.
The game guard's two refused read-only binds were not input attempts.

Git base `7e7f97cf88d6d1093c666b110361e1d80dc26d62`, relevant binary diff,
owned helper/note patches, module hash and media path hashes are retained;
there are no source/media archives. No production code changed, so no new
build or production-test claim is made. Box ID NONE, state NOT_CREATED,
expiry null, stop receipt N/A. No workers or new boxes were launched. The auxiliary board watcher is absent;
its actual parent wait is UNKNOWN because its short launcher already returned.
The global dashboard check reports historical external references, with no
errors or invalid records for this run.
