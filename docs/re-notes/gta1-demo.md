# Grand Theft Auto: original 24-bit DOS demo

## Checkpoint implementation first focused-test failure, 2026-11-01

Source implementation was started after Constructor's explicit release, on
main after `c515da25d`. The uncommitted WIP is in `tools/toyvm/run-dos.js`
and `test/test-toyvm-runner-input.js`; the four Constructor GC source/test/
generated-bundle WIP files were not edited or staged. No code is published
by this attempt. Evidence: `scratch/runs/20261101-gta1-checkpoint-implementation/`.

The proposed generic API is `runDos({ ..., checkpoint: { at, png, pause } })`.
At the first live handback at or beyond `at`, it writes a capture and awaits
`pause(snapshot, AbortSignal)`. A key string queues ordinary `pushKey` taps
once; null stops; continuation retains the same session and original bounds.
The proposed CLI is `--checkpoint=DISPATCHES --checkpoint-png=PATH` with
stdin key-string/EOF control, or `--checkpoint-keys=KEYS`. A checkpoint
requires a finite dispatch budget and positive finite `seconds`.
These interfaces remain **unfinished and unqualified**.

The first focused native synthetic COM test failed at line 47: the tapped run
retired **20,002** dispatches and the no-input control **20,003**, against the
test's exact-equality assertion. Earlier assertions passed: the callback ran
once after its requested threshold, a PNG existed before input, guest memory
recorded exactly one Enter (count 1, ASCII 13), the BIOS key queue was consumed,
and the hardware queue contained one make/break pair `1C 9C`. A PNG signature
check does not establish that the image depicts the correct surface.
The changed keyboard branch can end at a different instruction boundary;
the bound test needs an explicit permissible final-block overshoot rather
than assuming different guest paths retire identical counts.

Static review also identifies a capture bug requiring repair: `screenSurface`
returns an object with `.text` and `.geom`, but this WIP compares the object
to the string `'text'` and recomputes geometry. Use the shared surface result
for both console and graphics capture before relying on screenshots.
The remaining default-equivalence, explicit-stop and pause-deadline tests did
not run. CLI/EOF, capture content, terminal-before-checkpoint and error paths
still need validation. No unchanged retry was attempted under the assignment's
first-failure rule. Mandatory locked build was not run; free space reached
2.161 GB after the failed test, but that does not override the latched stop.

There were zero original GTA1 launches, no fresh archive/executable pin check,
no actual original module or paired input images, and no new language/menu/
gameplay result. The exact 117-file archive and executable pins below remain
prerequisites for a future original run. No browser, boat, download, registry,
deployment or alternate executable was used. Box ID/state/expiry are N/A.
The independent 2 GB disk monitor stayed above its floor; actual helper waits
and WIP recovery pins are retained in the run directory. Next: repair the
identified WIP issues, complete meaningful focused tests, pass the mandatory
locked build with admitted headroom, then publish code before any authorized
single original investigation. All paths and serialized ownership are released
after this note is published.

## Checkpoint-input repair second resource boundary, 2026-11-01

The fresh assignment after `741117e0a117a752038b82c2488dcf1194232022`
passed its entry disk check at **2,046,525,440 bytes available**, but its
independent guard subsequently measured **1,990,922,240 bytes**, below the
unchanged **2,000,000,000-byte** floor, during static read-only preparation.
The guard latched a stop and the task stopped without an unchanged retry.
Constructor still owned serialized source/build/runtime; its release had not
arrived. No runner/shared-source edits, test, build, fixture verification or
original GTA run started. Checkpoint input remains unimplemented, and there
is no new language-selection or player-control evidence.

Evidence is retained in
`scratch/runs/20261101-gta1-checkpoint-input-repair-run2/`: `disk.jsonl`,
`STOP`, `guard.py`, `guard-cleanup.json` and `verification.json`.
The guard actively terminates registered task-driver process groups with
TERM followed by KILL on a breach, rather than merely exiting. No registered
driver or game children existed at this boundary, so that termination path
was not exercised. Its board watcher was terminated and actually waited
with status -15; the guard's actual tool wait was 0, and both PIDs were
directly verified absent. Box ID/state/expiry and actual module identity
are N/A. No foreign deletion, RAM gate or floor reduction occurred.

Only this blocker note is published. A future assignment needs sustained
headroom above its required floor and Constructor's exact release before
implementing and testing the supported native checkpoint API, building, and
attempting the single bounded default original run. No code commit or
gameplay/full-corpus acceptance is claimed here.

## Checkpoint-input repair entry prerequisite, 2026-11-01

The checkpoint-input implementation assignment following
`19ce5388af57045694e051b0cd2f723213f5531e` stopped at its first resource
prerequisite. Initial `df -B1 /home` reported **1,985,933,312 bytes available**,
below the assignment's unchanged **2,000,000,000-byte** floor. The task explicitly
requires stopping at a failed prerequisite without an unchanged retry. No
source edits, test process, build, fixture verification or original GTA run
started. The native runner still lacks the supported checkpoint input path
described below; language selection and player control remain unverified.

