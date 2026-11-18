# UT GOTY idle presentation correction and install continuation

Evidence: `scratch/runs/20261118-ut-goty-idle-dialog-presentation-repair/`.

The reported idle loss is not present in the saved native PNGs. The previous
component-ready and allegedly teal-only final PNG are byte-identical, SHA-256
`3ebe8bf2648f25f47c95f6b4484f400253a67b854fdd180646d30063bb7ea79a`.
Both fresh bounded idle reproductions retain that same full dialog image.
Decoded pixels contain 234171 non-desktop pixels (531 × 441), including the
banner, guest-drawn component rows and default 670 MB requirement. The image
viewer intermittently displayed identical bytes as teal-only. This invalidates
the previous native-presentation-loss conclusion; it does not establish the
cause inside the viewer.

Passive, capped run-local instrumentation records natural repaint, surface
attachment/selection, canonical flush and final blit samples. Across idle,
the modal dialog remains HWND 0x10001, generation 1; the component control
remains 0x10030, generation 48, with focus 0x10002 and main HWND zero. The
desktop blit is followed by the live dialog surface with intact sampled
pixels. No causal ownership/damage transition losing the dialog was observed.
There is no supported production repair, and no forced main window, redraw,
focus, guest painting replacement or guard relaxation was made.

The two initial trace scopes were conservatively closed UNKNOWN after the
misleading viewer display, before byte comparison corrected the inference.
They were never queried after closure. A third scope's component-next attempt
was refused before consumption because the reviewed scene changed. Its
review text incorrectly described components while the captured page was
still destination; that review is withdrawn. Independent physical UP was
acknowledged, the scope closed, and that action was not replayed there.
A separate fresh scope waited for the actual component page, consumed its
ordinary Next, and reached the ordinary Install page with the default
C:\UnrealTournament destination and inherited D:\ source unchanged.

Validation: locked `tools/build.sh` passed. Existing scene-context unit,
DialogBox timer pump and show-after-init tests passed. The authored retained
component storage/guest owner-draw test passed in direct native and normal
CPUWorker modes against the unchanged b9b3ba8e module. A new scratch fixture
attempt failed its no-main precondition (the authored dialog promoted main
HWND 65537), before its idle checks; it supplies no old-fail/new-pass evidence.
No such regression claim is made without a reproduced production defect.
Two mistaken test invocations (missing filename / required fixture arguments)
are retained separately from the successful checks.

The unique CD1 ISO remains unchanged, SHA-256
`e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`.
Runtime module SHA-256 is
`b9b3ba8e195212293e955e778292aef27a0b73817179b12fc1620e272a3ecef9`;
it is the prior component-page module, not the later shared-tree build.
No media copy, configuration/registry patch, guest patch, Wine reference,
box, worker or held-title investigation was used. Source recovery uses Git
and recorded binary diffs; unique input/module recovery is documented in the
run. Foreign host/render/NE overlays and AoW2 callback edits were preserved.

Free space recovered to 2356281344 bytes before Install, leaving 1653735424
bytes after the conservative 702545920-byte expanded requirement. The independent
100 ms disk watchdog retained a 2087653376-byte minimum for this scope.
Ordinary Install was genuinely consumed at 1794992761070 ms through
`native-dialog-input-invocation-return` (dialog generation 1, input token 5,
invocation 116); independent UP acknowledged at 1794992761.378 seconds and
its child actually exited 0 with both EOFs.

The automatic first post-Install capture then refused both HWNDs 0x10043 and
0x10044, class 17, with `control.progressUnavailable`; there were no context
failures. This is the precise next blocker. The scope closed UNKNOWN at
1794992761.391 seconds, with no later runtime endpoint or replay. Filesystem
cancellation stopped the partial installation; the overlay flushed 16 records,
including genuine installed Core.u/Core.dll files, but installation completion,
original game startup, and ordinary Quit are unproved. Native, supervisor,
watchdog and enclosing owner each have actual exit-0 waits and both stream
EOFs. The enclosing launch tool also returned 0. The owned board watcher was
terminated separately and its enclosing tool returned 143; that is not a game
Quit result. No box was created (ID/expiry/stop receipt null).

`control.progressUnavailable` is a fail-closed qualification result, not enough
evidence to distinguish missing/uninitialized/subclassed native state from an
out-of-range value or identity failure. The snapshot was refused before saving
the progress fields, so those possibilities remain unproved. Continue with an
authored native + CPUWorker progress-control reproduction and bounded diagnostics
of the failing qualification predicate before another original run. Preserve
the retired/subclass guards; do not widen acceptance from class alone. No further
original run was attempted after this UNKNOWN.
