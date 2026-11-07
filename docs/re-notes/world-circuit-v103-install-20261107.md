# World Circuit v1.03: original installer requires a floppy source

Run: `scratch/runs/20261107-world-circuit-v103-install/`; owner Telegram177.

**Installation and user-controlled driving remain blocked.** The original
INSTALL.EXE reaches its installation menu and accepts Full Game Installation.
Its next screen requires a source floppy drive, offering **A:, B:, or Cancel**.
The existing native ToyVM DOS runner mounts only C:. This is a real media-mount
requirement, preserved without rewriting the installer, synthesizing installed
files, relabeling C: as a floppy, or substituting the demo.

## Original media and workflow

The [source note](world-circuit-v103-source-20261107.md) pins the ZIP and all
three FAT12 images under `scratch/game-media/world-circuit-v103/`. All four
hashes were verified again; the source bytes were unchanged afterward. Read-only
FAT traversal recovered each root file's size and SHA-256 in
`extracted-files.json`. Temporary extracted copies were removed after inspection;
recovery uses the pinned images and the FAT reader in the retained driver.
No source tree or media archive was made in the run.

Disk 1 contains INSTALL.EXE (96,163 bytes, SHA-256
`e4d0e821c511f39218239c33fe1d3cad6a8920dbdbd3335d0e408294f6f73df2`),
MPSCOPY.EXE, MPSLABS.IDX, README.TXT and F1GP.001. Disks 2 and 3 contain
F1GP.002 and F1GP.003 respectively. Retained string inventories show the
original index names GP.EXE, track files, sound data and batch files. The
installer names MPSCOPY.EXE as its copying child, includes disk-insertion
prompts and defaults to `C:\MPS\GPRIX`. These are static observations, not
verified installed entry points or an installation recipe that has completed.

The original menu offers full (6.28 MB), medium (3.77 MB), small (2.19 MB),
README and Exit. A single Enter DOWN, followed by its independent UP, selected
full installation and reached the floppy-source prompt. The final reviewed
capture is `retrieved/output2/full-install-enter-up.png`. No source-drive
selection or destination confirmation followed. No guest output files were
created. No corpus source or manifest registration changed.

The unmodified README's Quick Race/Main Menu routes remain relevant only after
successful installation. Neither was reached. A/Z/angle-bracket/Space driving
controls were not sent; there is no speed, gear, steering or displacement proof.
The [demo's key-drain limitation](world-circuit-driving-20261107.md) was not
repeated as a game test.

## Runner boundary and validation

Static checks preceded the one fresh box. `tools/toyvm/dos.js` resolves only
C: paths, leaves C: current when an unavailable drive is selected, and returns
error 15 for A:/B: current-directory queries. `checkpoint.js` exposes file and
directory mounts, with no floppy-image mount or disk-change interface. The
run's `mount-capability-check.cjs` reproduces those A:/B: limitations against
the unchanged native Machine. The existing DOS path suite passed all 24 groups,
including both shipped browser bundles. The locked main build also passed:
`flock /tmp/wine-build.lock bash tools/build.sh`.

An initial wrapper ended a confirmed startup after conservatively treating
`cache.unimplemented` entries as executed failures. Inspection of `dos-loop.js`
shows that map includes speculative decode followers. The retained disassembly
shows inline data after the call at 0326:0109, including the reported 010e
location; the session had continued to the installer menu without a runtime
refusal. The wrapper was corrected to stop on actual runtime refusal or
unhandled services. The unchanged installer was restarted on the same box,
before any UI input. This known startup restart is recorded explicitly; no
UNKNOWN command was replayed. No CPU fix is justified by the speculative map.

The second session reached 1,425,004 dispatches, with no unhandled services,
CPU faults or stuck stop. Its run, DOWN, independent UP and terminal quit each
received an exact ordered ACK; held keys were empty at quit. Both guest
processes exited. No ports or browser profiles were opened.

## Evidence and lifecycle

Actual runtime source commit:
`84bfa2e4b4cb89a3515a3dfabd7f919c15388a55`. Relevant source diff,
owned helper/note patches, original-media references and actual modules are
retained. Runtime/media/helper pins passed before and after execution (137
initially, 138 with the corrected helper). Node v24.22.1 / V8
13.6.233.17-node.58 used `createMachineRunner`, `DosSession.step` and the
production PNG renderer with default CPU/devices/clocks and no guest arguments.
Both sessions emitted module SHA-256
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`.

All 38 remote artifact references, 28 unique contents totaling 2,941,615 bytes,
were retrieved and hash/size verified before the task's requested prompt stop.
Evidence includes reviewed captures, console/state records, native module and
boundary memory. This unregistered title uses `run-summary.json`, without an
unrelated dashboard candidate.

One persisted UUID created **bx_gfe73dve** at 22:38:30Z with more than 5 GB
free locally. Detached normal-stop and 25-minute watchdog delegates were armed
before allocation; initial expiry was **2026-11-07T23:03:29.844Z**. After
retrieval and process checks, normal stop **stop_d97724824c22a785** completed
at **22:41:20.068Z**, `forced:false`. Final state **ARCHIVED**, expiry null;
custody returns to the coordinator. Both delegates exited zero, their supervisor
finished with no remaining children, and owned local watchers were closed.

Next: provide a genuine A:/B: read-only original-media mount and disk-change
workflow in the native DOS route, with focused drive/filesystem tests, then
run INSTALL.EXE through its own copying and configuration steps. Register only
the resulting verified installed files. There is no public deployment, FPS,
audio or parity claim.
