# Redline observed fixture 1375: blocked before allocation

The published `14475fc9f` startup-boundary preparation refused its retained
1235 provider pins before creating run inputs. No fixture, browser, input,
capture, allocation or qualification experiment ran. Native cause is UNKNOWN;
there is no fixture PASS or new runtime lifecycle receipt.

The retained compatibility module requires SHA-256
`bf7aa00db5459f0bd1f4721c31e7c96a03c80ffd4a4339891e7b487abd70f462`;
the retained primary module requires
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Concurrent Q2 1365 builds replaced both shared binaries. Preparation first
observed compatibility SHA `cec17da64bca0e3b57d13e4bd4d8131a80a3ac3f94e82e61c12583fc1a3d4b21`;
the retained diagnostic attempt later observed
`a5d7569b2315787832b7e1e720aca05e4de8012c809ac7a7e7896a29452d057f`.
The separate pin audit also records changed `src/05b-string-ops.wat` and the
primary module. No current module was substituted. A filesystem search of
existing checkout `.wasm` files found neither required module hash.

The published helper checks all retained pins before creating the destination
or spawning anything. Its failed preparation returned 1 with actual wait and
separate stdout/stderr EOF; `prepared/` remains absent. `--check` passed.
Git comparisons confirm the startup helper and native-trace provider exactly
match their requested published revisions. Existing 1355 fourteen inert and
six whole-controller proofs are referenced by path/hash; none were rerun as a
separate qualification. The 1325 cleanup provider remains unchanged, and its
postterminal composition was unnecessary because no native lifecycle began.
No startup bound, launch flag, 100-wait/101-stat loop, fixed ten-second trace,
cleanup behavior or shared provider was changed.

A read-only API request verified predecessor `bx_8w34tbhg`, UUID
`25fdf3f2-f616-4e3d-a301-b9d496c0a624`, is archived with completed unforced
`stop_cc4d683a58df369d`, ended `2026-11-09T12:45:36.383Z`.
The board records PHYSICAL_DRAINED. Final `archiveAfter:null`; `expiresAt`
was not returned. Initial expiry was `2026-11-09T13:03:57.076Z`.
It was neither resumed nor stopped again. No new box ID, UUID, expiry, stop
receipt or watchdog join exists: allocation prerequisites failed before a
watchdog or runtime was needed.

Evidence is `scratch/runs/20261109-redline-observed-startup-fixture-1375/`:
Git base, relevant uncommitted WAT patch, provider/proof hash references,
preparation stderr and wait, composition check, exact API response, existing
module search, result and SHA-size seal. Git plus the small note patch is the
recovery source; no source archive or media/module evidence copy was made.
Free `/home` exceeded 1.5 GB. Only this note is committed; no code changed,
so no build or focused code tests were required for this documentation result.

Next: supply the exact reproducible historical modules, or explicitly prepare
and review a coherent replacement module/source pin set, then rerun the fresh
no-spawn preparation before the sole finite leased fixture. The requested
native fixture remains unperformed. SingleTaskSTOP.
