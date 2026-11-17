# Caesar III pinned source and city growth, 2026-11-17

Run: `scratch/runs/20261117-caesar3-sealed-host-city-growth/`.

The pre-guest adapter rejected published d112 host imports because the shared
worktree contained newer published imports. It also enumerated mutable `src/`
while compiling sealed sources, admitting names absent from the selected Git
revision and correctly refusing their unsealed bodies. Neither refusal started
an original game.

The adapter now resolves explicit component revisions to full Git identities
and selects host imports directly from Git in qualification and original modes.
The source view enumerates `src/` names and existence from its verified index;
source digest checks, descriptor seals and child inheritance remain enforced.
Python helper execution still requires its published body. Owner proof reuse
checks the original proof's adapter hash against its later c268 publication and
requires exact AST bodies for supervisor, watchdog, readiness, controller and
native lifecycle functions. The historical proof's component label predates
publication; its recorded adapter digest identifies the tested body.

Focused fixture: `test/test-caesar3-pinned-source.py`. It checks selected host
and generated map hashes through the real Node preload, exact component graph
and module reuse, pinned directory enumeration, exclusion of the newer typelib
fragment and refusal of substituted host bytes. `pinned-fixture7/proof.json`
records the positive and negative child waits and both EOFs.

`fixture2` freshly compiled exact module
`9099bb3f694d5ec6dac2886b70c1920fa33f39ad9258b1e662d1ebe05dc2da0a`
and ran an authored native PE for eight seconds through the unchanged persistent
owner and outer supervisor. Native, outer, owner and independent watchdog waits
completed with both EOFs and an empty outer runtime scope. No game qualification
loop was repeated. `fixture` retains the initial fail-closed directory leak.

The locked build initially encountered concurrent callback metadata integration,
then three upstream media-size metadata mismatches. Foreign owners repaired
those shared gates; no foreign source or media was changed here. Final build
and original outcome are recorded in the run's final `result.json`.
