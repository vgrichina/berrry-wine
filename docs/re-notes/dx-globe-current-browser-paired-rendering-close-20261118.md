# Registered Globe paired scenes and unresolved native close

Evidence: `scratch/runs/20261118-dx-globe-current-browser-paired-rendering-close/`.
Both fresh original `dx_globe` browser scopes show moving textured scenes. I
personally viewed both complete 1280×1024 frame pairs. Software records actual
`GpuStreamSoftware` execution and native rasterizer draw statistics. WebGL records
`GpuStreamWebGL`, `webgl1`, context version `WebGL 1.0 (OpenGL ES 2.0 Chromium)`
and ANGLE Intel/Mesa UHD Graphics 620. These are executor/context observations;
they establish neither physical GPU use nor native Windows or pixel parity.

Ordinary title-close retirement is **unproved on both backends**. Each finite
20-second close observation expired and permanently closed its scope UNKNOWN.
Neither scope was reopened, retried or queried after closure. Software retained
the input command completion but lacks a final native state snapshot. WebGL
retained trusted DOWN/UP, no remaining windows at the deadline, `running:true`,
no native ExitProcess and no guest/render retirement. Presents advanced from
2,086 before close to 2,088 at the deadline; that is compatible with in-flight
work and is not evidence of continued rendering after destruction. I also viewed
the complete deadline image showing the application absent.

The remaining boundary is native application shutdown after window destruction.
Static disassembly identifies Globe's WndProc at `0x402668`: WM_DESTROY calls
`0x403841`, which clears initialization, releases native COM objects, then sets
the application's done flag at `0x40e9e2`. The main loop drains PeekMessage at
`0x401926` before checking that flag at `0x401987`. Retained observations do not
prove callback entry/completion, the particular COM release, flag value or pump
instruction at the deadline. Assigning a renderer, callback, queue or timing
root cause would exceed this evidence. No production change was justified;
security-held callback/lifecycle work and foreign WIP were left untouched.

The graph was prepared before either original. It uses published Git
`f6962ba5b1cf2829a66f5cc4d80b293c30719b37`, renderer
`06f27181f9c977cd1aed99270040efddca00ed75`, and the existing retained module
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`.
All 1,453 source pins, HTTP module/source hashes, registered Globe media and
native d3drm/d3dxof/oleaut32 closure are verified. No media/config change, module
compile, source snapshot, guest state write, clock change or polling shortcut
was used. Published `dd9b09da5` dual-executor regression and `c7ac59e41` cleanup
evidence are reused; no unchanged Tunnel campaign or redundant regression run.

Evidence limitations are explicit. A WebGL preparation syntax failure happened
before any runtime and is retained separately. Its added passive input-method
observer then referenced Win98Renderer before renderer.js loaded, so that suffix
failed and supplies no method observations; trusted DOM input and actual draw
observers remain available. The software original has individual Chrome
SIGKILL, Xvfb 0 and openbox 0 waits with both EOFs, and enclosing native wait 1
with both EOFs. WebGL lost individual host waits and driver-final receipts;
the tool session returned 143, with separate pipe EOFs unknown. Its native
supervisor nevertheless retained driver exit 1, finite descendant sweep and
`leaked:false`. Missing waits are not converted into success from PID absence.
Both scopes' recorded PIDs are absent; unique display evidence was retrieved
before removing the remaining owned tmpfs, with no downloads present.

Offline `verify.cjs` checks source, passive suffixes, served bytes, unchanged
media, actual executors, image changes and closed-failure receipts. No production
code changed, so no new canonical build or focused production suite was run.
Sampled disk observations were above 1.5 GB; missing WebGL outer monitoring
prevents a continuous task-floor compliance claim. Git plus relevant binary
diffs and owned input patches recover the work; selected whole images only.
`result.json` is published last. Box ID null, state NOT_CREATED, expiry null,
stop receipt null. No agents, workers, Wine reference, deployment or foreign
cleanup. Both native exits and clean-close acceptance remain open.
