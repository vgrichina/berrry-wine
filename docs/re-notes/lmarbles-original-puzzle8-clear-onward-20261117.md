# LMarbles Puzzle8 attempt: sealed-source resolution blocker, 2026-11-17

Puzzle8 clear, native tally, Puzzle9 and ordinary Quit remain OPEN. The single
authorized registered launch failed before the game loaded, before any image,
binding or input. Node exited1 because pinned `lib/host-imports.js` requires
`./gl-compat`, but `lib/gl-compat.js` no longer exists in the shared filesystem.
The file is present in the sealed published source inventory. The preloader
intercepts reads and compilation, but Node's filename resolution fails before
those hooks can supply that source. This is a local frozen-source preparation
blocker, not evidence of a guest SDL or gameplay failure.

The runtime reused published Git `a00eb35bebb621ebb3f2b42b6af18f1bd874b9f6`
without overlays. Canonical `compileClosure` plus the region-layout section
produced the same module as the earlier receipt-fence run:
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`.
The supervisor independently verified and resealed the source/module inputs.
No shared build output or foreign WIP was adopted. All86 media files, their
manifest and authentic CRT were hashed before and after; all88 are unchanged.
No source archive, repeated media, imported moves, board-memory reads, solver,
OCR, configuration/save/clock edits, worker or box was used.

The independent watchdog armed before the native child, retaining3600 native
seconds,3620 watchdog seconds and the existing300-second Quit reserve. Native
PID1950198 actually waited1 with both EOFs. Watchdog, supervisor, outer child,
durable parent and invoking tool completed0. The sole capture attempt detected
the already-recorded native wait locally; it sent no endpoint request and
latched the terminal failure. No endpoint replay, rebind or second launch was
attempted. The source/module holder closed its descriptors normally; its
invoking tool waited0. Recorded task PIDs are absent and the local port is closed.

This report changes documentation only. No production defect repair, focused
native test or new full locked build is claimed. The canonical isolated compile,
original media verifier and shutdown checks passed; the original startup failed.
Next work needs to make sealed-source filename resolution independent of live
path existence before another authorized original. Puzzle3–7 and earlier
Puzzle8 movement remain historical outcomes, not saved progress.

Evidence: `scratch/runs/20261117-lmarbles-original-puzzle8-clear-onward/result.json`.
No screenshots exist for this launch. Box ID null, state NOT_CREATED, expiry
null, stop receipt N/A. Free /home remained above1.5GB at recorded checks.
