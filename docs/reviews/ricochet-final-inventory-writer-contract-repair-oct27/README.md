# Ricochet final inventory and production writer repair

Source/test repair only; independent acceptance and integration remain required.
The isolated branch is an orphan scoped report. Extract the three tools, affected
tests and recipe; never merge its whole tree. Root tracked/index/refs were not
modified. No API, Node, guest, box, main or deployment operation ran.

The first behavioral checks retained all unchanged strict failures separately:
minimal late symlink (1793094993505441677), independent test10 symlink/hardlink
(1793094993660090218), and the exact historical API publisher prefix attack
(1793094993817367055). The originals remain byte-identical. The final helper
passes retargeted identical assertions; only source path and expected hash change.
Final test receipts and source SHA256 pins are in checkpoint.json.

The ledger now retains observed control descriptors until sampling finishes,
validates extant entries at final enumeration against original identity/version,
and rechecks regular/single-link/logical/allocated bounds. It accepts absence,
open/unlinked consumption and consumption before final enumeration; a newly
appearing or replaced extant control rejects, with lastBytes unset. The complete
24MiB control reserve remains inside the unchanged256MiB cap. This is a bounded
observation, not a filesystem quota or a guarantee against changes after return.

The production writer sets its OWN RLIMIT_FSIZE soft/hard to min(inherited,24MiB)
before encoding/open/writing. Directory-descriptor flock serializes writers;
every existing control (including dangling links) or terminal blocks publication.
One unnamed O_TMPFILE inode holds bounded UTF8 JSON, with both logical and
allocated-byte checks on each write and before publication. A single linkat
through the writer's own /proc descriptor publishes without replacing/opening
any destination. The inode has one link at publication; consumers may unlink it.
Failed encoding/writes/link publication close the unnamed inode. A directory
sync failure after atomic publication raises PublicationUncertain: retain the
complete outstanding command and never replay it. Consumer/supervisor limits
are not used as evidence of separately API-launched writer limits.

Producer closure is the FOUR actual continue.json publishers in the pinned
measured-cpu-round report: 1793092826212634802, 1793092833026763786,
1793092841347248549 and 1793092867150456577. serial.py consumes continue.json;
it does not produce it. Each original full API command and its SHA256 is retained
alongside a bounded-api command and transformed source SHA256 in producer-manifest.
Only its unsafe p.write_text statement is replaced, plus Python -B to avoid
import-cache writes; timeout, box, command payload, polling and no-replay tails
are preserved. Historical evidence is never edited. No claim covers unspecified
future producers: they must enter the same publisher and be added to the closure.

Actual production caller (it invokes the API; do not run in source-only work):

    python3 -B tools/ricochet/production-commands.py PRODUCER --bundle docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27

This CLI verifies pinned original bytes, builds the transformed argv and invokes
that argv. Tests intercept ONLY the outer API launch, assert all four exact
dispatches, then execute every exact transformed publication prefix in owned
local fixtures, including the historical exists/publication symlink attack.
They never execute a Boat/API command or its polling tail.

Executable staging recipe (requires task-owned pre-staged immutable closure):

    python3 -B docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27/integrate.py --destination STAGING --immutable INPUT-PINS.json --secondary-root SECONDARY

It verifies original supervisor and serial pins, stages accounting and publisher,
adds their immutable hashes, validates supplied inputs and transforms the exact
supervisor through the unchanged original recipe. Next owner must stage its
complete child/module/controller inputs, pin the entire closure, provide fresh
admission and lifecycle, and use this production caller for all four producers.
The historical box ID/cutoff is evidence, not authorization to reuse it.

Final authoritative writer suite has16 methods: all producer dispatch/prefix
gates, retained-file race, outstanding/link/terminal conflicts, four concurrent
process publishers, oversized streaming/sparse/allocated bounds, partial-write
cleanup, writer-limit ordering/setup failure, regular replacement/new entry,
full transformed supervisor staging entry, descriptor cleanup/content mutation,
old-inventory and unbounded-writer mutants, and committed uncertainty/no replay.
Ten affected independent methods pass, including strict link rejection and all
three consumption windows with no partial accepted inventory. Six affected
original methods rerun; unchanged22 prior method hashes and all95 prior manifest
payloads were verified, with successful original receipts reused. The final
retargeted minimal reproducer prints accepted_bytes=None.

Evidence preserves failed setup and distinct supervised stdout/stderr (.b64 is
standard base64), command/environment-safe hashes, inherited limits, supervisor
and Python identities, immutable pins and owned cleanup. checkpoint.json lists
all incidents, including the first test harness's unintended writes to three
predecessor untracked ops diagnostics. Donor tracked sources/objects and report
were unchanged; this does not claim perfect read-only handling of donor ops.

Git uses supplied strict SSH, two permits/flock, child-only DATA512MiB and
physical256MiB. Python uses one permit, trusted supervisor physical128MiB,
CPU90/wall120/file24MiB/output2MiB; no DATA/AS cap was added to Python. Owned
TMPDIR and24MiB unnamed-inode reservation keep local staging accounted. Initial
root-ref receipt is reused, without claiming a later root-ref comparison. No
mount or Node startup is applicable. No boxes assigned or accessed; lifecycle
remains with the coordinator. Independent review, scoped integration and actual
gameplay response/ordinary Quit remain unperformed.
