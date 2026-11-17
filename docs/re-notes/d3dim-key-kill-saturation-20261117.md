# D3DIM color-key rejection lost its negative intermediate

When `COLORKEYENABLE` is on and `COLORKEYBLENDENABLE` is off, the GPU-stream
producer subtracts a threshold from sampled alpha and uses `TEXKILL` to discard
the keyed fragment. `$d3g_dst` normally sets the saturation modifier. Using it
unchanged for this subtraction clamped negative results to zero, so the later
strict-negative kill test never rejected them.

The retained baseline failed the existing palette oracle: the keyed pixel was
`[64,128,192,0]` instead of the untouched background `[0,0,0,255]`.
Read-only stream diagnostics confirmed the threshold constants were 0.5 and
the canonical IR contained a zero clamp between subtraction and `TEXKILL`.
This rules out the earlier test comment's unproved texture-coordinate theory.

The producer now clears saturation only on the subtraction destination. Stage
color/alpha saturation remains intact. The palette test no longer exempts the
failure; all 32 pixel observations must pass in an ordinary invocation.

Evidence is in `scratch/runs/20261117-coordinator-gps-palette-strict/`,
`20261117-coordinator-gps-palette-strict-diagnostic/`, and
`20261117-coordinator-gps-palette-fixed/`. The fixed run exercises real WAT
palette handlers and stream production into the production software executor,
including key-mode transitions, alpha blending/testing and filtered samples.
Each tested instrumented module was retained before execution. Separate shader
canonicalization and keyed-mipmap regressions and the locked canonical build
are recorded in the fixed run's result.

The separate Chrome palette-lifetime attempt in
`20261117-coordinator-browser-palette-lifetime/` stopped before rendering: that
fixture expects the retired legacy transport and rejects `gpu_stream_kick`.
It proves no browser pixel result or runtime rendering defect. This repair
establishes neither original-game behavior nor full GL/D3D corpus coverage.
