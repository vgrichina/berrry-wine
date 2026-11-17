# AoWII Device7 observation qualified; original blocked before startup

Run: `scratch/runs/20261117-aow2-device7-ground-inputs-render-repair/`.
No production repair. Terrain, fresh army response and native Quit remain
unverified. The single authorized diagnostic original stopped on a required
DLL body cancellation before game startup; it was not retried.

## Actual Device7 observation

The existing kind15 hook covers Device3 only. Instead of extending that hook,
the bounded passive observer now reads the still-live Device7 stack at the
existing natural `gpu_stream_kick` import. It selects return PC `0x4459fe`,
FVF `0x1c4`, a type20 device and its actual 1024x525 target. It snapshots raw
vertices, packed vertices from the worker descriptor, the 4096-byte device
state, bound texture slot and samples, render states, stage0 states, viewport,
and strip triangles' geometric coverage of [600,300]. Geometric inclusion is
reported separately from effective raster acceptance. Surface flags now read
object+28; object+8 is the device render-target slot or surface misc0.

`native-fixture.cjs` executes the real WAT
`handle_IDirect3DDevice7_DrawPrimitive` through that exact import, rather than
a model or import bridge. Its covering textured strip renders RGB565 `f800`
at [600,300], with the expected supplied vertices, packed data, bound texture
and state captured. A separate target's narrow strip excludes that point and
is attributed accordingly. Seven whole-memory hash checks around passive
callbacks pass; these checks run only in the fixture, never in the game.
Copied receipts remain immutable and disposal restores the import wrapper.
`check-observer.cjs` additionally passes bounds, ownership, lifetime,
return/receiver preservation, read-failure isolation and real-error controls.
Its stress maximum is 1.65us/hook. The final native fixture records 11 calls,
8740 copied bytes and 9.50ms observer time, including cold snapshot work.
This proves observation coverage, not a rendering defect in AoWII.

## Matching module and names

`reconstruct.cjs` reconstructs the requested sources in memory from Git
`0a823095cd147c43d362384efd33a312cc2766c7` plus the retained
`20261117-aow2-restored-headroom-matched-package-gameplay/final-relevant-source.patch`.
Every source matches its pinned hash. Recompilation initially differed only
by the appended `wine-region-layout` custom section; all executable sections
were already byte-equal. Retaining that exact section reproduces the complete
module SHA256
`87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009`.
No source tree snapshot was written.

The named fixture is derived from this source closure. The selected native
function bodies match the original module byte for byte at their actual
indices (`native-function-map.json`), avoiding the earlier mismatched source
mapper. In particular, 7444 is `gps_kick`, 8393 `d3g_kick`, 8395
`d3g_begin`, 8403 `d3g_upload_at`, 8402 `d3g_upload`, 8423
`d3g_upload_rows`, and 8424 `d3g_prepare`. The predecessor's first captured
kick therefore occurred during target preparation/upload while the Device7
call was live; it did not establish completed draw output or its last writer.

## One original and the concrete blocker

The driver reused the prior sealed media, module, source adapter, audio and
input controls. Offline preflight and the real Device7 qualification passed
before launch. The whole `original/registered-launch.png` was personally
reviewed before the ordinary Launch click. No game controls were sent.

`original/first-fault.json` records the required
`binaries/dlls/oleaut32.dll` request as `network-loading-failed`, canceled,
`net::ERR_ABORTED`. The strict controller closed with
`REQUIRED_BODY_UNKNOWN`. There is no fresh game module identity, terrain
capture or Device7 input receipt. The cause of cancellation remains UNKNOWN;
no later query, unchanged retry, intended-color inference or speculative
rendering change was made. The previous audio/two-move/native-Quit evidence
in `20261117-aow2-required-dll-audio-gameplay-progress/result.json` remains
reference-only. The preceding run's unverified exit remains unverified.

## Shutdown and next work

The independent finite watchdog was ready before the driver, with a 900s
deadline and /home floor1500000000B, without a RAM gate. Custody records real
waits and both EOFs: driver1, Chrome0, watchdog0, supervisor1 and keeper1.
The watchdog did not fire. The supervisor reports clean shutdown with no
remaining scope or children. Unique custody files were retrieved and
hash-verified before removing the task's own tmpfs profile. No boxes were
created: IDnull, stateNOT_CREATED, expirynull, stop receipt not applicable.

Only this findings note is committed; the helpers and evidence remain in the
run directory. A canonical production build is not applicable to this
documentation-only change. The next useful step is a demonstrated repair of
the required-body cancellation boundary before any newly authorized original.
The qualified Device7 observer can then establish whether the supplied inputs
represent valid application black or an actual API/raster/coverage defect.
