# Steep perspective software filtering

Evidence destination: `scratch/runs/20261106-legacy-steep-software/`.
The unchanged production baseline reproduces the authored failure. The next
diagnostic failed before producing a module, so actual internal sampler stages
remain unobserved. No emulator repair or GPU candidate was applied or landed.

The authored public regression and independent oracle are retained from
[the predecessor](legacy-spatial-min-linear-20261106.md). Pixel `(30,1)` has
expected RGB `[103.220778044,113.924726814,97.215804982]`, tolerance 2.
Fresh public x86 COM drawing returned `[103,113,95]` at that integer center.
The original twelve spatial observations passed first. Both shipped modules
passed resource/bootstrap checks; compatibility rendering was not reached.

The locked full build passed at Git
`ee22703a6613f64690a2d1328b82ec42db98cf3e`, with no tracked production/test
diff. The public regression was added in memory by `public-probe.cjs`;
`baseline-harness.patch` records the complete test adaptation. It retains the
existing independent oracle and tolerance, and limits execution to standard
software spatial drawing. The four relevant source/test hashes were unchanged
since dispatch. `baseline-source.json` records 4,061 source pins and
`baseline-source.patch` records the empty tracked diff.

| Shipped module | SHA-256 |
| --- | --- |
| standard | 220beaba026d0aabaf25b4193a345ca6d704be64b0812a72d68adb0700ad80f2 |
| compatibility | 2b180ff8bbf552a10d97ac21d8ed5bf820e712e5c658bb29f0006e623a867326 |

These match the predecessor's retained modules exactly. The existing
`test/binaries/calc.exe` was referenced, not copied; its SHA-256 remains
`cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

Microsoft documents bilinear filtering as a weighted average with texel
centers at `(i+.5)/dimension`, including an example whose 127.5 component
is represented as 128. The pages consulted do not specify a general bound
for intermediate fixed-point quantization or UNORM rounding in legacy D3D.
The example alone must not be promoted into a complete precision contract.

References: [bilinear filtering](https://learn.microsoft.com/en-us/windows/win32/direct3d9/bilinear-texture-filtering),
[linear filtering](https://learn.microsoft.com/en-us/windows/win32/direct3d9/linear-texture-filtering),
[texture filtering](https://learn.microsoft.com/en-us/windows/win32/direct3d9/texture-filtering).
The D3D11 functional specification is a different API generation and cannot
establish a D3D7/9 intermediate-precision requirement by itself.

The intended stage diagnostic would record sampler inputs, quantized weights,
horizontal rows, bilinear results, mip fraction and final packed blend at the
failing pixel. My `prepare-trace.cjs` incorrectly prepended its trace import
and global to the root manifest. `compileClosure` rejected this at
`tools/protected-writer-entries.js:103` with
`protected runtime requires an include-only root`. The guard requires every
root form to be an include. This is a diagnostic preparation defect, not an
emulator failure. `compile-trace.log` and `trace-transform.patch` preserve it.
No diagnostic module was produced, no trace browser ran, and no retry followed
this first new failure.

The concrete next step is to keep `main.watx` include-only and put diagnostic
declarations in an already included VFS fragment, preserving the protected
writer pass and all three VFS aliases. That proposed correction is untested.
Then capture the actual stages before deciding whether an emulator change is
justified. The predecessor's intermediate-truncation explanation remains
offline arithmetic; this run does not turn it into runtime causal proof.
The unresolved semantic boundary remains whether legacy filtering permits
packed eight-bit conversion between the horizontal, vertical and mip blends,
and what intermediate precision/error and rounding rules apply. An ideal
oracle mismatch alone does not settle that boundary.

All ordered FINAL releases and independent cleanup passed before the local
window, `12:20:22.899604Z`–`13:05:22.899604Z`. The only browser ran
`12:20:58.001Z`–`12:20:59.066Z`. Initial cleanup at `12:21:29.996Z` verified 58 absent
owned PIDs, three refused ports, one absent profile, four free locks and more
than 4.57 GB free disk. The reviewed screenshot is a synthetic triangle.
No boxes were assigned; box ID/state/expiry are not applicable. Runtime
ownership returns to the coordinator.

Unexecuted: internal stage capture, focused repair regression, all solid
matrix cells, completed spatial matrix cells, compatibility spatial rendering,
direct and owning-Worker WebGL1/2 spatial rendering, and N/Q GPU candidate
qualification. Original GL coverage, top-left ownership and texture lifetime
were untouched. No failing test or speculative production change is committed.
