# Forsaken: the 56-triangle report is incomplete observation, November 21

The retained GPU24138/source7608/1 report does **not** establish 56 triangles
missing from rendering. Its published packet declares 180 vertices and 5,760
vertex bytes; the actual submission record declares 60 primitives. The pinned
`D3DIMDrawTrace.createGround` loop stops at `hits.length < 4`. Only the four
inclusive center-covering triangles13,17,18,21 are serialized. Subtracting those
four observations from60 measures unretained mesh records, not discarded draws.
The missing historical vertex bytes and depth outcomes remain unrecoverable.

Evidence: `scratch/runs/20261121-forsaken-missing-triangles-cause/`.
The emitted historical observer is recovered from Git`9bae6e181` and matches
its retained runtime pin. An authored60-triangle overlapping input reproduces
exactly four serialized hits while preserving the full5,760-byte input and
primitive count. Treating those hits as a complete mesh fails the explicit
completeness assertion. This is an observation counterexample, not a repaired
production renderer or a reconstruction of GPU24138.

The current retained immutable module is SHA256
`517057ed6b8bdba781cf05b55e4bfe17112a4c17ba82f3741217c95fafc55bbd`.
Actual `NodeRenderOwner` render Workers execute one180-vertex triangle-list
record on the production native WAT rasterizer. All60 disjoint triangles have
the expected interior pixels, both nonindexed and with reversed vertex storage
and explicit16-bit indices. Submitting only four or59 triangles makes the same
whole60 pixel oracle fail at exactly56 or one triangle. Ring retirement and
error counters pass. These negative controls detect real missing coverage;
they are not an oldFAIL/newPASS production repair. No WebGL parity or original
Forsaken mesh completeness is inferred from the authored software control.

The separate October world-collapse defect fed transformed output back through
Unlock into source vertices. Its existing repair separates the streams. The
current focused `test-d3dim-execute-vertices-sparse.js` passes18 sparse/control
comparisons, all processing modes and32 color-only refresh cycles, preserving
source and stable output positions. That test compiles the current tree with
test exports; it is separate from the immutable-module render Worker control.
The old draw/replay path was subsequently retired in favor of the WAT GPU
stream producer, so the old observer does not describe today's transport.

The retained November12 complete28-triangle unsaturated whitening analysis is
reused: actual sampling and native565 stores explain that witness without a
renderer mismatch. The all-zero texture and rounding controls were not rerun
or reclassified as bugs. Personally reviewed November18 `world-neutral.png`
and `corridor-forward-result.png` show a readable room/corridor, lives5 and
PULS2000, without a confidently identified enemy. These later frames do not
recover the old mesh or explain the entire earlier white interval.

No current renderer contract violation was isolated, so no runtime change,
new original diagnostic, input, endpoint request, Wine reference, build or
production oldFAIL/newPASS claim follows. The historical missing56 bytes issue
remains an evidence limitation; it is resolved as insufficient support for a
current missing-triangle defect. Broader original white-scene cause and ordinary
Quit13 remain unproved and separate. Joined authored/test scopes have actual
inner/outer/watchdog close receipts and both EOFs; no test box was created
(ID/state/expiry/stop: null/NOT_CREATED/null/null).
