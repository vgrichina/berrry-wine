# Aranna EULA/title diagnostic, 2026-11-07

The original registered demo passed EULA and rendered the title, but did not reach
Main Menu or a map. The repaired run-local route is validated. The remaining
causal boundary is the title animator's completion path to its installed state-5
callback. No emulator CPU, Win32, input or clock defect was demonstrated, so no
emulator implementation was changed.

Evidence is retained in `scratch/runs/20261107-aranna-eula-title-diagnostic/`.
This follows `aranna-title-transition-20261107.md` and the earlier successful
`aranna-acquire-before-arm` notes. The earlier rejected guest-coordinate click
was a harness error, not evidence of an emulator defect.

## Reproduction identity and controls

One fresh UUID Idempotency-Key created box `bx_ean6556p` at 05:08:07Z. Base source
commit: `d14a8e882f9cee83408ba67587591f90bd921957`;
`runtime-dirty.patch` and `untracked-wininit.patch` retain relevant dirty runtime
source. `runtime-pins.json` identifies 2,087 runtime/helper/media files by size and
SHA-256. Media is referenced by existing path and hash, not copied into evidence.
The retained qualified observer WASM SHA-256 was
`e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31`;
the owning Worker module was inspected, rather than inferred from a staged file.
Puppeteer 25.7.0 and Chrome 151.0.7922.108 passed rendered smoke before the original.
`browser-smoke.png` was personally inspected. The predecessor used a different
Chrome patch release; these are this run's actual bytes and version.

Before the single heavy original launch, two generated-shell sessions used the
actual retained browser driver, queue, completion protocol and observer:

- Positive route: `canvasclick:0.2481,0.7093` was admitted and completed. Fractions
  mapped through canvas rectangle `(10,194,661,568)` to page
  `(173.9941,596.8824)`. Guest button down/up counts were balanced (one each).
  The generated fixture's transient black response is not claimed as visible
  button activation. Quit completed, driver/Chrome exited 0, all ten tracked
  PIDs, both ports and the browser profile were absent.
- Negative route: `canvasclick:2,2` failed schema validation with
  `Error: queued fractions` before admission or effects. There was no action,
  admitted receipt or done receipt. Driver exited 1 and Chrome exited 0; all ten
  tracked PIDs, ports and profile were absent. No rejected/UNKNOWN input was
  replayed.
- Missing generated fixture and optional API/TLB/icon inputs were added to the
  run-local pin closure before original launch. A premature capture read and a
  mistaken expectation that schema rejection produced an action receipt were
  corrected by inspecting authoritative output, without retrying input.

See `control-route-approved.json`, `controls-approved.json`, both generated
session directories, and their preserved remote command envelopes. The complete
2,087-file closure passed before and after the original.

## Personally inspected original progress

The original used the corrected EULA fractions, mapping to page
`(173.9941,586.9986)` for its actual canvas geometry. It passed EULA, loading,
Microsoft/GPG/Mad Doc introductions, and reached the Aranna title over stone
doors (`response-07.png`). Ordinary balanced title Escape, Enter and center
canvas click completed. `response-10.png` still showed the title. Subsequent
passive observations `response-11.png` and `response-12.png` showed teal desktop;
the app remained reported running with no trap, focused, visible, and owning
relative pointer lock. This disappearance is observed, not diagnosed as a
renderer defect. No Main Menu or map capture exists for this run.

Two earlier review descriptions incorrectly named the intro images:
`response-05.png` is the scientist/Mad Doc image and `response-06.png` is the
Aranna title on black. `review-corrections.jsonl` records the corrections; these
were distinct completed actions, not replays. All final interpretation uses the
actual screenshots and matching state receipts.

## Read-only causal finding

The prepared owning Worker diagnostic identifies slot 0, endpoint 1, target
`EC5692A21A4A03EF62D15B3AE5977859`. It reads guest state without guest writes,
state forcing, injected guest calls or guest-byte changes. The previous run
already proved owning Escape/Enter callbacks completed; that is not a new cause.

The new center-click evidence reaches frontend member `0x4bccac` with receiver
`150089148`. The frontend's one-shot byte at `+0xe4` is 1. Following the actual
handle graph resolves frontend handle `0x40090009`, wrapper `162711416`, object
`167032348`, animator handle `0x00120012`, animator `167032084`.

Two exact-owner snapshots, at 05:17:53.220Z and 05:20:32.154Z, retain the same:

- frontend state 4; immediate request 0, delayed request 0, deadline double 0;
- animator bytes `+0x7c=1`, `+0x7d=1`, `+0x7e=0`, `+0x78=0`;
- animator clip fields `+0xc4=13`, `+0xd4=13`, `+0xd8=0`, `+0xdc=1`;
- callback record at animator `+0xf4`: `[0x4c0236,0,150089148,0x4f3cab]`.

The guest clock advanced from 545.7833295758464 to 862.8066514279344 over those
158.934 wall seconds. It is advancing; the roughly 2x ratio alone does not prove
an emulator clock mismatch. There is no pending delayed state request waiting
on a deadline in these samples.

Read-only disassembly shows `0x4bf1bb` starts the title animation and installs
that binding. Callback `0x4c0236` requests state 5 via `0x521f84` with zero delay.
The animation update at `0x69e7d0` skips its main body when byte `+0x7e` is zero.
This establishes a concrete next boundary: determine why this animator remains
in that condition and whether/where its completion callback is dispatched.
An installed callback and sampled flags do not prove it was never invoked, or
that the emulator executed an instruction incorrectly. A native/reference
comparison or bounded observation of that boundary is still needed before a
CPU/API repair. Repeating Win32 callback delivery alone will not resolve it.

The disassembly and both resolved snapshots are retained alongside the trace.
`observation-summary.json` counts 26,612 records, 24,812 broker completions, no
observer error/mismatch records. These are observer findings, not proof of
whole-program correctness or full callback coverage.

## Validation and shutdown

The generated positive/negative routes, rendered smoke, full pre/post pins,
normal original quit, and evidence SHA-256 retrieval passed. Local
`flock /tmp/wine-build.lock bash tools/build.sh` passed; it is a checkout sanity
check, not a claim that its newly built module was used in the retained runtime.
No emulator fix or implementation regression test is claimed.

Original quit completed at 05:21:03.779Z. Driver/Chrome/supervisor exited 0.
Cleanup verified all eleven tracked original/supervisor PIDs absent, HTTP 44603
and CDP 39895 refused, profile absent, all four runtime locks free. Terminal
state records the owning Worker as `retired-during-read` with `TargetCloseError`
after quit; generated-shell terminal reads also lack live Worker state. Live
matching captures are retained without fabricating terminal CPU state.
172 files / 17,679,652 bytes were retrieved with matching SHA-256, plus the two
approval receipts. Large unique traces/logs were gzip-verified before retrieval;
no source/media archive was made. `/home` stayed above 2 GB free.

Explicitly delegated normal stop completed: box `bx_ean6556p` is **ARCHIVED**,
`forced=false`, stopped at 05:21:48.269Z, no remaining expiry. No test runtime was
left running. The run ends with a precise animation-completion blocker and no
unproved emulator modification.
