# Enigma supervisor launch blocked before guest

The exact accepted supervisor cannot satisfy the mandatory separate-stream launch diagnostic contract. No Node startup check or production guest was launched, and no actual menu, ACK/frozen-zero, StartGame, gameplay, or ordinary Quit was obtained.

At accepted main `b2922b17dd6b62f4129fc87fd03b0e1df269ba4a`, `tools/enigma-supervised-gameplay.py` SHA-256 `6f00afae565b32114cc6b78d9b806348d2195ff69122e345aabaf09493b5960c` passes `stderr=subprocess.STDOUT` at both startup Popen (270–272) and production Popen (292–294). Both streams become one pipe before `output.log` is written. Redirecting the outer Python CLI stderr cannot recover child stream identity. The exact launch schema at line 70 has no alternative stderr/output setting. Source changes and runtime monkeypatches are outside this task.

The launch diagnostic checkpoint in `scratch/usage-watch/coordinator-policy.md` requires “bounded stdout AND stderr to distinct owned files from process creation, including failed spawn/setup.” This is a source contract mismatch before the scarce guest attempt, not a guest/emulator failure. A separately authorized supervisor repair and affected acceptance are needed before this exact production qualification can proceed. No allowance was consumed or renewed.

The local AST check verified both Popen sites and the schema, the two accepted supervisor/controller hashes, fixture-example identity, the exact production runner and host-imports, and retained canonical module. It exited 0 under the 128 MiB physical / CPU90 / wall120 / file24MiB / output2MiB light supervisor, with cleanup complete. Previously accepted 60 paired cases per backend, 28 controller tests and prior 79-step production initialization were not rerun; those receipts do not qualify the new supervisor path or gameplay. No builds, dependencies or full runtime copies were created.

The immutable 2,663-row / 37,486,692-byte runtime map is referenced by SHA-256 in `source-diagnostic-check.json`; the coordinator's dispatch full rehash is reused. The canonical filename/tree mount parser, remote closure staging/hash check, exact Node environment/limits startup, and production launch configuration were not run/constructed after this prelaunch rejection. No production checkout was materialized. This branch is an isolated, sparse, evidence-only root commit, with read-only donor objects available through an alternate; it is not a runtime implementation or a main merge candidate.

Bounded supported Boat API command `cmd_ra3i4pnntjco` completed successfully at 2026-10-27T03:37:28.562Z on `bx_xs97h52x`; no production Node `test/run.js` processes were present. No task guest/supervisor PIDs exist. The box remains RUNNING and is handed back to the coordinator: guest cutoff 04:05, handback 04:10, coordinator snapshot-stop 04:15, expiry 04:33:22.349 UTC. No stop/resume/SSH or other box action was performed.

The local allocation remains 32 MiB, including sparse Git/ops 4, captures 8 (unused), external events/session/positive WAL growth 8, transfer/publication 4, reserve 8. Accounting receipts measure actual owned and external files, reserve positive WAL growth from the recorded baseline, and retain both peers' remaining reservations once. WAL growth before the first worker baseline is not attributable; remaining external allowance stays reserved. The remote 256 MiB allocation is unused by runtime staging; the read-only API probe created no persistent runtime files.

Reproduce the static diagnostic check without a guest:

```sh
python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 1 --wait 30 -- \
  python3 /tmp/enigma-supervised-streamed-production-gameplay-oct27/ops/admin.py static-check \
  python3 /tmp/enigma-supervised-streamed-production-gameplay-oct27/ops/check.py
```

The published checks and JSON evidence describe an unlaunched runtime explicitly. `result.json` is written after the evidence manifest. Publication commit/remote-ref receipts remain in owned ops and the append-only repository messageboard to avoid a self-referential commit hash.
