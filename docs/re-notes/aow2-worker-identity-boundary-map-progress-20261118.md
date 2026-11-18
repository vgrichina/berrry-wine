# AoWII Worker identity boundary and two real map moves

Evidence: `scratch/runs/20261118-aow2-worker-identity-boundary-map-progress/`.

One fresh registered original completed Begin and two ordinary army moves.
Personally reviewed whole PNGs show the same six-unit Party moving southeast
from Beredan, then farther south, with movement **20/20 → 14/20 → 10/20**.
Ground remains black. Neither the preceding identity timeout nor the earlier
callback drive-limit failure reproduced; no causal runtime repair is claimed.

## Published diagnostic and controls

Published `3c6d7d11551399e043f31ac4bd0e7c95fdc91b36` adds optional
`threadSendFrameTraceFailureReserve`. The default observer is unchanged.
When enabled, the observer emits 255 ordinary frame records and reserves the
last record for the first later failed/thrown frame. Later successful frames
are transient. Emission remains at most 256 records, with first-eight/last-eight
samples per frame. The callback drive bound stays 10,000; admission, waits,
execution, scheduling, results and errors are unchanged. Concurrent reserved
failures cannot emit a second reserved record.

The updated real Worker/local test fails against the prior published host
because a late success consumes the final allowance; the new code retains the
later real nested error, preserving its identity. Existing frame ownership,
scoped yields, wait identity/reservation, process broker and admission tests
pass. The locked full build passed before publication. Only the owned host
trace hunks, their test and review were committed; the foreign host retirement
and rendering overlays were preserved. Strict pull/push completed immediately.
The pending foreign review's host hash anchors were adjusted without publishing
its other entries or changing its reasons.

The run-local reader still uses the actual Puppeteer Worker/session and its
original pure slot/endpoint/location expression. It now records each CDP
command's exact target, session, parameters/expression, start, completion,
returned exceptionDetails or transport exception. It also compares successive
actual owner values and records document/process checks and live Worker
inventories. It never guesses an owner, substitutes cached identity for a live
read, or queries a scope after UNKNOWN.

Authored browser controls use real Workers and an actually instantiated module:
normal reads pass; a 500ms busy Worker returns within the same 3000ms allowance;
a changed endpoint owner is rejected; a 4500ms busy Worker times out after about
3002ms with exact command and target retained. The timeout scope closes without
later endpoint requests. These controls demonstrate the reporting and refusal
boundaries, not the preceding original timeout's cause.

Native Device7 controls execute the real WAT DrawPrimitive handler with a
covering red texture and a noncovering neighbor, including seven complete
memory-hash checks around passive observation. The authored normal-browser
fixture changes a white foreground window to a maroon/yellow triangle after
independently released Space and reaches actual ExitProcess(0) after Escape.
A fresh detached custodian retains its complete child/enclosing waits and EOFs.
The initial fixture's outer tool returned 143 and lost the enclosing owner's
wait/EOF; its native driver/Chrome/watchdog receipts remain retained. The
fresh control does not retroactively repair that gap.

## Immutable original and identity result

The original serves the published graph above reconstructed in memory from Git,
excluding foreign working-tree overlays. Its compiled and actually instantiated
module is SHA256
`1504acf2ea5cac3ec3b8c627f4edc64c564e62ad37c06928f288bd8ae83b4f37`.
The unchanged `age_of_wonders2_demo` registry entry, all 1,083 media pins,
and real companion DLL/BPL bodies were sealed before launch. There are 448
successful authenticated application body consumers; canceled Network events
are separate observations. No interception, body substitution, guest/media,
configuration or registry edit was used.

Startup 900s, total 1800s, Quit reserve 180s and independent cleanup at 1820s
were fixed before launch. No bound was extended. The fresh native original
began at 09:16:23 UTC. Reviewed UI passed main menu → Scenario → Single →
Inioch's Legacy → Start → Julia's Begin dialog. This time Begin's whole PNG,
JSON and post-check all completed before its ordinary click and independent UP.

All 216 pure live identity reads succeeded, with maximum observed command time
1423.742ms. All 248 instrumented CDP command starts have completions, with zero
transport exceptions or returned exceptionDetails. The four actual guest
Worker targets are retained with sessions and instantiated-module checks:

