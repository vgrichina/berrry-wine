# Original TuxRacer 0.61a launch registration

Base: `4f48ba55572815d015ec9ac15f1f1284f770b40d`.
App ID: `tuxracer_original_061a` (local only).

The registry names the genuine `tuxracer.exe`, bundled `TCL83.DLL`,
`SDL_mixer.dll`, and `SDL.dll`. All 158 original files (13,225,945 bytes)
are pinned by size and SHA-256 in `test/candidate-corpus/tuxracer-original-files.json`.
The registry pins that inventory's bytes. The existing shared loader verifies
all bytes before compilation, PE loading, or VFS mutation, including the EXE
and explicit DLL seeds. Data and DLLs retain their original directory layout
under `C:\tuxracer-win32-0.61a`; that directory is the working directory.
`tuxracer_init.tcl` records `[pwd]` as its data root. No Tcl is evaluated here.

Stage from the retained, previously verified extracted payload:

```sh
python3 tools/recovery/stage-tuxracer-original.py /ABSOLUTE/EXTRACTED_ROOT
```

This creates exactly one destination:
`test/binaries/candidates/tuxracer-original-061a`, with `game/` and the local
media manifest. It refuses an existing destination. It verifies the complete
source inventory before creating the destination, verifies each byte buffer
again before writing, rejects escaping/symlink/missing/corrupt input, and
publishes the manifest last. On staging failure its newly created destination
is removed. The media are neither committed nor copied into a shared tree.
The usual registered launch selector is `--app=tuxracer_original_061a`;
no guest launch was performed by this task.

## Focused validation

```sh
node --max-old-space-size=48 test/test-tuxracer-original-registration.js
python3 test/test-tuxracer-original-staging.py /ABSOLUTE/EXTRACTED_ROOT
```

The first behavioral group executes the byte-exact `getAssetFiles` function
from pinned production `test/run.js`, invoking real `lib/app-files.js` through
its normal registry contract. It verifies all original sizes/digests and VFS
paths, the EXE, DLL seeds and working directory. It rejects missing and corrupt
EXE/DLL/initialization/course-index inputs, escaping host URLs and VFS paths,
and missing required manifest rows. Returned mount buffers are verified bytes.
The staging group rejects missing, digest/size mismatch, path escape and symlink
inputs without a second media copy or any write to retained media.
Both groups passed under the task supervisor. `git diff --check` passed.

## Scope and retained evidence

Computed/general Tcl closure and full-media static closure remain **UNKNOWN**.
Registration is not runtime, rendering, playability, or gameplay acceptance.
Original recovery and scanner acceptance were reused unchanged; neither broad
suite ran. No build, browser, game, guest, Boat, FUSE, download, installer,
public deployment, or Tcl execution occurred. No test box was assigned.

Canonical dispatch inventory SHA-256:
`9ac1ac56933cbeae45b0ada2162af298dbc768a5f82a0e2131faa218b0644dc5`.
Scanner SHA-256 (unchanged):
`17536ba93021a4d7061b542876eaecef6f1f716fa3e420ef283b2804c50b6c04`.
Prior accepted media/scanner evidence remains at the dispatch's original paths.

Task-local `evidence/` retains initial session/WAL/inherited limits,
per-operation disk/RAM admissions, containment negative controls and owned
sentinel, Node startup limits, loader/source/test pins and focused results.
The initial supervisor setup incorrectly lowered its own DATA hard limit,
preventing Git child setup before Git executed; this was corrected in the
same task by preserving the inherited supervisor hard ceiling and applying
DATA limits to the proper child only. Original incident evidence is retained.
Initial read-only policy inspection also produced an overlong terminal result;
subsequent outputs were narrowed. Neither incident is a gameplay result or a
resource-admission denial. Publication/cleanup and exact remote verification
are bound separately by task-local `receipt.json` and `publication-note.txt`.
Independent acceptance is required before main integration.
