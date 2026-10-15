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
