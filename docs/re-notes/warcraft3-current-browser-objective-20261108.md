# Warcraft III current-browser objective attempt, 8 November 2026

The attempt ended at a **driver readiness/ownership blocker before player
input**. No current Prologue world, Thrall selection, displacement, tutorial,
objective or combat consequence was reviewed. WebGL was **not executed** after
the software arm's first unsuccessful command. October 8 movement evidence
remains historical and is not promoted to current-build coverage.

Evidence: `scratch/runs/20261108-warcraft3-current-browser-objective/`.
The single-task worker used the shared checkout on `main`, with no nested
workers, emulator changes, reinstall, public deployment, old-box resume or
delete. The only committed path is this note.

## Executed identity and original media

Staged Git reference: `bc4cd7a8cc9f32bda0bca33808fc2f50fd98a2e7`.
`source-sha.txt`, `runtime-pins.json`, `relevant-source.patch` and
`untracked-source-patches.patch` retain exact source references and relevant
uncommitted source hunks. `owned-helper-patches.patch` records the run-specific
scripts. No source-tree archive or media archive was created in evidence.

The actual live guest CPU and render Worker bytecode both hash to
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
`retrieved/software/startup-binding.json` retains the separate owning targets,
instance/context identities and independently recovered module hashes before
and after the screenshot. The existing module was executed; no new build,
interpreter repair or native-code claim follows.

All twelve existing registered files under
`test/binaries/candidates/warcraft3-demo/` were hashed before staging and
verified after transfer and drain. The EXE, Game.dll, Storm.dll and MPQ match
all four extracted-file SHA-256 values recorded in
[the Warcraft notes](warcraft3-demo.md#original-prologue-browser-preparation-october-8).
The candidate manifest records installer provenance, size 104,680,620 and SHA
`3a1b83900c33f0ba671941905d36b9442ab05654c9d5f8d464cbdf9db14f2c6f`.
The original installer was not downloaded or re-extracted. The October run
bundles are absent locally; independent historical hashes for the other eight
extracted files were unavailable. Their current sizes/hashes and registered
paths are explicit in `media-preflight.json`; full historical twelve-hash
verification is not claimed. Originals were not modified or copied into the
run directory. Remote launch paths held the necessary original game files;
temporary transfer chunks were verified, assembled and removed.

## Observed sequence and blocker

Chrome `151.0.7922.108`, native viewport 945×889, production registered app
`warcraft3_demo`, guest Workers, ordinary `-opengl -window` arguments. The
actual URL has both `gl-renderer=software` and `d3d-renderer=software`.
The existing strict numbered-ACK/native-CDP driver was reused. Software used
the previously exercised owner-binding helper from the November 8 Q3 world
run; the newer in-progress GL-producer helper was not enabled or qualified in
this original-media execution.

At 03:24:33, the startup capture is visibly black except for the host cursor
and full-page toolbar. This image was personally reviewed and is not a menu
or gameplay capture. The driver had already bound render endpoint 1:
`api: gl`, `backend: software`, context handle 2, `software: true`,
`FixedFunctionGL`, no observed WebGL context. The context presentation
`writeSeq` is **zero**. Thus its existing two stable owner reads admitted
readiness before actual software presentation and transport attachment.

The sole queued command, `s-menu-wait`, requested an eight-second passive
capture. No keyboard, click, movement, profile text or other guest input was
queued. At 03:24:55.756, the exact owner check failed:

```text
AssertionError: identity changed: renderEndpoint
2 !== 1
```

`retrieved/software/menu-wait-state.json` was written before the screenshot
binding failed. It records the same running registered app/process and guest
endpoint, with GL endpoint 1 still open and newly available **legacy software
transport endpoint 2**. Host `d3dStats.renderEndpointId` is now 2, ready is true,
`glTriangles` is 172,189, fallbacks are zero and the actual software GL context
has `writeSeq: 27`. Software-front batch observations increase from 119 to
95,311. These are read-only activity/backend witnesses, not visual gameplay
or FPS evidence. The second PNG and successful ACK do not exist.

The helper chooses the sole render port before `d3dStats` exists, then chooses
`d3dStats.renderEndpointId` once software transport appears. Its binding spans
that transition. The observed assertion identifies a premature driver binding;
it does not establish an emulator renderer failure or guest crash. There is
no failing-before/passing-after repair claim. Exact owner checks were kept.
The first fault closed the driver and transport, no command was replayed,
and the subsequent WebGL arm was not launched. No Escape was sent.

## Validation and shutdown

`validation.json` checks all 624 staged pins and 400 completed HTTP response
hashes, including ranges and original media. The three retained 404s are
`build-info.js`, `favicon.ico` and the optional font bundle; no registered
Warcraft media miss was recorded. The startup PNG passes CRC/IDAT validation.
New bounded right-button/five-second click support and name-key independent
releases were locally tested with delayed DOWN replies and exact-once UP;
`new-controls-test.log` passes. These controls were never exercised on the
original game, so original-game right-click/typing qualification is absent.
Previously passing production input/capture controls were not retested as a
new emulator qualification. No code was committed and no build was required.

Fresh UUID-idempotent no-environment box **bx_uswepjdq** was created at
03:24:05.648 with initial expiry **03:49:05.662 UTC**. Independent detached
watchdog/normal-stop delegates were observably armed with an immutable
25-minute deadline before runtime. One browser ran on the new box.

Chrome exited 0 at 03:24:56.257. The independent drain check confirms driver
PID 5859 and Chrome PID 5871 absent, HTTP port 43537 and CDP port 45809 closed,
profile and writer lock absent, and all pins unchanged. The one command was a
capture with no successful ACK; guest input count is zero. The failed attempt
and failed missing-PNG retrieval are retained without retry.

All **42 remote evidence references / 40 unique hashes** were recovered and
independently reread for size/SHA-256 at 03:25:46.553, before requesting normal
stop. Box state is **archived**, current expiry **null**, stopped at
**03:25:48.835 UTC**. Stop receipt **stop_eff5c6429847ee5d** is completed at
03:25:48.857 with `forced: false`. Both lifecycle delegates exited 0 and the
supervisor has no remaining children. `/home` samples stayed above 5 GB;
there was no RAM gate. `RECOVERY.md` identifies the retained evidence.

The next useful change is to establish initial ownership only after actual
software presentation and legacy transport attachment, while retaining exact
CPU/module/context checks after binding. WebGL needs its own actual GL
producer predicate rather than software-only triangle readiness. Such driver
qualification and a fresh original run remain unexecuted here. Full 27-game
membership, visual parity, FPS, audio and campaign completion remain separate.