| Slot / endpoint | Actual target | Session |
| --- | --- | --- |
| 0 / 1 | `0000941BAA300106FE099A92DD1727C8` | `10EF829DCCA4A9F2424562EB0BD9C8BC` |
| 1 / 2 | `46027ACDED598D2FC824E0836034DA43` | `AC76F48F9B8DB6750770975B7940D301` |
| 2 / 3 | `505D3DE2E6EFD86C09C27BAE8EF562B7` | `70B6818FC57EC7BB18D333C072CA7228` |
| 3 / 4 | `F44A02753F87A29AE5F855F4B0BF7799` | `979896DE39A344612211BA3E1020CB9A` |

No preceding failed target can be inferred from these new targets. The frame
observer emits 255 ordinary records; the failure reserve remains unused.
Natural frames 240 and 249 accumulate 2502 and 1971 blocked-pending branches
respectively and return successfully. Neither is a failed callback witness.

The first marker click coincided with the opening animation and did not select
a party. A later tower click opened Beredan's city panel. Escape opened a save
prompt, which was canceled; the visible Close button then closed the city
panels. The crossed-swords toolbar selected Party with six units and 20/20.
Reviewed ordinary destination/confirmation pairs then moved it to the southeast
clearing and farther south. `party-toolbar-result.png`, `first-arrival.png` and
`second-arrival.png` retain the whole before/after/points proof, with completed
pre/post identity checks. Each gesture retains an independent release child
wait and both EOFs. Plotting-only captures are not counted as movement.

## Ground boundary, without an inferred renderer repair

The passive CPU observer belongs to the exact slot0/endpoint1 target above.
It stops at the first terrain transfer plus two natural kicks, retaining 16
bounded events per selected point and no observation error. The actual Device7
call at return PC `0x4459fe`, FVF `0x1c4`, supplies a four-vertex strip with
bounds `[605.5,118.5,887.5,218.5]` to surface65 generation1, 1024×525, RGB565,
DIB485441536. That strip excludes ground point `[600,300]`.

The independent point `[750,168]` lies geometrically inside its second triangle.
The bound texture is surface68 generation1, 512×128, format4. Perspective
interpolation selects texel `[144,49]`, whose retained native bytes are `0000`.
That is a geometric nearest-texel observation, not proof of completed sampling
or an intended nonblack color. Raw vertices, packed bytes, device state,
render/stage states and viewport are retained.

Before BltFast, surface65's `[600,300]` bytes are already `0000`. Its actual
source rectangle is `[0,0,1024,525]`, copied to surface18 at `[0,0]`; the
backbuffer point changes from `4208` to `0000` at the subsequent natural kick.
This is an observed source/transfer boundary, not an instruction-level writer
attribution.

A separate bounded live WebGL executor observation at `[600,300]` completes
on a natural READBACK without observer/executor error. It retains 108 uploads,
1392 DRAW_UP records and one readback. The selected backbuffer upload and GPU
readback are both `[0,0,0,255]`; no retained draw bounds cover the point.
Actual `GpuStreamWebGL.Executor` execution and `gl.readPixels` establish the
WebGL stream backend; the vendor/renderer string was not collected. The whole
`terrain-ground.png` still shows black ground with rendered objects and HUD.
No stream bundle, full frame dump or source/media archive was retained.

The next rendering cause to localize is earlier native production of the
black surface65/texture68 data on that exact CPU owner, before transfer/upload.
The selected Device7 strip cannot explain missing ground at `[600,300]`, and
the observed covered neighbor has zero source texel bytes. No WebGL raster,
callback, timer, asset or guest fault is proved by these observations.

## Closure and recovery

After the completed terrain probe, the driver reached its fixed 60s filesystem
command-wait deadline at 09:26:27.031. It closed UNKNOWN with no application
fault. A later inspect submission was refused locally before creating command35
or making any endpoint request. There was no extension, scope replay, later
query or ordinary original Quit. Host cleanup is separate from guest Quit.

Original Chrome, driver, watchdog, native supervisor, owner and enclosing waits
and both EOFs are retained, with no native leak or poll error and removed owned
profiles. The independent watchdog did not trigger; minimum original /home
free space was 2,013,347,840 bytes. Exact Git, relevant binary diffs, published
owned patch, run-helper patches, hashes, selected PNGs and recovery instructions
are retained. `result.json` is written last. No agents, workers, boxes, Python,
Wine, deployment or held-title investigation was used. Box ID null, state
NOT_CREATED, expiry null, stop receipt null. Ownership is released after sealing.
