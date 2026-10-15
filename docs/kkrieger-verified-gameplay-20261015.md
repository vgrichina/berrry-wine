# Original Kkrieger: verified canonical delivery and bounded control capture

The original game reaches its Start menu and first-person level through ordinary
held Enter on canonical main `dc0611212344ef3778652f4aff5e6c407be5c895`.
The matched W, A and mouse-look captures do **not** establish player control:
pillar and floor framing remains essentially unchanged, with animation also
present in the idle pair. This is level-rendering evidence, not a playability pass.
This result is inconclusive about an input bug: the five-second holds may be
shorter than the game's polling/frame interval. The forward window records only
one hook event in 20.17 seconds, and the strafe window records none in 20.21 seconds.

Root granted the sole fresh sandbox `bx_9ef2wdsw`. A public shallow clone pinned
the exact commit; `PUPPETEER_SKIP_DOWNLOAD=true npm ci --ignore-scripts
--omit=optional` used the committed lockfile. Node was v24.18.1, npm 11.16.0,
Chrome 151.0.7922.108. Fresh `bash tools/build.sh` passed all gates, producing a
physically contained canonical module of 1803164 bytes, SHA256
`02b41f090dacdb461ea0b59a77260d6c17432e9d3993d4cc8878cb76a865a33d`.
Eight canonical-delivery tests passed. All 6505 tracked-file size/SHA entries
independently match the pinned Git blobs and remain unchanged after execution.

The three original fixture files and browser manifest were transferred from
the parent's candidate directory through API exec, with exact byte/hash checks.
The fixture pins are retained in `meta.json`; no guest bytes were changed.
Actual server HTTP 200 and fresh-page fetch both verified the canonical module's
bytes and digest before screenshots or input. No compatibility/WAT fallback
occurred. The previous symlink/403 run remains separate historical evidence.

Owner 39718 started 2026-10-15T11:36:20.011Z with absolute deadline 11:51:20.011Z.
It exited 0 at 11:47:50.339Z, about 690 seconds into the 900-second bound.
`scene-45.png` shows the Start menu; operator review submitted its gate at
11:44:57.788Z. Ordinary Enter was held 11:44:58.649–11:45:03.662Z.
`scene-55.png` shows first-person geometry, weapon and life 100/ammo 100; its gate
was submitted 11:46:17.253Z. Root independently reviewed that frame and the final
matched after-images. All eight before/after images were reviewed by the owner.

The unchanged controller then captured sequential 20-second idle, W held 5s,
A held 5s, and ordinary mouse 550,400→710,400 windows. These are sequential
observations, not identical-world resets. No force-pointer-lock, firing, guest
write, broad EIP trace, second attempt or time extension occurred. Final focus
and main HWND are both 65537, active element is canvas `screen`, and pointer lock
is false. Delivered key events alone do not prove that the game acted on them.

| Window | Seconds | Hook events | Events/s | Kind/slot |
|---|---:|---:|---:|---|
| Idle |20.1823|2|0.09910|gpu:-1|
| Forward |20.1692|1|0.04958|gpu:-1|
| Strafe |20.2093|0|0|none|
| Look |20.1838|2|0.09909|gpu:-1|

These sparse observations are presentation-hook events, **not logical game FPS**
or unique displayed frames. Hook identity was checked at endpoints only; no rows
were dropped. Sparse events also limit the control assessment. The audio context
was running with 44.1kHz stereo 16-bit voice metadata, but no recording was made:
audibility and quality remain unknown. Combat was not attempted.

A future separately authorized bounded probe should first establish a read-only
game-progress/poll observation, then keep a key down until actual progress is
observed in the held state, subject to a hard cap, before releasing it. Absolute
mouse motion with pointer lock false does not establish relative mouse delivery.
Neither observation justifies an emulator input change without further evidence.

Postflight 11:48:19.549Z found no runtime survivors, clean tracked status,
unchanged source/module, and passed controller fixture pins. Runtime was released
to root before further read-only artifact export. Process receipts retain
pid/ppid/comm only after sanitizing incidental platform process arguments.

Evidence: `scratch/runs/20261015-kkrieger-verified-gameplay/`. The remote archive
contains 162 artifacts/24884814 bytes; archive 22510571 bytes, SHA256
`8fe1dc9907758507aebe9ac26b5ad1babf29a9761afcf8800d57373a0c54096d`.
The local bundle additionally retains the canonical module, controller sources,
lockfile, root's source audit and terminal receipt. See its manifests and
`result.json` for the completed copy audit and qualified outcome.

Recovery: clone the pinned commit, restore the three original fixture pins plus
browser manifest, install from lockfile, and build with the command above in a
real contained `build` directory. The exact controller launch is retained in
`receipts/process-39718.json`. A recovery recipe is not authorization for another
runtime. No public deployment was performed.
