# Repeatable browser GPS palette regression

`node test/test-d3dim-gps-palette-web.js` runs the existing native palette oracle against the actual software and WebGL executors in Chrome. It reuses every assertion and tolerance in `test/test-d3dim-gps-palette.js`; only browser boot and executor selection change. The unsupported alpha-palette/key combination still has to trap.

The test prepares and retains the native module before browser execution, freezes browser scripts in memory, and checks that its shared oracle files stayed unchanged during preparation. Unexpected native imports throw. It constructs the WebGL executor directly, requires a real context, and cannot silently select the software executor for that arm. Actual Chrome exit/close and output EOFs are checked. The `-web.js` name automatically selects the E2E tier.

Set `CHROME` to choose a browser. Set `PALETTE_WEB_EVIDENCE_DIR` to an absolute run directory to retain module/provenance/pixels; otherwise the test removes its temporary module after cleanup. No source trees or frame series are archived.

Validation: both final arms passed32 observations,26 draws and32 readbacks, with zero producer fallbacks or declines. Test-tier membership and syntax checks pass. Run `scratch/runs/20261117-coordinator-palette-browser-regression-final/result.json` records the exact harness hash, module, script hashes, pixel observations and actual driver/browser waits/EOFs. The earlier initial run is retained at `20261117-coordinator-palette-browser-regression`. No production source changed; a full native build was not repeated for this test-only addition.

This is cooperative component coverage, without an original game or guest/render Worker lifetime claim. SwiftShader was requested; the reported Intel/Mesa string does not prove physical hardware. The full27-app goal remains open.
