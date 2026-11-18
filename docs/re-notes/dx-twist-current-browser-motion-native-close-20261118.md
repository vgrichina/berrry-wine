# Twist motion and ordinary native close, 18 November 2026

Registered original `dx_twist` visibly animates on actual software and WebGL
browser executors. Ordinary title close reaches native `ExitProcess(0)` before
host cleanup, followed by guest/render retirement and separate successful
driver, Chrome, Xvfb and openbox waits with both output EOFs.

Evidence: `scratch/runs/20261118-dx-twist-current-browser-motion-native-close/`.

| Executor | Personally inspected whole-frame motion | Completed DRAW_UP / PRESENT | Close to native ExitProcess(0) |
|---|---|---|---|
| Software | Narrow twisted middle and radiation marking left become a broad blue/gray body with marking low right; 25,265 changed scene pixels | 226→443 / 111→220 | 132 ms |
| WebGL | Broad near gray body becomes a narrow middle, exposing the large yellow radiation marking right; 20,723 changed scene pixels | 1,448→1,894 / 722→945 | 254 ms |

Pixel differences exclude the overlay text and compare scene coordinates
x=29..340, y=225..464 within retained entire 1280×1024 display images. The page
and native canvas stay 800×600, with no observed resize. The original native
client remains 312×274. Ordinary focus precedes observation; recorded inputs
remain identical through the motion pair and before close. No media,
executable, registration or configuration substitution was made.

Software's first image caught startup black despite completed presents. It is
retained and excluded from the motion pair. While that same finite scope was
still healthy, one additional passive whole-display XGetImage observation
(`settled.png`) supplied the second visible scene, paired with `later.png`.
No original restart, input or viewport change occurred. Executor counters in
the table are the earlier early/later observations; they are not synchronous
measurements of the later/settled software image pair. Before-close state also
retains continued presenter progress and unchanged viewport/input. Before the
unlaunched WebGL scope, the startup settling delay was increased from 2.5 to
7 seconds. Its first two captures both show the object.

The passive corrected active-execute observer counts successful returns from
the actual executor. Software reports native software draws and no GL context.
WebGL reports backend `webgl1`, a live `WebGLRenderingContext`, a 312×274 drawing
buffer, context attributes and no context loss. Endpoint ID/epoch remain stable
and presenter counts advance. Vendor metadata is not hardware evidence.

The in-memory graph reuses the tested Viewer graph: Git
`f6962ba5b1cf2829a66f5cc4d80b293c30719b37`, renderer
`06f27181f9c977cd1aed99270040efddca00ed75`, and owning-Worker unload repair
`1ad9afd9201b40a3985421906436bd0023c73ba4`. Existing retained module SHA-256
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`
is referenced without copying or recompiling. Source pins, RPC overlay,
bounded diagnostic transform and observer suffixes reproduce actual HTTP
bytes; registered inputs and native DLLs have unchanged before/after hashes.
Shared foreign WIP is recorded as binary diffs and excluded from served bytes.

Both close traces show ordinary WM_CLOSE at `DefWindowProcA`, native
`PostQuitMessage(0)`, window destruction and native `ExitProcess` with stack
argument zero before host stop. No PeekMessage WM_QUIT record is present;
Viewer's separate observation is not attributed to Twist. Guest/render
retirement is independently checked. Individual actual driver, Chrome, Xvfb
and openbox waits each have code 0, null signal and both EOFs. Independent
finite supervision reports no deadline termination or leaked tracked children;
all tracked PIDs are absent. Forced cleanup is not counted as native close.

Minimum sampled /home free bytes were 1,594,900,480 for software and
1,592,061,952 for WebGL; samples do not prove continuous free space. Growing
logs and captures used owned tmpfs. Unique artifacts were retrieved, hashed
and verified before removal; closed text is losslessly gzip-compressed.
Git/diffs, owned run-input patches and the existing unique module provide
recovery. No source snapshot or media copy was made.

No product defect was proved and no product code changed, so no new build or
broad unchanged qualification was run. The published unload repair and tested
close/capture helpers are reused; the dd9 dual-executor regression files remain
byte-identical. All old UNKNOWN scopes remain closed. Foreign WIP and security
holds are preserved; no held investigation was opened. No workers, Wine,
performance, hardware, Windows-parity or deployment claim. Box ID/state/expiry/
stop receipt: null / NOT_CREATED / null / null. `result.json` is written last.