Evidence is in `scratch/runs/20261101-gta1-checkpoint-input-repair/`:
`df-initial.txt` and `prerequisite.json` retain the measurement and stop boundary.
Only this blocker note changed. No game/driver children existed to abort, and
no background disk guard was started after the failed synchronous entry check.
No foreign files were deleted, no floor was lowered, and no RAM gate was used.
Box ID/state/expiry and actual module identity are N/A because nothing ran.
The next assignment needs disk headroom above the same floor before beginning
the runner implementation, focused tests, mandatory build and eventual single
bounded original run. There is no new screenshot or gameplay evidence.

## Language-selection input boundary, 2026-11-01

The follow-up to `124d0bda1745b544faeafbb6f23f087fac23d6ae` stops at
the ordinary native runner's missing **post-menu keyboard staging** primitive.
No original was launched in this follow-up. The retained 640x480 screenshot
was visually inspected again: the pointer selects the English flag on
**Choose Your Language**. English selection, input response and gameplay
remain unverified. There is no after-input screenshot because no input was sent.

Inspection of the unchanged `tools/toyvm/run-dos.js` establishes the boundary:

- `keys`/`autoKeys` options are declared near line 326 and CLI parsing is near
  lines 1399–1400. `Machine` copies `keys` and queues make/break scancodes in its
  constructor (`tools/toyvm/dos.js`, lines 863 and 903). Thus `--keys=enter`
  supplies a key before startup, with no after-menu timing guarantee.
- The execution loop near line 827 supports scheduled mouse clicks and memory
  dumps, but exposes no keyboard schedule, stdin control channel, pause/resume
  control or caller-provided slice callback. Its `beforeSlice`/`afterSlice`
  hooks near lines 671–675 are internal instrumentation. `runDos()` returns
  the machine after the run, so that return value cannot stage a key during it.
- `--auto-keys=enter` enables repeating automatic input. Its graphics reader
  (`dos.js:1995`) samples every 4096 polls and answers after matching sampled
  screen hashes. It is neither a one-shot command nor confirmation that this
  particular menu is visible. Scheduled clicks do not establish keyboard
  navigation support for GTA's language menu.

The keyboard device already has `Machine.pushKey(scan, ascii)`,
`keyDown()` and `keyUp()` (`dos.js:2484` onward). The precise next dependency
is a supported native runner control path that invokes these between slices
after a reviewed menu checkpoint, captures the resulting frame, and permits
bounded continuation of that same session. For this menu the first intended
ordinary action would be Enter on the selected English flag. No source change,
prototype interception, alternate executable or automatic key rotation was
used to work around this boundary. A separately authorized runner improvement
or supported interactive environment is needed before the next original run.

Evidence: `scratch/runs/20261101-gta1-language-selection/` retains
`verification.json`, `identity-before.json`, `actual-files.json`,
`runner-input-inspection.json`, `before-retained.png`, `baseline-startup.log`,
`baseline-actual-module.json`, accepted test evidence and lifecycle records.
The copied image/log/module record are explicitly from the previous startup,
not a new execution. All **117 files / 17,078,619 bytes**, exact file-set closure
and the retained archive SHA-256 match the current manifests. All 230 previous
source/support/manifest pins match; current registry and candidate manifest
identities are also pinned. Fresh evaluation of actual `DESKTOP_APPS` finds
46 entries and no GTA; no candidate-corpus GTA1 entry is present (GTA2 is a
different candidate). This remains
an unqualified local original, with no redistribution grant or publication.

The retained actual module remains
`03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`;
no module was compiled or executed here. The 95 accepted ToyVM regression
source/test/support pins still match, so their existing VBE/DAC/retrace/bundle
results are reused without rerunning tests or the build. The previous seven
aggregate decoder give-up sites remain limitations: their ordering, execution
significance and causal relationship to menu progress are unknown. They do
not establish a crash or explain the language checkpoint.

Runtime/source/build access was serialized and read-only, GTA first while
Constructor remained static. An independent guard kept the unchanged
2,000,000,000-byte `/home` floor, without a RAM gate or foreign deletion.
Only own guard/watcher helpers required shutdown; actual waits and direct
absence are recorded separately from guest exit (N/A: zero originals).
Box ID/state/expiry are N/A. No new before/after runtime comparison, gameplay,
FPS or audio claim is made. All ownership is released after publication.

## Exact recovery and first default startup, 2026-11-01

The original default `GTADOS/K.EXE` route reaches a visible **Choose Your
Language** screen on ToyVM. This is a language menu, not gameplay or accepted
player control. No keys or mouse inputs were supplied and no second original
was launched. The next bounded task is ordinary language selection, followed
by inspection of the resulting screen before choosing further supported input.

Input handoff: `bd27914459f3501ee823b8122af23b1d9cd90129`,
[local DOS action dependency note](local-dos-action-replacement-nov01.md).
This was the sole selected distinct title. Fresh inspection of the actual
`DESKTOP_APPS` array still finds no GTA entry. No registry changes were made.

