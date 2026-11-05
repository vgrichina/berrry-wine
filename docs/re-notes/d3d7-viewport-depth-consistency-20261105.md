# SDK7 ProcessVertices viewport depth, 2026-11-05

The inconsistency was real: public VB7 `ProcessVertices` returned normalized
`Z/W`, while `ProcessVerticesStrided` applied `MinZ+(MaxZ-MinZ)*Z/W`.
The retained SDK7 viewport matrix specifies the latter, including collapsed
ranges. Reference: `scratch/runs/20261105-d3d7-processvertices-strided/`
(`sdk7-vpscale.gif`, SHA-256
`30365f6e3a16dbae794d2d66425fa8192c4c5bf063db930d47aab5289935f619`).
That matrix and the retained SDK7 method/viewport pages were inspected directly;
existing transform helpers were not expected-output oracles.

The actual public aliases in `09aa-handlers-d3dim.wat` reach the common
processing implementation in `09ab-handlers-d3dim-core.wat`. A shared final
processing-output helper now applies the range once for both methods.
`vertex_project` remains normalized because homogeneous triangle clipping
reconstructs clip Z from that representation. Legacy viewport normalization,
already transformed source depth, RHW and clipping are preserved. Public PV
also ignored `DONOTCOPYDATA`; selective output stores now preserve supplied
nonposition fields while allowing requested computed lighting colors. Existing
unpack callers retain their previous stores; unsupported PVS errors are intact.

Evidence: `scratch/runs/20261105-d3d7-viewport-depth-consistency/`.
`baseline-public-depth/` retains the independent destination-byte failure before
production changes; `baseline-public/` retains an earlier fixture vtable-slot
mistake. The implementation base is recorded by exact Git SHA, with relevant
binary diffs and the new note patch; module/media files are referenced by path
and SHA-256, never copied into this run.

The expanded `test/test-d3d7-processvertices-strided.js` uses real x86 COM
factories/vtables in both shipped modules. Independently authored dyadic
expectations cover nonidentity world/view, perspective W=1/2/4, nondefault
viewport rectangles, nonzero source/destination ranges, device A/B/A state,
normal and collapsed depth ranges (including 0 and 1), guard/source bytes,
DONOTCOPYDATA, supplied color/specular/UV tails, and computed lighting RGB.
Existing strided failure-atomic/unsupported/OOM coverage remains active.
Computed alpha is explicitly excluded only for computed color words.

`public-final/` passes both modules (1,752 COM records and 47 pixel checkpoints
each). `browser-final/` passes software and direct WebGL (1,744/47 each) and
production queued rendering (1,881/51 each), with all 12 browser negative
controls rejected by their designated byte/pixel oracles. A red triangle at .5
occludes mapped green depths above .625; replacing only processed depth with
raw normalized depth fails the final pixel oracle. Held ordinary/indexed draws
survive overwriting source, descriptors, indices and destination, releasing and
recreating VBs, and changing the live viewport. Released allocations are not
claimed to have been reassigned to identical addresses. Queued-depth corruption
fails its designated pixel oracle. All six accepted PNGs were personally viewed;
the four depth tiles and two extra held-depth tiles are red as expected.

The new held-depth tests use the primary render target. Additional secondary-
target indexed and ordinary variants timed out waiting for a queued packet,
despite correct destination/index bytes (`browser-second`, `browser-third`,
`browser-interleaved`); those failures are retained, not qualified or repaired
speculatively. Existing interleaved-device output and original queued A/B checks
still pass. `browser-first` retains a missing default Chromium executable;
subsequent runs explicitly use `/usr/bin/google-chrome` and exit normally.

Final `flock /tmp/wine-build.lock bash tools/build.sh` passes. Focused PV,
fog, VB aliases, interface, FVF lighting, supported computed lighting, and PV/VB/
strided dimensional suites all pass (nine `regression-*.json` receipts).
Final build module hashes match the accepted browser inputs. Chrome reports
ANGLE/Mesa Intel UHD 620; physical GPU execution is not independently established.
Native Windows and physical GPU validation remain untested. Computed alpha,
nonuniform-normal lighting, and historical27 qualification remain unresolved/
outside this task. No original games, held fault investigations or leased boxes
were run. Coordinator retains shutdown ownership.
