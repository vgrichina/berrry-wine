# Original Hock gameplay qualification — 2026-10-21

**Bounded gameplay/input qualified.** On the same running `bx_3f3x23m3`,
holding the left mouse button on the left character selected it and opened the
school-street playfield. Mouse movement subsequently moved the character from
left to center to right. Two held-button shot attempts were delivered, with
airborne objects visible afterward; traffic and other targets continued moving.
The successful run lasted 45.006 runner seconds, with gameplay visible from the
6-second capture through exit (about 39 seconds). It exited 0 without a trap.
This does not qualify a successful hit, scoring or level completion: every
inspected gameplay capture shows **SCORE: 0/20**.

## Identity

- Integrated main: `1d8dbd7a44656178d01869f28869be624a59fa39`.
- Inherited candidate: `5d5e48d0d97be71f8f7c0dcc1596f5bea770d59d`, canonical
  build originally `cmd_uydlnnqxmerz`. This is **not a fresh main compilation**.
- All 7,133 sealed source/test files were compared with integrated Git objects
  and freshly rehashed remotely. The original 39 game files (44 entries including
  intake provenance) and both canonical/compat modules passed seal verification.
- Canonical WASM SHA256:
  `eafeaa142c98fe60c489865c89a676c20afffe51002fe36799f42aa46d19ac2c`.
- Compat WASM SHA256:
  `f5ade4a49be77b9976fb3542d9a9d39ca1ffe9614346affddd8098d70e1c3ca9`.
- Original BBLOOGIE.EXE SHA256:
  `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.
- Source manifest SHA256:
  `645ef229b0a58c52131c78d49b50fb038110af0f980492a099103f5100b3c346`.
- Package manifest SHA256:
  `cc5b9f2e5092d14cca239ba2a3072571a2a97f14ddc9d365f332cc85a3bca0ae`.

## Runtime evidence

Node v24.18.1, CLI full VM, JS raster canvas, default cooperative thread route,
640×480 capture. Successful run uses `--real-ticks --control-stdin` and the
explicit canonical `--wasm` path. The unmodified runner routes mouse actions
through renderer handlers; logs show WM_MOUSEMOVE/WM_LBUTTONDOWN/WM_LBUTTONUP
dispatch to guest HWND `0x10001`. No game state, assets or production sources
were edited. No source acceptance review was repeated.

| Run / Boat command | Input and result |
|---|---|
| `selection` / `cmd_veaqdq760c99` | 15 seconds, default 200ms/batch clock. Instant click at batch 250 reaches guest; pose changes but title remains. Exit 0. |
| `sustained` / `cmd_kzeluzwwiwms` | 45 seconds, wall clock, instantaneous selection click then Enter/Space/Right and a center hold. Remains title screen. Exit 0; keyboard delivery does not prove supported controls. |
| `held` / `cmd_fpbyflk4kcw4` | 04:29:18.558–04:30:03.923 UTC. Left-character hold at 5–7s selects successfully. Center hold 13–15s and right hold 21–23s attempt shots. 22,777 batches / 27,391,908 API calls; exit 0. |

The original executable's loop polls GetAsyncKeyState for mouse buttons;
the held-button route resolves the initial instantaneous-click ambiguity.
The pose-only response on the earlier route is not represented as selection.
This task does not diagnose or repair short-click handling.

Successful captures in the evidence archive's `remote-evidence/`:
`held-before.png` (3s), `held-down.png` (6s), `held-selected.png` (10s),
`held-action.png` (18s), `held-30s.png`, `held-40s.png`, `held-final.png`.
All gameplay images were visually inspected. Exact argv, UTC/relative input
timings, acknowledgments, batch numbers and complete logs are in
`held-command.json`, `held-timings.json`, `held.log`, and the driver.

## Limits and recovery

Right-edge clipping persists, including part of the timer and characters;
full rendering completeness is not accepted. Mouse movement and sustained
gameplay are observed; hit/score progression and complete-game playability
remain unverified. No browser/Windows parity claim is made.

The held run produced 21,571 audio buffers / 11,044,352 PCM bytes according to
the runner. Capture was capped at 2,097,152 bytes, 22,050 Hz mono unsigned 8-bit:
95.109 seconds of sample data from a 45-second wall run. Its RMS around 128 is
21.698, with 2,044,834 non-midpoint samples. This proves non-silent PCM output,
not correct audible music, effects, pitch or synchronization. The duration
mismatch remains a limitation, not an audio pass. WAVs and analyses are retained.
FPS is unknown: the reported 506 batches/s is not a frame-rate measurement.

Local run: `scratch/runs/20261021-hock-original-gameplay`.
Committed evidence: [hock-original-gameplay-20261021-evidence.tgz](hock-original-gameplay-20261021-evidence.tgz).
`validation.json` checks source mapping, archive seals, exits and input logs;
`RECOVERY.md` gives the exact replay recipe and remote retained paths.
The archive excludes game assets, dependencies and binaries, which remain on
the remote host with the earlier recovery recipes. Same box left running,
health OK, TTL `2026-10-21T05:56:19.894Z`; coordinator owns shutdown.
No lifecycle actions, workers, main merge or deployment were performed.
