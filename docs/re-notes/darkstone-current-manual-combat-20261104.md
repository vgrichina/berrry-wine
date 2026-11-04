# Darkstone current manual combat: preflight blocker, November 4

Neither software nor WebGL combat was launched. Preparation stopped at the
first concrete helper blocker, before browser creation or native input:
`OSError: [Errno 7] Argument list too long: /home/user/.ascii/boat`.
The run's `prepare.py:26` passed all 1,409 prepared source-pin dictionaries
plus 15 media records inline to `python3 -c`; `runtime_io.py:36` failed in
local `subprocess.run`/`Popen`. Runtime pin verification and the subsequent
JavaScript syntax/import checks therefore did not complete. No helper repair,
retry, production change, build or gameplay claim follows.

Evidence is `scratch/runs/20261104-darkstone-current-manual-combat/`.
`preflight-failure.json` records the failure; `prepare.py` preserves the exact
command construction. `remote-commands.jsonl` retains the earlier remote probe
whose guessed `test/binaries/darkstone*` path was absent, followed by the
successful explicit-path media inventory. Original media absence was an
explicitly permitted staging condition, not a game failure.

The assigned box `bx_92ssqvkw` was verified and ACKed before use at **03:02:36Z**, before the first remote command at 03:02:36.893Z.
API state was `idle` (running), health `ok`, hydrated `true`, expiry
**2026-11-04T03:42:18.748Z**. Only this box was used. All 15 original installed
files were absent there and were uploaded individually to their registered
`test/binaries/win98-games-a-d/DarkstoneDemo-D3D/installed/` paths. No media
was copied into evidence. `media-pins.json` records paths, lengths and SHA-256;
`media-postflight.json` verifies all 15 remote hashes. The original executable
is SHA-256 `b43db5e1b835eb1e93688a1f3f1d9c814517be6fc8110c7fb6e024d467ee721b`.

The prepared GLTron runtime was reused in place at
`/home/user/wine-assembly` on that box; no source archive/snapshot was made.
Its supplied source identity is
`2e802c7dfbb41dec726b7e69d580aba316cc48d2`, expected canonical module
`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`,
expected companion
`74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.
These are predecessor identities, **not actual Darkstone execution hashes**:
no module executed here, and renderer ownership is unobserved. Toolbar
selection cannot establish a backend. `source-pins.json`, `checkout-head.txt`,
`from-prepared-source.patch` and `relevant-source.patch` preserve provenance;
owned new files are also retained as patches.

The accepted October 30 manual software result remains historical evidence:
module `4649ee5f…`, EXP 0 → 79, surviving LIFE 17/35. This task establishes
no new enemy defeat, survival, manual-mode selection, renderer comparison,
FPS, audio, save/reload or full-corpus result. The intended native route
remains original F for Manual, Town → Ardyl ground clicks, then aim at the
skeleton torso; none of it was attempted in this run.

Postflight recovered the unique local logs/helpers and confirmed zero running
Chrome processes on the box. No browser was opened, so none needed closing.
The box remains RUNNING/APIidle, healthy and hydrated, with the same expiry;
shutdown ownership returns to the coordinator. No create/resume/stop/delete,
subworker, successor or public deployment occurred. A separately authorized
attempt would first need bounded file-based pin validation and successful
helper/import preflight; this task stops at the recorded blocker.