Evidence and recovery helpers are retained in
`scratch/runs/20261101-gta1-original-recovery-startup/` (ignored).
`recovery.json`, `actual-files.json`, `identity-before.json`,
`actual-module.json`, `command.json`, `startup.log`, `startup.png`,
`lifecycle.json` and `verification.json` preserve the actual identities,
execution and cleanup. The image was visually inspected: four language flags,
the English pointer, BMG/DMA logos and yellow language-selection text render
at 640x480. No intro, driving, walking, input response, FPS or audio is claimed.

### Original payload and recovery recipe

The sole HTTPS download was the exact URL in
`test/dos-game-corpus/manifest.json`:

```text
https://archive.org/download/gta-1997/Files/Demo%20-%20Liberty%20City%20-%2024%20Bit%20-%20High%20Res%20Version/gta24.zip
```

Retain only the ignored local fixture; this demo has no recorded redistribution
grant. `test/binaries/dos-games/gta24.zip` is exactly **9,531,378 bytes**,
SHA-256 `76f1e1da5c898f755597b86357c4d77b7447cb483673a23d10d34f40cfe03ec9`.
There is one archive copy. Curl used normal certificate verification,
HTTPS-only redirects, a size cap and finite connect/overall timeouts; its
actual OS wait was 0. No broad search or compilation container was used.

Extract that archive into `test/binaries/dos-games/gta1-demo/`, preserving its
`GTA24/` directory. Before any startup, verify every size/SHA-256 against
`test/toyvm-dos-corpus/files/gta1-demo.json` and require exact file-set closure:
**117/117 files, 17,078,619 bytes**, all matched before this run and afterward.
`recover.py` records the complete guarded acquisition/verification recipe and
refuses an existing destination; do not overwrite or redownload retained files.

Important executable identities:

- `GTADOS/K.EXE`: `8fd02d556e06f3258a6ca516ccf675e7aafbf313bd3c575e12dd0f8e5c67d48f`.
- `GTADOS/DEMO24.EXE`: `2f1cedfb95254b2f1a8913f1aeac7a915966cb42c70c9c96b14b8861fbf78c9f`.

The catalog's default entry follows original `GTA.BAT`: `cd gtados`, `k.exe`,
`call dino.bat` (the last batch is empty). The existing native runner mounts
the executable's parent directory. It was invoked directly on **K.EXE** with
empty arguments/environment additions; DEMO24.EXE was never substituted.

### Actual startup and limits

`command.json` retains the exact command: ordinary
`tools/toyvm/run-dos.js`, default tailcall hardware/options,
`--dispatches=200000000 --seconds=60 --trace-fault --trace-entry=16
--report --text --png=.../startup.png`, plus a scratch-only identity observer.
An independent supervisor enforced a 90-second OS deadline and a 1.9 MB output
cap. The actual run finished in **2.7707 seconds**, with **3,829 log bytes**.

The process OS wait was **0**, while guest `exited=false`: there is no guest
exit code. The actual stop was **budget spent**, at `CS:IP=0080:0070`, after
200 million dispatches, 56,211 handbacks and 19.97 reported guest seconds.
The video report names VBE mode 101h, 640x480; that observation does not
qualify VBE 2.0 or subsequent gameplay. No terminal guest failure message was
visible. The ordinary runner also reports seven decoder give-up sites,
including `0080:85F1`, bytes `0F 21 F3 ...`, base `0x148370`, counted 17 times.
These aggregate diagnostics do not establish first-occurrence order or a cause
of the menu checkpoint; unsupported decoding remains a concrete limitation to
inspect before trusting later progress. No failure was retried or alternate
executable/hardware configuration attempted.

The scratch identity observer checks actual source pins, hashes the ordinary
compiler's returned bytes before guest execution and returns them unchanged.
Actual module SHA-256:
`03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`,
343,736 bytes. WAT SHA-256:
`29bdf4e754aa46d8e2f083b5bbb8e9fb9c9f2725c4b2503a25b11786234dfbc0`.
This is the existing ToyVM module generated in memory by its ordinary runner,
not `build/wine-assembly.wasm`. Loaded JS identities and source checkpoint are
recorded; all pinned source/support/manifest files stayed unchanged. No source,
test or build changes or project build were needed for this note-only task.

### Ownership and lifecycle

The coordinator's 21:40:26 UTC board entry verified both prior DOS-pool author
releases, launcher terminal0 and direct helper absence. GTA claimed serialized
runtime/source/build first; Constructor remained static during execution.
Independent disk guards sampled `/home` against the unchanged 2,000,000,000-byte
floor, with no RAM gate, guard reduction or foreign-artifact deletion. Recovery
reserved archive, full extraction and evidence margin before downloading.

Own download/game/guard/watcher processes were actually waited and directly
verified absent; process waits remain distinct from the unexited guest.
The fixture was not modified by guest overlay writes. Box ID/state/expiry are
N/A, with no browser, boat, EULA or deployment work. All assigned paths and
runtime ownership are released after publication. No further original is
authorized by this completed single-startup assignment.
