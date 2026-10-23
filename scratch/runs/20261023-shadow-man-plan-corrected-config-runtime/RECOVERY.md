# Bounded handback

Read REPORT.md and offline-plan-fixture.json first. The full accepted plan has
224 entries (216 immutable + eight fixed), and a separate ctl-pin receipt gives
217 immutable entries. Three fixed donor files differ from their accepted pins;
staging is not authorized by this task's gate. All diagnostic fixture assertions
pass while the actual donor gate explicitly fails. Do not interpret exit 0 of
the diagnostic fixture as staging acceptance.

The assigned box bx_fn7pn7yg contains all 2,083 verified originals unchanged.
Never rerun recover.py, reinstall, or restore originals. No runtime files were
uploaded, tmpfs mounted or VFS cloned. Originals are still writable. Any later
task needs coordinator assignment; this task stops at its first concrete blocker.
Coordinator owns lifecycle; leave the box RUNNING, expiry03:46:00.580Z,
shutdown checkpoint02:50, handback before02:45. No worker spawning is allowed.

All new artifacts are in this run, with reused accepted original receipts clearly
identified. Git preserves helper/evidence recipes, not game binaries. The new
plan gate validates exact destination sets/classifications/identities and rejects
nine omissions/alterations before any upload. Donor files and accepted plan were
not edited. Prepared operate.py/prepare_runtime.py/session_runner.py are copied
historical unexecuted preparation, not qualified commands. No runtime gate,
watchdog, defaults/save/persistence/Play/gameplay acceptance is claimed.

Offline replay: python3 plan_gate.py, then python3 verify.py from this folder.
These diagnostic checks do not upload files or run a guest. collect_handback.py
is a short read-only remote integrity and healthy-running-state observation;
it compares original rows exactly and refuses unexpected mutable/runtime state.
