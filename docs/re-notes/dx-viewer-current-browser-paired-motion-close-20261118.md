# Viewer supplied-model motion and ordinary native close, 2026-11-18

Registered `dx_viewer` visibly rotates its original supplied Microsoft model on
both actual software and WebGL browser executors. Ordinary title close reaches
native `PostQuitMessage(0)`, `PeekMessageA` returning WM_QUIT, and
`ExitProcess(0)`, followed by guest/render retirement and individual successful
driver, Chrome, Xvfb and openbox waits. Evidence:
`scratch/runs/20261118-dx-viewer-current-browser-paired-motion-close/`.

| Scope | Personally inspected whole-frame motion | Actual completed DRAW_UP / PRESENT | Native exit after close |
|---|---|---|---|
| software | Readable broad face to narrow reversed side; 18,240 changed scene pixels | 207→431 / 103→214 | 99 ms, code 0 |
| webgl-active-observer | Mirrored rear word to readable front/oblique word; 9,758 changed scene pixels | 495→1,094 / 246→545 | 220 ms, code 0 |

The scene pixel counts use the same 376×354 client area in retained whole
1280×1024 display images; no cropped evidence is substituted. The page and native
canvas remain 800×600 from startup through both observations, with zero observed
resize events. The initial ordinary focus click precedes both images; input
records are identical across each pair. No model, media, executable or app config
was edited. Ordinary startup loads the model; no File/Open, injected mesh,
private guest call, clock change or forced pump was needed.

The actual software executor reports completed native software draws and
presents with no WebGL context. The actual WebGL executor reports completed
draws/presents, backend `webgl1`, a live `WebGLRenderingContext` instance,
376×354 drawing buffer, context attributes and no context loss. Bridge endpoint
ID/epoch remain stable and presenter counts increase. Executor observations wrap
the pinned production `execute` methods and count only successful returns.
The renderer vendor string is retained as untrusted metadata; it establishes no
hardware claim. There is no performance, hardware or Windows-parity claim.

## Prepared graph and reused repair

Both successful originals use Git runtime graph
`f6962ba5b1cf2829a66f5cc4d80b293c30719b37`, renderer
`06f27181f9c977cd1aed99270040efddca00ed75`, and published owning-Worker unload
repair `1ad9afd9201b40a3985421906436bd0023c73ba4`. The existing module is
SHA-256 `a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`,
referenced at its retained path without copying or recompiling it. Preparation
constructs the source graph in memory before launching each finite scope.
Source pins, explicit RPC overlay, bounded native API diagnostic and passive
observer suffix hashes reproduce the actual HTTP bytes. Shared foreign WIP is
recorded as binary diffs and is not served.

All registered Viewer files and native `d3drm.dll`, `d3dxof.dll` and
`oleaut32.dll` are referenced from existing paths with before/after hashes.
The loader's app-local `d3dxof.dll` probe returns 404 before resolving the
served common DLL; the complete HTTP list also retains absent optional shell
resources. These do not prevent the observed model or clean exit.

The tested Globe/Tunnel close route and the published dd9 dual-executor
regression are reused. Both dd9 regression files remain byte-identical; no broad
unchanged qualification was run. No product defect was proved or product code
changed, so no new build was needed. The old retained-rendering note's Wine
citation is not used as ground truth.

## Closed observer failure and corrected scope

The first new WebGL scope (`webgl/`) captured one whole image, then failed the
executor assertion: installing the unused software observer overwrote the global
record with an empty software record, although WebGL was executing. It remains
permanently UNKNOWN/closed, with driver exit 1, explicit failed-scope Chrome
cleanup and no leaked supervised children. It is not native-close evidence.
No later endpoint request was made against it.

The materially changed `webgl-active-observer/` publishes the observation from
the actual successful execute call. Its paired images and context/executor
records pass, then ordinary close completes. CDP inspection creates/detaches
Worker sessions only; no second Puppeteer browser attachment or viewport setter
is used. All earlier UNKNOWNs, including the old software Viewer scope affected
by implicit inspection resizing, stay closed.

## Native completion, waits and retention

Both successful originals record the native API entry for `ExitProcess` with
stack argument 0 before browser cleanup. Native quit-message observations and
guest/render retirement are verified separately from host process bookkeeping.
Each driver/supervisor, Chrome, Xvfb and openbox has its own actual wait with code
0, null signal and both output EOFs. Independent finite supervision reports no
deadline termination or leaked children; all tracked runtime PIDs are absent.
The original bound is 150 seconds, close bound 20 seconds, and independent
supervisor bound 165 seconds plus 15 seconds for cleanup. No forced cleanup is
counted as successful native close.

Unique evidence is retained and verified before owned tmpfs removal. The private
display socket, lock and authentication file are gone. Minimum sampled /home free
bytes are 1,549,287,424 (software) and 1,530,384,384 (successful WebGL); these
100 ms samples are not a continuous-space claim. Only owned closed metadata was
losslessly compressed, with round-trip and SHA checks recorded before unlink.

`verification.json` checks source/media/HTTP/module hashes, actual executor and
presenter progress, stable viewport/input, scene changes, native quit/exit,
individual waits and absent PIDs. Recovery uses Git plus relevant binary diffs,
owned run-input patches and the existing unique retained module. No source-tree
snapshot, frame series, media copy, Wine reference, public deployment, worker or
box was created. Box ID/state/expiry/stop receipt: null / NOT_CREATED / null /
null. Foreign WIP and security holds are preserved. `result.json` is written last.
