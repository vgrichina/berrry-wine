# Serious Sam production headless GL attempt, 2026-11-05

Production gameplay remains unverified in this attempt. The first missing
prerequisite is authenticated SSH to the assigned runtime, not an observed
emulator fault. No guest execution, staging, media transfer, build, focused
executable test or shared source edit occurred.

Allocated input was main `3b66c1c39`; inspected main was
`382ccb923be12a1ad07bed41c229da7df573c5fd` (allocation documentation added).
Accepted REP commits `b786b78da`/`eadf70fd5` and DLL mapping commits
`3343777ea`/`e01a20635` are ancestors. Their acceptance is preserved; this
attempt did not repeat their tests. Other agents' D3D edits were left alone.

The canonical manifest and SeriousSam.exe/Engine.dll/Game.dll/Entities.dll
paths, sizes and SHA-256 values were rechecked against
`scratch/runs/20261105-sam-launch-preparation/prerequisites.json`.
The current registry mounts the package through the manifest, seeds the three
DLLs, sets `C:\Bin` as cwd, enables `reservedPageFaults` and
`asyncMultimediaTimer`, and disables uops. The entire Disk1 tree is required.
No acquisition or media copy was necessary locally.

The migration-era fault remainder is not a current launch recipe. Current
`rep_fault_sync` passes the REP PC, published progress and write kind through
the synchronous mode-5 fault path; `rep_fault_checked` checks full elements
and retries after a successful filter. Generic mode-5 scalar misses still run
a synchronous reserved-page filter and retranslate; an unrepaired miss uses
the sentinel. Scalar offers still report read kind. The asynchronous walker
still recognizes C++ handlers using first byte B8 and MSVC frames using a
shape heuristic. Those generic/classifier limitations remain separate
contracts, without a new original-program failure demonstrating that they
block this route. No diagnostic transform, all-AV raw routing, forced route,
guest byte change or same-block SMC work was attempted.

The sole attempted runtime access was:

```text
boat ssh bx_72mzdfcs -- '<read-only date/platform/Node/Xorg/Xvfb/Chrome/path/disk/module prerequisite checks>'
```

The exact requested command is retained in `attempt.json`. Boat returned:

```json
{"code":"api_key_action_forbidden","error":"This API key cannot perform ssh.","event":"error","status":403}
```

The response log was written at **2026-11-05T11:12:58.623574867Z**; the API
server's event timestamp is undisclosed. No alternative access method or retry
was attempted. This is an access rejection, with no evidence of an emulator
content-policy flag. The allocation explicitly requires stopping if
authenticated SSH/setup cannot be established. The coordinator was notified
on the messageboard for Telegram follow-through.

Evidence is in `scratch/runs/20261105-sam-production-headless-gl/`: raw access
response, box metadata, verified prerequisite hashes, relevant source hashes
and binary diffs, this new document's patch, and final result/cleanup metadata.
No screenshots exist because the emulator never launched. No source archive
or duplicated media was created.

Next causal step: the coordinator must supply credentials authorized for SSH
to the leased box, or explicitly assign a supported access method and a fresh
runtime allocation if needed. Before future execution, establish Node/native
headless GL/Xorg readiness and stage only the minimal runtime closure, current
module and hash-identified canonical media. Shared code/tests/builds still
require D3Dclip1010 then RFworker1020 FINAL RELEASE.

Runtime `bx_72mzdfcs` was left untouched and running (Boat state `idle`),
expiry `2026-11-05T13:11:54.615Z`. Shutdown ownership returns to the coordinator.
This worker created no remote or local runtime processes and holds no build
locks. No gameplay/menu/movement/combat or emulator repair is claimed.
