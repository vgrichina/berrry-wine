# Army Men licence pane: source diagnosis and bounded probe

Source-only review on 2026-10-15 of the sealed original setup evidence in
`scratch/runs/20261015-army-men-original-setup/next-run/`. No emulator fix is
justified yet. The real licence has not been answered.

The log creates hwnd `0x1002d`, id 301, class 2 (ordinary EDIT), inside licence
dialog `0x1002c`. The controller reacts to the first static instruction
containing “license agreement” and queues PNG/quit immediately. Next was at
batch 35977; the last captured batch is 35979. Thus the blank screenshot may
show unfinished initialization. There is no logged SetWindowText containing
the pane's terms; quiet API logging cannot distinguish other text-loading
messages, failed reads, or a delayed load. RichEdit streaming is not the first
suspect for this class.

Reconstructing the original `License.txt` from acquisition `original-docs.json`
as Latin-1 gives exactly 8,792 bytes and SHA-256
`a3befa2602aa870d65fd059a14619590684e803b56bc66820529da1f76512dfa`, matching
the final VFS seal. Every byte is ASCII; there is no NUL or Unicode BOM.
An encoding mismatch in those original bytes alone does not explain blank
ANSI EDIT text. The generated `_istmp0.dir/license.txt` is 358 bytes, SHA-256
`d532b726ef24d67b2dc4caa365175447171f23663f30beed866e9246630a966c`.
Its bytes were not recovered in the compact evidence, and its meaning and
relationship to the original terms remain unknown. Do not substitute either
file into the other path.

The native edit WM_SETTEXT copies ANSI text into EditState and invalidates
the control. EM_SETHANDLE/EM_GETHANDLE handlers are absent, so a real call to
those messages could explain missing content; the present log does not prove
one occurred. The reviewed `src/09c3-wndprocs5-edit.wat`,
`src/09c3-controls.wat`, and `test/run.js` hashes all match the physical source
seal of the captured historical runtime. No build or guest execution occurred
in this review.

## Prepared diagnostic

Only after the coordinator's sole remote grant:

```
node tools/army-men-licence-observe.js ROOT CAPTURE_DIRECTORY NEW_OUTPUT
```

This derives from the sealed original Welcome Next controller, with identical
child manifest, argv/cwd/registry, source/module checks, 120/150-second outer
bounds, one observed Next click, and no later guest input. On first licence
text it captures an initial PNG and waits five wall-clock seconds, then saves
the native edit text/state, snapshot and settled PNG and quits. A crash stops
immediately; failure to observe licence text stops ten seconds after Next.
Selected file, allocation, and text-message API tracing starts immediately
before Next, using existing paused tracing. No general API trace or build is
needed. The native edit dump includes total length but prints at most 8,191
characters, so its string alone cannot establish complete 8,792-byte terms.

Recover both original and generated licence bytes from the saved final VFS,
with hashes, alongside log and screenshots. First distinguish premature stop
from missing edit content. If text is populated but invisible, inspect paint,
scroll and colour state. If empty, use actual file path/return values and edit
messages to identify the failed load; only a traced unsupported message merits
a conformance implementation. No inferred or replacement terms are allowed.

Validation: Node syntax; mocked execution of the actual controller receive
callback proves Next once, no immediate licence quit, one five-second timer,
settled edit dump, and immediate crash quit. Original reconstructed bytes
match the captured seal. Execution and display result are still pending.

## Actual bounded observation: premature capture confirmed

After Outlaws' independent release, the coordinator granted this exact probe.
Fresh preflight at **14:50:28.051 UTC, 2026-10-15** verified 6,527 physical
source hashes, 187 originals, 246 captured files plus receipt/registry,
compiler closure/module, and no active runtime processes. Controller **175219**
ran 14:50:35.320–14:50:46.555, API exit 0. Guest exited normally at
14:50:41.731. Exactly one ordinary Welcome Next click occurred at batch
34183 (14:50:36.548 event receipt). No licence answer or other guest action
was supplied.

The initial licence PNG is blank; the five-second settled PNG visibly shows
the real **THE 3DO COMPANY / End-User License Agreement / Software Product:
Army Men Demo** text and vertical scrollbar. Final PNG equals settled PNG,
SHA-256 `1a9969e698f31423d89fefadfdd640e067901de79b10ebc8de7674e245834502`.
The trace opens `C:\ARMYMEN\License.txt`, reads its data, and records
`SetWindowTextA(hwnd=0x1002d, original licence prefix)` returning TRUE at API
446225, return address `0x0040c09e`. The installer then returns to its message
loop. Thus the earlier blank capture was taken before normal initialization
finished. No emulator code change is required for this observation.

The generic `dump-main-edit-state` diagnostic returned **NO EDIT**. It scans
`renderer.windows`, whose captured snapshot contains the dialog but omits its
native EDIT record. This is a diagnostic selection limitation, not evidence
of empty native text. The actual SetWindowText trace and reviewed visible
pane establish loading/rendering; the complete native edit length and every
scroll position were not captured. Neither this screenshot nor the file
recovery establishes that all terms have been reviewed or accepted.

Both actual licence files were independently recovered from final VFS:

- `armymen/license.txt`: 8,792 bytes, SHA-256 `a3befa2602aa870d65fd059a14619590684e803b56bc66820529da1f76512dfa`.
- `windows/temp/_istmp0.dir/license.txt`: 358 bytes, SHA-256 `d532b726ef24d67b2dc4caa365175447171f23663f30beed866e9246630a966c`.

The latter contains installer-author instructions to replace a licence file
in the Setup Files pane, plus hard-line-length guidance. It is a placeholder,
not the terms displayed by this run; the trace identifies the original file
as the source. No file was substituted or modified.

Independent postflight at **14:50:54.419** rechecked all source, original,
capture, receipt, registry and module hashes and found active processes empty.
The lane was released to the coordinator immediately. Local evidence is
`scratch/runs/20261015-army-men-licence-observe/licence-run/`, including
`licence-initial.png`, `licence-settled.png`, full `output.log`, controller,
source identity, input receipt, final VFS seal, and the two actual licence
files under `final-vfs/`. The compact archive `licence-evidence.tar.gz` is
732,679 bytes, SHA-256
`f2486e1ce5063f28291dc0cc7926b20019ccf47851fb8f5484a16bfec004a6a0`.
Complete generated VFS remains remotely in the original task's `licence-run`.

`tools/army-men-licence-postflight.js` seals/retrieves this evidence. Its small
real-file fixture passed archive and both-licence hash checks, plus negative
checks for active processes and modified source. Syntax/diff checks passed.
No rebuild, browser/default-Worker test, installation, gameplay, licence
acceptance, or public deployment occurred. The original installer now waits
at a readable, unanswered licence decision.
