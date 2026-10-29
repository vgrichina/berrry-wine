# GLTron integrated original-media static acceptance, 2026-10-29

Functional result: PASS for the exact production analysis API and actual CLI at
`00f76bfc8bfa5b99a778014cc0e89f3700f65393`. This closes the original-media
static-analysis gap left by fixture-based integrated acceptance. It does not
qualify runtime, dynamic LoadLibrary closure, gameplay, crash recovery, or
concurrent-reader publication atomicity.

The tested production file is `tools/recovery/gltron-original-win32-recovery-oct28.py`,
18,887 bytes, SHA-256
`aa7d8c7668a6ea466f2099bb1966d8f725ed660c47fcf961826e35f9c19be53d`.
The original 3,658,814-byte archive SHA-256 is
`8956abae4e4fe6ebc45b97d58c9254789e0a1457d11c58e4dbb90aead45a3eb3`.
All 92 retained extracted files were copied into the owned task directory and
verified against the pinned inventory hashes. No download, extraction,
installer, guest, browser, build, or Boat operation occurred.

The unmodified API `analyze(archive)` and CLI
`python3 -B tools/recovery/gltron-original-win32-recovery-oct28.py analyze ARCHIVE`
each independently replaced a deliberately marked prior inventory/closure pair.
They used the real installed `/usr/bin/objdump -p` for all 11 PE modules, with no
verification, tool, or publication substitution. Both produced the exact retained
inventory (92 files, 4,968,893 extracted bytes) and closure (11 modules, no
unresolved static imports), including identical serialized output hashes:

| Output | SHA-256 |
| --- | --- |
| inventory.json | 0f5c45647ac8d26104d01d4e052913382aaa9d73a3c6bc31339529a60508b341 |
| closure.json | 179270655ca581ba88ebc56f0eeef8dec01ac7fd0e8143b8a1f8ecf8f14db135 |

Both successful calls removed their `.analysis-pair-*` staging directories.
Publication paths are adjacent to the supplied archive, not in the repository.
Static objdump logs remain under the owned payload's `static/` directory.

One failing-analysis control changed only the first two bytes of the owned
`app/MSVCR70.dll` copy and updated that member's listing Adler32. This let the
real full inventory validation pass, then reached the real `pe_machine` check,
which rejected `invalid DOS header`. The prior successful inventory and closure
remained byte-for-byte unchanged; no pair staging remained. Original DLL and
listing bytes were restored and checked. This control used no mocks.

Reproducer and retention:

- Owned task root: `/tmp/gltron-integrated-real-media-analysis-oct29`.
- Pinned dispatch and admission: the task-named dispatch JSON and
  `real-media-three-oct29-admission.json` in the host `scratch/usage-watch/`.
- Committed recipe files: `docs/recipes/gltron-integrated-real-media-analysis-oct29/`.
  `setup.py` records containment, exact empty mount parsing and Node startup,
  initializes only the owned sparse Git repository, and copies pinned media.
  It intentionally rejects an already initialized repository; it is a fresh-task
  recovery recipe, not an instruction to rerun setup over retained evidence.
- After authorized staging, the tested sequence is `python3 -B accept.py` from
  the task root with its colocated `supervisor.py`. It runs API, actual CLI,
  output comparison, and the single failure control in that order. The committed
  copies are byte-identical to those tested at the task root. The acceptance
  script itself is `test/gltron-integrated-real-media-analysis-oct29.py`.
- Canonical handoff: `evidence/receipt.json`, with input pins, per-operation
  admissions and stdout/stderr, checkpoints, publication, and cleanup bindings.
  Retained acceptance JSON copies accompany the committed recipe.

Resource admissions retained the four-owner 125,829,120-byte projection, required
3,175,088,128-byte remaining free space, and 2 GiB MemAvailable floor at each
supervised operation. The 48 MiB allocation includes owned copies/Git/evidence,
session/events, positive shared WAL growth counted once, and an 8 MiB reserve.
Python children received 128 MiB DATA and physical RSS limits, Git alone received
256 MiB DATA, process groups had 512 MiB physical RSS, CPU 90 seconds, wall 120
seconds, file 12 MiB and capture 2 MiB bounds. Node's empty-parser startup had no
Git/Python DATA cap; its exact executable, heap flag, inherited limits and
environment configuration were recorded. No resource cap was increased.

Procedural exception: some initial read-only policy/source inspection tool
responses exceeded the requested 8192-byte terminal bound and were truncated by
the tool. This is retained as an inspection-output incident, not represented as
a clean all-controls acceptance. Production analysis captures and resource
admissions passed; no production-source counterexample or runtime claim arose.

Root refs/index and predecessor sources, wrappers, media and evidence were not
modified. No board append was made; `publication-note.txt` is for coordinator
delivery. No box was assigned. Allocation and owned copies remain retained for
coordinator closeout; there is no automatic deletion or shutdown.
