# Jardinains! v1.2

Jardinains! 1.2 is a Win32 Blitz/DirectDraw Breakout-style shareware game.
The original author still links the Windows 1.2 installer from the Jardinains
2 downloads page. Wine-Assembly runs that unchanged installer and launches the
files it writes; no host-side archive extraction is part of the workflow.

## Original package

- Downloads page: <https://jardinains2.com/otherDownloads.html>
- Original 1.2 installer: <https://jardinains2.com/download.php?download=1>
- Size: `4,647,761` bytes
- SHA-1: `805d7639f3ffbc0e771800c580c4799546d86bd7`
- SHA-256: `78c37d94d9bcf927343b56201ac6cdefed5b3233819c935650ce24260c49268c`
- Installed `jardinains.exe` SHA-256:
  `f1a8ba7040b190da398ced766940b6a853d747cb2dbbd6c46690a41a8368f117`

The installed manual describes the game as fully functional shareware and
free to play indefinitely. Its copyright notice separately prohibits
redistribution or reproduction without the author's written consent. The
installer and its output therefore remain local and gitignored. The Sources
page links to the original distribution instead of republishing either one.

## Installer result

The native installer writes 115 files, including 30 original levels, under
`C:\Program Files\Jardinains!`. The local playable fixture is copied only from
that guest-produced VFS tree into:

```text
test/binaries/candidates/jardinains/installed/
```

The ignored `.wine-assembly-browser.json` beside the installed executable maps
that exact tree to `C:\`. The `jardinains` app launches it; the separate
`jardinains_installer` app continues to launch the original setup program.

## DirectDraw failure

The first working installer run opened a black game window with only the
native player-name overlay visible. The application creates temporary
`DDSCAPS_SYSTEMMEMORY` surfaces with both `DDSD_LPSURFACE` and `DDSD_PITCH`.
Their pixel pointers refer directly to decoded FreeImage/Blitz ARGB rows.

Wine-Assembly previously discarded `lpSurface`, allocated a new DIB, and
zeroed it. Every image conversion therefore read black pixels. DirectDraw now
aliases caller-owned system-memory pixels, preserves their pitch, excludes
them from DIB/video-memory accounting, and does not clear or free them.

Blitz also probes a primary surface for an attached
`DDSCAPS_TEXTURE|DDSCAPS_MIPMAP` child. `GetAttachedSurface` used to return the
unrelated back buffer regardless of requested caps. It now returns an
attachment only when all requested capability bits match.

## Gameplay gate

Jardinains polls DirectInput mouse state. A synthetic down/up in one batch is
not enough, and setting an absolute click point does not create the relative
motion its menu cursor consumes. The gate therefore moves first, holds the
button over **New Game**, releases it, repeats for **Easy**, and advances into
Level 1. Once the field is live it moves the paddle and holds another click to
launch the ball, then compares two rendered frames.

```bash
bash tools/build.sh
node test/test-jardinains-candidate.js
```

The test uses `--control-stdin --frozen` and the CLI's own `--max-seconds`
guard. It does not wrap the emulator in an external signal timeout.

## Deterministic route and control response (2026-10-10)

The test holds its clicks for 1.5 s of wall clock, so its batch numbers vary
between runs. Holding a click across batches works just as well and repeats
exactly. With `--batch-size=200000 --tick-ms-per-batch=16`:

| batch | input | result |
|---|---|---|
| 1800 | mousemove 300,204; down 1805, up 1845 | menu -> New Game |
| 2150 | mousemove 306,207; down 2155, up 2195 | Easy -> Level 1 (b2900: ball on paddle, 3 lives) |
| 2900 | mousemove 120,450 | paddle and ball slide left |
| 2930 | mousemove 540,450 | paddle and ball reach the right wall |
| 2965 | down; up 3005 | ball launches up-left (in flight at b3018) |

Two runs give byte-identical captures. Evidence:
`scratch/runs/20261010T0345Z-jardinains-control-frames`.

## Frame counter

Each frame is about 246 `Blt`s onto the back buffer, then one `Flip` of the
primary. Over batches 2975-3334 (5.73 guest-s), these all count 298: the Flip
trace, `--present-distinct` (all on slot 22), and the flush series in
`--frame-stats-out`. **`dx_present` reads 597:** `--frame-stats` records both
the present and the flip event of each Flip, so it is not a frame count for
this game. The result is 51.9 frames per guest-second, rising to 60.1 in the
second half once the ball is moving; that looks like a 60 Hz cap. Of the 298
frames, 205 change the picture; the rest are the stretch before launch, with
the paddle at rest. Intervals are quantized to the 16 ms batch (55 batches hold
two frames), so read the rate, not the interval percentiles. Browser FPS is not
measured.

Two oddities, seen but not investigated:
- Twice, adding `--trace-api` to the `--control-stdin --frozen` driver stalled
  the session before the menu for 7 minutes. The same flag in a plain
  `--input` run costs nothing (300 batches in 13.6 s against 13.2 s).
- In an `--input` run with `--trace-api` windowed to batches 3100-3104,
  `--present-distinct=2975` counted only the 4 presents inside that trace
  window, while `--frame-stats` covered the whole window. With the trace window
  equal to the measurement window, the counts agree (the run above). Check
  that the present-distinct count looks plausible before quoting it.
