# Assigned-box recovery recipe

Current retained box: `bx_5mu9dnhg`, root
`/home/user/shadow-man-original-oct22`. Coordinator owns lifecycle; leave it
running. Expiry 2026-10-22T10:48:47.315Z, handback by 10:28, shutdown checkpoint
10:38. This receipt does not grant a new runtime attempt or new compute.

The complete original ISO and all extracted material are retained remotely.
Recover originals from this retained tree under the coordinator's next
assignment. `HANDOFF.json` identifies paths/hashes and confirms no owned
guest processes or open controls remain. The local `raw/` archive preserves
evidence only and is not a replacement media backup.

On an assigned host with enough storage, the exact accepted acquisition was:

```sh
bash receipt/recover-source.sh --coordinator-assigned-remote /home/user/shadow-man-original-oct22/recovery
```

This directory must be new. The helper verifies 674328576 bytes and whole ISO
SHA-1 `f985ca1349af958f886957aa662e87956a7db22d`, writes fresh SHA-256,
extracts `Demos/Shadowman/*` and `Diverses/Directx6/*` preserving hierarchy,
then verifies every source member and the ten earlier member hashes. The
fresh verified ISO SHA-256 for this task is
`db9ca33413c53d2d333a3d4b2e220d19daab625526d8acf55c1f11e780b28a12`.
Stop on source/hash mismatch; no substitutions. Require at least 5129633792
free bytes before recovery and remeasure before another expansion.

Native inspection actually used the original CAB, with list/test/extract
under separate finite 255-second TERM/260-second KILL limits:

```sh
unshield l recovery/source/Demos/Shadowman/data1.cab
unshield t recovery/source/Demos/Shadowman/data1.cab
unshield -d native x recovery/source/Demos/Shadowman/data1.cab
unshield -d support/sys1 x recovery/source/Demos/Shadowman/_sys1.cab
unshield -d support/user1 x recovery/source/Demos/Shadowman/_user1.cab
```

`audit-source-v2.py` on the box is the successful native audit; the local
`audit-source.py` contains that same corrected logic. `audit-source.py` on the
box retains the first parser failure for provenance. Never flatten/lowercase
the native source hierarchy or fabricate registry/config files.

`stage-runtime.py` inventories and verifies the canonical archive/module and
matching source, then copies the already pinned original AoE3 runtime/runner
to this task's new root. It is task-specific, not a general replay command;
it deliberately rejects existing output files. No build is part of recovery.
`runtime-expected.json` on the box and local runtime/runner pins identify the
exact module, API table, native support, fonts and dependencies.

The sole original execution was:

```sh
python3 /home/user/shadow-man-original-oct22/launch-stage.py
```

The driver deliberately requires a fresh `setup-run/`. Its saved command in
`setup-run/command.json` is authoritative. It runs original Setup from the
intact directory, supports actual guest children, saves registry/VFS and
captures the first error. Internal bound 240 seconds, external TERM255/KILL260,
owned-process cleanup. After inspection, the existing control endpoint's
ordinary harness `quit` ended this run without accepting/clicking anything.
No rerun occurred, and the first Error112 blocker is retained unchanged.

To replay local evidence without runtime:

```sh
python3 scratch/runs/20261022-shadow-man-original-recover-runtime/verify.py
```

`collect.py` retrieves bounded logs, manifests, registry, screenshots and the
69632-byte partial engine file, seals them against the remote bytes and
preserves the compressed evidence archive. `final-audit.py` rehashes originals,
verifies source-in-VFS and native integrity, checks owned process-group absence
and control ports, then writes handoff. Neither performs lifecycle operations.
