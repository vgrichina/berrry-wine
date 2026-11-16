# LTris line-clear attempt: missing original media

The 2026-11-14 task stopped during filesystem preparation. Neither the registered
`test/binaries/candidates/ltris-128` fixture nor the documented original directory
`scratch/runs/20261018-ltris-source/original/ltris-1.2.8` exists locally. The
original README, COPYING and controls could therefore not be read. No original
was launched, permanent guarded input bound, gesture delivered, or build run.
The SuperTux then paired GTA2 heavy-run order was left undisturbed.

Evidence: `scratch/runs/20261114-ltris-line-clear/`. Starting source identity is
`94e1a3972cf50ef2598cb27108486ee3e731d6ff`; `pins.json` records relevant source,
released read-only helpers, the existing module and authentic CRT by SHA-256.
The module pin describes an existing file, not a loaded or tested runtime.
`relevant-working-tree.patch` records the relevant uncommitted Git diff.

Both documented verifier commands failed with actual exit 1 and captured stdout
and stderr EOF: `verify-fixture.json` and `verify-original.json`. Each passed
the CRT check before failing with ENOENT on its missing LTris directory.
`required-paths.json` records the missing paths. A filename search and a separate
exact-size search covered readable paths under `/home/user`, `/tmp`, `/opt`,
`/var/tmp`, `/srv` and `/dev/shm`. The latter inspected 819,626 files and found
no candidate of either the pinned EXE size (572,618 bytes) or official ZIP size
(2,379,795 bytes). Twenty-three inaccessible system/private paths are explicitly
recorded; these searches do not prove absence inside arbitrary archives.
No download, archive expansion, replacement media, or alternate game was used.

The required recovery pins remain those in
[the registration](../ltris-registration.md) and
[the original source notes](../ltris-original-source.md): forty original files,
7,361,674 bytes, sorted inventory digest
`3478f9e208874423e61983d0a90df02d1cde36ca85ea2ef9628c79fe68181149`, and
thirty-nine exact companion mappings. The CRT is present with its required
SHA-256 `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
The original windowed route, cwd, DLL closure and registry were not edited.

The October 18 accepted lateral-control finding remains documented unchanged:
the same airborne green I moved left and then fell without further lateral
motion. Its later square-piece comparison did not prove rotation. The prior
capture directory is also absent here; this task neither re-reviewed those
pixels nor altered or replaced the historical claim. Non-square rotation,
controlled placement, a disappearing completed line, native lines/score
increase, settled outcome and native Quit remain **UNPROVED**. There is no new
gameplay screenshot or claim about browser parity, audio, FPS or full27.

Only this report is published. Evidence records actual preparation subprocess
waits and both EOFs; native/watchdog waits are not applicable because no runtime
started. Box ID none; state NOT_CREATED; expiry null; stop receipt not applicable.
Free `/home` space remained above 1.5 GB. No helper, config, board, piece, clock
or score was changed, and peer work was preserved.

Next: make the exact pinned original media available locally, verify all forty
files and companion mappings, and read the original README/controls before any
newly scheduled bounded original run. This task stops at the concrete media
blocker; it does not authorize downloading or another runtime attempt.
