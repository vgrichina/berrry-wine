# Grand Theft Auto: original 24-bit DOS demo

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
