# LMarbles: recent transcript pool exhausted below launch floor

Puzzle 2 selection, CLEAR and next/tally remain unproved. Observed the assigned
`recent-closed-transcripts-nfs-driving-1030` resource phase while its worker
PID 1016022 was still live; did not wait for the whole NFS task. Eight recent
canonical closed transcripts were recovered, distinct from the parent's
exhausted event pool. The phase reports 18,788,936 raw bytes, 10,097,911 encoded
bytes and 8,474,624 bytes net recovered including its then-current evidence.
All eight assigned raw targets are exhausted. The phase recorded 1,487,958,016
bytes available. One fresh post-phase check measured 1,487,089,664 bytes,
12,910,337 bytes short of strictly above 1,500,000,000. No floor polling or
native launch followed. Shared capacity changes are not attributed to this task.

Evidence: `scratch/runs/20261113-lmarbles-native-selector-1035/`.
Personally verified all eight full compressed hashes and full decoded raw
hashes/sizes against their recovery indexes, and confirmed the raw paths absent.
This verifies the referenced bytes; eligibility, restore and recovery accounting
belong to the resource worker. Preserve its gzip files, indexes, restore helper,
proofs and dependencies; restore raw before any old consumer. No resource files
were changed by this task, and no broader cleanup was attempted.

All 23 parent seals and 88 existing original-media/CRT/current04-module pins
passed. Runtime sources match the reviewed parent freeze, including published
input guard 418099fe9. Reused the registered `lmarbles_108` route and corrected
small pointer helper; both syntax checks passed. Motion precedes a balanced
down/up pair, UP is in a separate control invocation in finally, and no replay
is automatic. The independent deadline supervisor is prepared but unstarted.
Retained exact Git SHA, relevant binary diff, untracked runtime patches and
owned helper patches. No source or media archive was created. No production
code changed; a build was not required or claimed.

No title/menu, hover label, selector state or puzzle board was observed in this
run. Puzzle 2 availability and Tutorial prerequisites remain UNKNOWN. No input,
state/configuration edit, clock manipulation or forced presentation occurred.
There is no native parent or watchdog to wait for; waits/EOF and independent UP
are N/A because no runtime or input began. Both messageboard watcher parents
were actually waited, each exit 124 from its bounded timeout. No child agents
or workers were launched. Box ID none, state NOT_CREATED, expiry null, stop
receipt N/A.

Concrete new blocker: the distinct eight-transcript recovery pool is exhausted
and still leaves capacity below the required floor. Next requires a different
authorized source of sustainable headroom, then an observed watchdog, native
title/menu, pointer motion and hover-label review before selector click,
selection-label review before Start, and fresh full-board/target/consequence
review for each legal move through earned CLEAR and next/tally.
