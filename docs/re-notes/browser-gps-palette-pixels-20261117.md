# Browser GPS palette pixel check, November 17

The existing `test/test-d3dim-gps-palette.js` oracle passes all 32 observations in Chrome with the native software executor and with the real WebGL executor. The 32 recorded pixel arrays are identical across the two arms. Each arm performs 26 draws and 32 producer READBACK operations, with zero producer fallbacks or declines; the explicit unsupported alpha-palette/key combination still traps as required.

Evidence: `scratch/runs/20261117-coordinator-browser-gps-palette/result.json`. The native module was prepared and retained before execution as `tested.wasm`, SHA-256 `ad38e26f969ea13a76001c3549c3170ff094b506e3752ef871b9750ab7683d9e`. `tested.wasm.json` records its canonical compilation inputs and extra WAT. `source-pins.json` and `working.patch` identify the actual tested working-tree inputs, including foreign WIP without adopting it. Browser scripts were served from immutable in-memory buffers.

`driver.cjs` replaces the Node boot harness with browser WebAssembly instantiation and supplies the selected production executor to the existing GPS device helper. It removes the Node shebang and automatic entrypoint before invoking the same `arm(1)` body; assertions and expected pixels are unchanged. Unhandled native host imports throw. The WebGL arm constructs `GpuStreamWebGL.Executor` directly and records a real WebGL2 context; it cannot silently fall back to software.

Chrome 151.0.7922.108 was launched with SwiftShader requested. Its reported Intel/Mesa renderer string does not establish physical hardware provenance. Native driver actual wait returned zero, Chrome actual exit/close returned zero, both output EOFs were observed, and all task-owned runtime scopes closed.

Two earlier harness attempts stopped before pixels: missing browser dependency scripts and a Node shebang passed to `Function`. Their drivers, failures and actual wait receipts remain under `attempt1-*` and `attempt2-*`.

This is a cooperative pixel test. It does not repair or qualify the separate stale legacy Worker palette-lifetime fixture, prove original-game rendering, establish hardware GPU execution, or complete the 27-app goal. No production or test source changed in this check.
